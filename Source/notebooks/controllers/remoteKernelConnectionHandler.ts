// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable } from "inversify";
import { NotebookDocument } from "vscode";

import { PreferredRemoteKernelIdProvider } from "../../kernels/jupyter/connection/preferredRemoteKernelIdProvider";
import { ILiveRemoteKernelConnectionUsageTracker } from "../../kernels/jupyter/types";
import {
	IKernel,
	IKernelProvider,
	isLocalConnection,
} from "../../kernels/types";
import { IExtensionSyncActivationService } from "../../platform/activation/types";
import { IDisposableRegistry } from "../../platform/common/types";
import { noop } from "../../platform/common/utils/misc";
import { logger } from "../../platform/logging";
import { IControllerRegistration, IVSCodeNotebookController } from "./types";

/**
 * Tracks the remote kernel in use for a notebook (updates the live kernel information)
 */
@injectable()
export class RemoteKernelConnectionHandler
	implements IExtensionSyncActivationService
{
	constructor(
		@inject(IDisposableRegistry)
		private readonly disposables: IDisposableRegistry,
		@inject(IKernelProvider)
		private readonly kernelProvider: IKernelProvider,
		@inject(IControllerRegistration)
		private readonly controllers: IControllerRegistration,
		@inject(ILiveRemoteKernelConnectionUsageTracker)
		private readonly liveKernelTracker: ILiveRemoteKernelConnectionUsageTracker,
		@inject(PreferredRemoteKernelIdProvider)
		private readonly preferredRemoteKernelIdProvider: PreferredRemoteKernelIdProvider,
	) {}

	activate(): void {
		this.kernelProvider.onDidStartKernel(
			this.onDidStartKernel,
			this,
			this.disposables,
		);

		this.controllers.onControllerSelectionChanged(
			this.onNotebookControllerSelectionChanged,
			this,
			this.disposables,
		);
	}

	private onNotebookControllerSelectionChanged({
		selected,
		notebook,
		controller,
	}: {
		selected: boolean;

		notebook: NotebookDocument;

		controller: IVSCodeNotebookController;
	}) {
		if (notebook.isClosed) {
			return;
		}

		if (
			controller.connection.kind === "connectToLiveRemoteKernel" &&
			controller.connection.kernelModel.id
		) {
			if (selected) {
				this.liveKernelTracker.trackKernelIdAsUsed(
					notebook.uri,
					controller.connection.serverProviderHandle,
					controller.connection.kernelModel.id,
				);
			} else {
				this.liveKernelTracker.trackKernelIdAsNotUsed(
					notebook.uri,
					controller.connection.serverProviderHandle,
					controller.connection.kernelModel.id,
				);
			}
		}

		if (isLocalConnection(controller.connection)) {
			this.preferredRemoteKernelIdProvider
				.clearPreferredRemoteKernelId(notebook.uri)
				.catch(noop);
		}
	}

	private onDidStartKernel(kernel: IKernel) {
		if (!kernel.resourceUri) {
			return;
		}

		const resource = kernel.resourceUri;

		if (
			kernel.kernelConnectionMetadata.kind !==
			"startUsingRemoteKernelSpec"
		) {
			return;
		}

		const serverId = kernel.kernelConnectionMetadata.serverProviderHandle;

		const storeKernelInfo = () => {
			const kernelId = kernel.session?.kernel?.id;

			if (!kernel.disposed && !kernel.disposing && kernelId) {
				logger.debug(
					`Updating preferred kernel for remote notebook ${kernelId}`,
				);

				this.preferredRemoteKernelIdProvider
					.storePreferredRemoteKernelId(resource, kernelId)
					.catch(noop);

				this.liveKernelTracker.trackKernelIdAsUsed(
					resource,
					serverId,
					kernelId,
				);
			}
		};

		storeKernelInfo();

		kernel.onDidKernelSocketChange(storeKernelInfo, this, this.disposables);
	}
}
