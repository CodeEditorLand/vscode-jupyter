// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IServiceManager } from "../platform/ioc/types";
import { IExtensionSyncActivationService } from "./activation/types";
import { registerTypes as registerApiTypes } from "./api/serviceRegistry.node";
import {
	IWebviewPanelProvider,
	IWebviewViewProvider,
	IWorkspaceService,
} from "./common/application/types";
import { WorkspaceService } from "./common/application/workspace.node";
import { ConfigurationService } from "./common/configuration/service.node";
import { DataScienceStartupTime } from "./common/constants";
import { FileSystem } from "./common/platform/fileSystem.node";
import { IFileSystem } from "./common/platform/types";
import { IFileSystemNode } from "./common/platform/types.node";
import { registerTypes as registerCommonTypes } from "./common/serviceRegistry.node";
import {
	IConfigurationService,
	IDataScienceCommandListener,
} from "./common/types";
import { registerTypes as registerInterpreterTypes } from "./interpreter/serviceRegistry.node";
import { OutputCommandListener } from "./logging/outputCommandListener";
import { KernelProgressReporter } from "./progress/kernelProgressReporter";
import { ProgressReporter } from "./progress/progressReporter";
import { registerTypes as registerTerminalTypes } from "./terminals/serviceRegistry.node";
import { WebviewPanelProvider } from "./webviews/webviewPanelProvider";
import { WebviewViewProvider } from "./webviews/webviewViewProvider";

export function registerTypes(serviceManager: IServiceManager) {
	serviceManager.addSingleton<FileSystem>(FileSystem, FileSystem);
	serviceManager.addBinding(FileSystem, IFileSystemNode);
	serviceManager.addBinding(FileSystem, IFileSystem);
	serviceManager.addSingleton<IWorkspaceService>(
		IWorkspaceService,
		WorkspaceService,
	);
	serviceManager.addSingleton<IConfigurationService>(
		IConfigurationService,
		ConfigurationService,
	);

	registerApiTypes(serviceManager);
	registerCommonTypes(serviceManager);
	registerTerminalTypes(serviceManager);
	registerInterpreterTypes(serviceManager);

	// Root platform types
	serviceManager.addSingletonInstance<number>(
		DataScienceStartupTime,
		Date.now(),
	);

	serviceManager.addSingleton<ProgressReporter>(
		ProgressReporter,
		ProgressReporter,
	);
	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		KernelProgressReporter,
	);
	serviceManager.addSingleton<IDataScienceCommandListener>(
		IDataScienceCommandListener,
		OutputCommandListener,
	);

	serviceManager.add<IWebviewViewProvider>(
		IWebviewViewProvider,
		WebviewViewProvider,
	);
	serviceManager.add<IWebviewPanelProvider>(
		IWebviewPanelProvider,
		WebviewPanelProvider,
	);
}
