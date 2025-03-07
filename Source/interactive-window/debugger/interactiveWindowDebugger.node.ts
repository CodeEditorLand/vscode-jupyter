// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type * as nbformat from "@jupyterlab/nbformat";
import { inject, injectable, named } from "inversify";
import { DebugConfiguration, Disposable, NotebookDocument } from "vscode";

import { JupyterDebuggerNotInstalledError } from "../../kernels/errors/jupyterDebuggerNotInstalledError";
import { executeSilently } from "../../kernels/helpers";
import { getPlainTextOrStreamOutput } from "../../kernels/kernel";
import { IKernel, isLocalConnection } from "../../kernels/types";
import { IJupyterDebugService } from "../../notebooks/debugger/debuggingTypes";
import { IPythonApiProvider } from "../../platform/api/types";
import { Identifiers } from "../../platform/common/constants";
import { trimQuotes } from "../../platform/common/helpers";
import { IPlatformService } from "../../platform/common/platform/types";
import { IConfigurationService } from "../../platform/common/types";
import { DataScience } from "../../platform/common/utils/localize";
import { noop } from "../../platform/common/utils/misc";
import { logger } from "../../platform/logging";
import { Telemetry } from "../../telemetry";
import { IFileGeneratedCodes } from "../editor-integration/types";
import { IInteractiveWindowDebugger } from "../types";
import { buildSourceMap } from "./helper";

/**
 * Public API to begin debugging in the interactive window
 */
@injectable()
export class InteractiveWindowDebugger implements IInteractiveWindowDebugger {
	private configs: WeakMap<NotebookDocument, DebugConfiguration> =
		new WeakMap<NotebookDocument, DebugConfiguration>();

	private readonly debuggerPackage: string;

	private readonly enableDebuggerCode: string;

	private readonly waitForDebugClientCode: string;

	private readonly tracingEnableCode: string;

	private readonly tracingDisableCode: string;

	private debuggingActive: boolean = false;

	constructor(
		@inject(IPythonApiProvider)
		private readonly apiProvider: IPythonApiProvider,
		@inject(IConfigurationService)
		private configService: IConfigurationService,
		@inject(IJupyterDebugService)
		@named(Identifiers.MULTIPLEXING_DEBUGSERVICE)
		private debugService: IJupyterDebugService,
		@inject(IPlatformService) private platform: IPlatformService,
	) {
		this.debuggerPackage = "debugpy";

		this.enableDebuggerCode = `import debugpy;debugpy.listen(('localhost', 0))`;

		this.waitForDebugClientCode = `import debugpy;debugpy.wait_for_client()`;

		this.tracingEnableCode = `from debugpy import trace_this_thread;trace_this_thread(True)`;

		this.tracingDisableCode = `from debugpy import trace_this_thread;trace_this_thread(False)`;
	}

	public async attach(kernel: IKernel): Promise<void> {
		if (!kernel.session) {
			throw new Error("Notebook not initialized");
		}

		const settings = this.configService.getSettings(kernel.resourceUri);

		// The python extension debugger tags the debug configuration with the python path used on the python property
		// by tagging this here (if available) we can treat IW or python extension debug session the same in knowing
		// which python launched them
		const pythonPath = kernel.kernelConnectionMetadata.interpreter?.uri;

		return this.startDebugSession(
			(c) => this.debugService.startDebugging(undefined, c),
			kernel,
			{
				justMyCode: settings.debugJustMyCode,
				python: pythonPath,
			},
		);
	}

	public async detach(kernel: IKernel): Promise<void> {
		if (!kernel.session) {
			return;
		}

		const notebook = kernel.notebook;

		const config = this.configs.get(notebook);

		if (config) {
			logger.info("stop debugging");

			// Tell our debug service to shutdown if possible
			this.debuggingActive = false;

			this.debugService.stop();

			// Disable tracing after we disconnect because we don't want to step through this
			// code if the user was in step mode.
			if (kernel.status !== "dead" && kernel.status !== "unknown") {
				this.disable(kernel);
			}
		}
	}

