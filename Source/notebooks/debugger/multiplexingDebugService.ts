// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable, named, optional } from "inversify";
import {
	Breakpoint,
	BreakpointsChangeEvent,
	commands,
	DebugAdapterTrackerFactory,
	DebugConfiguration,
	DebugConfigurationProvider,
	DebugConsole,
	DebugSession,
	DebugSessionCustomEvent,
	Disposable,
	Event,
	EventEmitter,
	WorkspaceFolder,
} from "vscode";
import { DebugProtocol } from "vscode-debugprotocol";

import { IDebugService } from "../../platform/common/application/types";
import { Identifiers } from "../../platform/common/constants";
import { IDisposableRegistry } from "../../platform/common/types";
import { noop } from "../../platform/common/utils/misc";
import { IJupyterDebugService } from "./debuggingTypes";

/**
 * IJupyterDebugService that will pick the correct debugger based on if doing run by line or normal debugging.
 * RunByLine will use the JupyterDebugService, Normal debugging will use the VS code debug service.
 */
@injectable()
export class MultiplexingDebugService implements IJupyterDebugService {
	private lastStartedService: IDebugService | undefined;
	private sessionChangedEvent: EventEmitter<DebugSession | undefined> =
		new EventEmitter<DebugSession | undefined>();
	private sessionStartedEvent: EventEmitter<DebugSession> =
		new EventEmitter<DebugSession>();
	private sessionTerminatedEvent: EventEmitter<DebugSession> =
		new EventEmitter<DebugSession>();
	private sessionCustomEvent: EventEmitter<DebugSessionCustomEvent> =
		new EventEmitter<DebugSessionCustomEvent>();

	constructor(
		@inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
		@inject(IDebugService) private vscodeDebugService: IDebugService,
		@optional()
		@inject(IJupyterDebugService)
		@named(Identifiers.RUN_BY_LINE_DEBUGSERVICE)
		private jupyterDebugService: IJupyterDebugService | undefined,
	) {
		disposableRegistry.push(
			vscodeDebugService.onDidTerminateDebugSession(
				this.endedDebugSession.bind(this),
			),
		);
		disposableRegistry.push(
			vscodeDebugService.onDidStartDebugSession(
				this.startedDebugSession.bind(this),
			),
		);
		disposableRegistry.push(
			vscodeDebugService.onDidChangeActiveDebugSession(
				this.changedDebugSession.bind(this),
			),
		);
		disposableRegistry.push(
			vscodeDebugService.onDidReceiveDebugSessionCustomEvent(
				this.gotCustomEvent.bind(this),
			),
		);

		if (jupyterDebugService) {
			disposableRegistry.push(
				jupyterDebugService.onDidTerminateDebugSession(
					this.endedDebugSession.bind(this),
				),
			);
			disposableRegistry.push(
				jupyterDebugService.onDidStartDebugSession(
					this.startedDebugSession.bind(this),
				),
			);
			disposableRegistry.push(
				jupyterDebugService.onDidChangeActiveDebugSession(
					this.changedDebugSession.bind(this),
				),
			);
			disposableRegistry.push(
				jupyterDebugService.onDidReceiveDebugSessionCustomEvent(
					this.gotCustomEvent.bind(this),
				),
			);
		}
	}
	public get activeDebugSession(): DebugSession | undefined {
		return this.activeService.activeDebugSession;
	}

