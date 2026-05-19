window.WashModules = window.WashModules || {};
window.WashModules.reuniones = window.WashModules.reuniones || {};

(function(){
  const state = { ctx:null, lastResult:null, file:null, recorder:null, stream:null, chunks:[] };
  const PROMPT_FALLBACK = {
    system:'Eres WASH-OS, asistente institucional UNICEF/WASH para reuniones técnicas y seguimiento operativo.',
    summary:'Genera un resumen ejecutivo corto y claro.',
    agreements:'Identifica acuerdos y decisiones.',
    tasks:'Convierte la reunión en tareas accionables con responsable, fecha, prioridad y acción concreta.',
    risks:'Detecta riesgos, bloqueos, retrasos y brechas de información.',
    next_steps:'Genera próximos pasos operativos inmediatos.',
    executive_minutes:'Prepara una minuta ejecutiva breve con enfoque WASH/UNICEF.'
  };

  function esc(value){return String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function get(id){return document.getElementById(id);}
  function setStatus(text){const el=get('meet-ai-status');if(el)el.textContent=text;}
  function manualPrompt(prompt,target){const note=target==='claude'?'Prioriza narrativa clara, detalle operativo y decisiones accionables.':'Prioriza estructura JSON, síntesis y seguimiento operativo.';return `${note}\n\n${prompt}`;}
  function copyPromptFallback(prompt,route){const outputs=(route&&route.manualOutputs&&route.manualOutputs.length?route.manualOutputs:['chatgpt','claude']);const manual=outputs.map(target=>`=== ${target.toUpperCase()} ===\n${manualPrompt(prompt,target)}`).join('\n\n');if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(manual).then(()=>setStatus(`Prompt manual copiado para ${outputs.join(' / ')}. Pega el JSON abajo.`)).catch(()=>setStatus('Sin API key o gateway disponible. Usa el flujo manual.'));}else setStatus('Sin API key o gateway disponible. Usa el flujo manual.');}
  function recordingName(){return `nota-voz-${new Date().toISOString().replace(/[:.]/g,'-')}.webm`;}
  function getRoute(){return window.WashAI&&typeof window.WashAI.routeAI==='function'?window.WashAI.routeAI('meeting'):{provider:'manual',model:null,manualOutputs:['chatgpt','claude']};}
  async function resolveRoute(task,input){if(window.WashAIRouter&&typeof window.WashAIRouter.routeAI==='function')return window.WashAIRouter.routeAI({task, input});return getRoute();}
  function scriptUrl(path){return state.ctx&&state.ctx.resolveAppPath?state.ctx.resolveAppPath(path):path;}
  function loadScriptOnce(path,test){return new Promise((resolve,reject)=>{if(test())return resolve();const script=document.createElement('script');script.src=scriptUrl(path);script.onload=()=>test()?resolve():reject(new Error('Script cargado sin API esperada: '+path));script.onerror=()=>reject(new Error('No se pudo cargar '+path));document.head.appendChild(script);});}
  async function ensureAIGateway(){await loadScriptOnce('/core/ai/gateway.js',()=>window.WashAI&&typeof window.WashAI.runAI==='function');}
  function getPromptUrl(){return state.ctx&&state.ctx.resolveAppPath?state.ctx.resolveAppPath('/config/prompts/reuniones.json'):'/config/prompts/reuniones.json';}
  async function loadMeetingPrompts(){try{const res=await fetch(getPromptUrl(),{cache:'no-cache'});if(!res.ok)throw new Error(res.status);return {...PROMPT_FALLBACK,...await res.json()};}catch(e){console.warn('No se pudo cargar prompts de reuniones, usando fallback.',e);return PROMPT_FALLBACK;}}
  function list(items, empty){return (items&&items.length)?items.map(i=>`<li>${esc(typeof i==='string'?i:(i.action||i.text||i.descripcion||JSON.stringify(i)))}</li>`).join(''):`<li style="color:#94a3b8">${empty}</li>`;}
  function taskList(tasks){return (tasks&&tasks.length)?tasks.map(t=>`<div class="meet-task"><div><strong>${esc(t.action||t.tarea||t.text||'Tarea')}</strong></div><div class="meet-meta">👤 ${esc(t.responsible||t.responsable||'No especificado')} · 📅 ${esc(t.date||t.fecha||'No especificado')} · ⚑ ${esc(t.priority||t.prioridad||'Media')}</div></div>`).join(''):'<div class="meet-empty">No se identificaron tareas.</div>';}
  function meetingInput(){return {title:get('meet-title')?.value.trim()||'Reunión sin título',date:get('meet-date')?.value||'',type:get('meet-type')?.value||'Reunión técnica',content:get('meet-notes')?.value.trim()||'',fileName:state.file?.name||'',fileType:state.file?.type||''};}
  function buildPrompt(input,prompts,route){return `${prompts.system}\n\nTIPO DE REUNIÓN: ${input.type}\nTÍTULO: ${input.title}\nFECHA: ${input.date||'No especificada'}\nARCHIVO: ${input.fileName||'Sin archivo'} (${input.fileType||'notas rápidas'})\nMODELO SUGERIDO: ${route.provider}/${route.model}\n\nPIPELINE MULTIMODAL:\n- audio → transcripción futura\n- PDF → extracción de texto / OCR preparado\n- DOCX → lectura estructurada\n- imagen → OCR preparado\n- TXT/notas → análisis directo\n\nINSTRUCCIONES:\n1. ${prompts.summary}\n2. ${prompts.agreements}\n3. ${prompts.tasks}\n4. ${prompts.risks}\n5. ${prompts.next_steps}\n6. ${prompts.executive_minutes||'Genera una minuta ejecutiva breve.'}\n\nResponde únicamente en JSON válido con esta estructura:\n{\n  "summary":"",\n  "agreements":[""],\n  "tasks":[{"action":"","responsible":"No especificado","date":"No especificado","priority":"Media"}],\n  "risks":[""],\n  "next_steps":[""]\n}\n\nCONTENIDO MULTIMODAL NORMALIZADO:\n${input.content}`;}
  function parseLines(text,label){const re=new RegExp(`${label}[:\\n]+([\\s\\S]*?)(\\n[A-ZÁÉÍÓÚ_ ]{4,}:|$)`,'i');const m=text.match(re);return m?m[1].split(/\n|;/).map(x=>x.replace(/^[-*\d.\s]+/,'').trim()).filter(Boolean):[];}
  function parseResult(text){try{const parsed=JSON.parse(text);return {summary:parsed.summary||parsed.resumen||'',agreements:parsed.agreements||parsed.acuerdos||[],tasks:parsed.tasks||parsed.tareas||[],risks:parsed.risks||parsed.riesgos||[],next_steps:parsed.next_steps||parsed.proximos_pasos||parsed.nextSteps||[]};}catch(e){}
    return {summary:text.split('\n').slice(0,4).join('\n').trim(),agreements:parseLines(text,'ACUERDOS|AGREEMENTS'),tasks:parseLines(text,'TAREAS|TASKS').map(action=>({action,responsible:'No especificado',date:'No especificado',priority:'Media'})),risks:parseLines(text,'RIESGOS|RISKS'),next_steps:parseLines(text,'PRÓXIMOS PASOS|NEXT STEPS')};}

  async function sendTasksToManager(tasks,input){
    if(!state.ctx||!Array.isArray(state.ctx.tasks)||typeof state.ctx.saveTasks!=='function')return {added:0};
    const source=Array.isArray(tasks)?tasks:[];
    if(!source.length)return {added:0};
    let added=0;
    for(const task of source){
      if(!task||typeof task!=='object')continue;
      const newTask={
        id:Date.now()+added,
        titulo:task.action||task.tarea||task.text||'Tarea de reunión',
        desc:'',
        categoria:'Reuniones',
        prioridad:task.priority||task.prioridad||'Media',
        responsable:task.responsible||task.responsable||'No especificado',
        fechaI:input?.date||'',
        fechaC:task.date||task.fecha||'',
        inicio:(input?.date?`${input.date}T09:00:00`:''),
        cierre:(task.date&&task.date!=='No especificado'?`${task.date}T18:00:00`:''),
        estimado:0,email:'',link:'',nota:'',notaCierre:'',reprogNotas:[],parentId:null,parentTitle:'',
        estado:'Pendiente',elapsed:0,running:false
      };
      state.ctx.tasks.unshift(newTask);
      added++;
    }
    if(!added)return {added:0};
    await state.ctx.saveTasks();
    if(typeof state.ctx.renderTaskList==='function')state.ctx.renderTaskList();
    if(typeof state.ctx.renderApp==='function'&&state.ctx.view==='gestor')state.ctx.renderApp();
    return {added};
  }

  function renderResults(result){const box=get('meet-results');if(!box)return;const transferred=Number(result?.tasksTransferred||0);box.style.display='grid';box.innerHTML=`<div class="meet-result-card"><h3>Resumen</h3><p>${esc(result.summary||'Sin resumen.')}</p></div><div class="meet-result-card"><h3>Acuerdos</h3><ul>${list(result.agreements,'No se identificaron acuerdos.')}</ul></div><div class="meet-result-card"><h3>Tareas</h3>${taskList(result.tasks)}<div class="meet-meta" style="margin-top:10px">${transferred>0?`✅ ${transferred} tarea(s) transferidas al Gestor.`:'ℹ️ Sin tareas transferidas al Gestor.'}</div></div><div class="meet-result-card"><h3>Riesgos</h3><ul>${list(result.risks,'No se identificaron riesgos.')}</ul></div><div class="meet-result-card"><h3>Próximos pasos</h3><ul>${list(result.next_steps,'No se identificaron próximos pasos.')}</ul></div><div class="meet-result-card"><h3>Exportación</h3><button onclick="WashMeetings.exportHTML()">Exportar HTML / PDF</button></div>`;}
  function dateParts(dateText){const d=dateText?new Date(dateText):new Date();const ok=!Number.isNaN(d.getTime());return {month:ok?d.getUTCMonth()+1:null,year:ok?d.getUTCFullYear():null};}
  function historyPayload(input,result,route){const parts=dateParts(input.date);return {type:'meeting',title:input.title,date:input.date,month:parts.month,year:parts.year,summary:result.summary||'',pending_tasks:result.tasks||[],completed_or_coordinated:result.agreements||[],risks:result.risks||[],notes:result.next_steps||[],source_reference:input.fileName?`${input.fileName}${input.fileType?` (${input.fileType})`:''}`:'notas pegadas/manuales',provider:route?.provider||'',model:route?.model||'',raw_result:result,tags:['meeting',input.type,input.fileType].filter(Boolean)};}
  async function saveLegacyHistory(input,result){if(!state.ctx||!state.ctx.historialReuniones)return;const contenido=[result.summary,(result.agreements||[]).join('\n'),(result.next_steps||[]).join('\n')].filter(Boolean).join('\n\n');state.ctx.historialReuniones.unshift({titulo:input.title,fecha:input.date,tipo:input.type,lugar:'',contenido,resumen:result.summary,archivoNombre:input.fileName,archivoTipo:input.fileType,resultado:result,tareas:result.tasks||[],ts:Date.now()});if(state.ctx.saveHist)await state.ctx.saveHist('hist-reuniones',state.ctx.historialReuniones);}
  async function saveOperationalHistory(input,result,route){const payload=historyPayload(input,result,route);if(window.WashStorage&&typeof window.WashStorage.saveHistory==='function')return window.WashStorage.saveHistory(payload);if(window.WashStorage&&typeof window.WashStorage.saveLocalHistory==='function')return {ok:true,storage:'local',record:window.WashStorage.saveLocalHistory(payload)};throw new Error('WashStorage no disponible');}
  async function saveResult(input,result,route){try{await saveLegacyHistory(input,result);}catch(e){console.warn('No se pudo guardar historial simple local.',e);}try{const saved=await saveOperationalHistory(input,result,route);setStatus(saved.storage==='supabase'?'Guardado en historial':'Guardado localmente');}catch(e){console.warn('No se pudo guardar historial operacional.',e);setStatus('Guardado localmente');}}
  function saveResultLater(input,result,route){setTimeout(()=>saveResult(input,result,route),0);}

  window.WashMeetings = {
    sendTasksToManager,
    async process(){const input=meetingInput();if(!input.content){alert('Agrega notas, transcripción o un archivo multimodal.');return;}const route=await resolveRoute('meeting',input);const prompts=await loadMeetingPrompts();const prompt=buildPrompt(input,prompts,route);setStatus(`AI Router: ${route.provider} · ${route.model||'manual'}`);const paste=get('meet-ai-paste');if(route.provider==='manual'||!route.model){if(paste)paste.style.display='block';copyPromptFallback(prompt,route);return;}try{await ensureAIGateway();setStatus(`Enviando automáticamente a ${route.provider}...`);const audioFile=state.file&&state.file.type==='audio'?state.file.rawFile:null;const ai=await window.WashAI.runAI('meeting',{prompt,systemPrompt:prompts.system,audioFile});const result=parseResult(JSON.stringify(ai.result));const aiRoute=ai.route||route;const transfer=await sendTasksToManager(result.tasks,input);result.tasksTransferred=transfer.added||0;state.lastResult={input,result};renderResults(result);if(paste)paste.style.display='none';setStatus(`Resultado generado automáticamente con ${aiRoute.provider}. Guardando historial...`);saveResultLater(input,result,aiRoute);}catch(e){console.warn('IA automática no disponible; usando fallback manual.',e);if(paste)paste.style.display='block';copyPromptFallback(prompt,route);}},
    async loadResult(){const raw=get('meet-ai-output')?.value.trim();if(!raw){alert('Pega el JSON o resultado primero.');return;}const input=meetingInput();const route=await resolveRoute('meeting',input);const result=parseResult(raw);const transfer=await sendTasksToManager(result.tasks,input);result.tasksTransferred=transfer.added||0;state.lastResult={input,result};renderResults(result);setStatus('Resultado cargado. Guardando historial...');saveResultLater(input,result,route);},
    async startRecording(){if(!navigator.mediaDevices||!window.MediaRecorder){alert('MediaRecorder no está disponible en este navegador.');return;}try{state.stream=await navigator.mediaDevices.getUserMedia({audio:true});state.chunks=[];state.recorder=new MediaRecorder(state.stream);state.recorder.ondataavailable=e=>{if(e.data&&e.data.size)state.chunks.push(e.data);};state.recorder.onstop=async()=>{const blob=new Blob(state.chunks,{type:'audio/webm'});const file=new File([blob],recordingName(),{type:'audio/webm'});state.stream?.getTracks().forEach(track=>track.stop());state.stream=null;state.recorder=null;const stop=get('meet-stop-record');if(stop)stop.disabled=true;setStatus('Grabación lista. Procesando audio...');await window.WashMeetings.handleFile(file);};state.recorder.start();const stop=get('meet-stop-record');if(stop)stop.disabled=false;setStatus('Grabando...');window.WashMeetingsUI.setFilePreview({name:'nota de voz en curso',label:'Audio',icon:'🎙️',status:'grabando',note:'Grabando...'});}catch(e){console.warn('No se pudo iniciar la grabación.',e);setStatus('No se pudo acceder al micrófono.');}},
    stopRecording(){if(state.recorder&&state.recorder.state!=='inactive'){setStatus('Deteniendo grabación...');state.recorder.stop();}},
    async handleFile(file){if(!file)return;const preview={name:file.name,type:'detectando',label:'Detectando',icon:'📎',status:'procesando',note:'Procesando archivo...'};window.WashMeetingsUI.setFilePreview(preview);try{const fileInfo=await window.WashMeetingProcessors.processFile(file);state.file={...fileInfo,rawFile:file};window.WashMeetingsUI.setFilePreview(fileInfo);const notes=get('meet-notes');if(notes)notes.value=fileInfo.text;setStatus(`${fileInfo.label} listo · ${fileInfo.note}`);}catch(e){console.warn('No se pudo procesar el archivo de reunión.',e);window.WashMeetingsUI.setFilePreview({name:file.name,label:'Error',icon:'⚠️',status:'pendiente',note:'No se pudo procesar. Pega el contenido manualmente.'});setStatus('No se pudo procesar el archivo.');}},
    exportHTML(){if(!state.lastResult){alert('Procesa y carga un resultado primero.');return;}const {input,result}=state.lastResult;const html=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${esc(input.title)}</title><style>body{font-family:Arial,sans-serif;padding:32px;line-height:1.6;color:#1e293b}h1{color:#0f766e}.card{border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin:12px 0}li{margin:4px 0}@media print{button{display:none}}</style></head><body><h1>${esc(input.title)}</h1><p>${esc(input.type)} · ${esc(input.date||'Sin fecha')} · ${esc(input.fileName||'Sin archivo')}</p><div class="card"><h2>Resumen</h2><p>${esc(result.summary)}</p></div><div class="card"><h2>Acuerdos</h2><ul>${list(result.agreements,'Sin acuerdos')}</ul></div><div class="card"><h2>Tareas</h2>${taskList(result.tasks)}<p><strong>Transferidas al Gestor:</strong> ${esc(result.tasksTransferred||0)}</p></div><div class="card"><h2>Riesgos</h2><ul>${list(result.risks,'Sin riesgos')}</ul></div><div class="card"><h2>Próximos pasos</h2><ul>${list(result.next_steps,'Sin próximos pasos')}</ul></div></body></html>`;if(state.ctx&&state.ctx.dlBlob)state.ctx.dlBlob(html,`reunion_${Date.now()}.html`);else{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([html],{type:'text/html'}));a.download=`reunion_${Date.now()}.html`;a.click();URL.revokeObjectURL(a.href);}}
  };

  window.WashModules.reuniones.render = function(ctx){state.ctx=ctx;return window.WashMeetingsUI.render(ctx,getRoute());};
})();
