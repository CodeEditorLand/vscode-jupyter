// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable, named } from "inversify";
import { Memento } from "vscode";
import { IKernel } from "../../../../kernels/types";
import {
	GLOBAL_MEMENTO,
	IConfigurationService,
	IMemento,
} from "../../../../platform/common/types";
import {
	IIPyWidgetScriptManagerFactory,
	ILocalResourceUriConverter,
	IWidgetScriptSourceProvider,
	IWidgetScriptSourceProviderFactory,
} from "../types";
import { CDNWidgetScriptSourceProvider } from "./cdnWidgetScriptSourceProvider";
import { LocalWidgetScriptSourceProvider } from "./localWidgetScriptSourceProvider.node";
import { RemoteWidgetScriptSourceProvider } from "./remoteWidgetScriptSourceProvider";

/**
 * Returns the IWidgetScriptSourceProvider for use in a node environment
 */
@injectable()
export class ScriptSourceProviderFactory
	implements IWidgetScriptSourceProviderFactory
{
	constructor(
		@inject(IConfigurationService)
		private readonly configurationSettings: IConfigurationService,
		@inject(IIPyWidgetScriptManagerFactory)
		private readonly widgetScriptManagerFactory: IIPyWidgetScriptManagerFactory,
		@inject(IMemento)
		@named(GLOBAL_MEMENTO)
		private readonly globalMemento: Memento
	) {}

	public getProviders(
		kernel: IKernel,
		uriConverter: ILocalResourceUriConverter,
	) {
		const scriptProviders: IWidgetScriptSourceProvider[] = [];

		// Give preference to CDN.
		scriptProviders.push(
			new CDNWidgetScriptSourceProvider(
				this.globalMemento,
				this.configurationSettings,
			),
		);
		switch (kernel.kernelConnectionMetadata.kind) {
			case "connectToLiveRemoteKernel":
			case "startUsingRemoteKernelSpec": {
				scriptProviders.push(
					new RemoteWidgetScriptSourceProvider(
						kernel,
						this.widgetScriptManagerFactory,
					),
				);
				break;
			}

			default:
				scriptProviders.push(
					new LocalWidgetScriptSourceProvider(
						kernel,
						uriConverter,
						this.widgetScriptManagerFactory,
					),
				);
		}

		return scriptProviders;
	}
}
