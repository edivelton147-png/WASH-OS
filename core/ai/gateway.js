window.WashAI = window.WashAI || {};

(function(){
  function providerFor(route){
    const provider=window.WashAIProviders&&window.WashAIProviders[route.provider];
    if(!provider)throw new Error(`Proveedor IA no disponible: ${route.provider}`);
    return provider;
  }

  async function runAI(taskType,{prompt,systemPrompt='',audioFile=null}={}){
    if(!window.WashAI||typeof window.WashAI.routeAI!=='function')throw new Error('AI Router no disponible');
    const route=window.WashAI.routeAI(taskType);
    const provider=providerFor(route);
    let finalPrompt=prompt;

    if(audioFile&&typeof provider.transcribeAudio==='function'){
      const transcript=await provider.transcribeAudio({file:audioFile,model:'gpt-4o-transcribe'});
      finalPrompt=`${prompt}\n\nTRANSCRIPCIÓN DE AUDIO:\n${transcript}`;
    }

    const result=await provider.jsonCompletion({
      prompt:finalPrompt,
      systemPrompt,
      model:taskType==='meeting'?'gpt-4o-mini':route.model
    });

    return {route,result};
  }

  window.WashAI.runAI=runAI;
})();
