// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IExtensionSyncActivationService } from "../../../platform/activation/types";
import { IServiceManager } from "../../../platform/ioc/types";
import { IPyWidgetMessageDispatcherFactory } from "./message/ipyWidgetMessageDispatcherFactory";
import { RendererVersionChecker } from "./rendererVersionChecker";
import { CDNWidgetScriptSourceProvider } from "./scriptSourceProvider/cdnWidgetScriptSourceProvider";
import { IPyWidgetScriptManagerFactory } from "./scriptSourceProvider/ipyWidgetScriptManagerFactory.web";
import { NbExtensionsPathProvider } from "./scriptSourceProvider/nbExtensionsPathProvider.web";
import { ScriptSourceProviderFactory } from "./scriptSourceProvider/scriptSourceProviderFactory.web";
import {
	IIPyWidgetScriptManagerFactory,
	INbExtensionsPathProvider,
	IWidgetScriptSourceProviderFactory,
} from "./types";

export function registerTypes(
	serviceManager: IServiceManager,
	_isDevMode: boolean,
) {
	serviceManager.addSingleton<IPyWidgetMessageDispatcherFactory>(
		IPyWidgetMessageDispatcherFactory,
		IPyWidgetMessageDispatcherFactory,
	);
	serviceManager.addSingleton(
		IWidgetScriptSourceProviderFactory,
		ScriptSourceProviderFactory,
	);
	serviceManager.addSingleton(
		IIPyWidgetScriptManagerFactory,
		IPyWidgetScriptManagerFactory,
	);
	serviceManager.addSingleton(
		INbExtensionsPathProvider,
		NbExtensionsPathProvider,
	);
	serviceManager.addSingleton(
		CDNWidgetScriptSourceProvider,
		CDNWidgetScriptSourceProvider,
	);
	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		RendererVersionChecker,
	);
}
