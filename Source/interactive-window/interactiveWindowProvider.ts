// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable, named } from "inversify";
import {
	commands,
	ConfigurationTarget,
	Event,
	EventEmitter,
	Memento,
	NotebookController,
	NotebookControllerAffinity,
	NotebookDocument,
	NotebookEditor,
	TabInputInteractiveWindow,
	TabInputNotebook,
	Uri,
	ViewColumn,
	window,
	workspace,
} from "vscode";

import { KernelConnectionMetadata } from "../kernels/types";
import { IVSCodeNotebookController } from "../notebooks/controllers/types";
import {
	IEmbedNotebookEditorProvider,
	INotebookEditorProvider,
} from "../notebooks/types";
import {
	InteractiveWindowView,
	JupyterNotebookView,
	JVSC_EXTENSION_ID,
	NotebookCellScheme,
	Telemetry,
} from "../platform/common/constants";
import { getDisplayPath } from "../platform/common/platform/fs-paths";
import { IFileSystem } from "../platform/common/platform/types";
import {
	GLOBAL_MEMENTO,
	IConfigurationService,
	IDisposableRegistry,
	IMemento,
	InteractiveWindowMode,
	Resource,
	WORKSPACE_MEMENTO,
} from "../platform/common/types";
import { createDeferred } from "../platform/common/utils/async";
import * as localize from "../platform/common/utils/localize";
import { noop } from "../platform/common/utils/misc";
import { IServiceContainer } from "../platform/ioc/types";
import { logger } from "../platform/logging";
import { IReplNotebookTrackerService } from "../platform/notebooks/replNotebookTrackerService";
import { sendTelemetryEvent } from "../telemetry";
import { getInteractiveWindowTitle } from "./identity";
import { InteractiveWindow } from "./interactiveWindow";
import { InteractiveControllerFactory } from "./InteractiveWindowController";
import { NotebookInteractiveWindow } from "./notebookInteractiveWindow";
import {
	IInteractiveControllerHelper,
	IInteractiveWindow,
	IInteractiveWindowCache,
	IInteractiveWindowProvider,
	INativeInteractiveWindow,
} from "./types";

// Export for testing
export const AskedForPerFileSettingKey = "ds_asked_per_file_interactive";

export const InteractiveWindowCacheKey = "ds_interactive_window_cache";

@injectable()
export class ReplNotebookTrackerService implements IReplNotebookTrackerService {
	private interactiveWindowProvider: IInteractiveWindowProvider | undefined;

	constructor(
		@inject(IServiceContainer) private serviceContainer: IServiceContainer,
	) {}

	isForReplEditor(notebook: NotebookDocument): boolean {
		if (!this.interactiveWindowProvider) {
			this.interactiveWindowProvider =
				this.serviceContainer.get<IInteractiveWindowProvider>(
					IInteractiveWindowProvider,
				);
		}

		return (
			this.interactiveWindowProvider.getInteractiveWindowWithNotebook(
				notebook.uri,
			) !== undefined
		);
	}
}

/**
 * Factory for InteractiveWindow
 */
