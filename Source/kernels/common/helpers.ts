// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { Kernel, KernelMessage, Session } from "@jupyterlab/services";
import { CancellationError, CancellationToken, Disposable } from "vscode";

import { IDisposable, Resource } from "../../platform/common/types";
import { createDeferred, raceTimeout } from "../../platform/common/utils/async";
import { dispose } from "../../platform/common/utils/lifecycle";
import { DataScience } from "../../platform/common/utils/localize";
import { noop, swallowExceptions } from "../../platform/common/utils/misc";
import { logger } from "../../platform/logging";
import { KernelProgressReporter } from "../../platform/progress/kernelProgressReporter";
import { JupyterInvalidKernelError } from "../errors/jupyterInvalidKernelError";
import { JupyterWaitForIdleError } from "../errors/jupyterWaitForIdleError";
import { KernelConnectionMetadata } from "../types";

export async function waitForIdleOnSession(
	kernelConnectionMetadata: KernelConnectionMetadata,
	resource: Resource,
	session: Session.ISessionConnection,
	timeout: number,
	token: CancellationToken,
): Promise<void> {
	if (!session.kernel) {
		throw new JupyterInvalidKernelError(kernelConnectionMetadata);
	}

	const progress = KernelProgressReporter.reportProgress(
		resource,
		DataScience.waitingForJupyterSessionToBeIdle,
	);

	const disposables: IDisposable[] = [];

	if (progress) {
		disposables.push(progress);
	}

	try {
		logger.trace(
			`Waiting for idle on (kernel): ${session.kernel.id} -> ${session.kernel.status}`,
		);

		// When our kernel connects and gets a status message it triggers the ready promise
		const kernelStatus = createDeferred<string>();

		token.onCancellationRequested(
			() => kernelStatus.reject(new CancellationError()),
			undefined,
			disposables,
		);

		const handler = (
			_session: Kernel.IKernelConnection,
			status: KernelMessage.Status,
		) => {
			logger.trace(`Got status ${status} in waitForIdleOnSession`);

			if (status == "idle") {
				kernelStatus.resolve(status);
			}
		};

		session.kernel.statusChanged?.connect(handler);

		disposables.push(
			new Disposable(() =>
				swallowExceptions(() =>
					session.kernel?.statusChanged?.disconnect(handler),
				),
			),
		);

		if (session.kernel.status == "idle") {
			kernelStatus.resolve(session.kernel.status);
		}
		// Check for possibility that kernel has died.
		const sessionDisposed = createDeferred<string>();

		const sessionDisposedHandler = () => sessionDisposed.resolve("");

		session.disposed.connect(sessionDisposedHandler, sessionDisposed);

		disposables.push(
			new Disposable(() =>
				swallowExceptions(() =>
					session.disposed.disconnect(
						sessionDisposedHandler,
						sessionDisposed,
					),
				),
			),
		);

		sessionDisposed.promise.catch(noop);

		kernelStatus.promise.catch(noop);

		const result = await raceTimeout(
			timeout,
			"",
			kernelStatus.promise,
			sessionDisposed.promise,
		);

		if (session.isDisposed) {
			logger.error(
				"Session disposed while waiting for session to be idle.",
			);

			throw new JupyterInvalidKernelError(kernelConnectionMetadata);
		}

		logger.trace(
			`Finished waiting for idle on (kernel): ${session.kernel.id} -> ${session.kernel.status}`,
		);

		if (result == "idle") {
			return;
		}

		logger.error(
			`Shutting down after failing to wait for idle on (kernel): ${session.kernel.id} -> ${session.kernel.status}`,
		);

		throw new JupyterWaitForIdleError(kernelConnectionMetadata);
	} catch (ex) {
		logger.ci(`Error waiting for idle`, ex);

		throw ex;
	} finally {
		dispose(disposables);
	}
}
