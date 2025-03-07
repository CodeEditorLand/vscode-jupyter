// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Environment } from "@vscode/python-extension";
import { inject, injectable } from "inversify";
import { CancellationToken, workspace } from "vscode";

import { sendTelemetryEvent } from "../../telemetry";
import { IPythonApiProvider, IPythonExtensionChecker } from "../api/types";
import { raceCancellation } from "../common/cancellation";
import { Telemetry } from "../common/constants";
import { getDisplayPath } from "../common/platform/fs-paths";
import { IDisposable, Resource } from "../common/types";
import { DataScience } from "../common/utils/localize";
import { noop } from "../common/utils/misc";
import { StopWatch } from "../common/utils/stopWatch";
import {
	ICustomEnvironmentVariablesProvider,
	IEnvironmentVariablesService,
} from "../common/variables/types";
import { debugDecorator, ignoreLogging, logger, logValue } from "../logging";
import { TraceOptions } from "../logging/types";
import { KernelProgressReporter } from "../progress/kernelProgressReporter";
import { EnvironmentType } from "../pythonEnvironments/info";
import * as path from "../vscode-path/path";
import { IEnvironmentActivationService } from "./activation/types";
import { IInterpreterService } from "./contracts";
import { GlobalPythonExecutablePathService } from "./globalPythonExePathService.node";
import {
	getEnvironmentType,
	getPythonEnvDisplayName,
	getSysPrefix,
	isCondaEnvironmentWithoutPython,
} from "./helpers";

const ENV_VAR_CACHE_TIMEOUT = 60_000;

