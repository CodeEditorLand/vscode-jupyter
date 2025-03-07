// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import dedent from "dedent";
import { inject, injectable } from "inversify";

import { IFileSystem } from "../common/platform/types";
import {
	IExtensionContext,
	IVariableScriptGenerator,
	ParentOptions,
} from "../common/types";
import { joinPath } from "../vscode-path/resources";

const VariableFunc = "_VSCODE_getVariable";

const cleanupCode = dedent`
                            try:
                                del _VSCODE_getVariable
                            except:
                                pass
                            `;

/**
 * Provides utilities to extract python scripts from the extension installation. These scripts can then be used to query variable information in the kernel.
 */
@injectable()
export class VariableScriptGenerator implements IVariableScriptGenerator {
	static contentsOfScript: string | undefined;

	static contentsOfVariablesScript: string | undefined;

	constructor(
		@inject(IFileSystem) private readonly fs: IFileSystem,
		@inject(IExtensionContext) private readonly context: IExtensionContext,
	) {}

	async generateCodeToGetVariableInfo(options: {
		isDebugging: boolean;

		variableName: string;
	}) {
		const initializeCode = await this.getContentsOfScript();

		const isDebugging = options.isDebugging ? "True" : "False";

		const code = `${VariableFunc}("info", ${isDebugging}, ${options.variableName})`;

		if (options.isDebugging) {
			// When debugging, the code is evaluated in the debugger, so we need to initialize the script.
			// We cannot send complex code to the debugger, it has to be a simple expression that produces a value.
			// Hence the need to split the code into initialization, real code & finalization.
			return {
				initializeCode,
				code,
				cleanupCode,
			};
		} else {
			return {
				code: `${initializeCode}\n\n${code}\n\n${cleanupCode}`,
			};
		}
	}

	async generateCodeToGetVariableProperties(options: {
		isDebugging: boolean;

		variableName: string;

		stringifiedAttributeNameList: string;
	}) {
		const initializeCode = await this.getContentsOfScript();

		const isDebugging = options.isDebugging ? "True" : "False";

		const code = `${VariableFunc}("properties", ${isDebugging}, ${options.variableName}, ${options.stringifiedAttributeNameList})`;

		if (options.isDebugging) {
			return {
				initializeCode,
				code,
				cleanupCode,
			};
		} else {
			return {
				code: `${initializeCode}\n\n${code}\n\n${cleanupCode}`,
			};
		}
	}

	async generateCodeToGetAllVariableDescriptions(
		parentOptions: ParentOptions | undefined,
	) {
		let scriptCode = await this.getContentsOfVariablesScript();

		if (parentOptions) {
			scriptCode =
				scriptCode +
				`\n\nreturn _VSCODE_getAllChildrenDescriptions(\'${parentOptions.root}\', ${JSON.stringify(
					parentOptions.propertyChain,
				)}, ${parentOptions.startIndex})`;
		} else {
			scriptCode =
				scriptCode +
				"\n\nvariables= %who_ls\nreturn _VSCODE_getVariableDescriptions(variables)";
		}

		return scriptCode;
	}

	async generateCodeToGetVariableTypes(options: { isDebugging: boolean }) {
		const scriptCode = await this.getContentsOfScript();

		const initializeCode = `${scriptCode}\n\n_VSCODE_rwho_ls = %who_ls\n`;

		const isDebugging = options.isDebugging ? "True" : "False";

		const cleanupWhoLsCode = dedent`
        try:
            del _VSCODE_rwho_ls
        except:
            pass
        `;

		const code = `${VariableFunc}("types", ${isDebugging}, _VSCODE_rwho_ls)`;

		if (options.isDebugging) {
			return {
				initializeCode,
				code,
				cleanupCode: `${cleanupCode}\n${cleanupWhoLsCode}`,
			};
		} else {
			return {
				code: `${initializeCode}${code}\n\n${cleanupCode}\n${cleanupWhoLsCode}`,
			};
		}
	}

	async generateCodeToGetVariableValueSummary(variableName: string) {
		let scriptCode = await this.getContentsOfVariablesScript();

		scriptCode =
			scriptCode +
			`\n\nvariables= %who_ls\nreturn _VSCODE_getVariableSummary(${variableName})`;

		return scriptCode;
	}
	/**
	 * Script content is static, hence read the contents once.
	 */
	private async getContentsOfScript() {
		if (VariableScriptGenerator.contentsOfScript) {
			return VariableScriptGenerator.contentsOfScript;
		}

		const scriptPath = joinPath(
			this.context.extensionUri,
			"pythonFiles",
			"vscode_datascience_helpers",
			"getVariableInfo",
			"vscodeGetVariableInfo.py",
		);

		const contents = await this.fs.readFile(scriptPath);

		VariableScriptGenerator.contentsOfScript = contents;

		return contents;
	}

	private async getContentsOfVariablesScript() {
		if (VariableScriptGenerator.contentsOfVariablesScript) {
			return VariableScriptGenerator.contentsOfVariablesScript;
		}

		const scriptPath = joinPath(
			this.context.extensionUri,
			"pythonFiles",
			"vscode_datascience_helpers",
			"getVariableInfo",
			"vscodeGetVariablesForProvider.py",
		);

		const contents = await this.fs.readFile(scriptPath);

		VariableScriptGenerator.contentsOfVariablesScript = contents;

		return contents;
	}
}
