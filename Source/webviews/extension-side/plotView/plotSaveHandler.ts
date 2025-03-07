// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable } from "inversify";
import {
	NotebookCellOutput,
	NotebookDocument,
	Uri,
	window,
	workspace,
} from "vscode";

import { getDisplayPath } from "../../../platform/common/platform/fs-paths";
import { IFileSystem } from "../../../platform/common/platform/types";
import { DataScience } from "../../../platform/common/utils/localize";
import { logger } from "../../../platform/logging";
import * as path from "../../../platform/vscode-path/path";
import { IPlotSaveHandler } from "./types";

export const svgMimeType = "image/svg+xml";

export const imageExtensionForMimeType: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpeg",
	"image/gif": "gif",
	[svgMimeType]: "svg",
};

@injectable()
export class PlotSaveHandler implements IPlotSaveHandler {
	constructor(@inject(IFileSystem) private readonly fs: IFileSystem) {}

	public async savePlot(
		notebook: NotebookDocument,
		outputId: string,
		mimeType: string,
	) {
		if (notebook.isClosed) {
			return;
		}

		const output = getOutputItem(notebook, outputId, mimeType);

		if (!output) {
			return logger.error(
				`No plot to save ${getDisplayPath(notebook.uri)}, id: ${outputId} for ${mimeType}`,
			);
		}

		if (!(mimeType.toLowerCase() in imageExtensionForMimeType)) {
			return logger.error(
				`Unsupported MimeType ${getDisplayPath(notebook.uri)}, id: ${outputId} for ${mimeType}`,
			);
		}

		const saveLocation = await this.getSaveTarget(output, mimeType);

		if (!saveLocation) {
			return;
		}

		if (saveLocation.path.toLowerCase().endsWith("pdf")) {
			await this.saveAsPdf(output, saveLocation);
		} else {
			await this.saveAsImage(output, saveLocation);
		}
	}

	private getSaveTarget(output: NotebookCellOutput, mimeType: string) {
		const imageExtension =
			imageExtensionForMimeType[mimeType.toLowerCase()];

		const filters: Record<string, string[]> = {};
		// If we have an SVG, then we can export to PDF.
		if (
			output.items.find((item) => item.mime.toLowerCase() === svgMimeType)
		) {
			filters[DataScience.pdfFilter] = ["pdf"];

			filters[DataScience.svgFilter] = ["svg"];
		}

		if (imageExtension === "png") {
			filters[DataScience.pngFilter] = ["png"];
		}

		if (Object.keys(filters).length === 0) {
			filters["Images"] = [imageExtension];
		}

		const workspaceUri =
			(workspace.workspaceFolders?.length || 0) > 0
				? workspace.workspaceFolders![0].uri
				: undefined;

		const fileName = `output`;

		const defaultUri = workspaceUri
			? Uri.joinPath(workspaceUri, fileName)
			: Uri.file(fileName);

		return window.showSaveDialog({
			defaultUri,
			saveLabel: DataScience.exportPlotTitle,
			filters,
		});
	}

	private async saveAsImage(output: NotebookCellOutput, target: Uri) {
		const extension = path.extname(target.path).substring(1);

		const correspondingMimeType = Object.keys(
			imageExtensionForMimeType,
		).find((mime) => imageExtensionForMimeType[mime] === extension);

		const data = output.items.find(
			(item) => item.mime === correspondingMimeType,
		);

		if (!data) {
			throw new Error(
				`Unsupported MimeType ${target.toString()}, available mime Types: ${output.items
					.map((item) => item.mime)
					.join(", ")}`,
			);
		}

		await this.fs.writeFile(target, data.data);
	}

	protected async saveAsPdf(_output: NotebookCellOutput, _target: Uri) {
		return logger.error(`Save as PDF is not yet supported on the web.`);
	}
}

function getOutputItem(
	notebook: NotebookDocument,
	outputId: string,
	mimeType: string,
): NotebookCellOutput | undefined {
	for (const cell of notebook.getCells()) {
		for (const output of cell.outputs) {
			if (output.id !== outputId) {
				continue;
			}

			if (output.items.find((item) => item.mime === mimeType)) {
				return output;
			}
		}
	}
}
