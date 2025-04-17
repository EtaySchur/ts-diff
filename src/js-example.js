// CommonJS style import
const ReactRouter = require('react-router-dom');

// ES6 destructuring with CommonJS
const { Route, Switch } = require('react-router-dom');

// Use imported symbols
function createRoute(path, component) {
  return ReactRouter.Route({
    path,
    component
  });
}

function renderRoutes(routes) {
  return (
    ReactRouter.Switch({}, 
      routes.map(route => Route({ path: route.path, component: route.component }))
    )
  );
}

// Using dynamic import
async function loadRouter() {
  const router = await import('react-router-dom');
  return router.BrowserRouter;
}

// AMD style (RequireJS)
require(['react-router-dom'], function(reactRouter) {
  const router = reactRouter.BrowserRouter;
  console.log('Router loaded!', router);
});

module.exports = {
  createRoute,
  renderRoutes,
  loadRouter
}; 