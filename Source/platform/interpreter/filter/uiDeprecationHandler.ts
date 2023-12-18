// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable } from "inversify";
import { commands } from "vscode";
import { IExtensionSyncActivationService } from "../../activation/types";
import { IDisposableRegistry } from "../../common/types";
import { noop } from "../../common/utils/misc";

@injectable()
export class PythonFilterUICommandDeprecation
	implements IExtensionSyncActivationService
{
	constructor(
		@inject(IDisposableRegistry)
		private readonly disposables: IDisposableRegistry
	) {}
	public activate() {
		this.disposables.push(
			commands.registerCommand(
				"jupyter.filterKernels",
				() =>
					commands
						.executeCommand(
							"workbench.action.openSettings",
							"jupyter.kernels.excludePythonEnvironments",
						)
						.then(noop, noop),
				this,
			),
		);
	}
}
