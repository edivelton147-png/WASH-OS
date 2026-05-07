async function loadPrompt(promptName) {
  const safeName = String(promptName || '').trim();

  if (!safeName) {
    console.warn('loadPrompt: promptName is required');
    return '';
  }

  const promptPath = `/config/prompts/${safeName}.txt`;

  try {
    const response = await fetch(promptPath, { cache: 'no-cache' });

    if (!response.ok) {
      console.warn(`loadPrompt: prompt not found (${promptPath})`);
      return '';
    }

    return (await response.text()).trim();
  } catch (error) {
    console.warn(`loadPrompt: could not load prompt (${promptPath})`, error);
    return '';
  }
}

if (typeof window !== 'undefined') {
  window.WashAI = window.WashAI || {};
  window.WashAI.loadPrompt = loadPrompt;
}

if (typeof module !== 'undefined') {
  module.exports = { loadPrompt };
}
