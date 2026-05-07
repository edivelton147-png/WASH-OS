const AI_ROUTES = {
  meeting: {
    provider: 'openai',
    model: 'gpt-4o-transcribe',
  },
  proposal: {
    provider: 'claude',
    model: 'claude-sonnet',
  },
  ocr: {
    provider: 'gemini',
    model: 'gemini-pro-vision',
  },
  quickTask: {
    provider: 'deepseek',
    model: 'deepseek-chat',
  },
};

function routeAI(taskType) {
  return AI_ROUTES[taskType] || AI_ROUTES.quickTask;
}

if (typeof window !== 'undefined') {
  window.WashAI = window.WashAI || {};
  window.WashAI.AI_ROUTES = AI_ROUTES;
  window.WashAI.routeAI = routeAI;
}

if (typeof module !== 'undefined') {
  module.exports = { AI_ROUTES, routeAI };
}
