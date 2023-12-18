// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IExtensionSyncActivationService } from "../platform/activation/types";
import { IPythonExtensionChecker } from "../platform/api/types";
import { Identifiers, isPreReleaseVersion } from "../platform/common/constants";

import { injectable } from "inversify";
import { IServiceManager } from "../platform/ioc/types";
import { setSharedProperty } from "../telemetry";
import { KernelApi } from "./api/accessManagement";
import { CellOutputDisplayIdTracker } from "./execution/cellDisplayIdTracker";
import { LastCellExecutionTracker } from "./execution/lastCellExecutionTracker";
import { ClearJupyterServersCommand } from "./jupyter/clearJupyterServersCommand";
import { PreferredRemoteKernelIdProvider } from "./jupyter/connection/preferredRemoteKernelIdProvider";
import { RemoteJupyterServerMruUpdate } from "./jupyter/connection/remoteJupyterServerMruUpdate";
import { registerTypes as registerJupyterTypes } from "./jupyter/serviceRegistry.web";
import { KernelAutoReconnectMonitor } from "./kernelAutoReConnectMonitor";
import { KernelCrashMonitor } from "./kernelCrashMonitor";
import { KernelDependencyService } from "./kernelDependencyService.web";
import { KernelFinder } from "./kernelFinder";
import { KernelProvider, ThirdPartyKernelProvider } from "./kernelProvider.web";
import { KernelRefreshIndicator } from "./kernelRefreshIndicator.web";
import { KernelStartupCodeProviders } from "./kernelStartupCodeProviders.web";
import { KernelStatusProvider } from "./kernelStatusProvider";
import { TrustedKernelPaths } from "./raw/finder/trustedKernelPaths.web";
import { ITrustedKernelPaths } from "./raw/finder/types";
import { IRawNotebookSupportedService } from "./raw/types";
import {
	IKernelDependencyService,
	IKernelFinder,
	IKernelProvider,
	IStartupCodeProviders,
	IThirdPartyKernelProvider,
} from "./types";
import { JupyterVariables } from "./variables/jupyterVariables";
import { KernelVariables } from "./variables/kernelVariables";
import { PythonVariablesRequester } from "./variables/pythonVariableRequester";
import { IJupyterVariables, IKernelVariableRequester } from "./variables/types";

@injectable()
class RawNotebookSupportedService implements IRawNotebookSupportedService {
	isSupported = false;
}

export function registerTypes(
	serviceManager: IServiceManager,
	isDevMode: boolean,
) {
	serviceManager.addSingleton<IRawNotebookSupportedService>(
		IRawNotebookSupportedService,
		RawNotebookSupportedService,
	);
	setSharedProperty("isInsiderExtension", isPreReleaseVersion());

	const isPythonExtensionInstalled =
		serviceManager.get<IPythonExtensionChecker>(IPythonExtensionChecker);
	setSharedProperty(
		"isPythonExtensionInstalled",
		isPythonExtensionInstalled.isPythonExtensionInstalled
			? "true"
			: "false",
	);
	const rawService = serviceManager.get<IRawNotebookSupportedService>(
		IRawNotebookSupportedService,
	);
	setSharedProperty(
		"rawKernelSupported",
		rawService.isSupported ? "true" : "false",
	);
	serviceManager.addSingleton<IStartupCodeProviders>(
		IStartupCodeProviders,
		KernelStartupCodeProviders,
	);
	serviceManager.addSingleton<IKernelVariableRequester>(
		IKernelVariableRequester,
		PythonVariablesRequester,
		Identifiers.PYTHON_VARIABLES_REQUESTER,
	);
	serviceManager.addSingleton<IJupyterVariables>(
		IJupyterVariables,
		JupyterVariables,
		Identifiers.ALL_VARIABLES,
	);
	serviceManager.addSingleton<IJupyterVariables>(
		IJupyterVariables,
		KernelVariables,
		Identifiers.KERNEL_VARIABLES,
	);

	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		KernelCrashMonitor,
	);
	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		KernelRefreshIndicator,
	);
	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		KernelStatusProvider,
	);
	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		KernelAutoReconnectMonitor,
	);
	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		RemoteJupyterServerMruUpdate,
	);

	serviceManager.addSingleton<IKernelProvider>(
		IKernelProvider,
		KernelProvider,
	);
	serviceManager.addSingleton<ITrustedKernelPaths>(
		ITrustedKernelPaths,
		TrustedKernelPaths,
	);
	serviceManager.addSingleton<IThirdPartyKernelProvider>(
		IThirdPartyKernelProvider,
		ThirdPartyKernelProvider,
	);
	serviceManager.addSingleton<PreferredRemoteKernelIdProvider>(
		PreferredRemoteKernelIdProvider,
		PreferredRemoteKernelIdProvider,
	);
	serviceManager.addSingleton<IKernelFinder>(IKernelFinder, KernelFinder);
	serviceManager.addSingleton<IKernelDependencyService>(
		IKernelDependencyService,
		KernelDependencyService,
	);

	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		ClearJupyterServersCommand,
	);
	serviceManager.addSingleton<LastCellExecutionTracker>(
		LastCellExecutionTracker,
		LastCellExecutionTracker,
	);
	serviceManager.addBinding(
		LastCellExecutionTracker,
		IExtensionSyncActivationService,
	);
	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		KernelApi,
	);

	// Subdirectories
	registerJupyterTypes(serviceManager, isDevMode);

	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		CellOutputDisplayIdTracker,
	);
}
