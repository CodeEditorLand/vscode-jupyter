// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { DebugProtocol } from "vscode-debugprotocol";

import { IJupyterVariable } from "./types";

export const DataViewableTypes: Set<string> = new Set<string>([
	"DataFrame",
	"list",
	"dict",
	"ndarray",
	"Series",
	"Tensor",
	"EagerTensor",
	"DataArray",
]);

export function convertDebugProtocolVariableToIJupyterVariable(
	variable: DebugProtocol.Variable,
): IJupyterVariable {
	return {
		// If `evaluateName` is available use that. That is the name that we can eval in the debugger
		// but it's an optional property so fallback to `variable.name`
		name: variable.evaluateName ?? variable.name,
		type: variable.type!,
		count: 0,
		shape: "",
		size: 0,
		supportsDataExplorer: DataViewableTypes.has(variable.type || ""),
		value: variable.value,
		truncated: true,
		frameId: variable.variablesReference,
	};
}

export type DataFrameSplitFormat = {
	index: (number | string)[];

	columns: string[];

	data: Record<string, unknown>[];
};

export function parseDataFrame(df: DataFrameSplitFormat) {
	const rowIndexValues = df.index;

	const columns = df.columns;

	const rowData = df.data;

	const data = rowData.map((row, index) => {
		const rowData: Record<string, unknown> = {
			index: rowIndexValues[index],
		};

		columns.forEach((column, columnIndex) => {
			rowData[column] = row[columnIndex];
		});

		return rowData;
	});

	return { data };
}
