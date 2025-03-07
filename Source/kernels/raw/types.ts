// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { CancellationToken, Event } from "vscode";

import { Resource } from "../../platform/common/types";
import type { ObservableDisposable } from "../../platform/common/utils/lifecycle";
import {
	IRawKernelSession,
	LocaLKernelSessionCreationOptions,
	LocalKernelSpecConnectionMetadata,
	PythonKernelConnectionMetadata,
} from "../types";

export const IKernelLauncher = Symbol("IKernelLauncher");

export interface IKernelLauncher {
	launch(
		kernelConnectionMetadata:
			| LocalKernelSpecConnectionMetadata
			| PythonKernelConnectionMetadata,
		timeout: number,
		resource: Resource,
		workingDirectory: string,
		cancelToken: CancellationToken,
	): Promise<IKernelProcess>;
}

export interface IKernelConnection {
	iopub_port: number;

	shell_port: number;

	stdin_port: number;

	control_port: number;

	signature_scheme: "hmac-sha256";

	hb_port: number;

	ip: string;

	key: string;

	transport: "tcp" | "ipc";

	kernel_name?: string;
}

export interface IKernelProcess extends ObservableDisposable {
	readonly pid?: number;

	readonly connection: Readonly<IKernelConnection>;

	readonly kernelConnectionMetadata: Readonly<
		LocalKernelSpecConnectionMetadata | PythonKernelConnectionMetadata
	>;
	/**
	 * This event is triggered if the process is exited
	 */
	readonly exited: Event<{
		exitCode?: number;

		reason?: string;

		stderr: string;
	}>;
	/**
	 * Whether we can interrupt this kernel process.
	 * If not possible, send a shell message to the underlying kernel.
	 */
	readonly canInterrupt: boolean;
	/**
	 * Interrupts the Kernel process.
	 * This method is to be used only if `canInterrupt` is true.
	 */
	interrupt(): Promise<void>;
}

// Provides a service to determine if raw notebook is supported or not
export const IRawNotebookSupportedService = Symbol(
	"IRawNotebookSupportedService",
);

export interface IRawNotebookSupportedService {
	isSupported: boolean;
}

export const IRawKernelSessionFactory = Symbol("IRawKernelSessionFactory");

export interface IRawKernelSessionFactory {
	create(
		options: LocaLKernelSessionCreationOptions,
	): Promise<IRawKernelSession>;
}
