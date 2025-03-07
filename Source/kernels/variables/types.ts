// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { JSONObject } from "@lumino/coreutils";
import {
	CancellationToken,
	Event,
	NotebookVariableProvider,
	Uri,
	Variable,
} from "vscode";

import { IKernel } from "../types";

// Get variables from the currently running active Jupyter server or debugger
// Note: This definition is used implicitly by getJupyterVariableValue.py file
// Changes here may need to be reflected there as well
export interface IJupyterVariable {
	name: string;

	value: string | undefined;

	executionCount?: number;

	supportsDataExplorer: boolean;

	type: string;

	fullType?: string;

	size: number;

	shape: string;

	dataDimensionality?: number;

	count: number;

	truncated: boolean;

	columns?: { key: string; type: string }[];

	rowCount?: number;

	indexColumn?: string;

	maximumRowChunkSize?: number;

	fileName?: Uri;

	frameId?: number;
}

export const IJupyterVariables = Symbol("IJupyterVariables");

export interface IJupyterVariables {
	readonly refreshRequired: Event<void>;

	getAllVariableDiscriptions(
		kernel: IKernel,
		parent: IVariableDescription | undefined,
		startIndex: number,
		token: CancellationToken,
	): Promise<IVariableDescription[]>;

	getVariables(
		request: IJupyterVariablesRequest,
		kernel?: IKernel,
	): Promise<IJupyterVariablesResponse>;

	getFullVariable(
		variable: IJupyterVariable,
		kernel?: IKernel,
		cancelToken?: CancellationToken,
	): Promise<IJupyterVariable>;

	getVariableValueSummary(
		variable: IJupyterVariable,
		kernel: IKernel,
		cancelToken?: CancellationToken,
	): Promise<string | undefined>;

	getDataFrameInfo(
		targetVariable: IJupyterVariable,
		kernel?: IKernel,
		sliceExpression?: string,
		isRefresh?: boolean,
	): Promise<IJupyterVariable>;

	getDataFrameRows(
		targetVariable: IJupyterVariable,
		start: number,
		end: number,
		kernel?: IKernel,
		sliceExpression?: string,
	): Promise<{ data: Record<string, unknown>[] }>;

	getMatchingVariable(
		name: string,
		kernel?: IKernel,
		cancelToken?: CancellationToken,
	): Promise<IJupyterVariable | undefined>;
	// This is currently only defined in kernelVariables.ts
	getVariableProperties?(
		name: string,
		kernel?: IKernel,
		cancelToken?: CancellationToken,
	): Promise<JSONObject>;
}

export interface IConditionalJupyterVariables extends IJupyterVariables {
	readonly active: boolean;
}

// Request for variables
export interface IJupyterVariablesRequest {
	executionCount: number;

	refreshCount: number;

	sortColumn: string;

	sortAscending: boolean;

	startIndex: number;

	pageSize: number;
}

// Response to a request
export interface IJupyterVariablesResponse {
	executionCount: number;

	totalCount: number;

	pageStartIndex: number;

	pageResponse: IJupyterVariable[];

	refreshCount: number;
}

export interface IVariableDescription extends Variable {
	/** The name of the variable at the root scope */
	root: string;
	/** How to look up the specific property of the root variable */
	propertyChain: (string | number)[];
	/** The number of children for collection types */
	count?: number;
	/** Names of children */
	hasNamedChildren?: boolean;
	/** A method to get the children of this variable */
	getChildren?: (
		start: number,
		token: CancellationToken,
	) => Promise<IVariableDescription[]>;
}

export interface IRichVariableResult {
	variable: Variable & { summary?: string };

	hasNamedChildren: boolean;

	indexedChildrenCount: number;
}

export const IKernelVariableRequester = Symbol("IKernelVariableRequester");

export interface IKernelVariableRequester {
	getAllVariableDiscriptions(
		kernel: IKernel,
		parent: IVariableDescription | undefined,
		startIndex: number,
		token: CancellationToken,
	): Promise<IVariableDescription[]>;

	getVariableNamesAndTypesFromKernel(
		kernel: IKernel,
		token?: CancellationToken,
	): Promise<IJupyterVariable[]>;

	getFullVariable(
		targetVariable: IJupyterVariable,
		kernel: IKernel,
		token?: CancellationToken,
	): Promise<IJupyterVariable>;

	getDataFrameRows(
		start: number,
		end: number,
		kernel: IKernel,
		expression: string,
	): Promise<{ data: Record<string, unknown>[] }>;

	getVariableProperties(
		word: string,
		cancelToken: CancellationToken | undefined,
		matchingVariable: IJupyterVariable | undefined,
	): Promise<{ [attributeName: string]: string }>;

	getVariableValueSummary(
		targetVariable: IJupyterVariable,
		kernel: IKernel,
		token: CancellationToken,
	): Promise<string | undefined>;

	getDataFrameInfo(
		targetVariable: IJupyterVariable,
		kernel: IKernel,
		expression: string,
	): Promise<IJupyterVariable>;
}

export const IJupyterVariablesProvider = Symbol("IJupyterVariablesProvider");

export interface IJupyterVariablesProvider extends NotebookVariableProvider {}