	public async updateSourceMaps(
		hashes: IFileGeneratedCodes[],
	): Promise<void> {
		// Make sure that we have an active debugging session at this point
		if (this.debugService.activeDebugSession && this.debuggingActive) {
			logger.ci(`Sending debug request for source map`);

			await Promise.all(
				hashes.map(async (fileHash) => {
					if (this.debuggingActive) {
						return this.debugService.activeDebugSession!.customRequest(
							"setPydevdSourceMap",
							buildSourceMap(fileHash),
						);
					}
				}),
			);
		}
	}

	public enable(kernel: IKernel) {
		if (!kernel.session?.kernel) {
			return;
		}

		executeSilently(kernel.session.kernel, this.tracingEnableCode, {
			traceErrors: true,
			traceErrorsMessage:
				"Execute_request failure enabling tracing code for IW",
			telemetryName: Telemetry.InteractiveWindowDebugSetupCodeFailure,
		}).catch(noop);
	}

	public disable(kernel: IKernel) {
		if (!kernel.session?.kernel) {
			return;
		}

		executeSilently(kernel.session.kernel, this.tracingDisableCode, {
			traceErrors: true,
			traceErrorsMessage:
				"Execute_request failure disabling tracing code for IW",
			telemetryName: Telemetry.InteractiveWindowDebugSetupCodeFailure,
		}).catch(noop);
	}

	private async startDebugSession(
		startCommand: (config: DebugConfiguration) => Thenable<boolean>,
		kernel: IKernel,
		extraConfig: Partial<DebugConfiguration>,
	) {
		logger.info("start debugging");

		if (!kernel.session?.kernel) {
			return;
		}
		// Try to connect to this notebook
		const config = await this.connect(kernel, extraConfig);

		if (config) {
			logger.info("connected to notebook during debugging");

			this.debuggingActive = await startCommand(config);

			if (this.debuggingActive) {
				// Force the debugger to update its list of breakpoints. This is used
				// to make sure the breakpoint list is up to date when we do code file hashes
				this.debugService.removeBreakpoints([]);

				// Wait for attach before we turn on tracing and allow the code to run, if the IDE is already attached this is just a no-op
				const importResults = await executeSilently(
					kernel.session.kernel,
					this.waitForDebugClientCode,
					{
						traceErrors: true,
						traceErrorsMessage:
							"Execute_request failure starting debug session for IW",
						telemetryName:
							Telemetry.InteractiveWindowDebugSetupCodeFailure,
					},
				);

				if (
					importResults.some((item) => item.output_type === "error")
				) {
					logger.warn(`${this.debuggerPackage} not found in path.`);
				} else {
					logger.info(
						`import startup: ${getPlainTextOrStreamOutput(importResults)}`,
					);
				}

				// After attach initially disable debugging
				await this.disable(kernel);
			}
		}
	}

	private async connect(
		kernel: IKernel,
		extraConfig: Partial<DebugConfiguration>,
	): Promise<DebugConfiguration | undefined> {
		const notebook = kernel.notebook;
		// If we already have configuration, we're already attached, don't do it again.
		const key = notebook;

		let result = this.configs.get(key);

		if (result) {
			return {
				...result,
				...extraConfig,
			};
		}

		logger.info("enable debugger attach");

		// Append any specific debugger paths that we have
		await this.appendDebuggerPaths(kernel);

		// Connect local or remote based on what type of notebook we're talking to
		result = {
			type: "python",
			name: "IPython",
			request: "attach",
			...extraConfig,
		};

		const { host, port } = await this.connectToLocal(kernel);

		result.host = host;

		result.port = port;

		if (result.port) {
			this.configs.set(notebook, result);

			// Sign up for any change to the kernel to delete this config.
			const disposables: Disposable[] = [];

			const clear = () => {
				this.configs.delete(key);

				disposables.forEach((d) => d.dispose());
			};

			disposables.push(kernel.onDisposed(clear));

			disposables.push(kernel.onRestarted(clear));
		}

		return result;
	}

