// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable } from "inversify";
import {
	Event,
	EventEmitter,
	Uri,
	WebviewOptions,
	WebviewView as vscodeWebviewView,
} from "vscode";
import {
	IWebviewView,
	IWebviewViewOptions,
	IWebviewViewProvider,
} from "../common/application/types";
import { IFileSystem } from "../common/platform/types";
import { IDisposableRegistry } from "../common/types";
import { noop } from "../common/utils/misc";
import { Webview } from "./webview";

class WebviewView extends Webview implements IWebviewView {
	public get visible(): boolean {
		if (this.webviewHost) {
			return this.webviewHost.visible;
		} else {
			return false;
		}
	}
	public get onDidChangeVisibility(): Event<void> {
		return this._onDidChangeVisibility.event;
	}
	private readonly _onDidChangeVisibility = new EventEmitter<void>();
	constructor(
		fs: IFileSystem,
		disposableRegistry: IDisposableRegistry,
		private panelOptions: IWebviewViewOptions,
		additionalRootPaths: Uri[] = [],
	) {
		super(fs, disposableRegistry, panelOptions, additionalRootPaths);
	}

	protected createWebview(
		_webviewOptions: WebviewOptions,
	): vscodeWebviewView {
		throw new Error("Webview Views must be passed in an initial view");
	}

	protected postLoad(webviewHost: vscodeWebviewView) {
		// Reset when the current panel is closed
		this.disposableRegistry.push(
			webviewHost.onDidDispose(() => {
				this.webviewHost = undefined;
				this.panelOptions.listener.dispose().catch(noop);
			}),
		);

		this.disposableRegistry.push(
			webviewHost.webview.onDidReceiveMessage((message) => {
				// Pass the message onto our listener
				this.panelOptions.listener.onMessage(
					message.type,
					message.payload,
				);
			}),
		);

		this.disposableRegistry.push(
			webviewHost.onDidChangeVisibility(() => {
				this._onDidChangeVisibility.fire();
			}),
		);

		// Fire one inital visibility change once now as we have loaded
		this._onDidChangeVisibility.fire();
	}
}

@injectable()
export class WebviewViewProvider implements IWebviewViewProvider {
	constructor(
		@inject(IDisposableRegistry)
		private readonly disposableRegistry: IDisposableRegistry,
		@inject(IFileSystem) private readonly fs: IFileSystem
	) {}

	public async create(options: IWebviewViewOptions): Promise<IWebviewView> {
		return new WebviewView(this.fs, this.disposableRegistry, options);
	}
}
