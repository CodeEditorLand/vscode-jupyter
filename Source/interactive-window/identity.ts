// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Uri } from "vscode";
import * as localize from "../platform/common/utils/localize";
import * as path from "../platform/vscode-path/path";

export function getInteractiveWindowTitle(owner: Uri): string {
	return localize.DataScience.interactiveWindowTitleFormat(
		path.basename(owner.path),
	);
}
