window.WashAI = window.WashAI || {};

(function(){
  async function fileToBase64(file){
    const buffer=await file.arrayBuffer();
    let binary='';
    const bytes=new Uint8Array(buffer);
    for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  async function runAI(taskType,{prompt,input={},systemPrompt='',audioFile=null}={}){
    if(!window.WashAI||typeof window.WashAI.routeAI!=='function')throw new Error('AI Router no disponible');
    const route=window.WashAI.routeAI(taskType);
    const payloadInput={...input};

    if(audioFile){
      payloadInput.audio={
        name:audioFile.name||'audio.webm',
        mime:audioFile.type||'audio/webm',
        model:'gpt-4o-transcribe',
        data:await fileToBase64(audioFile),
      };
    }

    const response=await fetch('/api/ai',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        provider:route.provider,
        model:taskType==='meeting'?'gpt-4o-mini':route.model,
        prompt:[systemPrompt,prompt].filter(Boolean).join('\n\n'),
        input:payloadInput,
        type:taskType,
      }),
    });

    const data=await response.json().catch(()=>({ok:false,error:'Respuesta inválida del gateway IA'}));
    if(!response.ok||!data.ok)throw new Error(data.error||`AI gateway error ${response.status}`);

    return {route:{provider:data.provider,model:data.model},result:JSON.parse(data.text),text:data.text};
  }

  window.WashAI.runAI=runAI;
})();
