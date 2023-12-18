// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IRemoteKernelFinder, JupyterServerProviderHandle } from "../types";

export const IRemoteKernelFinderController = Symbol(
	"RemoteKernelFinderController",
);
export interface IRemoteKernelFinderController {
	getOrCreateRemoteKernelFinder(
		serverProviderHandle: JupyterServerProviderHandle,
		displayName: string,
	): IRemoteKernelFinder;
}
