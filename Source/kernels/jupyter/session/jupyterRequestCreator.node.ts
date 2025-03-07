// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { injectable } from "inversify";
import WebSocketIsomorphic from "isomorphic-ws";
import * as nodeFetch from "node-fetch";

import { noop } from "../../../platform/common/utils/misc";
import { ClassType } from "../../../platform/ioc/types";
import { logger } from "../../../platform/logging";
import { KernelSocketWrapper } from "../../common/kernelSocketWrapper";
import { KernelSocketMap } from "../../kernelSocket";
import { IJupyterRequestCreator } from "../types";

// Function for creating node Request object that prevents jupyterlab services from writing its own
// authorization header.
/* eslint-disable @typescript-eslint/no-explicit-any */
@injectable()
export class JupyterRequestCreator implements IJupyterRequestCreator {
	public getRequestCtor(
		_cookieString?: string,
		_allowUnauthorized?: boolean,
		getAuthHeader?: () => any,
	) {
		// Only need the authorizing part. Cookie and rejectUnauthorized are set in the websocket ctor for node.
		class AuthorizingRequest extends nodeFetch.Request {
			constructor(
				input: nodeFetch.RequestInfo,
				init?: nodeFetch.RequestInit,
			) {
				super(input, init);

				// Add all of the authorization parts onto the headers.
				const origHeaders = this.headers;

				const authorizationHeader = getAuthHeader!();

				const keys = Object.keys(authorizationHeader);

				keys.forEach((k) =>
					origHeaders.append(k, authorizationHeader[k].toString()),
				);

				origHeaders.set("Content-Type", "application/json");

				// Rewrite the 'append' method for the headers to disallow 'authorization' after this point
				const origAppend = origHeaders.append.bind(origHeaders);

				origHeaders.append = (k, v) => {
					if (k.toLowerCase() !== "authorization") {
						origAppend(k, v);
					}
				};
			}
		}

		return (
			getAuthHeader && Object.keys(getAuthHeader() || {}).length
				? AuthorizingRequest
				: nodeFetch.Request
		) as any;
	}

	public getWebsocketCtor(
		cookieString?: string,
		allowUnauthorized?: boolean,
		getAuthHeaders?: () => Record<string, string>,
	): ClassType<WebSocket> {
		const generateOptions = (): WebSocketIsomorphic.ClientOptions => {
			let co: WebSocketIsomorphic.ClientOptions = {};

			let co_headers: { [key: string]: string } | undefined;

			if (allowUnauthorized) {
				co = { ...co, rejectUnauthorized: false };
			}

			if (cookieString) {
				co_headers = { Cookie: cookieString };
			}

			// Auth headers have to be refetched every time we create a connection. They may have expired
			// since the last connection.
			if (getAuthHeaders) {
				const authorizationHeader = getAuthHeaders();

				co_headers = co_headers
					? { ...co_headers, ...authorizationHeader }
					: authorizationHeader;
			}

			if (co_headers) {
				co = { ...co, headers: co_headers };
			}

			return co;
		};

		class JupyterWebSocket extends KernelSocketWrapper(
			WebSocketIsomorphic,
		) {
			private kernelId: string | undefined;

			private timer: NodeJS.Timeout | number;

			constructor(
				url: string,
				protocols?: string | string[] | undefined,
			) {
				super(url, protocols, generateOptions());

				let timer: NodeJS.Timeout | undefined = undefined;
				// Parse the url for the kernel id
				const parsed = /.*\/kernels\/(.*)\/.*/.exec(url);

				if (parsed && parsed.length > 1) {
					this.kernelId = parsed[1];
				}

				if (this.kernelId) {
					KernelSocketMap.set(this.kernelId, this);

					this.on("close", () => {
						if (timer && this.timer !== timer) {
							clearInterval(timer as any);
						}

						if (KernelSocketMap.get(this.kernelId!) === this) {
							KernelSocketMap.delete(this.kernelId!);
						}
					});
				} else {
					logger.error(
						"KernelId not extracted from Kernel WebSocket URL",
					);
				}

				// Ping the websocket connection every 30 seconds to make sure it stays alive
				timer = this.timer = setInterval(() => this.ping(noop), 30_000);
			}
		}

		return JupyterWebSocket as any;
	}

	public wrapWebSocketCtor(
		websocketCtor: ClassType<WebSocketIsomorphic>,
	): ClassType<WebSocketIsomorphic> {
		class JupyterWebSocket extends KernelSocketWrapper(websocketCtor) {
			private kernelId: string | undefined;

			private timer: NodeJS.Timeout | number;

			constructor(
				url: string,
				protocols?: string | string[] | undefined,
				options?: unknown,
			) {
				super(url, protocols, options);

				let timer: NodeJS.Timeout | undefined = undefined;
				// Parse the url for the kernel id
				const parsed = /.*\/kernels\/(.*)\/.*/.exec(url);

				if (parsed && parsed.length > 1) {
					this.kernelId = parsed[1];
				}

				if (this.kernelId) {
					KernelSocketMap.set(this.kernelId, this);

					this.on("close", () => {
						if (timer && this.timer !== timer) {
							clearInterval(timer as any);
						}

						if (KernelSocketMap.get(this.kernelId!) === this) {
							KernelSocketMap.delete(this.kernelId!);
						}
					});
				} else {
					logger.error(
						"KernelId not extracted from Kernel WebSocket URL",
					);
				}

				// Ping the websocket connection every 30 seconds to make sure it stays alive
				timer = this.timer = setInterval(() => this.ping(noop), 30_000);
			}
		}

		return JupyterWebSocket as any;
	}

	public getFetchMethod(): (
		input: RequestInfo,
		init?: RequestInit,
	) => Promise<Response> {
		return nodeFetch.default as any;
	}

	public getHeadersCtor(): ClassType<Headers> {
		return nodeFetch.Headers as any;
	}

	public getRequestInit(): RequestInit {
		return { cache: "no-store", credentials: "same-origin" };
	}
}
