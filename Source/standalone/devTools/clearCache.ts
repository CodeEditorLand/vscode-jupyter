// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { commands, Uri, workspace } from "vscode";

import { RemoteKernelSpecCacheFileName } from "../../kernels/jupyter/constants";
import { Commands } from "../../platform/common/constants";
import { deleteTempDirs } from "../../platform/common/temp";
import { IExtensionContext } from "../../platform/common/types";
import { noop } from "../../platform/common/utils/misc";
import { logger } from "../../platform/logging";

export function addClearCacheCommand(
	context: IExtensionContext,
	isDevMode: boolean,
) {
	if (!isDevMode) {
		return;
	}

	commands.registerCommand("dataScience.ClearCache", async () => {
		const promises: (Thenable<unknown> | Promise<unknown>)[] = [];
		// eslint-disable-next-line no-restricted-syntax
		for (const key of context.globalState.keys()) {
			promises.push(
				context.globalState.update(key, undefined).then(noop, noop),
			);
		}
		// eslint-disable-next-line no-restricted-syntax
		for (const key of context.workspaceState.keys()) {
			promises.push(
				context.workspaceState.update(key, undefined).then(noop, noop),
			);
		}

		promises.push(
			commands
				.executeCommand(Commands.ClearSavedJupyterUris)
				.then(noop, noop),
		);

		await Promise.all(promises).catch(noop);
		// Delete the files after clearing the cache.
		await Promise.all([
			workspace.fs
				.delete(
					Uri.joinPath(
						context.globalStorageUri,
						"lastExecutedRemoteCell.json",
					),
				)
				.then(noop, noop),
			workspace.fs
				.delete(
					Uri.joinPath(
						context.globalStorageUri,
						"remoteServersMRUList.json",
					),
				)
				.then(noop, noop),
			workspace.fs
				.delete(
					Uri.joinPath(
						context.globalStorageUri,
						RemoteKernelSpecCacheFileName,
					),
				)
				.then(noop, noop),
			deleteTempDirs(context).then(noop, noop),
		]);

		logger.info("Cache cleared");
	});
}
