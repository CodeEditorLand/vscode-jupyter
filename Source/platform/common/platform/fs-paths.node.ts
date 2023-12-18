// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { homedir } from "os";
import { Uri, WorkspaceFolder } from "vscode";
import { getDisplayPath as getDisplayPathCommon } from "./fs-paths";

export const homePath = Uri.file(homedir()); // This is the only thing requiring a node version

export function getDisplayPathFromLocalFile(
	file: string | undefined,
	cwd?: string | undefined,
) {
	const folders: WorkspaceFolder[] = cwd
		? [
				{
					uri: Uri.file(cwd),
					name: "",
					index: 0,
				},
		  ]
		: [];
	return getDisplayPathCommon(
		file ? Uri.file(file) : undefined,
		folders,
		homePath,
	);
}

export function getDisplayPath(
	file?: Uri | string,
	workspaceFolders: readonly WorkspaceFolder[] | WorkspaceFolder[] = [],
) {
	return getDisplayPathCommon(file, workspaceFolders, homePath);
}
