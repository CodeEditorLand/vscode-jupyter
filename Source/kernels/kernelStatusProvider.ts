// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable } from "inversify";
import { Disposable } from "vscode";

import { IExtensionSyncActivationService } from "../platform/activation/types";
import { IDisposable, IDisposableRegistry } from "../platform/common/types";
import { DisposableStore, dispose } from "../platform/common/utils/lifecycle";
import { DataScience } from "../platform/common/utils/localize";
import { KernelProgressReporter } from "../platform/progress/kernelProgressReporter";
import { getDisplayNameOrNameOfKernelConnection } from "./helpers";
import { IKernel, IKernelProvider } from "./types";

@injectable()
export class KernelStatusProvider implements IExtensionSyncActivationService {
	private readonly disposables: IDisposable[] = [];

	private readonly restartProgress = new WeakMap<IKernel, IDisposable>();

	private readonly interruptProgress = new WeakMap<IKernel, IDisposable>();

	constructor(
		@inject(IKernelProvider)
		private readonly kernelProvider: IKernelProvider,
		@inject(IDisposableRegistry) disposables: IDisposableRegistry,
	) {
		disposables.push(this);
	}

	public dispose(): void {
		dispose(this.disposables);
	}

	activate(): void {
		this.kernelProvider.onDidCreateKernel(
			this.onDidCreateKernel,
			this,
			this.disposables,
		);

		this.kernelProvider.onDidDisposeKernel(
			(kernel) => {
				this.restartProgress.get(kernel)?.dispose();

				this.interruptProgress.get(kernel)?.dispose();
			},
			this,
			this.disposables,
		);
	}

	private onDidCreateKernel(kernel: IKernel) {
		// Restart status.
		kernel.addHook(
			"willRestart",
			async () => {
				this.restartProgress.get(kernel)?.dispose();

				const progress = KernelProgressReporter.createProgressReporter(
					kernel.resourceUri,
					DataScience.restartingKernelStatus(
						`: ${getDisplayNameOrNameOfKernelConnection(kernel.kernelConnectionMetadata)}`,
					),
				);

				this.restartProgress.set(kernel, progress);
			},
			this,
			this.disposables,
		);

		kernel.addHook(
			"restartCompleted",
			async () => {
				this.restartProgress.get(kernel)?.dispose();

				this.interruptProgress.get(kernel)?.dispose();
			},
			this,
			this.disposables,
		);

		kernel.addHook(
			"willInterrupt",
			async () => {
				// Wait for around 1s before displaying the notification
				// Generally interrupts completely fairly quickly, in < 1s
				// Hence no point displaying a notification just to hide that immediately after its displayed
				const disposable = new DisposableStore();

				const timeout = setTimeout(() => {
					if (disposable.isDisposed) {
						return;
					}

					disposable.add(
						KernelProgressReporter.createProgressReporter(
							kernel.resourceUri,
							DataScience.interruptKernelStatus(
								getDisplayNameOrNameOfKernelConnection(
									kernel.kernelConnectionMetadata,
								),
							),
						),
					);
				}, 1_000);

				disposable.add(new Disposable(() => clearTimeout(timeout)));

				this.interruptProgress.set(kernel, disposable);
			},
			this,
			this.disposables,
		);

		kernel.addHook(
			"interruptCompleted",
			async () => this.interruptProgress.get(kernel)?.dispose(),
			this,
			this.disposables,
		);
	}
}
