// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable, optional } from "inversify";
import {
	NotebookDocument,
	NotebookEditor,
	TextEditor,
	window,
	workspace,
} from "vscode";

import {
	IInteractiveWindow,
	IInteractiveWindowProvider,
} from "../../interactive-window/types";
import { isPythonNotebook } from "../../kernels/helpers";
import { IJupyterServerProviderRegistry } from "../../kernels/jupyter/types";
import {
	IKernel,
	IKernelProvider,
	isRemoteConnection,
} from "../../kernels/types";
import { IControllerRegistration } from "../../notebooks/controllers/types";
import { IExtensionSyncActivationService } from "../../platform/activation/types";
import {
	EditorContexts,
	InteractiveWindowView,
	JupyterNotebookView,
	PYTHON_LANGUAGE,
} from "../../platform/common/constants";
import { ContextKey } from "../../platform/common/contextKey";
import { IDisposable, IDisposableRegistry } from "../../platform/common/types";
import {
	getNotebookMetadata,
	isJupyterNotebook,
} from "../../platform/common/utils";
import { isNotebookCell, noop } from "../../platform/common/utils/misc";

/**
 * Tracks a lot of the context keys needed in the extension.
 */
@injectable()
export class ActiveEditorContextService
	implements IExtensionSyncActivationService, IDisposable
{
	private readonly disposables: IDisposable[] = [];

	private nativeContext: ContextKey;

	private interactiveContext: ContextKey;

	private interactiveOrNativeContext: ContextKey;

	private pythonOrInteractiveContext: ContextKey;

	private pythonOrNativeContext: ContextKey;

	private pythonOrInteractiveOrNativeContext: ContextKey;

	private canRestartNotebookKernelContext: ContextKey;

	private canInterruptNotebookKernelContext: ContextKey;

	private canRestartInteractiveWindowKernelContext: ContextKey;

	private canInterruptInteractiveWindowKernelContext: ContextKey;

	private hasNativeNotebookCells: ContextKey;

	private isPythonFileActive: boolean = false;

	private isPythonNotebook: ContextKey;

	private isJupyterKernelSelected: ContextKey;

	private hasNativeNotebookOrInteractiveWindowOpen: ContextKey;

	private kernelSourceContext: ContextKey<string>;

	constructor(
		@inject(IInteractiveWindowProvider)
		@optional()
		private readonly interactiveProvider:
			| IInteractiveWindowProvider
			| undefined,
		@inject(IDisposableRegistry) disposables: IDisposableRegistry,
		@inject(IKernelProvider)
		private readonly kernelProvider: IKernelProvider,
		@inject(IControllerRegistration)
		private readonly controllers: IControllerRegistration,
		@inject(IJupyterServerProviderRegistry)
		private readonly jupyterUriProviderRegistration: IJupyterServerProviderRegistry,
	) {
		disposables.push(this);

		this.nativeContext = new ContextKey(EditorContexts.IsNativeActive);

		this.canRestartNotebookKernelContext = new ContextKey(
			EditorContexts.CanRestartNotebookKernel,
		);

		this.canInterruptNotebookKernelContext = new ContextKey(
			EditorContexts.CanInterruptNotebookKernel,
		);

		this.canRestartInteractiveWindowKernelContext = new ContextKey(
			EditorContexts.CanRestartInteractiveWindowKernel,
		);

		this.canInterruptInteractiveWindowKernelContext = new ContextKey(
			EditorContexts.CanInterruptInteractiveWindowKernel,
		);

		this.interactiveContext = new ContextKey(
			EditorContexts.IsInteractiveActive,
		);

		this.interactiveOrNativeContext = new ContextKey(
			EditorContexts.IsInteractiveOrNativeActive,
		);

		this.pythonOrNativeContext = new ContextKey(
			EditorContexts.IsPythonOrNativeActive,
		);

		this.pythonOrInteractiveContext = new ContextKey(
			EditorContexts.IsPythonOrInteractiveActive,
		);

		this.pythonOrInteractiveOrNativeContext = new ContextKey(
			EditorContexts.IsPythonOrInteractiveOrNativeActive,
		);

		this.hasNativeNotebookCells = new ContextKey(
			EditorContexts.HaveNativeCells,
		);

		this.isPythonNotebook = new ContextKey(EditorContexts.IsPythonNotebook);

		this.isJupyterKernelSelected = new ContextKey(
			EditorContexts.IsJupyterKernelSelected,
		);

		this.hasNativeNotebookOrInteractiveWindowOpen = new ContextKey(
			EditorContexts.HasNativeNotebookOrInteractiveWindowOpen,
		);

		this.kernelSourceContext = new ContextKey(EditorContexts.KernelSource);
	}

	public dispose() {
		this.disposables.forEach((item) => item.dispose());
	}

	public activate() {
		window.onDidChangeActiveTextEditor(
			this.onDidChangeActiveTextEditor,
			this,
			this.disposables,
		);

		this.kernelProvider.onKernelStatusChanged(
			this.onDidKernelStatusChange,
			this,
			this.disposables,
		);
		// Interactive provider might not be available
		if (this.interactiveProvider) {
			this.interactiveProvider.onDidChangeActiveInteractiveWindow(
				this.onDidChangeActiveInteractiveWindow,
				this,
				this.disposables,
			);

			if (this.interactiveProvider.activeWindow) {
				this.onDidChangeActiveInteractiveWindow();
			}
		}

		if (window.activeNotebookEditor) {
			this.onDidChangeActiveNotebookEditor(window.activeNotebookEditor);
		}

		window.onDidChangeActiveNotebookEditor(
			this.onDidChangeActiveNotebookEditor,
			this,
			this.disposables,
		);

		// Do we already have python file opened.
		if (window.activeTextEditor?.document.languageId === PYTHON_LANGUAGE) {
			this.onDidChangeActiveTextEditor(window.activeTextEditor);
		}

		workspace.onDidCloseNotebookDocument(
			this.updateNativeNotebookInteractiveWindowOpenContext,
			this,
			this.disposables,
		);

		this.controllers.onControllerSelectionChanged(
			() => this.updateSelectedKernelContext(),
			this,
			this.disposables,
		);

		this.updateSelectedKernelContext();
	}

	private updateNativeNotebookCellContext() {
		// Separate for debugging.
		const hasNativeCells =
			(window.activeNotebookEditor?.notebook.cellCount || 0) > 0;

		this.hasNativeNotebookCells.set(hasNativeCells).catch(noop);
	}

	private onDidChangeActiveInteractiveWindow(e?: IInteractiveWindow) {
		this.interactiveContext.set(!!e).catch(noop);

		this.updateMergedContexts();

		this.updateContextOfActiveInteractiveWindowKernel();
	}

	private onDidChangeActiveNotebookEditor(e?: NotebookEditor) {
		const isJupyterNotebookDoc = e
			? e.notebook.notebookType === JupyterNotebookView
			: false;

		this.nativeContext.set(isJupyterNotebookDoc).catch(noop);

		this.isPythonNotebook
			.set(
				e && isJupyterNotebookDoc
					? isPythonNotebook(getNotebookMetadata(e.notebook))
					: false,
			)
			.catch(noop);

		this.updateContextOfActiveNotebookKernel(e);

		this.updateContextOfActiveInteractiveWindowKernel();

		this.updateNativeNotebookCellContext();

		this.updateMergedContexts();
	}

	private ownedOpenNotebooks = new Set<NotebookDocument>();

	private updateNativeNotebookInteractiveWindowOpenContext(
		e: NotebookDocument,
		jupyterKernelSelected?: boolean,
	) {
		if (jupyterKernelSelected) {
			this.ownedOpenNotebooks.add(e);
		} else {
			this.ownedOpenNotebooks.delete(e);
		}

		this.hasNativeNotebookOrInteractiveWindowOpen
			.set(this.ownedOpenNotebooks.size > 0)
			.catch(noop);
	}

	private updateContextOfActiveNotebookKernel(activeEditor?: NotebookEditor) {
		const kernel =
			activeEditor &&
			activeEditor.notebook.notebookType === JupyterNotebookView
				? this.kernelProvider.get(activeEditor.notebook)
				: undefined;

		if (kernel) {
			const executionService =
				this.kernelProvider.getKernelExecution(kernel);

			const canStart =
				kernel.status !== "unknown" ||
				executionService.executionCount > 0 ||
				kernel.startedAtLeastOnce;

			this.canRestartNotebookKernelContext.set(!!canStart).catch(noop);

			const canInterrupt = kernel.status === "busy";

			this.canInterruptNotebookKernelContext
				.set(!!canInterrupt)
				.catch(noop);
		} else {
			this.canRestartNotebookKernelContext.set(false).catch(noop);

			this.canInterruptNotebookKernelContext.set(false).catch(noop);
		}

		this.updateKernelSourceContext(kernel).catch(noop);

		this.updateSelectedKernelContext();
	}

	private async updateKernelSourceContext(kernel: IKernel | undefined) {
		if (!kernel || !isRemoteConnection(kernel.kernelConnectionMetadata)) {
			this.kernelSourceContext.set("").catch(noop);

			return;
		}

		const connection = kernel.kernelConnectionMetadata;

		const provider =
			await this.jupyterUriProviderRegistration.jupyterCollections.find(
				(c) =>
					c.extensionId ===
						connection.serverProviderHandle.extensionId &&
					c.id === connection.serverProviderHandle.id,
			);

		if (!provider) {
			this.kernelSourceContext.set("").catch(noop);

			return;
		}

		this.kernelSourceContext.set(provider.id).catch(noop);
	}

	private updateSelectedKernelContext() {
		const document =
			window.activeNotebookEditor?.notebook ||
			this.interactiveProvider?.getActiveOrAssociatedInteractiveWindow()
				?.notebookDocument;

		if (
			document &&
			isJupyterNotebook(document) &&
			this.controllers.getSelected(document)
		) {
			this.isJupyterKernelSelected.set(true).catch(noop);

			this.updateNativeNotebookInteractiveWindowOpenContext(
				document,
				true,
			);
		} else {
			this.isJupyterKernelSelected.set(false).catch(noop);
		}
	}

	private updateContextOfActiveInteractiveWindowKernel() {
		const notebook =
			this.interactiveProvider?.getActiveOrAssociatedInteractiveWindow()
				?.notebookDocument;

		const kernel = notebook ? this.kernelProvider.get(notebook) : undefined;

		if (kernel) {
			const canStart = kernel.status !== "unknown";

			this.canRestartInteractiveWindowKernelContext
				.set(!!canStart)
				.catch(noop);

			const canInterrupt = kernel.status === "busy";

			this.canInterruptInteractiveWindowKernelContext
				.set(!!canInterrupt)
				.catch(noop);
		} else {
			this.canRestartInteractiveWindowKernelContext
				.set(false)
				.catch(noop);

			this.canInterruptInteractiveWindowKernelContext
				.set(false)
				.catch(noop);
		}

		this.updateSelectedKernelContext();
	}

	private onDidKernelStatusChange({ kernel }: { kernel: IKernel }) {
		const notebook = kernel.notebook;

		if (notebook.notebookType === InteractiveWindowView) {
			this.updateContextOfActiveInteractiveWindowKernel();
		} else if (
			notebook.notebookType === JupyterNotebookView &&
			notebook === window.activeNotebookEditor?.notebook
		) {
			this.updateContextOfActiveNotebookKernel(
				window.activeNotebookEditor,
			);
		}
	}

	private onDidChangeActiveTextEditor(e?: TextEditor) {
		this.isPythonFileActive =
			e?.document.languageId === PYTHON_LANGUAGE &&
			!isNotebookCell(e.document.uri);

		this.updateNativeNotebookCellContext();

		this.updateMergedContexts();

		this.updateContextOfActiveInteractiveWindowKernel();
	}

	private updateMergedContexts() {
		this.interactiveOrNativeContext
			.set(
				this.nativeContext.value === true ||
					this.interactiveContext.value === true,
			)
			.catch(noop);

		this.pythonOrNativeContext
			.set(
				this.nativeContext.value === true ||
					this.isPythonFileActive === true,
			)
			.catch(noop);

		this.pythonOrInteractiveContext
			.set(
				this.interactiveContext.value === true ||
					this.isPythonFileActive === true,
			)
			.catch(noop);

		this.pythonOrInteractiveOrNativeContext
			.set(
				this.nativeContext.value === true ||
					(this.interactiveContext.value === true &&
						this.isPythonFileActive === true),
			)
			.catch(noop);
	}
}
