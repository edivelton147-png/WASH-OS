(function(){
  async function loadPrompt(path,fallback){
    try{
      const res=await fetch(path,{cache:'no-cache'});
      if(!res.ok)throw new Error(String(res.status));
      const data=await res.json();
      return (data&&typeof data==='object')?data:(fallback||{});
    }catch(e){
      console.warn('Prompt no encontrado:',path,e);
      return fallback&&typeof fallback==='object'?fallback:{};
    }
  }
  window.WashPromptLoader={loadPrompt};
})();
