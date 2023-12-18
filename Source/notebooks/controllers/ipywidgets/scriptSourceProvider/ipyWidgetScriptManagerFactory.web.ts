// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable } from "inversify";
import { IKernel } from "../../../../kernels/types";
import { IFileSystem } from "../../../../platform/common/platform/types";
import {
	IDisposableRegistry,
	IExtensionContext,
} from "../../../../platform/common/types";
import {
	IIPyWidgetScriptManager,
	IIPyWidgetScriptManagerFactory,
} from "../types";
import { RemoteIPyWidgetScriptManager } from "./remoteIPyWidgetScriptManager";

/**
 * Determines the IPyWidgetScriptManager for use in a web environment
 */
@injectable()
export class IPyWidgetScriptManagerFactory
	implements IIPyWidgetScriptManagerFactory
{
	private readonly managers = new WeakMap<IKernel, IIPyWidgetScriptManager>();
	constructor(
		@inject(IExtensionContext) private readonly context: IExtensionContext,
		@inject(IFileSystem) private readonly fs: IFileSystem,
		@inject(IDisposableRegistry)
		private readonly disposables: IDisposableRegistry
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
				);
				this.managers.set(kernel, scriptManager);
				kernel.onDisposed(
					() => scriptManager.dispose(),
					this,
					this.disposables,
				);
			} else {
				throw new Error(
					"Cannot enumerate Widget Scripts using local kernels on the Web",
				);
			}
		}
		return this.managers.get(kernel)!;
	}
}
