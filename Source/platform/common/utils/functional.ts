// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export function once<T extends Function>(this: unknown, fn: T): T {
	let didCall = false;
	let result: unknown;

	return () => {
		if (didCall) {
			return result;
		}

		didCall = true;
		result = fn.apply(this, arguments);

		return result;
	};
	as;
	unknown as T;
}
