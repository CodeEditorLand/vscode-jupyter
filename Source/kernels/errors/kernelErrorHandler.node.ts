// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable, optional } from "inversify";
import { Uri } from "vscode";

import { getDisplayPath } from "../../platform/common/platform/fs-paths";
import { IFileSystem } from "../../platform/common/platform/types";
import { IConfigurationService, Resource } from "../../platform/common/types";
import { Common, DataScience } from "../../platform/common/utils/localize";
import { JupyterKernelStartFailureOverrideReservedName } from "../../platform/interpreter/constants";
import { IInterpreterService } from "../../platform/interpreter/contracts";
import { IReservedPythonNamedProvider } from "../../platform/interpreter/types";
import * as path from "../../platform/vscode-path/resources";
import {
	IJupyterInterpreterDependencyManager,
	IJupyterServerProviderRegistry,
	IJupyterServerUriStorage,
} from "../jupyter/types";
import { IKernelDependencyService } from "../types";
import { DataScienceErrorHandler } from "./kernelErrorHandler";

/**
 * Common code for handling errors. This one is node specific.
 */
@injectable()
export class DataScienceErrorHandlerNode extends DataScienceErrorHandler {
	constructor(
		@inject(IJupyterInterpreterDependencyManager)
		@optional()
		dependencyManager: IJupyterInterpreterDependencyManager | undefined,
		@inject(IConfigurationService) configuration: IConfigurationService,
		@inject(IKernelDependencyService)
		@optional()
		kernelDependency: IKernelDependencyService | undefined,
		@inject(IJupyterServerUriStorage)
		serverUriStorage: IJupyterServerUriStorage,
		@inject(IJupyterServerProviderRegistry)
		jupyterUriProviderRegistration: IJupyterServerProviderRegistry,
		@inject(IReservedPythonNamedProvider)
		private readonly reservedPythonNames: IReservedPythonNamedProvider,
		@inject(IFileSystem) fs: IFileSystem,
		@inject(IInterpreterService) interpreterService: IInterpreterService,
	) {
		super(
			dependencyManager,
			configuration,
			kernelDependency,
			serverUriStorage,
			jupyterUriProviderRegistration,
			fs,
			interpreterService,
		);
	}

	protected override async addErrorMessageIfPythonArePossiblyOverridingPythonModules(
		messages: string[],
		resource: Resource,
	) {
		// Looks like some other module is missing.
		// Sometimes when you create files like xml.py, then kernel startup fails due to xml.dom module not being found.
		const problematicFiles =
			await this.getFilesInWorkingDirectoryThatCouldPotentiallyOverridePythonModules(
				resource,
			);

		if (problematicFiles.length > 0) {
			const cwd = resource ? path.dirname(resource) : undefined;

			const fileLinks = problematicFiles.map((item) => {
				if (item.type === "file") {
					const displayPath = resource
						? getDisplayPath(item.uri, [], cwd)
						: path.basename(item.uri);

					return `<a href='${item.uri.toString()}?line=1'>${displayPath}</a>`;
				} else {
					const displayPath = resource
						? getDisplayPath(item.uri, [], cwd)
						: `${path.basename(path.dirname(item.uri))}/__init__.py`;

					return `<a href='${item.uri.toString()}?line=1'>${displayPath}</a>`;
				}
			});

			let files = "";

			if (fileLinks.length === 1) {
				files = fileLinks[0];
			} else {
				files = `${fileLinks.slice(0, -1).join(", ")} ${Common.and} ${fileLinks.slice(-1)}`;
			}

			messages.push(
				DataScience.filesPossiblyOverridingPythonModulesMayHavePreventedKernelFromStarting(
					files,
				),
			);

			messages.push(
				DataScience.listOfFilesWithLinksThatMightNeedToBeRenamed(files),
			);

			messages.push(
				Common.clickHereForMoreInfoWithHtml(
					JupyterKernelStartFailureOverrideReservedName,
				),
			);
		}
	}

	protected override async getFilesInWorkingDirectoryThatCouldPotentiallyOverridePythonModules(
		resource: Resource,
	): Promise<{ uri: Uri; type: "file" | "__init__" }[]> {
		return resource
			? this.reservedPythonNames.getUriOverridingReservedPythonNames(
					path.dirname(resource),
				)
			: [];
	}
}
