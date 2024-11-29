// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable } from "inversify";

import { IExtensionSyncActivationService } from "../../platform/activation/types";
import {
	InteractiveWindowView,
	JupyterNotebookView,
} from "../../platform/common/constants";
import { isPythonKernelConnection } from "../helpers";
import {
	IKernel,
	IStartupCodeProvider,
	IStartupCodeProviders,
	StartupCodePriority,
} from "../types";
import { chatStartupPythonCode } from "./generator";

@injectable()
export class KernelChatStartupCodeProvider
	implements IStartupCodeProvider, IExtensionSyncActivationService
{
	public priority = StartupCodePriority.Base;

	constructor(
		@inject(IStartupCodeProviders)
		private readonly registry: IStartupCodeProviders,
	) {}

	activate(): void {
		this.registry.register(this, JupyterNotebookView);

		this.registry.register(this, InteractiveWindowView);
	}

	async getCode(kernel: IKernel): Promise<string[]> {
		if (!isPythonKernelConnection(kernel.kernelConnectionMetadata)) {
			return [];
		}

		return [chatStartupPythonCode];
	}
}
