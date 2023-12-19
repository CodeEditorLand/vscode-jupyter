// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { computeHash } from "../common/crypto";
import { traceError } from "../logging";

export function getTelemetrySafeVersion(version: string): string | undefined {
	try {
		// Split by `.` & take only the first 3 numbers.
		// Suffix with '.', so we know we'll always have 3 items in the array.
		const [major, minor, patch] = `${version.trim()}...`
			.split(".")
			.map((item) => parseInt(item, 10));
		if (Number.isNaN(major)) {
			return;
		} else if (Number.isNaN(minor)) {
			return major.toString();
		} else if (Number.isNaN(patch)) {
			return `${major}.${minor}`;
		}
		return `${major}.${minor}.${patch}`;
	} catch (ex) {
		traceError(`Failed to parse version ${version}`, ex);
	}
}

/**
 * Safe way to send data in telemetry (obfuscate PII).
 */
export async function getTelemetrySafeHashedString(data: string) {
	return computeHash(data, "SHA-256");
}
