define(() =>
	(() => {
		"use strict";
		var e,
			n = {};
		return (
			(e = n),
			Object.defineProperty(e, "__esModule", { value: !0 }),
			(e.load_ipython_extension = void 0),
			window.require &&
				window.require.config({
					map: { "*": { bqplot: "nbextensions/bqplot/index" } },
				}),
			(e.load_ipython_extension = function () {}),
			n
		);
	})());
