const { AI_ROUTES, DEFAULT_AI_ROUTE, routeAI } = require('./router.js');

const taskTypes = ['meeting', 'proposal', 'ocr', 'quickTask'];

function assertValidRoute(taskType, route) {
  if (!route || !route.provider || !route.model) {
    throw new Error(`Invalid route for ${taskType}: ${JSON.stringify(route)}`);
  }
}

taskTypes.forEach((taskType) => {
  const route = routeAI(taskType);
  assertValidRoute(taskType, route);
  console.log(taskType, route);
});

const defaultRoute = routeAI('unknownTask');
assertValidRoute('unknownTask', defaultRoute);

if (defaultRoute !== AI_ROUTES[DEFAULT_AI_ROUTE]) {
  throw new Error('Unknown taskType did not return the default AI route');
}

console.log('default', defaultRoute);
console.log('AI Router tests passed');
