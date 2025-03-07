// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { INotebookExporter } from "../kernels/jupyter/types";
import {
	IJupyterVariables,
	IJupyterVariablesProvider,
	IKernelVariableRequester,
} from "../kernels/variables/types";
import {
	IExtensionActivationManager,
	IExtensionSyncActivationService,
} from "../platform/activation/types";
import { Identifiers } from "../platform/common/constants";
import { IExtensionContext } from "../platform/common/types";
import { IServiceManager } from "../platform/ioc/types";
import { ExtensionActivationManager } from "./activation/activationManager";
import { GlobalActivation } from "./activation/globalActivation";
import { KernelApi } from "./api/kernels/accessManagement";
import { EagerlyActivateJupyterUriProviders } from "./api/unstable/activateJupyterProviderExtensions";
import { ApiAccessService } from "./api/unstable/apiAccessService";
import { JupyterKernelServiceFactory } from "./api/unstable/kernelApi";
import { IExportedKernelServiceFactory } from "./api/unstable/types";
import { ExposeUsedAzMLServerHandles } from "./api/unstable/usedAzMLServerHandles.deprecated";
import { CommandRegistry as CodespaceCommandRegistry } from "./codespace/commandRegistry";
import { ActiveEditorContextService } from "./context/activeEditorContext";
import { registerTypes as registerDevToolTypes } from "./devTools/serviceRegistry";
import { CommandRegistry as ExportCommandRegistry } from "./import-export/commandRegistry";
import { ImportTracker } from "./import-export/importTracker";
import { JupyterExporter } from "./import-export/jupyterExporter";
import { registerTypes as registerIntellisenseTypes } from "./intellisense/serviceRegistry.web";
import { PythonExtensionRestartNotification } from "./notification/pythonExtensionRestartNotification";
import { JupyterServerSelectorCommand } from "./userJupyterServer/serverSelectorForTests";
import { UserJupyterServerUrlProvider } from "./userJupyterServer/userServerUrlProvider";
import { JupyterVariablesProvider } from "./variables/JupyterVariablesProvider";
import { KernelVariables } from "./variables/kernelVariables";
import { PythonVariablesRequester } from "./variables/pythonVariableRequester";

export function registerTypes(
	context: IExtensionContext,
	serviceManager: IServiceManager,
	isDevMode: boolean,
) {
	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		GlobalActivation,
	);

	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		ActiveEditorContextService,
	);

	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		ExportCommandRegistry,
	);

	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		ImportTracker,
	);

	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		EagerlyActivateJupyterUriProviders,
	);

	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		JupyterServerSelectorCommand,
	);

	// Activation Manager
	serviceManager.add<IExtensionActivationManager>(
		IExtensionActivationManager,
		ExtensionActivationManager,
	);

	serviceManager.add<INotebookExporter>(INotebookExporter, JupyterExporter);

	// API
	serviceManager.addSingleton<IExportedKernelServiceFactory>(
		IExportedKernelServiceFactory,
		JupyterKernelServiceFactory,
	);

	serviceManager.addSingleton<ApiAccessService>(
		ApiAccessService,
		ApiAccessService,
	);

	// Notification
	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		PythonExtensionRestartNotification,
	);

	// Intellisense
	registerIntellisenseTypes(serviceManager, isDevMode);

	// Dev Tools
	registerDevToolTypes(context, isDevMode);

	// User jupyter server url provider
	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		UserJupyterServerUrlProvider,
	);

	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		CodespaceCommandRegistry,
	);

	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		ExposeUsedAzMLServerHandles,
	);

	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		KernelApi,
	);

	// Variables
	serviceManager.addSingleton<IJupyterVariablesProvider>(
		IJupyterVariablesProvider,
		JupyterVariablesProvider,
	);

	serviceManager.addSingleton<IJupyterVariables>(
		IJupyterVariables,
		KernelVariables,
		Identifiers.KERNEL_VARIABLES,
	);

	serviceManager.addSingleton<IKernelVariableRequester>(
		IKernelVariableRequester,
		PythonVariablesRequester,
		Identifiers.PYTHON_VARIABLES_REQUESTER,
	);
}
