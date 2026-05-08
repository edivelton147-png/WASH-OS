window.WashAIProviders = window.WashAIProviders || {};

(function(){
  const OPENAI_BASE_URL = 'https://api.openai.com/v1';

  function getApiKey(){
    if(typeof process !== 'undefined' && process.env && process.env.OPENAI_API_KEY)return process.env.OPENAI_API_KEY;
    if(window.WASH_OS_OPENAI_API_KEY)return window.WASH_OS_OPENAI_API_KEY;
    try{return localStorage.getItem('OPENAI_API_KEY')||'';}catch(e){return '';}
  }

  function assertApiKey(){
    const apiKey=getApiKey();
    if(!apiKey)throw new Error('OPENAI_API_KEY no configurada');
    return apiKey;
  }

  async function chatCompletion({messages,model='gpt-4o-mini',responseFormat}={}){
    const body={model,messages};
    if(responseFormat)body.response_format=responseFormat;
    const res=await fetch(`${OPENAI_BASE_URL}/chat/completions`,{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${assertApiKey()}`},
      body:JSON.stringify(body)
    });
    if(!res.ok)throw new Error(`OpenAI chat error ${res.status}: ${await res.text()}`);
    const data=await res.json();
    return data.choices?.[0]?.message?.content||'';
  }

  async function jsonCompletion({prompt,systemPrompt='',model='gpt-4o-mini'}={}){
    const content=await chatCompletion({
      model,
      responseFormat:{type:'json_object'},
      messages:[
        {role:'system',content:systemPrompt||'Responde siempre en JSON válido.'},
        {role:'user',content:prompt}
      ]
    });
    return JSON.parse(content);
  }

  async function transcribeAudio({file,model='gpt-4o-transcribe'}={}){
    const form=new FormData();
    form.append('model',model);
    form.append('file',file,file.name||'audio.webm');
    const res=await fetch(`${OPENAI_BASE_URL}/audio/transcriptions`,{
      method:'POST',
      headers:{Authorization:`Bearer ${assertApiKey()}`},
      body:form
    });
    if(!res.ok)throw new Error(`OpenAI transcription error ${res.status}: ${await res.text()}`);
    const data=await res.json();
    return data.text||'';
  }

  window.WashAIProviders.openai={chatCompletion,jsonCompletion,transcribeAudio};
})();
