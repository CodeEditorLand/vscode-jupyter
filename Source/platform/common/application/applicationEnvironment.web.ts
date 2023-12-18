// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable } from "inversify";
import { Uri } from "vscode";
import { IExtensionContext } from "../types";
import { BaseApplicationEnvironment } from "./applicationEnvironment.base";

/**
 * BaseApplicationEnvironment for web. Some properties are not available in web.
 */
@injectable()
export class ApplicationEnvironment extends BaseApplicationEnvironment {
	public get userSettingsFile(): Uri | undefined {
		return undefined;
	}
	public get userCustomKeybindingsFile(): Uri | undefined {
		return undefined;
	}
	constructor(
		@inject(IExtensionContext) extensionContext: IExtensionContext
	) {
		super(extensionContext);
	}
}
