// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable } from "inversify";
import { CancellationTokenSource } from "vscode";

import { logger } from "../../../platform/logging";
import { LiveRemoteKernelConnectionMetadata } from "../../types";
import {
	IJupyterRemoteCachedKernelValidator,
	IJupyterServerProviderRegistry,
	ILiveRemoteKernelConnectionUsageTracker,
} from "../types";

/**
 * Used to verify remote jupyter connections from 3rd party URIs are still valid.
 */
@injectable()
export class JupyterRemoteCachedKernelValidator
	implements IJupyterRemoteCachedKernelValidator
{
	constructor(
		@inject(ILiveRemoteKernelConnectionUsageTracker)
		private readonly liveKernelConnectionTracker: ILiveRemoteKernelConnectionUsageTracker,

		@inject(IJupyterServerProviderRegistry)
		private readonly providerRegistration: IJupyterServerProviderRegistry,
	) {}

	public async isValid(
		kernel: LiveRemoteKernelConnectionMetadata,
	): Promise<boolean> {
		// Only list live kernels that was used by the user,
		if (!this.liveKernelConnectionTracker.wasKernelUsed(kernel)) {
			return false;
		}

		const collection =
			await this.providerRegistration.jupyterCollections.find(
				(c) =>
					c.extensionId === kernel.serverProviderHandle.extensionId &&
					c.id === kernel.serverProviderHandle.id,
			);

		if (!collection) {
			logger.warn(
				`Extension ${kernel.serverProviderHandle.extensionId} may have been uninstalled for provider ${kernel.serverProviderHandle.id}, handle ${kernel.serverProviderHandle.handle}`,
			);

			return false;
		}

		const token = new CancellationTokenSource();

		try {
			const servers = await Promise.resolve(
				collection.serverProvider.provideJupyterServers(token.token),
			);

			if (!servers) {
				return false;
			}

			if (
				servers
					.map((s) => s.id)
					.includes(kernel.serverProviderHandle.handle)
			) {
				return true;
			} else {
				logger.warn(
					`Hiding remote kernel ${kernel.id} for ${collection.id} as the remote Jupyter Server ${kernel.serverProviderHandle.extensionId}:${kernel.serverProviderHandle.id}:${kernel.serverProviderHandle.handle} is no longer available`,
				);
				// 3rd party extensions own these kernels, if these are no longer
				// available, then just don't display them.
				return false;
			}
		} catch (ex) {
			logger.warn(
				`Failed to fetch remote servers from ${kernel.serverProviderHandle.extensionId}:${kernel.serverProviderHandle.id}`,
				ex,
			);

			return false;
		} finally {
			token.dispose();
		}
	}
}
