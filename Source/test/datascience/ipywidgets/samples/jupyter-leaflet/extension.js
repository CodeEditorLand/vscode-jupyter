define(() => {
	return (
		(e = {
			474: (e) => {
				window.require &&
					window.require.config({
						map: {
							"*": {
								"jupyter-leaflet":
									"nbextensions/jupyter-leaflet/index",
							},
						},
					}),
					(e.exports = { load_ipython_extension: function () {} });
			},
		}),
		(r = {}),
		(function n(t) {
			if (r[t]) return r[t].exports;
			var o = (r[t] = { exports: {} });
			return e[t](o, o.exports, n), o.exports;
		})(474)
	);
	var e, r;
});
