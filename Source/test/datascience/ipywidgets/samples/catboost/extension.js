define(() => {
	return (
		(e = {
			474: (e) => {
				window.require &&
					window.require.config({
						map: {
							"*": {
								"catboost-widget":
									"nbextensions/catboost-widget/index",
							},
						},
					}),
					(e.exports = { load_ipython_extension: function () {} });
			},
		}),
		(o = {}),
		(function t(n) {
			var r = o[n];
			if (void 0 !== r) return r.exports;
			var i = (o[n] = { exports: {} });
			return e[n](i, i.exports, t), i.exports;
		})(474)
	);
	var e, o;
});
