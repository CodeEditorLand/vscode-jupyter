// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IExtensionSyncActivationService } from "../../platform/activation/types";
import { IServiceManager } from "../../platform/ioc/types";
import { DataViewer } from "./dataviewer/dataViewer";
import { DataViewerCommandRegistry } from "./dataviewer/dataViewerCommandRegistry";
import { DataViewerDelegator } from "./dataviewer/dataViewerDelegator";
import { DataViewerDependencyService } from "./dataviewer/dataViewerDependencyService";
import { DataViewerFactory } from "./dataviewer/dataViewerFactory";
import { JupyterVariableDataProvider } from "./dataviewer/jupyterVariableDataProvider";
import { JupyterVariableDataProviderFactory } from "./dataviewer/jupyterVariableDataProviderFactory";
import {
	IDataViewer,
	IDataViewerDependencyService,
	IDataViewerFactory,
	IJupyterVariableDataProvider,
	IJupyterVariableDataProviderFactory,
} from "./dataviewer/types";
import { IPyWidgetRendererComms } from "./ipywidgets/rendererComms";
import { PlotViewer } from "./plotting/plotViewer";
import { PlotViewerProvider } from "./plotting/plotViewerProvider";
import { IPlotViewer, IPlotViewerProvider } from "./plotting/types";
import { PlotSaveHandler } from "./plotView/plotSaveHandler";
import { PlotViewHandler } from "./plotView/plotViewHandler";
import { RendererCommunication } from "./plotView/rendererCommunication";
import { IPlotSaveHandler } from "./plotView/types";
import { NotebookWatcher } from "./variablesView/notebookWatcher";
import { INotebookWatcher, IVariableViewProvider } from "./variablesView/types";
import { VariableViewActivationService } from "./variablesView/variableViewActivationService";
import { VariableViewProvider } from "./variablesView/variableViewProvider";

export function registerTypes(serviceManager: IServiceManager) {
	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		RendererCommunication,
	);

	// Data viewer
	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		DataViewerCommandRegistry,
	);

	serviceManager.add<IDataViewer>(IDataViewer, DataViewer);

	serviceManager.addSingleton<IDataViewerFactory>(
		IDataViewerFactory,
		DataViewerFactory,
	);

	serviceManager.addSingleton<IDataViewerDependencyService>(
		IDataViewerDependencyService,
		DataViewerDependencyService,
	);

	serviceManager.addSingleton<DataViewerDelegator>(
		DataViewerDelegator,
		DataViewerDelegator,
	);

	// Plot Viewer
	serviceManager.add<IPlotViewer>(IPlotViewer, PlotViewer);

	serviceManager.addSingleton<IPlotViewerProvider>(
		IPlotViewerProvider,
		PlotViewerProvider,
	);

	serviceManager.addSingleton<IPlotSaveHandler>(
		IPlotSaveHandler,
		PlotSaveHandler,
	);

	serviceManager.addSingleton<PlotViewHandler>(
		PlotViewHandler,
		PlotViewHandler,
	);

	// Variables view
	serviceManager.addSingleton<INotebookWatcher>(
		INotebookWatcher,
		NotebookWatcher,
	);

	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		VariableViewActivationService,
	);

	serviceManager.addSingleton<IExtensionSyncActivationService>(
		IExtensionSyncActivationService,
		IPyWidgetRendererComms,
	);

	serviceManager.addSingleton<IVariableViewProvider>(
		IVariableViewProvider,
		VariableViewProvider,
	);

	serviceManager.add<IJupyterVariableDataProvider>(
		IJupyterVariableDataProvider,
		JupyterVariableDataProvider,
	);

	serviceManager.addSingleton<IJupyterVariableDataProviderFactory>(
		IJupyterVariableDataProviderFactory,
		JupyterVariableDataProviderFactory,
	);
}
