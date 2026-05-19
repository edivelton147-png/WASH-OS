(function(){
  async function loadPrompt(path){
    try{
      const resp=await fetch(path,{cache:'no-cache'});
      if(!resp.ok)throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    }catch(e){
      console.warn('No se pudo cargar el prompt:',path,e);
      return {};
    }
  }
  window.WashPromptLoader={loadPrompt};
})();
