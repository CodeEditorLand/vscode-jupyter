// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable } from "inversify";
import { languages } from "vscode";

import { IExtensionSyncActivationService } from "../../platform/activation/types";
import { PYTHON_FILE_ANY_SCHEME } from "../../platform/common/constants";
import { IExtensionContext } from "../../platform/common/types";
import { ICellRangeCache, IDataScienceCodeLensProvider } from "./types";

@injectable()
export class CodeLensProviderActivator
	implements IExtensionSyncActivationService
{
	constructor(
		@inject(IDataScienceCodeLensProvider)
		private dataScienceCodeLensProvider: IDataScienceCodeLensProvider,
		@inject(IExtensionContext) private extensionContext: IExtensionContext,
		@inject(ICellRangeCache) cellRangeCache: ICellRangeCache,
	) {
		// make sure this is tracking the cell ranges and updating context keys to be used for shift+enter,
		// even when code lenses and decorations are disabled
		cellRangeCache;
	}

	public activate() {
		this.extensionContext.subscriptions.push(
			languages.registerCodeLensProvider(
				[PYTHON_FILE_ANY_SCHEME],
				this.dataScienceCodeLensProvider,
			),
		);
	}
}
