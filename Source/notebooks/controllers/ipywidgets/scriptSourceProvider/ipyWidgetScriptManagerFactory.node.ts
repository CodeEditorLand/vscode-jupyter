// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable } from "inversify";

import { JupyterConnection } from "../../../../kernels/jupyter/connection/jupyterConnection";
import { JupyterPaths } from "../../../../kernels/raw/finder/jupyterPaths.node";
import { IKernel } from "../../../../kernels/types";
import { IFileSystemNode } from "../../../../platform/common/platform/types.node";
import {
	IDisposableRegistry,
	IExtensionContext,
} from "../../../../platform/common/types";
import {
	IIPyWidgetScriptManager,
	IIPyWidgetScriptManagerFactory,
	INbExtensionsPathProvider,
} from "../types";
import { LocalIPyWidgetScriptManager } from "./localIPyWidgetScriptManager.node";
import { RemoteIPyWidgetScriptManager } from "./remoteIPyWidgetScriptManager";

/**
 * Determines the IPyWidgetScriptManager for use in a node environment
 */
@injectable()
export class IPyWidgetScriptManagerFactory
	implements IIPyWidgetScriptManagerFactory
{
	private readonly managers = new WeakMap<IKernel, IIPyWidgetScriptManager>();

	constructor(
		@inject(INbExtensionsPathProvider)
		private readonly nbExtensionsPathProvider: INbExtensionsPathProvider,
		@inject(IFileSystemNode) private readonly fs: IFileSystemNode,
		@inject(IExtensionContext) private readonly context: IExtensionContext,
		@inject(JupyterPaths) private readonly jupyterPaths: JupyterPaths,
		@inject(IDisposableRegistry)
		private readonly disposables: IDisposableRegistry,
		@inject(JupyterConnection)
		private readonly connection: JupyterConnection,
	) {}

	getOrCreate(kernel: IKernel): IIPyWidgetScriptManager {
		if (!this.managers.has(kernel)) {
			if (
				kernel.kernelConnectionMetadata.kind ===
					"connectToLiveRemoteKernel" ||
				kernel.kernelConnectionMetadata.kind ===
					"startUsingRemoteKernelSpec"
			) {
				const scriptManager = new RemoteIPyWidgetScriptManager(
					kernel,
					this.context,
					this.fs,
					this.connection,
				);

				this.managers.set(kernel, scriptManager);

				kernel.onDisposed(
					() => scriptManager.dispose(),
					this,
					this.disposables,
				);
			} else {
				const scriptManager = new LocalIPyWidgetScriptManager(
					kernel,
					this.fs,
					this.nbExtensionsPathProvider,
					this.context,
					this.jupyterPaths,
				);

				this.managers.set(kernel, scriptManager);

				kernel.onDisposed(
					() => scriptManager.dispose(),
					this,
					this.disposables,
				);
			}
		}

		return this.managers.get(kernel)!;
	}
}
