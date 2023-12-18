// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IExtensionSyncActivationService } from "../activation/types";
import { DataFrameScriptGenerator } from "../interpreter/dataFrameScriptGenerator";
import { VariableScriptGenerator } from "../interpreter/variableScriptGenerator";
import { IServiceManager } from "../ioc/types";
import { DebugService } from "./application/debugService";
import { EncryptedStorage } from "./application/encryptedStorage";
import { Extensions } from "./application/extensions.web";
import { IDebugService, IEncryptedStorage } from "./application/types";
import { AsyncDisposableRegistry } from "./asyncDisposableRegistry";
import { OldCacheCleaner } from "./cache";
import { CryptoUtils } from "./crypto";
import { ExperimentService } from "./experiments/service";
import { FeatureManager } from "./featureManager";
import { PersistentStateFactory } from "./persistentState";
import { registerTypes as registerPlatformTypes } from "./platform/serviceRegistry.web";
import {
	IAsyncDisposableRegistry,
	ICryptoUtils,
	IDataFrameScriptGenerator,
	IExperimentService,
	IExtensions,
	IFeaturesManager,
	IPersistentStateFactory,
	IVariableScriptGenerator,
	IsWindows,
} from "./types";
import {
	IMultiStepInputFactory,
	MultiStepInputFactory,
} from "./utils/multiStepInput";

export function registerTypes(serviceManager: IServiceManager) {
	serviceManager.addSingletonInstance<boolean>(IsWindows, false);
	serviceManager.addSingleton<IExperimentService>(
		IExperimentService,
		ExperimentService,
	);
	serviceManager.addSingleton<IFeaturesManager>(
		IFeaturesManager,
		FeatureManager,
	);
	serviceManager.addSingleton<IPersistentStateFactory>(
		IPersistentStateFactory,
		PersistentStateFactory,
	);
	serviceManager.addSingleton<IExtensions>(IExtensions, Extensions);
	serviceManager.addSingleton<ICryptoUtils>(ICryptoUtils, CryptoUtils);
	serviceManager.addSingleton<IEncryptedStorage>(
		IEncryptedStorage,
		EncryptedStorage,
	);
	serviceManager.addSingleton<IDebugService>(IDebugService, DebugService);
	serviceManager.addSingleton<IAsyncDisposableRegistry>(
		IAsyncDisposableRegistry,
		AsyncDisposableRegistry,
	);
	serviceManager.addSingleton<IMultiStepInputFactory>(
		IMultiStepInputFactory,
		MultiStepInputFactory,
	);
	serviceManager.addSingleton<IDataFrameScriptGenerator>(
		IDataFrameScriptGenerator,
		DataFrameScriptGenerator,
	);
	serviceManager.addSingleton<IVariableScriptGenerator>(
		IVariableScriptGenerator,
		VariableScriptGenerator,
	);
	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		OldCacheCleaner,
	);

	registerPlatformTypes(serviceManager);
}
