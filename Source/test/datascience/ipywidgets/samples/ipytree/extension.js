define(() =>
	(() => {
		var e = {
				758: (e, r, t) => {
					(t.p =
						document
							.querySelector("body")
							.getAttribute("data-base-url") +
						"nbextensions/ipytree"),
						window.require &&
							window.require.config({
								map: {
									"*": {
										ipytree: "nbextensions/ipytree/index",
									},
								},
							}),
						(e.exports = {
							load_ipython_extension: function () {},
						});
				},
			},
			r = {};
		function t(n) {
			if (r[n]) return r[n].exports;
			var i = (r[n] = { exports: {} });
			return e[n](i, i.exports, t), i.exports;
		}
		return (t.p = ""), t(758);
	})());
