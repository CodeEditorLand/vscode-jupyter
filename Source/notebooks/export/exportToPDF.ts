// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { CancellationToken, NotebookDocument, Uri } from "vscode";
import { ServiceContainer } from "../../platform/ioc/container";
import { PythonEnvironment } from "../../platform/pythonEnvironments/info";
import { ExportFormat, IExportBase } from "./types";

export class ExportToPDF {
	public async export(
		sourceDocument: NotebookDocument,
		target: Uri,
		interpreter: PythonEnvironment,
		token: CancellationToken,
	): Promise<void> {
		const exportBase =
			ServiceContainer.instance.get<IExportBase>(IExportBase);
		await exportBase.executeCommand(
			sourceDocument,
			target,
			ExportFormat.pdf,
			interpreter,
			token,
		);
	}
}