	public get activeDebugConsole(): DebugConsole {
		return this.activeService.activeDebugConsole;
	}
	public get breakpoints(): readonly Breakpoint[] {
		return this.activeService.breakpoints;
	}
	public get onDidChangeActiveDebugSession(): Event<
		DebugSession | undefined
	> {
		return this.sessionChangedEvent.event;
	}
	public get onDidStartDebugSession(): Event<DebugSession> {
		return this.sessionStartedEvent.event;
	}
	public get onDidReceiveDebugSessionCustomEvent(): Event<DebugSessionCustomEvent> {
		return this.sessionCustomEvent.event;
	}
	public get onDidTerminateDebugSession(): Event<DebugSession> {
		return this.sessionTerminatedEvent.event;
	}
	public get onDidChangeBreakpoints(): Event<BreakpointsChangeEvent> {
		return this.activeService.onDidChangeBreakpoints;
	}
	public get onBreakpointHit(): Event<void> {
		if (!this.jupyterDebugService) {
			throw new Error("No jupyter debugger service");
		}
		return this.jupyterDebugService.onBreakpointHit;
	}
	public startRunByLine(config: DebugConfiguration): Thenable<boolean> {
		this.lastStartedService = this.jupyterDebugService;

		if (!this.jupyterDebugService) {
			throw new Error("No jupyter debugger service");
		}
		return this.jupyterDebugService.startRunByLine(config);
	}
	public registerDebugConfigurationProvider(
		debugType: string,
		provider: DebugConfigurationProvider,
	): Disposable {
		const d1 = this.vscodeDebugService.registerDebugConfigurationProvider(
			debugType,
			provider,
		);

		if (this.jupyterDebugService) {
			const d2 =
				this.jupyterDebugService.registerDebugConfigurationProvider(
					debugType,
					provider,
				);

			return this.combineDisposables(d1, d2);
		}
		return d1;
	}
	public registerDebugAdapterTrackerFactory(
		debugType: string,
		factory: DebugAdapterTrackerFactory,
	): Disposable {
		const d1 = this.vscodeDebugService.registerDebugAdapterTrackerFactory(
			debugType,
			factory,
		);

		if (this.jupyterDebugService) {
			const d2 =
				this.jupyterDebugService.registerDebugAdapterTrackerFactory(
					debugType,
					factory,
				);

			return this.combineDisposables(d1, d2);
		}
		return d1;
	}
	public startDebugging(
		folder: WorkspaceFolder | undefined,
		nameOrConfiguration: string | DebugConfiguration,
		parentSession?: DebugSession | undefined,
	): Thenable<boolean> {
		this.lastStartedService = this.vscodeDebugService;

		return this.vscodeDebugService.startDebugging(
			folder,
			nameOrConfiguration,
			parentSession,
		);
	}
	public addBreakpoints(breakpoints: Breakpoint[]): void {
		return this.activeService.addBreakpoints(breakpoints);
	}
	public removeBreakpoints(breakpoints: Breakpoint[]): void {
		return this.activeService.removeBreakpoints(breakpoints);
	}

	public getStack(): Promise<DebugProtocol.StackFrame[]> {
		if (!this.jupyterDebugService) {
			throw new Error("No jupyter debugger service");
		}
		if (this.lastStartedService === this.jupyterDebugService) {
			return this.jupyterDebugService.getStack();
		}
		throw new Error(
			"Requesting jupyter specific stack when not debugging.",
		);
	}
	public step(): Promise<void> {
		if (!this.jupyterDebugService) {
			throw new Error("No jupyter debugger service");
		}
		if (this.lastStartedService === this.jupyterDebugService) {
			return this.jupyterDebugService.step();
		}
		throw new Error("Requesting jupyter specific step when not debugging.");
	}
	public continue(): Promise<void> {
		if (!this.jupyterDebugService) {
			throw new Error("No jupyter debugger service");
		}
		if (this.lastStartedService === this.jupyterDebugService) {
			return this.jupyterDebugService.continue();
		}
		throw new Error("Requesting jupyter specific step when not debugging.");
	}
	public requestVariables(): Promise<void> {
		if (!this.jupyterDebugService) {
			throw new Error("No jupyter debugger service");
		}
		if (this.lastStartedService === this.jupyterDebugService) {
			return this.jupyterDebugService.requestVariables();
		}
		throw new Error(
			"Requesting jupyter specific variables when not debugging.",
		);
	}

	public stop(): void {
		if (
			this.jupyterDebugService &&
			this.lastStartedService === this.jupyterDebugService
		) {
			this.jupyterDebugService.stop();
		} else {
			// Stop our debugging UI session, no await as we just want it stopped
			commands
				.executeCommand("workbench.action.debug.stop")
				.then(noop, noop);
		}
	}

	private get activeService(): IDebugService {
		if (this.lastStartedService) {
			return this.lastStartedService;
		} else {
			return this.vscodeDebugService;
		}
	}

	private combineDisposables(d1: Disposable, d2: Disposable): Disposable {
		return {
			dispose: () => {
				d1.dispose();
				d2.dispose();
			},
		};
	}

	private endedDebugSession(session: DebugSession) {
		this.sessionTerminatedEvent.fire(session);
		this.lastStartedService = undefined;
	}

	private startedDebugSession(session: DebugSession) {
		this.sessionStartedEvent.fire(session);
	}

	private changedDebugSession(session: DebugSession | undefined) {
		this.sessionChangedEvent.fire(session);
	}

	private gotCustomEvent(e: DebugSessionCustomEvent) {
		this.sessionCustomEvent.fire(e);
	}
}
