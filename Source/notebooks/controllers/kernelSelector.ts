// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { commands } from "vscode";
import { Resource } from "../../platform/common/types";
import { traceError } from "../../platform/logging";
import { INotebookEditorProvider } from "../types";

/**
 * Return `true` if a new kernel has been selected.
 */
export async function selectKernel(
	resource: Resource,
	notebookEditorProvider: INotebookEditorProvider | undefined,
): Promise<boolean> {
	const notebookEditor = notebookEditorProvider?.findNotebookEditor(resource);
	if (notebookEditor) {
		return commands.executeCommand("notebook.selectKernel", {
			notebookEditor,
		}) as Promise<boolean>;
	}
	traceError(
		"Unable to select kernel as the Notebook document could not be identified",
	);
	return false;
}
