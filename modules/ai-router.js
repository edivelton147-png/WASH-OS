(function(){
  const DEFAULT_ROUTE = { provider: 'manual', model: null, manualOutputs: ['chatgpt', 'claude'] };
  let routes = null;
  let routesPromise = null;

  function normalizeRoute(route) {
    if (!route || typeof route !== 'object') return { ...DEFAULT_ROUTE };
    return {
      provider: route.provider || DEFAULT_ROUTE.provider,
      model: route.model || null,
      manualOutputs: Array.isArray(route.manualOutputs) && route.manualOutputs.length
        ? route.manualOutputs
        : DEFAULT_ROUTE.manualOutputs,
    };
  }

  async function loadRoutesOnce() {
    if (routes) return routes;
    if (!routesPromise) {
      routesPromise = fetch('/config/ai-routes.json', { cache: 'no-cache' })
        .then(response => {
          if (!response.ok) throw new Error(`ai-routes.json ${response.status}`);
          return response.json();
        })
        .then(data => {
          routes = data && typeof data === 'object' ? data : {};
          return routes;
        })
        .catch(error => {
          console.warn('WASH-OS AI routes unavailable; using manual fallback.', error);
          routes = {};
          return routes;
        });
    }
    return routesPromise;
  }

  function installSyncRouter(loadedRoutes) {
    if (typeof window === 'undefined') return;
    window.WashAI = window.WashAI || {};
    window.WashAI.AI_ROUTES = loadedRoutes;
    window.WashAI.routeAI = taskType => normalizeRoute(loadedRoutes[taskType] || loadedRoutes.default);
  }

  async function routeAI({ task, complexity, input } = {}) {
    const loadedRoutes = await loadRoutesOnce();
    installSyncRouter(loadedRoutes);
    return normalizeRoute(loadedRoutes[task] || loadedRoutes.default);
  }

  if (typeof window !== 'undefined') {
    window.WashAIRouter = window.WashAIRouter || {};
    window.WashAIRouter.routeAI = routeAI;
    window.WashAIRouter.loadRoutesOnce = loadRoutesOnce;
  }

  if (typeof module !== 'undefined') {
    module.exports = { routeAI, loadRoutesOnce };
  }
})();
