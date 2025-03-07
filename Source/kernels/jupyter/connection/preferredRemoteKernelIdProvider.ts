// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable, named } from "inversify";
import { Memento, NotebookDocument, Uri } from "vscode";

import { getDisplayPath } from "../../../platform/common/platform/fs-paths";
import {
	GLOBAL_MEMENTO,
	ICryptoUtils,
	IMemento,
} from "../../../platform/common/types";
import { logger } from "../../../platform/logging";

export const ActiveKernelIdList = "Active_Kernel_Id_List";
// This is the number of kernel ids that will be remembered between opening and closing VS code
export const MaximumKernelIdListSize = 100;

type KernelIdListEntry = {
	fileHash: string;

	kernelId: string | undefined;
};

/**
 * Saves the preferred kernel for a given notebook
 */
@injectable()
export class PreferredRemoteKernelIdProvider {
	constructor(
		@inject(IMemento)
		@named(GLOBAL_MEMENTO)
		private readonly globalMemento: Memento,
		@inject(ICryptoUtils) private crypto: ICryptoUtils,
	) {}

	public async getPreferredRemoteKernelId(
		notebook: NotebookDocument,
	): Promise<string | undefined> {
		// Stored as a list so we don't take up too much space
		const list: KernelIdListEntry[] = this.globalMemento.get<
			KernelIdListEntry[]
		>(ActiveKernelIdList, []);

		if (list.length) {
			const uri = notebook.uri;
			// Not using a map as we're only going to store the last 40 items.
			const fileHash = await this.crypto.createHash(uri.toString());

			const entry = list.find((l) => l.fileHash === fileHash);

			logger.trace(
				`Preferred Remote kernel for ${getDisplayPath(uri)} is ${entry?.kernelId}`,
			);

			return entry?.kernelId;
		}
	}

	public async clearPreferredRemoteKernelId(uri: Uri): Promise<void> {
		await this.updatePreferredRemoteKernelIdInternal(uri);
	}

	public async storePreferredRemoteKernelId(
		uri: Uri,
		id: string,
	): Promise<void> {
		await this.updatePreferredRemoteKernelIdInternal(uri, id);
	}

	private async updatePreferredRemoteKernelIdInternal(
		uri: Uri,
		id?: string,
	): Promise<void> {
		let requiresUpdate = false;

		// Don't update in memory representation.
		const list: KernelIdListEntry[] = JSON.parse(
			JSON.stringify(
				this.globalMemento.get<KernelIdListEntry[]>(
					ActiveKernelIdList,
					[],
				),
			),
		);

		const fileHash = await this.crypto.createHash(uri.toString());

		const index = list.findIndex((l) => l.fileHash === fileHash);
		// Always remove old spot (we'll push on the back for new ones)
		if (index >= 0) {
			requiresUpdate = true;

			list.splice(index, 1);
		}

		// If adding a new one, push
		if (id) {
			requiresUpdate = true;

			list.push({ fileHash, kernelId: id });

			logger.trace(
				`Storing Preferred remote kernel for ${getDisplayPath(uri)} is ${id}`,
			);
		}

		// Prune list if too big
		while (list.length > MaximumKernelIdListSize) {
			requiresUpdate = true;

			list.shift();
		}

		if (requiresUpdate) {
			await this.globalMemento.update(ActiveKernelIdList, list);
		}
	}
}
