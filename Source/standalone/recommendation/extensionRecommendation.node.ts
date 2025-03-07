// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable, named } from "inversify";
import {
	commands,
	extensions,
	Memento,
	NotebookDocument,
	window,
	workspace,
} from "vscode";

import {
	getKernelConnectionLanguage,
	getLanguageInNotebookMetadata,
	isPythonKernelConnection,
} from "../../kernels/helpers";
import {
	IControllerRegistration,
	IVSCodeNotebookController,
} from "../../notebooks/controllers/types";
import { IExtensionSyncActivationService } from "../../platform/activation/types";
import { Telemetry } from "../../platform/common/constants";
import {
	GLOBAL_MEMENTO,
	IDisposable,
	IDisposableRegistry,
	IMemento,
} from "../../platform/common/types";
import {
	getNotebookMetadata,
	isJupyterNotebook,
} from "../../platform/common/utils";
import { dispose } from "../../platform/common/utils/lifecycle";
import { Common, DataScience } from "../../platform/common/utils/localize";
import { noop } from "../../platform/common/utils/misc";
import { sendTelemetryEvent } from "../../telemetry";

const mementoKeyToNeverPromptExtensionAgain =
	"JVSC_NEVER_PROMPT_EXTENSIONS_LIST";

const knownExtensionsToRecommend = new Map<
	string,
	{ displayName: string; extensionLink: string }
>([
	[
		"ms-dotnettools.dotnet-interactive-vscode",
		{
			displayName: ".NET Interactive Notebooks Preview",
			extensionLink:
				"https://marketplace.visualstudio.com/items?itemName=ms-dotnettools.dotnet-interactive-vscode",
		},
	],
]);

const extensionsThatSupportJupyterKernelLanguages = new Map<string, string>([
	["c#", "ms-dotnettools.dotnet-interactive-vscode"],
	["csharp", "ms-dotnettools.dotnet-interactive-vscode"],
	["f#", "ms-dotnettools.dotnet-interactive-vscode"],
	["fsharp", "ms-dotnettools.dotnet-interactive-vscode"],
	["powershell", "ms-dotnettools.dotnet-interactive-vscode"],
]);

/**
 * Responsible for showing UI to recommend .NET Interactive Notebooks when the user picks a .NET language
 */
@injectable()
export class ExtensionRecommendationService
	implements IExtensionSyncActivationService, IDisposable
{
	private readonly disposables: IDisposable[] = [];

	private recommendedInSession = new Set<string>();

	constructor(
		@inject(IControllerRegistration)
		private readonly controllerManager: IControllerRegistration,
		@inject(IDisposableRegistry) disposables: IDisposableRegistry,
		@inject(IMemento)
		@named(GLOBAL_MEMENTO)
		private readonly globalMemento: Memento,
	) {
		disposables.push(this);
	}

	public dispose() {
		dispose(this.disposables);
	}

	public activate() {
		workspace.onDidOpenNotebookDocument(
			this.onDidOpenNotebookDocument,
			this,
			this.disposables,
		);

		this.controllerManager.onControllerSelected(
			this.onNotebookControllerSelected,
			this,
			this.disposables,
		);
	}

	private onDidOpenNotebookDocument(notebook: NotebookDocument) {
		if (!isJupyterNotebook(notebook)) {
			return;
		}

		const language = getLanguageInNotebookMetadata(
			getNotebookMetadata(notebook),
		);

		if (language) {
			this.recommendExtensionForLanguage(language).catch(noop);
		}
	}

	private onNotebookControllerSelected({
		controller,
	}: {
		controller: IVSCodeNotebookController;
	}) {
		if (
			controller.connection.kind !== "startUsingLocalKernelSpec" &&
			controller.connection.kind !== "startUsingRemoteKernelSpec"
		) {
			return;
		}

		if (isPythonKernelConnection(controller.connection)) {
			return;
		}

		const language = getKernelConnectionLanguage(controller.connection);

		if (language) {
			this.recommendExtensionForLanguage(language).catch(noop);
		}
	}

	private async recommendExtensionForLanguage(language: string) {
		const extensionId = extensionsThatSupportJupyterKernelLanguages.get(
			language.toLowerCase(),
		);

		if (!extensionId || extensions.getExtension(extensionId)) {
			return;
		}

		const extensionInfo = knownExtensionsToRecommend.get(extensionId);

		if (!extensionInfo) {
			return;
		}

		if (
			this.globalMemento
				.get<string[]>(mementoKeyToNeverPromptExtensionAgain, [])
				.includes(extensionId) ||
			this.recommendedInSession.has(extensionId)
		) {
			return;
		}

		this.recommendedInSession.add(extensionId);

		const message = DataScience.recommendExtensionForNotebookLanguage(
			`[${extensionInfo.displayName}](${extensionInfo.extensionLink})`,
			language,
		);

		sendTelemetryEvent(Telemetry.RecommendExtension, undefined, {
			extensionId,
			action: "displayed",
		});

		const selection = await window.showInformationMessage(
			message,
			Common.bannerLabelYes,
			Common.bannerLabelNo,
			Common.doNotShowAgain,
		);

		switch (selection) {
			case Common.bannerLabelYes: {
				sendTelemetryEvent(Telemetry.RecommendExtension, undefined, {
					extensionId,
					action: "ok",
				});

				commands
					.executeCommand("extension.open", extensionId)
					.then(noop, noop);

				break;
			}

			case Common.bannerLabelNo: {
				sendTelemetryEvent(Telemetry.RecommendExtension, undefined, {
					extensionId,
					action: "cancel",
				});

				break;
			}

			case Common.doNotShowAgain: {
				sendTelemetryEvent(Telemetry.RecommendExtension, undefined, {
					extensionId,
					action: "doNotShowAgain",
				});

				const list = this.globalMemento.get<string[]>(
					mementoKeyToNeverPromptExtensionAgain,
					[],
				);

				if (!list.includes(extensionId)) {
					list.push(extensionId);

					await this.globalMemento.update(
						mementoKeyToNeverPromptExtensionAgain,
						list,
					);
				}

				break;
			}

			default:
				sendTelemetryEvent(Telemetry.RecommendExtension, undefined, {
					extensionId,
					action: "dismissed",
				});
		}
	}
}