@injectable()
export class EnvironmentActivationService
	implements IEnvironmentActivationService
{
	private readonly disposables: IDisposable[] = [];

	private readonly activatedEnvVariablesCache = new Map<
		string,
		{ promise: Promise<NodeJS.ProcessEnv | undefined>; time: StopWatch }
	>();

	constructor(
		@inject(IInterpreterService)
		private interpreterService: IInterpreterService,
		@inject(ICustomEnvironmentVariablesProvider)
		private readonly customEnvVarsService: ICustomEnvironmentVariablesProvider,
		@inject(IPythonApiProvider)
		private readonly apiProvider: IPythonApiProvider,
		@inject(IPythonExtensionChecker)
		private readonly extensionChecker: IPythonExtensionChecker,
		@inject(IEnvironmentVariablesService)
		private readonly envVarsService: IEnvironmentVariablesService,
		@inject(GlobalPythonExecutablePathService)
		private readonly globalExecPaths: GlobalPythonExecutablePathService,
	) {
		this.customEnvVarsService.onDidEnvironmentVariablesChange(
			this.clearCache,
			this,
			this.disposables,
		);

		this.interpreterService.onDidChangeInterpreter(
			this.clearCache,
			this,
			this.disposables,
		);

		this.interpreterService.onDidEnvironmentVariablesChange(
			this.clearCache,
			this,
			this.disposables,
		);
	}

	public clearCache() {
		this.activatedEnvVariablesCache.clear();

		this.cachedEnvVariables.clear();
	}

	public dispose(): void {
		this.disposables.forEach((d) => d.dispose());
	}

	public async getActivatedEnvironmentVariables(
		resource: Resource,
		interpreter: { id: string },
		token?: CancellationToken,
	): Promise<NodeJS.ProcessEnv | undefined> {
		const title = DataScience.activatingPythonEnvironment(
			getPythonEnvDisplayName(interpreter),
		);

		return KernelProgressReporter.wrapAndReportProgress(
			resource,
			title,
			async () =>
				this.getActivatedEnvironmentVariablesImplWithCaching(
					resource,
					interpreter.id,
					token,
				),
		);
	}

	private async getActivatedEnvironmentVariablesImplWithCaching(
		resource: Resource,
		interpreterId: string,
		token?: CancellationToken,
	): Promise<NodeJS.ProcessEnv | undefined> {
		const env =
			await this.interpreterService.resolveEnvironment(interpreterId);

		if (!env) {
			logger.warn(`Failed to resolve environment for ${interpreterId}`);

			return;
		}

		const key = `${resource?.toString() || ""}${interpreterId}`;

		const info = this.activatedEnvVariablesCache.get(key);

		if (info && info.time.elapsedTime >= ENV_VAR_CACHE_TIMEOUT) {
			this.activatedEnvVariablesCache.delete(key);
		}

		if (!this.activatedEnvVariablesCache.has(key)) {
			const promise = this.getActivatedEnvironmentVariablesImpl(
				resource,
				env,
				token,
			);

			promise.catch(noop);

			this.activatedEnvVariablesCache.set(key, {
				promise,
				time: new StopWatch(),
			});
		}

		const promise = this.activatedEnvVariablesCache.get(key)!.promise;

		if (token) {
			return promise;
		}

		return raceCancellation(token, promise);
	}
	@debugDecorator("Getting activated env variables", TraceOptions.Arguments)
	private async getActivatedEnvironmentVariablesImpl(
		resource: Resource,
		@logValue<Environment>("id") environment: Environment,
		token?: CancellationToken,
	): Promise<NodeJS.ProcessEnv | undefined> {
		if (!this.extensionChecker.isPythonExtensionInstalled) {
			return;
		}

		const stopWatch = new StopWatch();

		return this.getActivatedEnvironmentVariablesFromPython(
			resource,
			environment,
			token,
		)
			.then((env) => {
				if (token?.isCancellationRequested) {
					return;
				}

				return env;
			})
			.catch((ex) => {
				logger.error(
					`Failed to get env vars with python ${getDisplayPath(environment.id)} in ${
						stopWatch.elapsedTime
					}ms`,
					ex,
				);

				return undefined;
			});
	}

	private cachedEnvVariables = new Map<
		string,
		{
			promise: Promise<NodeJS.ProcessEnv | undefined>;

			lastRequestedTime: StopWatch;
		}
	>();

	private async getActivatedEnvironmentVariablesFromPython(
		resource: Resource,
		@logValue<{ id: string }>("id") environment: Environment,
		@ignoreLogging() token?: CancellationToken,
	): Promise<NodeJS.ProcessEnv | undefined> {
		const key = `${resource?.toString() || ""}${environment.id || ""}`;

		// Ensure the cache is only valid for a limited time.
		const info = this.cachedEnvVariables.get(key);

		if (
			info &&
			info.lastRequestedTime.elapsedTime > ENV_VAR_CACHE_TIMEOUT
		) {
			this.cachedEnvVariables.delete(key);
		}

		if (!this.cachedEnvVariables.has(key)) {
			const promise = this.getActivatedEnvironmentVariablesFromPythonImpl(
				resource,
				environment,
				token,
			);

			this.cachedEnvVariables.set(key, {
				promise,
				lastRequestedTime: new StopWatch(),
			});
		}

		return raceCancellation(
			token,
			this.cachedEnvVariables.get(key)!.promise,
		);
	}

	private async getActivatedEnvironmentVariablesFromPythonImpl(
		resource: Resource,
		environment: Environment,
		token?: CancellationToken,
	): Promise<NodeJS.ProcessEnv | undefined> {
		resource = resource
			? resource
			: workspace.workspaceFolders?.length
				? workspace.workspaceFolders[0].uri
				: undefined;

		const stopWatch = new StopWatch();
		// We'll need this later.
		const customEnvVarsPromise = this.customEnvVarsService
			.getEnvironmentVariables(resource, "RunPythonCode")
			.catch(() => undefined);

		// Check cache.
		let reasonForFailure:
			| "emptyVariables"
			| "failedToGetActivatedEnvVariablesFromPython"
			| "failedToGetCustomEnvVariables" = "emptyVariables";

		let failureEx: Error | undefined;

		let env = await this.apiProvider.getApi().then((api) =>
			api
				.getActivatedEnvironmentVariables(resource, environment, false)
				.catch((ex) => {
					logger.error(
						`Failed to get activated env variables from Python Extension for ${getDisplayPath(
							environment.path,
						)}`,
						ex,
					);

					reasonForFailure =
						"failedToGetActivatedEnvVariablesFromPython";

					return undefined;
				}),
		);

		if (token?.isCancellationRequested) {
			return;
		}

		const envType = getEnvironmentType(environment);

		sendTelemetryEvent(
			Telemetry.GetActivatedEnvironmentVariables,
			{ duration: stopWatch.elapsedTime },
			{
				envType,
				source: "python",
				failed: Object.keys(env || {}).length === 0,
				reason: reasonForFailure,
			},
			failureEx,
		);

		if (env) {
			logger.debug(
				`Got env vars from Python Ext in ${stopWatch.elapsedTime}ms for ${getDisplayPath(
					environment.path,
				)}, with env var count ${Object.keys(env || {}).length}.`,
			);
		} else if (envType === EnvironmentType.Conda) {
			// We must get activated env variables for Conda env, if not running stuff against conda will not work.
			// Hence we must log these as errors (so we can see them in jupyter logs).
			logger.error(
				`Failed to get activated conda env vars for ${getDisplayPath(environment.path)}
                 in ${stopWatch.elapsedTime}ms`,
			);
		} else {
			logger.warn(
				`Failed to get activated env vars for ${getDisplayPath(environment.path)} in ${stopWatch.elapsedTime}ms`,
			);
		}

		if (!env) {
			// Temporary work around until https://github.com/microsoft/vscode-python/issues/20678
			// However we might still need a work around for failure to activate conda envs without Python.
			const customEnvVars = await customEnvVarsPromise;

			env = {};

			// Patch for conda envs.
			if (getEnvironmentType(environment) === EnvironmentType.Conda) {
				const sysPrefix = await getSysPrefix(environment);

				if (sysPrefix) {
					env.CONDA_PREFIX = sysPrefix;
				} else {
					logger.warn(
						`Failed to get the SysPrefix for the Conda Environment ${getDisplayPath(environment.path)}}`,
					);
				}
			}

			this.envVarsService.mergeVariables(process.env, env); // Copy current proc vars into new obj.
			this.envVarsService.mergeVariables(customEnvVars!, env); // Copy custom vars over into obj.
			this.envVarsService.mergePaths(process.env, env);

			if (process.env.PYTHONPATH) {
				env.PYTHONPATH = process.env.PYTHONPATH;
			}

			let pathKey = customEnvVars
				? Object.keys(customEnvVars).find(
						(k) => k.toLowerCase() == "path",
					)
				: undefined;

			if (pathKey && customEnvVars![pathKey]) {
				this.envVarsService.appendPath(env, customEnvVars![pathKey]!);
			}

			if (customEnvVars!.PYTHONPATH) {
				this.envVarsService.appendPythonPath(
					env,
					customEnvVars!.PYTHONPATH,
				);
			}

			const executablesPath = await this.globalExecPaths
				.getExecutablesPath(environment)
				.catch(noop);

			if (token?.isCancellationRequested) {
				return;
			}

			const pathValue = env.PATH || env.Path;

			const pathValues = pathValue ? pathValue.split(path.delimiter) : [];
			// First value in PATH is expected to be the directory of python executable.
			// Second value in PATH is expected to be the site packages directory.
			if (executablesPath && pathValues[1] !== executablesPath.fsPath) {
				logger.trace(
					`Prepend PATH with user site path for ${getDisplayPath(environment.path)}, user site ${
						executablesPath.fsPath
					}`,
				);
				// Based on docs this is the right path and must be setup in the path.
				this.envVarsService.prependPath(env, executablesPath.fsPath);
			} else if (isCondaEnvironmentWithoutPython(environment)) {
				//
			} else {
				logger.error(
					`Unable to determine site packages path for python ${getDisplayPath(
						environment.path,
					)} (${getEnvironmentType(environment)})`,
				);
			}

			// Seems to be required on windows,
			// Without this, in Python, the PATH variable inherits the process env variables and not what we give it.
			// Probably because Python uses PATH on windows as well , even if Path is provided.
			if (!env.PATH && env.Path) {
				env.PATH = env.Path;
			}
		}

		// Ensure the first path in PATH variable points to the directory of python executable.
		// We need to add this to ensure kernels start and work correctly, else things can fail miserably.
		// This way all executables from that env are used.
		// This way shell commands such as `!pip`, `!python` end up pointing to the right executables.
		// Also applies to `!java` where java could be an executable in the conda bin directory.
		// Also required for conda environments that do not have Python installed (in the conda env).
		if (environment.executable.uri) {
			logger.trace(
				`Prepend PATH with python bin for ${getDisplayPath(environment.path)}`,
			);

			this.envVarsService.prependPath(
				env,
				path.dirname(environment.executable.uri.fsPath),
			);
		}

		return env;
	}
}
