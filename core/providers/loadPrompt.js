(function(){
  async function loadPrompt(path, fallback = {}) {
    try {
      const res = await fetch(path, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data && typeof data === 'object' ? data : fallback;
    } catch (e) {
      console.warn('No se pudo cargar el prompt:', path, e);
      return fallback && typeof fallback === 'object' ? fallback : {};
    }
  }

  if (typeof window !== 'undefined') {
    window.WashPromptLoader = { loadPrompt };
  }

  if (typeof module !== 'undefined') {
    module.exports = { loadPrompt };
  }
})();
