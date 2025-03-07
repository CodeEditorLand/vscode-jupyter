// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { injectable } from "inversify";

import {
	IAsyncDisposable,
	IAsyncDisposableRegistry,
	IDisposable,
} from "./types";

/**
 * List of disposables where the dispose function returns a promise instead of a void.
 */
@injectable()
export class AsyncDisposableRegistry implements IAsyncDisposableRegistry {
	private _list: (IDisposable | IAsyncDisposable)[] = [];

	public async dispose(): Promise<void> {
		const promises = this._list.map((l) => l.dispose());

		await Promise.all(promises);

		this._list = [];
	}

	public push(disposable?: IDisposable | IAsyncDisposable) {
		if (disposable) {
			this._list.push(disposable);
		}
	}

	public get list(): (IDisposable | IAsyncDisposable)[] {
		return this._list;
	}
}
