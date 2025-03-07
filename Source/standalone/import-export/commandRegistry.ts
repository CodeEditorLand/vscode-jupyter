// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable, optional } from "inversify";
import { workspace } from "vscode";

import { IInteractiveWindowProvider } from "../../interactive-window/types";
import { JupyterConnection } from "../../kernels/jupyter/connection/jupyterConnection";
import { IKernelFinder } from "../../kernels/types";
import { PreferredKernelConnectionService } from "../../notebooks/controllers/preferredKernelConnectionService";
import { IControllerRegistration } from "../../notebooks/controllers/types";
import { IFileConverter } from "../../notebooks/export/types";
import { IExtensionSyncActivationService } from "../../platform/activation/types";
import { IFileSystem } from "../../platform/common/platform/types";
import { IDisposableRegistry } from "../../platform/common/types";
import { ExportCommands } from "./exportCommands";

/**
 * Registers the export commands if in a trusted workspace.
 */
@injectable()
export class CommandRegistry implements IExtensionSyncActivationService {
	private exportCommand?: ExportCommands;

	constructor(
		@inject(IDisposableRegistry)
		private readonly disposables: IDisposableRegistry,
		@inject(IFileConverter) private fileConverter: IFileConverter,
		@inject(IFileSystem) private readonly fs: IFileSystem,
		@inject(IInteractiveWindowProvider)
		@optional()
		private readonly interactiveProvider:
			| IInteractiveWindowProvider
			| undefined,
		@inject(IControllerRegistration)
		readonly controllerSelection: IControllerRegistration,
		@inject(IKernelFinder) readonly kernelFinder: IKernelFinder,
		@inject(JupyterConnection)
		readonly jupyterConnection: JupyterConnection,
	) {
		this.exportCommand = new ExportCommands(
			this.fileConverter,
			this.fs,
			this.interactiveProvider,
			controllerSelection,
			new PreferredKernelConnectionService(jupyterConnection),
			kernelFinder,
		);

		if (!workspace.isTrusted) {
			workspace.onDidGrantWorkspaceTrust(
				this.registerCommandsIfTrusted,
				this,
				this.disposables,
			);
		}
	}

	activate() {
		this.registerCommandsIfTrusted();
	}

	private registerCommandsIfTrusted() {
		if (!workspace.isTrusted) {
			return;
		}

		this.exportCommand?.register();
	}
}
