// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IServiceManager } from "../../ioc/types";
import { CustomEnvironmentVariablesProvider } from "./customEnvironmentVariablesProvider.node";
import { EnvironmentVariablesService } from "./environment.node";
import {
	ICustomEnvironmentVariablesProvider,
	IEnvironmentVariablesService,
} from "./types";

export function registerTypes(serviceManager: IServiceManager) {
	serviceManager.addSingleton<IEnvironmentVariablesService>(
		IEnvironmentVariablesService,
		EnvironmentVariablesService,
	);
	serviceManager.addSingleton<ICustomEnvironmentVariablesProvider>(
		ICustomEnvironmentVariablesProvider,
		CustomEnvironmentVariablesProvider,
	);
}
