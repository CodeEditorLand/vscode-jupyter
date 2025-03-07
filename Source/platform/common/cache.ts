// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable, named } from "inversify";
import { env, Memento, workspace } from "vscode";

import { IExtensionSyncActivationService } from "../activation/types";
import { getRootFolder } from "./application/workspace.base";
import { Settings } from "./constants";
import { getFilePath } from "./platform/fs-paths";
import {
	GLOBAL_MEMENTO,
	ICryptoUtils,
	IExtensionContext,
	IMemento,
	WORKSPACE_MEMENTO,
} from "./types";
import { noop } from "./utils/misc";

const GlobalMementoKeyPrefixesToRemove = [
	"currentServerHash",
	"connectToLocalKernelsOnly",
	"JUPYTER_LOCAL_KERNELSPECS",
	"JUPYTER_LOCAL_KERNELSPECS_V1",
	"JUPYTER_LOCAL_KERNELSPECS_V2",
	"JUPYTER_LOCAL_KERNELSPECS_V3",
	"JUPYTER_REMOTE_KERNELSPECS",
	"JUPYTER_REMOTE_KERNELSPECS_V1",
	"JUPYTER_REMOTE_KERNELSPECS_V2",
	"JUPYTER_REMOTE_KERNELSPECS_V3",
	"JUPYTER_LOCAL_KERNELSPECS_V4",
	"JUPYTER_REMOTE_KERNELSPECS_V4-",
	"LOCAL_KERNEL_SPECS_CACHE_KEY_V_2022_10",
	"LOCAL_KERNEL_PYTHON_AND_RELATED_SPECS_CACHE_KEY_V_2022_10",
	"user-jupyter-server-uri-list-v2",
	"REGISTRATION_ID_EXTENSION_OWNER_MEMENTO_KEY",
	"jupyter.jupyterServer.uriList",
];
@injectable()
export class OldCacheCleaner implements IExtensionSyncActivationService {
	constructor(
		@inject(IMemento)
		@named(GLOBAL_MEMENTO)
		private readonly globalState: Memento,
		@inject(ICryptoUtils) private readonly crypto: ICryptoUtils,
		@inject(IMemento)
		@named(WORKSPACE_MEMENTO)
		private readonly workspaceState: Memento,
		@inject(IExtensionContext)
		private readonly extensionContext: IExtensionContext,
	) {}

	public activate(): void {
		this.removeOldCachedItems().then(noop, noop);
	}

	async removeOldCachedItems(): Promise<void> {
		await Promise.all(
			[await this.getUriAccountKey()]
				.concat(GlobalMementoKeyPrefixesToRemove)
				.filter(
					(key) => this.globalState.get(key, undefined) !== undefined,
				)
				.map((key) =>
					this.globalState.update(key, undefined).then(noop, noop),
				),
		);

		const workspaceStateKeysToRemove = this.workspaceState
			.keys()
			.filter(
				(key) =>
					key.startsWith("LAST_EXECUTED_CELL_") &&
					!key.startsWith("LAST_EXECUTED_CELL_V2_"),
			);

		await Promise.all(
			workspaceStateKeysToRemove.map((key) =>
				this.workspaceState.update(key, undefined),
			),
		);

		await Promise.all(
			GlobalMementoKeyPrefixesToRemove.map((keyPrefix) =>
				this.globalState
					.keys()
					.filter((key) => key.startsWith(keyPrefix))
					.map((key) =>
						this.globalState
							.update(key, undefined)
							.then(noop, noop),
					),
			).flat(),
		);

		await this.extensionContext.secrets
			.delete(
				`${Settings.JupyterServerRemoteLaunchService}.remote-uri-list`,
			)
			.then(noop, noop);
	}

	async getUriAccountKey(): Promise<string> {
		const rootFolder = getRootFolder();

		if (rootFolder) {
			// Folder situation
			return this.crypto.createHash(getFilePath(rootFolder), "SHA-512");
		} else if (workspace.workspaceFile) {
			// Workspace situation
			return this.crypto.createHash(
				getFilePath(workspace.workspaceFile),
				"SHA-512",
			);
		}

		return env.machineId; // Global key when no folder or workspace file
	}
}
