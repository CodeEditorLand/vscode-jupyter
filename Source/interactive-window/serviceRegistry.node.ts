// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ITracebackFormatter } from "../kernels/types";
import { IExtensionSyncActivationService } from "../platform/activation/types";
import { IJupyterExtensionBanner } from "../platform/common/types";
import { IServiceManager } from "../platform/ioc/types";
import { IReplNotebookTrackerService } from "../platform/notebooks/replNotebookTrackerService";
import { CommandRegistry } from "./commands/commandRegistry";
import { InteractiveWindowDebugger } from "./debugger/interactiveWindowDebugger.node";
import { InteractiveWindowDebuggingManager } from "./debugger/jupyter/debuggingManager";
import { InteractiveWindowDebuggingStartupCodeProvider } from "./debugger/startupCodeProvider";
import { CellRangeCache } from "./editor-integration/cellRangeCache";
import { CodeGeneratorFactory } from "./editor-integration/codeGeneratorFactory";
import { CodeLensFactory } from "./editor-integration/codeLensFactory";
import { DataScienceCodeLensProvider } from "./editor-integration/codelensprovider";
import { CodeLensProviderActivator } from "./editor-integration/codelensProviderActivator";
import { CodeWatcher } from "./editor-integration/codewatcher";
import { Decorator } from "./editor-integration/decorator";
import { GeneratedCodeStorageFactory } from "./editor-integration/generatedCodeStorageFactory";
import { HoverProvider } from "./editor-integration/hoverProvider";
import { PythonCellFoldingProvider } from "./editor-integration/pythonCellFoldingProvider";
import {
	ICellRangeCache,
	ICodeGeneratorFactory,
	ICodeLensFactory,
	ICodeWatcher,
	IDataScienceCodeLensProvider,
	IGeneratedCodeStorageFactory,
} from "./editor-integration/types";
import { GeneratedCodeStorageManager } from "./generatedCodeStoreManager";
import { InteractiveControllerHelper } from "./InteractiveControllerHelper";
import {
	InteractiveWindowProvider,
	ReplNotebookTrackerService,
} from "./interactiveWindowProvider";
import { InteractiveWindowTracebackFormatter } from "./outputs/tracebackFormatter";
import {
	BANNER_NAME_INTERACTIVE_SHIFTENTER,
	InteractiveShiftEnterBanner,
} from "./shiftEnterBanner";
import {
	IInteractiveControllerHelper,
	IInteractiveWindowDebugger,
	IInteractiveWindowDebuggingManager,
	IInteractiveWindowProvider,
} from "./types";

export function registerTypes(serviceManager: IServiceManager) {
	serviceManager.addSingleton<IInteractiveWindowProvider>(
		IInteractiveWindowProvider,
		InteractiveWindowProvider,
	);
	serviceManager.addSingleton<IReplNotebookTrackerService>(
		IReplNotebookTrackerService,
		ReplNotebookTrackerService,
	);
	serviceManager.addSingleton<IInteractiveControllerHelper>(
		IInteractiveControllerHelper,
		InteractiveControllerHelper,
	);
	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		CommandRegistry,
	);
	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		HoverProvider,
	);
	serviceManager.addSingleton<ICellRangeCache>(
		ICellRangeCache,
		CellRangeCache,
	);
	serviceManager.add<ICodeWatcher>(ICodeWatcher, CodeWatcher);
	serviceManager.addSingleton<ICodeLensFactory>(
		ICodeLensFactory,
		CodeLensFactory,
	);
	serviceManager.addSingleton<IDataScienceCodeLensProvider>(
		IDataScienceCodeLensProvider,
		DataScienceCodeLensProvider,
	);
	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		CodeLensProviderActivator,
	);
	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		PythonCellFoldingProvider,
	);
	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		Decorator,
	);
	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		GeneratedCodeStorageManager,
	);
	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		InteractiveWindowDebuggingStartupCodeProvider,
	);
	serviceManager.addSingleton<ICodeGeneratorFactory>(
		ICodeGeneratorFactory,
		CodeGeneratorFactory,
		undefined,
		[IExtensionSyncActivationService],
	);
	serviceManager.addSingleton<IGeneratedCodeStorageFactory>(
		IGeneratedCodeStorageFactory,
		GeneratedCodeStorageFactory,
	);
	serviceManager.addSingleton<ITracebackFormatter>(
		ITracebackFormatter,
		InteractiveWindowTracebackFormatter,
	);
	serviceManager.addSingleton<IInteractiveWindowDebugger>(
		IInteractiveWindowDebugger,
		InteractiveWindowDebugger,
	);
	serviceManager.addSingleton<IInteractiveWindowDebuggingManager>(
		IInteractiveWindowDebuggingManager,
		InteractiveWindowDebuggingManager,
		undefined,
		[IExtensionSyncActivationService],
	);
	serviceManager.addSingleton<IJupyterExtensionBanner>(
		IJupyterExtensionBanner,
		InteractiveShiftEnterBanner,
		BANNER_NAME_INTERACTIVE_SHIFTENTER,
	);
}