	private async calculateDebuggerPathList(
		kernel: IKernel,
	): Promise<string | undefined> {
		const extraPaths: string[] = [];

		// Add the settings path first as it takes precedence over the ptvsd extension path
		// eslint-disable-next-line no-multi-str
		let settingsPath = this.configService.getSettings(
			kernel.resourceUri,
		).debugpyDistPath;
		// Escape windows path chars so they end up in the source escaped
		if (settingsPath) {
			if (this.platform.isWindows) {
				settingsPath = settingsPath.replace(/\\/g, "\\\\");
			}

			extraPaths.push(settingsPath);
		}

		// For a local connection we also need will append on the path to the debugger
		// installed locally by the extension
		// Actually until this is resolved: https://github.com/microsoft/vscode-python/issues/7615, skip adding
		// this path.
		if (isLocalConnection(kernel.kernelConnectionMetadata)) {
			let localPath = await this.getDebuggerPath();

			if (this.platform.isWindows) {
				localPath = localPath.replace(/\\/g, "\\\\");
			}

			extraPaths.push(localPath);
		}

		if (extraPaths && extraPaths.length > 0) {
			return extraPaths.reduce((totalPath, currentPath) => {
				if (totalPath.length === 0) {
					totalPath = `'${currentPath}'`;
				} else {
					totalPath = `${totalPath}, '${currentPath}'`;
				}

				return totalPath;
			}, "");
		}

		return undefined;
	}

	public getDebuggerPath(): Promise<string> {
		return this.apiProvider.getApi().then((api) => api.getDebuggerPath());
	}

	// Append our local debugger path and debugger settings path to sys.path
	private async appendDebuggerPaths(kernel: IKernel): Promise<void> {
		const debuggerPathList = await this.calculateDebuggerPathList(kernel);

		if (debuggerPathList && debuggerPathList.length > 0) {
			const result = kernel.session?.kernel
				? await executeSilently(
						kernel.session.kernel,
						`import sys as _VSCODE_sys\r\n_VSCODE_sys.path.extend([${debuggerPathList}])\r\n_VSCODE_sys.path\r\ndel _VSCODE_sys`,
						{
							traceErrors: true,
							traceErrorsMessage:
								"Execute_request failure appending debugger paths for IW",
							telemetryName:
								Telemetry.InteractiveWindowDebugSetupCodeFailure,
						},
					)
				: [];

			logger.info(
				`Appending paths: ${getPlainTextOrStreamOutput(result)}`,
			);
		}
	}

	private async connectToLocal(
		kernel: IKernel,
	): Promise<{ port: number; host: string }> {
		const outputs = kernel.session?.kernel
			? await executeSilently(
					kernel.session.kernel,
					this.enableDebuggerCode,
					{
						traceErrors: true,
						traceErrorsMessage:
							"Execute_request failure enabling debugging for IW",
						telemetryName:
							Telemetry.InteractiveWindowDebugSetupCodeFailure,
					},
				)
			: [];

		// Pull our connection info out from the cells returned by enable_attach
		if (outputs.length > 0) {
			// Debugger can log warning messages, we need to exclude those.
			// Simplest is to test each output.
			for (const output of outputs) {
				let enableAttachString = getPlainTextOrStreamOutput([output]);

				if (enableAttachString) {
					enableAttachString = trimQuotes(enableAttachString);

					// Important: This regex matches the format of the string returned from enable_attach. When
					// doing enable_attach remotely, make sure to print out a string in the format ('host', port)
					const debugInfoRegEx = /\('(.*?)', ([0-9]*)\)/;

					const debugInfoMatch =
						debugInfoRegEx.exec(enableAttachString);

					if (debugInfoMatch) {
						return {
							port: parseInt(debugInfoMatch[2], 10),
							host: debugInfoMatch[1],
						};
					}
				}
			}
		}
		// if we cannot parse the connect information, throw so we exit out of debugging
		if (outputs.length > 0 && outputs[0].output_type === "error") {
			const error = outputs[0] as nbformat.IError;

			throw new JupyterDebuggerNotInstalledError(
				this.debuggerPackage,
				error.ename,
				kernel.kernelConnectionMetadata,
			);
		}

		throw new JupyterDebuggerNotInstalledError(
			DataScience.jupyterDebuggerOutputParseError(this.debuggerPackage),
			undefined,
			kernel.kernelConnectionMetadata,
		);
	}
}
