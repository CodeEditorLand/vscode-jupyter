// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EventEmitter } from "events";
import { Container, decorate, injectable, interfaces } from "inversify";

import { logger } from "../logging";
import { Abstract, IServiceContainer, Newable } from "./types";

// This needs to be done once, hence placed in a common location.
// Used by UnitTestSockerServer and also the extension unit tests.
// Place within try..catch, as this can only be done once (it's
// possible another extension would perform this before our extension).
try {
	decorate(injectable(), EventEmitter);
} catch (ex) {
	logger.warn(
		"Failed to decorate EventEmitter for DI (possibly already decorated by another Extension)",
		ex,
	);
}

/**
 * Wrapper around an inversify container. Provides get access to different services.
 */
@injectable()
export class ServiceContainer implements IServiceContainer {
	public static get instance(): IServiceContainer {
		return ServiceContainer._instance;
	}

	private static _instance: IServiceContainer;

	constructor(private container: Container) {
		ServiceContainer._instance = this;
	}

	public get<T>(
		serviceIdentifier: interfaces.ServiceIdentifier<T>,
		name?: string | number | symbol,
	): T {
		return name
			? this.container.getNamed<T>(serviceIdentifier, name)
			: this.container.get<T>(serviceIdentifier);
	}

	public getAll<T>(
		serviceIdentifier: string | symbol | Newable<T> | Abstract<T>,
		name?: string | number | symbol | undefined,
	): T[] {
		return name
			? this.container.getAllNamed<T>(serviceIdentifier, name)
			: this.container.getAll<T>(serviceIdentifier);
	}

	public tryGet<T>(
		serviceIdentifier: interfaces.ServiceIdentifier<T>,
		name?: string | number | symbol | undefined,
	): T | undefined {
		try {
			return name
				? this.container.getNamed<T>(serviceIdentifier, name)
				: this.container.get<T>(serviceIdentifier);
		} catch {
			// This might happen after the container has been destroyed
		}
	}
}
