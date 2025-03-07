// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {
	PortAttributes,
	PortAutoForwardAction,
	workspace,
	type CancellationToken,
	type PortAttributesProvider,
	type PortAttributesSelector,
} from "vscode";

import { DisposableStore } from "../../platform/common/utils/lifecycle";
import { logger } from "../../platform/logging";

// Keeps track of all ports used by Kernels and other processes spawned by Kernels and related code
export const UsedPorts = new Set<number>();

export function ignorePortForwarding(...ports: number[]) {
	const disposableStore = new DisposableStore();

	try {
		const provider = new (class implements PortAttributesProvider {
			async providePortAttributes(
				attributes: {
					port: number;

					pid?: number;

					commandLine?: string;
				},
				_token: CancellationToken,
			) {
				if (ports.includes(attributes.port)) {
					return new PortAttributes(PortAutoForwardAction.Ignore);
				}

				return undefined;
			}
		})();

		for (const port of ports) {
			const portSelector: PortAttributesSelector = {
				portRange: port,
			};

			disposableStore.add(
				workspace.registerPortAttributesProvider(
					portSelector,
					provider,
				),
			);
		}
	} catch (ex) {
		// In case proposed API changes.
		logger.error("Failure in registering port attributes", ex);
	}

	return disposableStore;
}