@injectable()
export class InteractiveWindowProvider
	implements IInteractiveWindowProvider, IEmbedNotebookEditorProvider
{
	public get onDidChangeActiveInteractiveWindow(): Event<
		IInteractiveWindow | undefined
	> {
		return this._onDidChangeActiveInteractiveWindow.event;
	}

	// returns the active Editor if it is an Interactive Window that we are tracking
	public get activeWindow(): IInteractiveWindow | undefined {
		const notebookUri =
			window.activeNotebookEditor?.notebook.uri.toString();

		return notebookUri
			? this._windows.find(
					(win) => win.notebookUri?.toString() === notebookUri,
				)
			: undefined;
	}

	private readonly _onDidChangeActiveInteractiveWindow = new EventEmitter<
		IInteractiveWindow | undefined
	>();

	private lastActiveInteractiveWindow: IInteractiveWindow | undefined;

	private pendingCreations: Promise<void> | undefined;

	private _windows: InteractiveWindow[] = [];

	constructor(
		@inject(IServiceContainer) private serviceContainer: IServiceContainer,
		@inject(IDisposableRegistry) private disposables: IDisposableRegistry,
		@inject(IFileSystem) private readonly fs: IFileSystem,
		@inject(IConfigurationService)
		private readonly configService: IConfigurationService,
		@inject(IMemento)
		@named(GLOBAL_MEMENTO)
		private readonly globalMemento: Memento,
		@inject(IMemento)
		@named(WORKSPACE_MEMENTO)
		private workspaceMemento: Memento,
		@inject(INotebookEditorProvider)
		private readonly notebookEditorProvider: INotebookEditorProvider,
		@inject(IInteractiveControllerHelper)
		private readonly controllerHelper: IInteractiveControllerHelper,
	) {
		this.notebookEditorProvider.registerEmbedNotebookProvider(this);

		this.restoreWindows();
	}

	private restoreWindows() {
		// VS Code controls if interactive windows are restored.
		const interactiveWindowMapping = new Map<
			string,
			TabInputInteractiveWindow | TabInputNotebook
		>();

		window.tabGroups.all.forEach((group) => {
			group.tabs.forEach((tab) => {
				const input = tab.input;

				if (
					input instanceof TabInputInteractiveWindow ||
					input instanceof TabInputNotebook
				) {
					interactiveWindowMapping.set(input.uri.toString(), input);
				}
			});
		});

		this.workspaceMemento
			.get(InteractiveWindowCacheKey, [] as IInteractiveWindowCache[])
			.forEach((iw) => {
				if (
					!iw.uriString ||
					!interactiveWindowMapping.get(iw.uriString)
				) {
					return;
				}

				const tabInput = interactiveWindowMapping.get(iw.uriString);

				if (!tabInput) {
					return;
				}

				const mode = this.configService.getSettings(
					tabInput.uri,
				).interactiveWindowMode;

				const result =
					tabInput instanceof TabInputInteractiveWindow
						? new InteractiveWindow(
								this.serviceContainer,
								Uri.parse(iw.owner),
								new InteractiveControllerFactory(
									this.controllerHelper,
									mode,
								),
								tabInput,
								Uri.parse(iw.inputBoxUriString),
							)
						: new NotebookInteractiveWindow(
								this.serviceContainer,
								Uri.parse(iw.owner),
								new InteractiveControllerFactory(
									this.controllerHelper,
									mode,
								),
								tabInput,
								Uri.parse(iw.inputBoxUriString),
							);

				result.notifyConnectionReset().catch(noop);

				this._windows.push(result);

				sendTelemetryEvent(
					Telemetry.CreateInteractiveWindow,
					{ windowCount: this._windows.length },
					{
						hasKernel: false,
						hasOwner: !!iw.owner,
						mode: mode,
						restored: true,
					},
				);

				const handler = result.closed(
					this.onInteractiveWindowClosed.bind(this, result),
				);

				this.disposables.push(result);

				this.disposables.push(handler);

				this.disposables.push(
					result.onDidChangeViewState(
						this.raiseOnDidChangeActiveInteractiveWindow.bind(this),
					),
				);
			});

		this._updateWindowCache();
	}

	public async getOrCreate(
		resource: Resource,
		connection?: KernelConnectionMetadata,
	): Promise<IInteractiveWindow> {
		if (!workspace.isTrusted) {
			// This should not happen, but if it does, then just throw an error.
			// The commands the like should be disabled.
			throw new Error("Workspace not trusted");
		}
		// Ask for a configuration change if appropriate
		const mode = await this.getInteractiveMode(resource);

		// Ensure we wait for a previous creation to finish.
		if (this.pendingCreations) {
			await this.pendingCreations.catch(noop);
		}

		// See if we already have a match
		let result = this.getExisting(resource, mode, connection);

		if (!result) {
			// No match. Create a new item.
			result = await this.create(resource, mode, connection);
		}

		await result.ensureInitialized();

		return result;
	}

	/**
	 * Given a text document, return the associated interactive window if one exists.
	 * @param owner The URI of a text document which may be associated with an interactive window.
	 */
	public get(owner: Uri): IInteractiveWindow | undefined {
		const mode =
			this.configService.getSettings(owner).interactiveWindowMode;

		return this.getExisting(owner, mode);
	}

	private async create(
		resource: Resource,
		mode: InteractiveWindowMode,
		connection?: KernelConnectionMetadata,
	) {
		// track when a creation is pending, so consumers can wait before checking for an existing one.
		const creationInProgress = createDeferred<void>();
		// Ensure we don't end up calling this method multiple times when creating an IW for the same resource.
		this.pendingCreations = creationInProgress.promise;

		try {
			const useNotebookModel =
				this.configService.getSettings(
					resource,
				).interactiveReplNotebook;

			const viewType = useNotebookModel
				? JupyterNotebookView
				: InteractiveWindowView;

			let initialController =
				await this.controllerHelper.getInitialController(
					resource,
					viewType,
					connection,
				);

			logger.info(
				`Starting interactive window for resource '${getDisplayPath(
					resource,
				)}' with controller '${initialController?.id}'`,
			);

			const [inputUri, editor] = await this.createEditor(
				initialController,
				resource,
				mode,
				useNotebookModel,
			);

			if (initialController) {
				initialController.controller.updateNotebookAffinity(
					editor.notebook,
					NotebookControllerAffinity.Preferred,
				);
			}

			logger.debug(
				`Interactive Window Editor Created: ${editor.notebook.uri.toString()} with input box: ${inputUri.toString()}`,
			);

			const result = useNotebookModel
				? new NotebookInteractiveWindow(
						this.serviceContainer,
						resource,
						new InteractiveControllerFactory(
							this.controllerHelper,
							mode,
							initialController,
						),
						editor,
						inputUri,
					)
				: new InteractiveWindow(
						this.serviceContainer,
						resource,
						new InteractiveControllerFactory(
							this.controllerHelper,
							mode,
							initialController,
						),
						editor,
						inputUri,
					);

			this._windows.push(result);

			sendTelemetryEvent(
				Telemetry.CreateInteractiveWindow,
				{ windowCount: this._windows.length },
				{
					hasKernel: !!initialController,
					hasOwner: !!resource,
					mode: mode,
					restored: false,
				},
			);

			this._updateWindowCache();

			// This is the last interactive window at the moment (as we're about to create it)
			this.lastActiveInteractiveWindow = result;

			// When shutting down, we fire an event
			const handler = result.closed(
				this.onInteractiveWindowClosed.bind(this, result),
			);

			this.disposables.push(result);

			this.disposables.push(handler);

			this.disposables.push(
				result.onDidChangeViewState(
					this.raiseOnDidChangeActiveInteractiveWindow.bind(this),
				),
			);

			return result;
		} finally {
			creationInProgress.resolve();
		}
	}

	private async createEditor(
		preferredController: IVSCodeNotebookController | undefined,
		resource: Resource,
		mode: InteractiveWindowMode,
		withNotebookModel: boolean,
	): Promise<[Uri, NotebookEditor]> {
		const title =
			resource && mode === "perFile"
				? getInteractiveWindowTitle(resource)
				: undefined;

		const preserveFocus = resource !== undefined;

		const viewColumn = this.getInteractiveViewColumn(resource);

		if (withNotebookModel) {
			return this.createNotebookBackedEditor(
				viewColumn,
				preserveFocus,
				preferredController?.controller,
				title,
			);
		}

		const { inputUri, notebookEditor } = (await commands.executeCommand(
			"interactive.open",
			// Keep focus on the owning file if there is one
			{ viewColumn, preserveFocus },
			undefined,
			preferredController
				? `${JVSC_EXTENSION_ID}/${preferredController.id}`
				: undefined,
			title,
		)) as unknown as INativeInteractiveWindow;

		if (!notebookEditor) {
			// This means VS Code failed to create an interactive window.
			// This should never happen.
			throw new Error(
				"Failed to request creation of interactive window from VS Code.",
			);
		}

		return [inputUri, notebookEditor];
	}

	private async createNotebookBackedEditor(
		viewColumn: number,
		preserveFocus: boolean,
		controller: NotebookController | undefined,
		title?: string,
	): Promise<[Uri, NotebookEditor]> {
		title = title || "Interactive-1";

		const notebookDocument =
			await workspace.openNotebookDocument(JupyterNotebookView);

		const editor = await window.showNotebookDocument(notebookDocument, {
			// currently, to set the controller, we need to focus the editor
			preserveFocus: !!controller ? false : preserveFocus,
			viewColumn,
			asRepl: title,
		});

		if (!editor.replOptions) {
			throw new Error("Wrong type of editor created");
		}

		if (controller) {
			await commands.executeCommand("notebook.selectKernel", {
				editor,
				id: controller.id,
				extension: JVSC_EXTENSION_ID,
			});
		}

		const inputUri = notebookDocument.cellAt(editor.replOptions.appendIndex)
			.document.uri;

		return [inputUri, editor];
	}

	private getInteractiveViewColumn(resource: Resource): ViewColumn {
		if (resource) {
			return ViewColumn.Beside;
		}

		const setting =
			this.configService.getSettings(
				resource,
			).interactiveWindowViewColumn;

		if (setting === "secondGroup") {
			return ViewColumn.One;
		} else if (setting === "active") {
			return ViewColumn.Active;
		}

		return ViewColumn.Beside;
	}

	private async getInteractiveMode(
		resource: Resource,
	): Promise<InteractiveWindowMode> {
		let result =
			this.configService.getSettings(resource).interactiveWindowMode;

		// Ask user if still at default value and they're opening a second file.
		if (
			result === "multiple" &&
			resource &&
			!this.globalMemento.get(AskedForPerFileSettingKey) &&
			this._windows.length === 1 &&
			// Only prompt if the submitting file is different
			(!this._windows[0].owner ||
				!this.fs.arePathsSame(this._windows[0].owner, resource))
		) {
			// See if the first window was tied to a file or not.
			this.globalMemento
				.update(AskedForPerFileSettingKey, true)
				.then(noop, noop);

			const questions = [
				localize.DataScience.interactiveWindowModeBannerSwitchYes,
				localize.DataScience.interactiveWindowModeBannerSwitchNo,
			];
			// Ask user if they'd like to switch to per file or not.
			const response = await window.showInformationMessage(
				localize.DataScience.interactiveWindowModeBannerTitle,
				...questions,
			);

			if (response === questions[0]) {
				result = "perFile";

				this._windows[0].changeMode(result);

				await this.configService.updateSetting(
					"interactiveWindow.creationMode",
					result,
					resource,
					ConfigurationTarget.Global,
				);
			}
		}

		return result;
	}

	private _updateWindowCache() {
		const windowCache = this._windows.map(
			(iw) =>
				({
					owner: iw.owner?.toString(),
					uriString: iw.notebookUri.toString(),
					inputBoxUriString: iw.inputUri.toString(),
				}) as IInteractiveWindowCache,
		);

		this.workspaceMemento
			.update(InteractiveWindowCacheKey, windowCache)
			.then(noop, noop);
	}

	public getExisting(
		owner: Resource,
		interactiveMode: InteractiveWindowMode,
		connection?: KernelConnectionMetadata,
	): IInteractiveWindow | undefined {
		// Single mode means there's only ever one.
		if (interactiveMode === "single") {
			return this._windows.length > 0 ? this._windows[0] : undefined;
		}

		// Multiple means use last active window or create a new one
		// if not owned.
		if (interactiveMode === "multiple") {
			// Owner being undefined means create a new window, otherwise use
			// the last active window.
			return owner
				? this.activeWindow ||
						this.lastActiveInteractiveWindow ||
						this._windows[0]
				: undefined;
		}

		// Otherwise match the owner.
		return this._windows.find((w) => {
			if (!owner && !w.owner && !connection) {
				return true;
			}

			if (owner && w.owner && this.fs.arePathsSame(owner, w.owner)) {
				return (
					!connection ||
					w.kernelConnectionMetadata?.id === connection.id
				);
			}

			return false;
		});
	}

	// TODO: we don't currently have a way to know when the VS Code InteractiveEditor
	// view state changes. Requires API (interactive.open should return the InteractiveEditorPanel)
	private raiseOnDidChangeActiveInteractiveWindow() {
		// Update last active window (remember changes to the active window)
		this.lastActiveInteractiveWindow = this.activeWindow
			? this.activeWindow
			: this.lastActiveInteractiveWindow;

		this._onDidChangeActiveInteractiveWindow.fire(this.activeWindow);
	}

	private onInteractiveWindowClosed(interactiveWindow: IInteractiveWindow) {
		logger.debug(
			`Closing interactive window: ${interactiveWindow.notebookUri?.toString()}`,
		);

		interactiveWindow.dispose();

		this._windows = this._windows.filter((w) => w !== interactiveWindow);

		this._updateWindowCache();

		if (this.lastActiveInteractiveWindow === interactiveWindow) {
			this.lastActiveInteractiveWindow = this._windows[0];
		}

		this.raiseOnDidChangeActiveInteractiveWindow();
	}

	public getActiveOrAssociatedInteractiveWindow():
		| IInteractiveWindow
		| undefined {
		if (this.activeWindow) {
			return this.activeWindow;
		}

		if (window.activeTextEditor === undefined) {
			return;
		}

		const textDocumentUri = window.activeTextEditor.document.uri;

		if (textDocumentUri.scheme !== NotebookCellScheme) {
			return this.get(textDocumentUri);
		}
	}

	findNotebookEditor(resource: Resource): NotebookEditor | undefined {
		let notebook: NotebookDocument | undefined;

		if (resource && resource.path.endsWith(".interactive")) {
			notebook = this.get(resource)?.notebookDocument;
		} else {
			const mode =
				this.configService.getSettings(resource).interactiveWindowMode;

			notebook = this.getExisting(resource, mode)?.notebookDocument;
		}

		return notebook
			? window.visibleNotebookEditors.find(
					(editor) => editor.notebook === notebook,
				)
			: undefined;
	}

	findAssociatedNotebookDocument(uri: Uri): NotebookDocument | undefined {
		const interactiveWindow = this._windows.find(
			(w) => w.inputUri?.toString() === uri.toString(),
		);

		let notebook = interactiveWindow?.notebookDocument;

		return notebook;
	}

	getInteractiveWindowWithNotebook(notebookUri: Uri | undefined) {
		let targetInteractiveWindow;

		if (notebookUri !== undefined) {
			targetInteractiveWindow = this._windows.find(
				(w) => w.notebookUri?.toString() === notebookUri.toString(),
			);
		} else {
			targetInteractiveWindow =
				this.getActiveOrAssociatedInteractiveWindow();
		}

		return targetInteractiveWindow;
	}

	getInteractiveWindowsWithSubmitter(file: Uri): IInteractiveWindow[] {
		return this._windows.filter((w) =>
			w.submitters.find((s) => this.fs.arePathsSame(file, s)),
		);
	}
}
