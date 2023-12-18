// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable } from "inversify";
import { IConfigurationService } from "../../platform/common/types";
import { ProgressReporter } from "../../platform/progress/progressReporter";
import { FileConverterBase } from "./fileConverter";
import { IExportUtil } from "./types";

/**
 * Converts different file formats to others. Used in export.
 */
@injectable()
export class FileConverter extends FileConverterBase {
	constructor(
		@inject(IExportUtil) override readonly exportUtil: IExportUtil,
		@inject(ProgressReporter) progressReporter: ProgressReporter,
		@inject(IConfigurationService) configuration: IConfigurationService
	) {
		super(exportUtil, progressReporter, configuration);
	}
}
