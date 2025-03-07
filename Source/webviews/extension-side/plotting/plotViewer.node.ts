// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable } from "inversify";
import { Uri, window } from "vscode";

import { IWebviewPanelProvider } from "../../../platform/common/application/types";
import { IFileSystemNode } from "../../../platform/common/platform/types.node";
import {
	IConfigurationService,
	IExtensionContext,
} from "../../../platform/common/types";
import { createDeferred } from "../../../platform/common/utils/async";
import * as localize from "../../../platform/common/utils/localize";
import { noop } from "../../../platform/common/utils/misc";
import { base64ToUint8Array } from "../../../platform/common/utils/string";
import { logger } from "../../../platform/logging";
import * as path from "../../../platform/vscode-path/path";
import { PlotViewer as PlotViewerBase } from "./plotViewer";
import { IExportPlotRequest } from "./types";

@injectable()
export class PlotViewer extends PlotViewerBase {
	constructor(
		@inject(IWebviewPanelProvider) provider: IWebviewPanelProvider,
		@inject(IConfigurationService) configuration: IConfigurationService,
		@inject(IFileSystemNode) private fsNode: IFileSystemNode,
		@inject(IExtensionContext) context: IExtensionContext,
	) {
		super(provider, configuration, fsNode, context);
	}

	protected override async exportPlot(
		payload: IExportPlotRequest,
	): Promise<void> {
		logger.info("exporting plot...");

		const filtersObject: Record<string, string[]> = {};

		filtersObject[localize.DataScience.pdfFilter] = ["pdf"];

		filtersObject[localize.DataScience.pngFilter] = ["png"];

		filtersObject[localize.DataScience.svgFilter] = ["svg"];

		// Ask the user what file to save to
		const file = await window.showSaveDialog({
			saveLabel: localize.DataScience.exportPlotTitle,
			filters: filtersObject,
		});

		try {
			if (file) {
				const ext = path.extname(file.fsPath);

				switch (ext.toLowerCase()) {
					case ".pdf":
						await saveSvgToPdf(payload.svg, this.fsNode, file);

						break;

					case ".png":
						const buffer = base64ToUint8Array(
							payload.png.replace("data:image/png;base64", ""),
						);

						await this.fs.writeFile(file, buffer);

						break;

					default:
					case ".svg":
						// This is the easy one:
						await this.fs.writeFile(file, payload.svg);

						break;
				}
			}
		} catch (e) {
			logger.error(e);

			window
				.showErrorMessage(localize.DataScience.exportImageFailed(e))
				.then(noop, noop);
		}
	}
}

export async function saveSvgToPdf(
	svg: string,
	fs: IFileSystemNode,
	file: Uri,
) {
	logger.info("Attempting pdf write...");
	// Import here since pdfkit is so huge.
	const SVGtoPDF = (await import("svg-to-pdfkit")).default;

	const deferred = createDeferred<void>();
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const pdfkit =
		require("pdfkit/js/pdfkit.standalone") as typeof import("pdfkit");

	const doc = new pdfkit();

	const ws = fs.createLocalWriteStream(file.fsPath);

	logger.info(`Writing pdf to ${file.fsPath}`);

	ws.on("finish", () => deferred.resolve);
	// See docs or demo from source https://cdn.statically.io/gh/alafr/SVG-to-PDFKit/master/examples/demo.htm
	// How to resize to fit (fit within the height & width of page).
	SVGtoPDF(doc, svg, 0, 0, { preserveAspectRatio: "xMinYMin meet" });

	doc.pipe(ws);

	doc.end();

	logger.info(`Finishing pdf to ${file.fsPath}`);

	await deferred.promise;

	logger.info(`Completed pdf to ${file.fsPath}`);
}
