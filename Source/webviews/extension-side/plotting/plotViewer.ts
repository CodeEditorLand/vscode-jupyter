// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable } from "inversify";
import { Event, EventEmitter, Uri, ViewColumn, window } from "vscode";

import { IWebviewPanelProvider } from "../../../platform/common/application/types";
import { IFileSystem } from "../../../platform/common/platform/types";
import {
	IConfigurationService,
	IDisposable,
	IExtensionContext,
} from "../../../platform/common/types";
import * as localize from "../../../platform/common/utils/localize";
import { noop } from "../../../platform/common/utils/misc";
import { StopWatch } from "../../../platform/common/utils/stopWatch";
import { base64ToUint8Array } from "../../../platform/common/utils/string";
import { logger } from "../../../platform/logging";
import * as path from "../../../platform/vscode-path/path";
import { joinPath } from "../../../platform/vscode-path/resources";
import { WebviewPanelHost } from "../../../platform/webviews/webviewPanelHost";
import { sendTelemetryEvent, Telemetry } from "../../../telemetry";
import { PlotViewerMessageListener } from "./plotViewerMessageListener";
import {
	IExportPlotRequest,
	IPlotViewer,
	IPlotViewerMapping,
	PlotViewerMessages,
} from "./types";

@injectable()
export class PlotViewer
	extends WebviewPanelHost<IPlotViewerMapping>
	implements IPlotViewer, IDisposable
{
	private closedEvent: EventEmitter<IPlotViewer> =
		new EventEmitter<IPlotViewer>();

	private removedEvent: EventEmitter<number> = new EventEmitter<number>();

	constructor(
		@inject(IWebviewPanelProvider) provider: IWebviewPanelProvider,
		@inject(IConfigurationService) configuration: IConfigurationService,
		@inject(IFileSystem) protected fs: IFileSystem,
		@inject(IExtensionContext) readonly context: IExtensionContext,
	) {
		const startupTimer = new StopWatch();

		const plotDir = joinPath(
			context.extensionUri,
			"dist",
			"webviews",
			"webview-side",
			"viewers",
		);

		super(
			configuration,
			provider,
			(c, v, d) => new PlotViewerMessageListener(c, v, d),
			plotDir,
			[joinPath(plotDir, "plotViewer.js")],
			localize.DataScience.plotViewerTitle,
			ViewColumn.One,
		);
		// Load the web panel using our current directory as we don't expect to load any other files
		super
			.loadWebview(Uri.file(process.cwd()))
			.catch(logger.error)
			.finally(() => {
				// Send our telemetry for the webview loading when the load is done.
				sendTelemetryEvent(Telemetry.PlotViewerWebviewLoaded, {
					duration: startupTimer.elapsedTime,
				});
			});
	}

	public get closed(): Event<IPlotViewer> {
		return this.closedEvent.event;
	}

	public get removed(): Event<number> {
		return this.removedEvent.event;
	}

	public override async show(): Promise<void> {
		if (!this.isDisposed) {
			// Then show our web panel.
			return super.show(true);
		}
	}

	public addPlot = async (imageHtml: string): Promise<void> => {
		if (!this.isDisposed) {
			// Make sure we're shown
			await super.show(false);

			// Send a message with our data
			this.postMessage(PlotViewerMessages.SendPlot, imageHtml).catch(
				noop,
			);
		}
	};

	public override dispose() {
		super.dispose();

		this.removedEvent.dispose();

		if (this.closedEvent) {
			this.closedEvent.fire(this);
		}
	}

	protected get owningResource() {
		return undefined;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	protected override onMessage(message: string, payload: any) {
		switch (message) {
			case PlotViewerMessages.CopyPlot:
				this.copyPlot(payload.toString()).catch(noop);

				break;

			case PlotViewerMessages.ExportPlot:
				this.exportPlot(payload).catch(noop);

				break;

			case PlotViewerMessages.RemovePlot:
				this.removePlot(payload);

				break;

			default:
				break;
		}

		super.onMessage(message, payload);
	}

	private removePlot(payload: number) {
		this.removedEvent.fire(payload);
	}

	private copyPlot(_svg: string): Promise<void> {
		// This should be handled actually in the web view. Leaving
		// this here for now in case need node to handle it.
		return Promise.resolve();
	}

	protected async exportPlot(payload: IExportPlotRequest): Promise<void> {
		logger.info("exporting plot...");

		const filtersObject: Record<string, string[]> = {};

		filtersObject[localize.DataScience.pngFilter] = ["png"];

		filtersObject[localize.DataScience.svgFilter] = ["svg"];

		// Ask the user what file to save to
		const file = await window.showSaveDialog({
			saveLabel: localize.DataScience.exportPlotTitle,
			filters: filtersObject,
		});

		try {
			if (file) {
				const ext = path.extname(file.path);

				switch (ext.toLowerCase()) {
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
				.showErrorMessage(
					localize.DataScience.exportImageFailed(e.toString()),
				)
				.then(noop, noop);
		}
	}
}
