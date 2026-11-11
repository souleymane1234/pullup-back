function markUpdatedOps() {
  try {
    var spec = window.ui.specSelectors.specJson().toJS();
    var paths = spec.paths || {};
    Object.keys(paths).forEach(function (path) {
      var item = paths[path];
      Object.keys(item).forEach(function (method) {
        var op = item[method];
        if (!op || typeof op !== 'object' || !op['x-updated']) return;
        document.querySelectorAll('.opblock').forEach(function (block) {
          var p = block.querySelector('.opblock-summary-path');
          var m = block.querySelector('.opblock-summary-method');
          if (!p || !m) return;
          var shown = (p.getAttribute('data-path') || p.textContent).trim();
          if (
            shown === path &&
            m.textContent.trim().toLowerCase() === method &&
            !block.classList.contains('opblock-updated')
          ) {
            block.classList.add('opblock-updated');
          }
        });
      });
    });
  } catch (_err) {
    /* spec pas encore chargé */
  }
}

window.ui = window.SwaggerUIBundle({
  url: '/api/docs/openapi.json',
  dom_id: '#swagger-ui',
  persistAuthorization: true,
  withCredentials: true,
  filter: true,
  docExpansion: 'list',
  defaultModelsExpandDepth: -1,
  displayRequestDuration: true,
  requestInterceptor: function (request) {
    request.credentials = 'include';
    return request;
  },
  onComplete: function () {
    markUpdatedOps();
    var root = document.getElementById('swagger-ui');
    if (!root || window.__pullupUpdatedObs) return;
    window.__pullupUpdatedObs = new MutationObserver(markUpdatedOps);
    window.__pullupUpdatedObs.observe(root, { childList: true, subtree: true });
  },
  tagsSorter: function (a, b) {
    if (a === 'Admin') return -1;
    if (b === 'Admin') return 1;
    return a.localeCompare(b, 'fr');
  },
  operationsSorter: function (a, b) {
    var order = { get: 0, post: 1, put: 2, delete: 3 };
    var d = (order[a.get('method')] ?? 9) - (order[b.get('method')] ?? 9);
    return d !== 0 ? d : a.get('path').localeCompare(b.get('path'));
  },
});
