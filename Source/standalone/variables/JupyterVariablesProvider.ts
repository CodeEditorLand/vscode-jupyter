// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable, named } from "inversify";
import {
	CancellationToken,
	EventEmitter,
	NotebookDocument,
	NotebookVariablesRequestKind,
	Variable,
	VariablesResult,
} from "vscode";

import { IKernel, IKernelProvider } from "../../kernels/types";
import {
	IJupyterVariables,
	IJupyterVariablesProvider,
	IRichVariableResult,
	IVariableDescription,
} from "../../kernels/variables/types";
import { Identifiers } from "../../platform/common/constants";
import {
	VariableResultCache,
	VariableSummaryCache,
} from "./variableResultCache";

@injectable()
export class JupyterVariablesProvider implements IJupyterVariablesProvider {
	private variableResultCache = new VariableResultCache();

	private variableSummaryCache = new VariableSummaryCache();

	private runningKernels = new Set<string>();

	_onDidChangeVariables = new EventEmitter<NotebookDocument>();

	onDidChangeVariables = this._onDidChangeVariables.event;

	constructor(
		@inject(IJupyterVariables)
		@named(Identifiers.KERNEL_VARIABLES)
		private variables: IJupyterVariables,
		@inject(IKernelProvider) private kernelProvider: IKernelProvider,
	) {
		this.kernelProvider.onKernelStatusChanged(
			this.onKernelStatusChanged,
			this,
		);
	}

	private onKernelStatusChanged({ kernel }: { kernel: IKernel }) {
		if (
			"variableProvider" in kernel.controller &&
			kernel.controller.variableProvider !== this
		) {
			return;
		}

		const notebookUri = kernel.notebook.uri.toString();

		const kernelWasRunning = this.runningKernels.has(notebookUri);

		if (kernel.status === "idle" && !kernelWasRunning) {
			this.runningKernels.add(notebookUri);
		} else if (
			kernel.status !== "busy" &&
			kernel.status !== "idle" &&
			kernelWasRunning
		) {
			this.runningKernels.delete(notebookUri);

			this._onDidChangeVariables.fire(kernel.notebook);
		}
	}

	private _getVariableResultCacheKey(
		notebookUri: string,
		parent: Variable | undefined,
		start: number,
	) {
		let parentKey = "";

		const parentDescription = parent as IVariableDescription;

		if (parentDescription) {
			parentKey = `${parentDescription.name}.${parentDescription.propertyChain.join(".")}[[${start}`;
		}

		return `${notebookUri}:${parentKey}`;
	}

	async *provideVariables(
		notebook: NotebookDocument,
		parent: Variable | undefined,
		kind: NotebookVariablesRequestKind,
		start: number,
		token: CancellationToken,
	): AsyncIterable<VariablesResult> {
		if (token.isCancellationRequested) {
			return;
		}

		const kernel = this.kernelProvider.get(notebook);

		if (
			!kernel ||
			kernel.status === "dead" ||
			kernel.status === "terminating"
		) {
			return;
		}

		const executionCount =
			this.kernelProvider.getKernelExecution(kernel).executionCount;

		const cacheKey = this._getVariableResultCacheKey(
			notebook.uri.toString(),
			parent,
			start,
		);

		let results = this.variableResultCache.getResults(
			executionCount,
			cacheKey,
		);

		if (parent) {
			const parentDescription = parent as IVariableDescription;

			if (!results && parentDescription.getChildren) {
				const variables = await parentDescription.getChildren(
					start,
					token,
				);

				results = variables.map((variable) =>
					this.createVariableResult(variable, kernel),
				);

				this.variableResultCache.setResults(
					executionCount,
					cacheKey,
					results,
				);
			} else if (!results) {
				// no cached results and no way to get children, so return empty
				return;
			}

			for (const result of results) {
				yield result;
			}

			// check if we have more indexed children to return
			if (
				kind === 2 &&
				parentDescription.count &&
				results.length > 0 &&
				parentDescription.count > start + results.length
			) {
				for await (const result of this.provideVariables(
					notebook,
					parent,
					kind,
					start + results.length,
					token,
				)) {
					yield result;
				}
			}
		} else {
			if (!results) {
				const variables =
					await this.variables.getAllVariableDiscriptions(
						kernel,
						undefined,
						start,
						token,
					);

				results = variables.map((variable) =>
					this.createVariableResult(variable, kernel),
				);

				this.variableResultCache.setResults(
					executionCount,
					cacheKey,
					results,
				);
			}

			for (const result of results) {
				yield result;
			}
		}
	}

	private _getVariableSummaryCacheKey(
		notebookUri: string,
		variable: Variable,
	) {
		return `${notebookUri}:${variable.name}`;
	}

	async *provideVariablesWithSummarization(
		notebook: NotebookDocument,
		parent: Variable | undefined,
		kind: NotebookVariablesRequestKind,
		start: number,
		token: CancellationToken,
	): AsyncIterable<IRichVariableResult> {
		const kernel = this.kernelProvider.get(notebook);

		const results = this.provideVariables(
			notebook,
			parent,
			kind,
			start,
			token,
		);

		for await (const result of results) {
			if (
				kernel &&
				kernel.status !== "dead" &&
				kernel.status !== "terminating"
			) {
				const cacheKey = this._getVariableSummaryCacheKey(
					notebook.uri.toString(),
					result.variable,
				);

				const executionCount =
					this.kernelProvider.getKernelExecution(
						kernel,
					).executionCount;

				let summary = this.variableSummaryCache.getResults(
					executionCount,
					cacheKey,
				);

				if (
					summary == undefined &&
					result.variable.type === "pandas.core.frame.DataFrame"
				) {
					summary = await this.variables.getVariableValueSummary(
						{
							name: result.variable.name,
							value: result.variable.value,
							supportsDataExplorer: false,
							type: result.variable.type ?? "",
							size: 0,
							count: 0,
							shape: "",
							truncated: true,
						},
						kernel,
						token,
					);

					this.variableSummaryCache.setResults(
						executionCount,
						cacheKey,
						summary ?? null,
					);
				}

				yield {
					hasNamedChildren: result.hasNamedChildren,
					indexedChildrenCount: result.indexedChildrenCount,
					variable: {
						name: result.variable.name,
						value: result.variable.value,
						expression: result.variable.expression,
						type: result.variable.type,
						language: result.variable.language,
						summary: summary ?? "",
					},
				};
			}
		}
	}

	private createVariableResult(
		result: IVariableDescription,
		kernel: IKernel,
	): VariablesResult {
		const indexedChildrenCount = result.count ?? 0;

		const hasNamedChildren = !!result.hasNamedChildren;

		const variable = {
			getChildren: (start: number, token: CancellationToken) =>
				this.getChildren(variable, start, kernel, token),
			expression: createExpression(result.root, result.propertyChain),
			...result,
		} as Variable;

		return { variable, hasNamedChildren, indexedChildrenCount };
	}

	async getChildren(
		variable: Variable,
		start: number,
		kernel: IKernel,
		token: CancellationToken,
	): Promise<IVariableDescription[]> {
		const parent = variable as IVariableDescription;

		return await this.variables.getAllVariableDiscriptions(
			kernel,
			parent,
			start,
			token,
		);
	}
}

function createExpression(
	root: string,
	propertyChain: (string | number)[],
): string {
	let expression = root;

	for (const property of propertyChain) {
		if (typeof property === "string") {
			expression += `.${property}`;
		} else {
			expression += `[${property}]`;
		}
	}

	return expression;
}
