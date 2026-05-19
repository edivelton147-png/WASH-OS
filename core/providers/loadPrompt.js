(function(){
<<<<<<< codex/add-independent-history-module-to-wash-os-yojv1u
  async function loadPrompt(path){
    try{
      const resp=await fetch(path,{cache:'no-cache'});
      if(!resp.ok)throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    }catch(e){
      console.warn('No se pudo cargar el prompt:',path,e);
      return {};
=======
  async function loadPrompt(path,fallback){
    try{
      const res=await fetch(path,{cache:'no-cache'});
      if(!res.ok)throw new Error(String(res.status));
      const data=await res.json();
      return (data&&typeof data==='object')?data:(fallback||{});
    }catch(e){
      console.warn('Prompt no encontrado:',path,e);
      return fallback&&typeof fallback==='object'?fallback:{};
>>>>>>> main
    }
  }
  window.WashPromptLoader={loadPrompt};
})();
