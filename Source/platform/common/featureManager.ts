// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable } from "inversify";
import {
	commands,
	Disposable,
	EventEmitter,
	window,
	workspace,
	WorkspaceConfiguration,
} from "vscode";

import { logger } from "../logging";
import { openInBrowser } from "./net/browser";
import {
	DeprecatedFeatureInfo,
	DeprecatedSettingAndValue,
	IFeatureSet,
	IFeaturesManager,
	IPersistentStateFactory,
} from "./types";
import { Deprecated } from "./utils/localize";

const deprecatedFeatures: DeprecatedFeatureInfo[] = [
	{
		doNotDisplayPromptStateKey:
			"SHOW_DEPRECATED_FEATURE_PROMPT_FORMAT_ON_SAVE",
		message: Deprecated.SHOW_DEPRECATED_FEATURE_PROMPT_FORMAT_ON_SAVE,
		moreInfoUrl: "https://github.com/Microsoft/vscode-python/issues/309",
		setting: { setting: "formatting.formatOnSave", values: ["true", true] },
	},
	{
		doNotDisplayPromptStateKey:
			"SHOW_DEPRECATED_FEATURE_PROMPT_LINT_ON_TEXT_CHANGE",
		message: Deprecated.SHOW_DEPRECATED_FEATURE_PROMPT_LINT_ON_TEXT_CHANGE,
		moreInfoUrl: "https://github.com/Microsoft/vscode-python/issues/313",
		setting: {
			setting: "linting.lintOnTextChange",
			values: ["true", true],
		},
	},
	{
		doNotDisplayPromptStateKey:
			"SHOW_DEPRECATED_FEATURE_PROMPT_FOR_AUTO_COMPLETE_PRELOAD_MODULES",
		message:
			Deprecated.SHOW_DEPRECATED_FEATURE_PROMPT_FOR_AUTO_COMPLETE_PRELOAD_MODULES,
		moreInfoUrl: "https://github.com/Microsoft/vscode-python/issues/1704",
		setting: { setting: "autoComplete.preloadModules" },
	},
];

/**
 * Manages experimental and deprecated of features.
 * Commands that are deprecated end up here.
 */
@injectable()
export class FeatureManager implements IFeaturesManager {
	private _onDidChangeFeatures = new EventEmitter<void>();

	readonly onDidChangeFeatures = this._onDidChangeFeatures.event;

	private _features: IFeatureSet = {};

	get features(): IFeatureSet {
		return this._features;
	}

	set features(newFeatures: IFeatureSet) {
		this._features = newFeatures;

		this._onDidChangeFeatures.fire();
	}

	private disposables: Disposable[] = [];

	constructor(
		@inject(IPersistentStateFactory)
		private persistentStateFactory: IPersistentStateFactory,
	) {
		this._updateFeatures();

		this.disposables.push(
			workspace.onDidChangeConfiguration(() => {
				this._updateFeatures();
			}),
		);
	}

	private _updateFeatures() {
		this.features = {};
	}

	public dispose() {
		this.disposables.forEach((disposable) => disposable.dispose());
	}

	public initialize() {
		deprecatedFeatures.forEach(this.registerDeprecation.bind(this));
	}

	public registerDeprecation(deprecatedInfo: DeprecatedFeatureInfo): void {
		if (Array.isArray(deprecatedInfo.commands)) {
			deprecatedInfo.commands.forEach((cmd) => {
				this.disposables.push(
					commands.registerCommand(
						cmd,
						() => this.notifyDeprecation(deprecatedInfo),
						this,
					),
				);
			});
		}

		if (deprecatedInfo.setting) {
			this.checkAndNotifyDeprecatedSetting(deprecatedInfo);
		}
	}

	public async notifyDeprecation(
		deprecatedInfo: DeprecatedFeatureInfo,
	): Promise<void> {
		const notificationPromptEnabled =
			this.persistentStateFactory.createGlobalPersistentState(
				deprecatedInfo.doNotDisplayPromptStateKey,
				true,
			);

		if (!notificationPromptEnabled.value) {
			return;
		}

		const moreInfo = "Learn more";

		const doNotShowAgain = "Never show again";

		const option = await window.showInformationMessage(
			deprecatedInfo.message,
			moreInfo,
			doNotShowAgain,
		);

		if (!option) {
			return;
		}

		switch (option) {
			case moreInfo: {
				openInBrowser(deprecatedInfo.moreInfoUrl);

				break;
			}

			case doNotShowAgain: {
				await notificationPromptEnabled.updateValue(false);

				break;
			}

			default: {
				throw new Error("Selected option not supported.");
			}
		}

		return;
	}

	public checkAndNotifyDeprecatedSetting(
		deprecatedInfo: DeprecatedFeatureInfo,
	) {
		let notify = false;

		if (
			Array.isArray(workspace.workspaceFolders) &&
			workspace.workspaceFolders.length > 0
		) {
			workspace.workspaceFolders.forEach((workspaceFolder) => {
				if (notify) {
					return;
				}

				notify = this.isDeprecatedSettingAndValueUsed(
					workspace.getConfiguration("jupyter", workspaceFolder.uri),
					deprecatedInfo.setting!,
				);
			});
		} else {
			notify = this.isDeprecatedSettingAndValueUsed(
				workspace.getConfiguration("jupyter"),
				deprecatedInfo.setting!,
			);
		}

		if (notify) {
			this.notifyDeprecation(deprecatedInfo).catch((ex) =>
				logger.debug("Jupyter Extension: notifyDeprecation", ex),
			);
		}
	}

	public isDeprecatedSettingAndValueUsed(
		pythonConfig: WorkspaceConfiguration,
		deprecatedSetting: DeprecatedSettingAndValue,
	) {
		if (!pythonConfig.has(deprecatedSetting.setting)) {
			return false;
		}

		const configValue = pythonConfig.get(deprecatedSetting.setting);

		if (
			!Array.isArray(deprecatedSetting.values) ||
			deprecatedSetting.values.length === 0
		) {
			if (Array.isArray(configValue)) {
				return configValue.length > 0;
			}

			return true;
		}

		if (
			!Array.isArray(deprecatedSetting.values) ||
			deprecatedSetting.values.length === 0
		) {
			if (configValue === undefined) {
				return false;
			}

			if (Array.isArray(configValue)) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				return (configValue as any[]).length > 0;
			}
			// If we have a value in the setting, then return.
			return true;
		}

		return (
			deprecatedSetting.values.indexOf(
				pythonConfig.get<{}>(deprecatedSetting.setting)!,
			) >= 0
		);
	}
}
