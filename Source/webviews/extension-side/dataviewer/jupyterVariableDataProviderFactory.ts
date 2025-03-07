// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable } from "inversify";

import { IKernel } from "../../../kernels/types";
import { IJupyterVariable } from "../../../kernels/variables/types";
import { IServiceContainer } from "../../../platform/ioc/types";
import {
	IJupyterVariableDataProvider,
	IJupyterVariableDataProviderFactory,
} from "./types";

@injectable()
export class JupyterVariableDataProviderFactory
	implements IJupyterVariableDataProviderFactory
{
	constructor(
		@inject(IServiceContainer) private serviceContainer: IServiceContainer,
	) {}

	public async create(
		variable: IJupyterVariable,
		kernel?: IKernel,
	): Promise<IJupyterVariableDataProvider> {
		const jupyterVariableDataProvider =
			this.serviceContainer.get<IJupyterVariableDataProvider>(
				IJupyterVariableDataProvider,
			);

		jupyterVariableDataProvider.setDependencies(variable, kernel);

		return jupyterVariableDataProvider;
	}
}
