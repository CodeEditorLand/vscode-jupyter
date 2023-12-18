// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable, named } from "inversify";
import { commands } from "vscode";
import { Commands, STANDARD_OUTPUT_CHANNEL } from "../common/constants";
import {
	IDataScienceCommandListener,
	IDisposableRegistry,
	IOutputChannel,
} from "../common/types";

@injectable()
export class OutputCommandListener implements IDataScienceCommandListener {
	constructor(
		@inject(IOutputChannel)
		@named(STANDARD_OUTPUT_CHANNEL)
		private jupyterOutput: IOutputChannel,
		@inject(IDisposableRegistry)
		private readonly disposableRegistry: IDisposableRegistry
	) {}
	register(): void {
		this.disposableRegistry.push(
			commands.registerCommand(
				Commands.ViewJupyterOutput,
				this.viewJupyterOutput,
				this,
			),
		);
	}

	private viewJupyterOutput() {
		this.jupyterOutput.show(true);
	}
}
