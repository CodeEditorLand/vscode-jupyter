// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import "./emptyRowsView.css";

import { getLocString } from "../react-common/locReactSide";

export type IEmptyRowsProps = {};

export const EmptyRows = (_props: IEmptyRowsProps) => {
	const message = getLocString(
		"noRowsInDataViewer",
		"No rows match current filter",
	);

	return <div className="container">{message}</div>;
};
