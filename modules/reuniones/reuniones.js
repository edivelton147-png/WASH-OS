window.WashModules = window.WashModules || {};
window.WashModules.reuniones = window.WashModules.reuniones || {};

(function(){
  const state = { ctx:null, lastResult:null, file:null, recorder:null, stream:null, chunks:[] };
  const PROMPT_FALLBACK = {
    system:'Eres WASH-OS, un asistente institucional UNICEF/WASH para reuniones técnicas y seguimiento operacional humanitario. Analiza reuniones, notas, audios y documentos. Tu función NO es transcribir literalmente. Debes convertir información compleja en resúmenes ejecutivos claros, homogéneos, accionables y fáciles de revisar rápidamente.',
    summary:'Genera un resumen ejecutivo extremadamente resumido y homogéneo. Máximo 3 a 5 líneas cortas. Resume únicamente avances, decisiones, coordinaciones clave y situación operacional. No repitas detalles innecesarios ni hagas narrativa extensa.',
    agreements:'Identifica acuerdos, decisiones tomadas y coordinaciones realizadas. Resume cada punto en formato breve y operativo.',
    tasks:'Convierte únicamente acciones pendientes reales en tareas accionables. Cada tarea debe incluir: título corto, responsable si existe, fecha si existe y prioridad estimada (alta/media/baja). No inventes información.',
    risks:'Detecta riesgos, bloqueos, retrasos, interferencias, limitaciones o alertas operativas mencionadas en la reunión. Si no existen riesgos, devuelve lista vacía.',
    next_steps:'Genera próximos pasos inmediatos derivados de la reunión. Máximo 5 puntos breves y accionables.',
    notes:'Incluye notas operativas cortas únicamente si aportan contexto importante para seguimiento posterior.',
    classification:'Clasifica automáticamente la reunión en una categoría principal según el contenido detectado: Emergencia, Salud, WASH, Educación u Otros.',
    source_reference:'Incluye referencia breve del archivo, audio o documento procesado para facilitar búsqueda futura en historial.',
    output_rules:['NO devolver transcripción literal','NO generar párrafos largos','Priorizar claridad operacional','Usar lenguaje institucional UNICEF/WASH','Mantener estructura homogénea','Reducir redundancia','Máximo síntesis posible sin perder contexto','Mantener formato JSON válido']
  };

  function esc(value){return String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function get(id){return document.getElementById(id);}
  function setStatus(text){const el=get('meet-ai-status');if(el)el.textContent=text;}
  function copyPromptFallback(prompt,route){if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(prompt).then(()=>setStatus(`Sin API key o gateway disponible. Prompt copiado para ${route.provider}; pega el JSON abajo.`)).catch(()=>setStatus('Sin API key o gateway disponible. Usa el flujo manual.'));}else setStatus('Sin API key o gateway disponible. Usa el flujo manual.');}
  function recordingName(){return `nota-voz-${new Date().toISOString().replace(/[:.]/g,'-')}.webm`;}
  function getRoute(){return window.WashAI&&typeof window.WashAI.routeAI==='function'?window.WashAI.routeAI('meeting'):{provider:'openai',model:'meeting-fallback'};}
  function scriptUrl(path){return state.ctx&&state.ctx.resolveAppPath?state.ctx.resolveAppPath(path):path;}
  function loadScriptOnce(path,test){return new Promise((resolve,reject)=>{if(test())return resolve();const script=document.createElement('script');script.src=scriptUrl(path);script.onload=()=>test()?resolve():reject(new Error('Script cargado sin API esperada: '+path));script.onerror=()=>reject(new Error('No se pudo cargar '+path));document.head.appendChild(script);});}
  async function ensureAIGateway(){await loadScriptOnce('/core/ai/gateway.js',()=>window.WashAI&&typeof window.WashAI.runAI==='function');}
  function getPromptUrl(){return state.ctx&&state.ctx.resolveAppPath?state.ctx.resolveAppPath('/config/prompts/reuniones.json'):'/config/prompts/reuniones.json';}
  async function loadMeetingPrompts(){try{const res=await fetch(getPromptUrl(),{cache:'no-cache'});if(!res.ok)throw new Error(res.status);return {...PROMPT_FALLBACK,...await res.json()};}catch(e){console.warn('No se pudo cargar prompts de reuniones, usando fallback.',e);return PROMPT_FALLBACK;}}
  function list(items, empty){return (items&&items.length)?items.map(i=>`<li>${esc(typeof i==='string'?i:(i.action||i.text||i.descripcion||JSON.stringify(i)))}</li>`).join(''):`<li style="color:#94a3b8">${empty}</li>`;}
  function taskList(tasks){return (tasks&&tasks.length)?tasks.map(t=>`<div class="meet-task"><div><strong>${esc(t.title||t.titulo||t.action||t.tarea||t.text||'Tarea')}</strong></div><div class="meet-meta">👤 ${esc(t.responsible||t.responsable||'No especificado')} · 📅 ${esc(t.date||t.fecha||'No especificado')} · ⚑ ${esc(t.priority||t.prioridad||'Media')}</div></div>`).join(''):'<div class="meet-empty">No se identificaron tareas.</div>';}
  function meetingInput(){return {title:get('meet-title')?.value.trim()||'Reunión sin título',date:get('meet-date')?.value||'',type:get('meet-type')?.value||'Reunión técnica',content:get('meet-notes')?.value.trim()||'',fileName:state.file?.name||'',fileType:state.file?.type||''};}
  function buildPrompt(input,prompts,route){const rules=(prompts.output_rules||[]).map(rule=>`- ${rule}`).join('\n');return `${prompts.system}

TIPO DE REUNIÓN: ${input.type}
TÍTULO: ${input.title}
FECHA: ${input.date||'No especificada'}
ARCHIVO: ${input.fileName||'Sin archivo'} (${input.fileType||'notas rápidas'})
MODELO SUGERIDO: ${route.provider}/${route.model}

PIPELINE MULTIMODAL:
- audio → transcripción futura
- PDF → extracción de texto / OCR preparado
- DOCX → lectura estructurada
- imagen → OCR preparado
- TXT/notas → análisis directo

INSTRUCCIONES:
1. ${prompts.summary}
2. ${prompts.agreements}
3. ${prompts.tasks}
4. ${prompts.risks}
5. ${prompts.next_steps}
6. ${prompts.notes}
7. ${prompts.classification}
8. ${prompts.source_reference}

REGLAS DE SALIDA:
${rules}

Responde únicamente en JSON válido con esta estructura:
{
  "summary":"",
  "agreements":[""],
  "tasks":[{"action":"","responsible":"No especificado","date":"No especificado","priority":"Media"}],
  "risks":[""],
  "next_steps":[""],
  "notes":[""],
  "classification":"Otros",
  "source_reference":""
}

CONTENIDO MULTIMODAL NORMALIZADO:
${input.content}`;}
  function parseLines(text,label){const re=new RegExp(`${label}[:\\n]+([\\s\\S]*?)(\\n[A-ZÁÉÍÓÚ_ ]{4,}:|$)`,'i');const m=text.match(re);return m?m[1].split(/\n|;/).map(x=>x.replace(/^[-*\d.\s]+/,'').trim()).filter(Boolean):[];}
  function parseResult(text){try{const parsed=JSON.parse(text);return {summary:parsed.summary||parsed.resumen||'',agreements:parsed.agreements||parsed.acuerdos||parsed.completed_or_coordinated||[],tasks:parsed.tasks||parsed.tareas||parsed.pending_tasks||[],risks:parsed.risks||parsed.riesgos||[],next_steps:parsed.next_steps||parsed.proximos_pasos||parsed.nextSteps||[],notes:parsed.notes||parsed.notas||[],classification:parsed.classification||parsed.clasificacion||'',source_reference:parsed.source_reference||parsed.referencia||''};}catch(e){}
    return {summary:text.split('\n').slice(0,4).join('\n').trim(),agreements:parseLines(text,'ACUERDOS|AGREEMENTS'),tasks:parseLines(text,'TAREAS|TASKS').map(action=>({action,responsible:'No especificado',date:'No especificado',priority:'Media'})),risks:parseLines(text,'RIESGOS|RISKS'),next_steps:parseLines(text,'PRÓXIMOS PASOS|NEXT STEPS'),notes:parseLines(text,'NOTAS|NOTES'),classification:'',source_reference:''};}
  function renderResults(result){const box=get('meet-results');if(!box)return;box.style.display='grid';box.innerHTML=`<div class="meet-result-card"><h3>Resumen</h3><p>${esc(result.summary||'Sin resumen.')}</p>${result.classification?`<div class="meet-meta">Categoría: ${esc(result.classification)}</div>`:''}</div><div class="meet-result-card"><h3>Acuerdos</h3><ul>${list(result.agreements,'No se identificaron acuerdos.')}</ul></div><div class="meet-result-card"><h3>Tareas</h3>${taskList(result.tasks)}</div><div class="meet-result-card"><h3>Riesgos</h3><ul>${list(result.risks,'No se identificaron riesgos.')}</ul></div><div class="meet-result-card"><h3>Próximos pasos</h3><ul>${list(result.next_steps,'No se identificaron próximos pasos.')}</ul></div><div class="meet-result-card"><h3>Notas</h3><ul>${list(result.notes,'No se identificaron notas operativas adicionales.')}</ul></div><div class="meet-result-card"><h3>Exportación</h3><button onclick="WashMeetings.exportHTML()">Exportar HTML / PDF</button></div>`;}
  function dateParts(dateText){const d=dateText?new Date(dateText):new Date();const ok=!Number.isNaN(d.getTime());return {month:ok?d.getUTCMonth()+1:null,year:ok?d.getUTCFullYear():null};}
  function historyPayload(input,result,route){const parts=dateParts(input.date);const source=result.source_reference||(input.fileName?`${input.fileName}${input.fileType?` (${input.fileType})`:''}`:'notas pegadas/manuales');return {type:'meeting',title:input.title,date:input.date,month:parts.month,year:parts.year,summary:result.summary||'',pending_tasks:result.tasks||[],completed_or_coordinated:result.agreements||[],risks:result.risks||[],notes:result.notes||[],source_reference:source,provider:route?.provider||'',model:route?.model||'',raw_result:result,tags:['meeting',input.type,input.fileType,result.classification].filter(Boolean)};}
  async function saveLegacyHistory(input,result){if(!state.ctx||!state.ctx.historialReuniones)return;const contenido=[result.summary,(result.agreements||[]).join('\n'),(result.next_steps||[]).join('\n')].filter(Boolean).join('\n\n');state.ctx.historialReuniones.unshift({titulo:input.title,fecha:input.date,tipo:input.type,lugar:'',contenido,resumen:result.summary,archivoNombre:input.fileName,archivoTipo:input.fileType,resultado:result,tareas:result.tasks||[],ts:Date.now()});if(state.ctx.saveHist)await state.ctx.saveHist('hist-reuniones',state.ctx.historialReuniones);}
  async function saveOperationalHistory(input,result,route){const payload=historyPayload(input,result,route);if(window.WashStorage&&typeof window.WashStorage.saveHistory==='function')return window.WashStorage.saveHistory(payload);if(window.WashStorage&&typeof window.WashStorage.saveLocalHistory==='function')return {ok:true,storage:'local',record:window.WashStorage.saveLocalHistory(payload)};throw new Error('WashStorage no disponible');}
  async function saveResult(input,result,route){try{await saveLegacyHistory(input,result);}catch(e){console.warn('No se pudo guardar historial simple local.',e);}try{const saved=await saveOperationalHistory(input,result,route);setStatus(saved.storage==='supabase'?'Guardado en historial':'Guardado localmente');}catch(e){console.warn('No se pudo guardar historial operacional.',e);setStatus('Guardado localmente');}}
  function saveResultLater(input,result,route){setTimeout(()=>saveResult(input,result,route),0);}

  window.WashMeetings = {
    async process(){const input=meetingInput();if(!input.content){alert('Agrega notas, transcripción o un archivo multimodal.');return;}const route=getRoute();const prompts=await loadMeetingPrompts();const prompt=buildPrompt(input,prompts,route);setStatus(`AI Router: ${route.provider} · ${route.model}`);const paste=get('meet-ai-paste');try{await ensureAIGateway();setStatus(`Enviando automáticamente a ${route.provider}...`);const audioFile=state.file&&state.file.type==='audio'?state.file.rawFile:null;const ai=await window.WashAI.runAI('meeting',{prompt,systemPrompt:prompts.system,audioFile});const result=parseResult(JSON.stringify(ai.result));const aiRoute=ai.route||route;state.lastResult={input,result};renderResults(result);if(paste)paste.style.display='none';setStatus(`Resultado generado automáticamente con ${aiRoute.provider}. Guardando historial...`);saveResultLater(input,result,aiRoute);}catch(e){console.warn('IA automática no disponible; usando fallback manual.',e);if(paste)paste.style.display='block';copyPromptFallback(prompt,route);}},
    async loadResult(){const raw=get('meet-ai-output')?.value.trim();if(!raw){alert('Pega el JSON o resultado primero.');return;}const input=meetingInput();const route=getRoute();const result=parseResult(raw);state.lastResult={input,result};renderResults(result);setStatus('Resultado cargado. Guardando historial...');saveResultLater(input,result,route);},
    async startRecording(){if(!navigator.mediaDevices||!window.MediaRecorder){alert('MediaRecorder no está disponible en este navegador.');return;}try{state.stream=await navigator.mediaDevices.getUserMedia({audio:true});state.chunks=[];state.recorder=new MediaRecorder(state.stream);state.recorder.ondataavailable=e=>{if(e.data&&e.data.size)state.chunks.push(e.data);};state.recorder.onstop=async()=>{const blob=new Blob(state.chunks,{type:'audio/webm'});const file=new File([blob],recordingName(),{type:'audio/webm'});state.stream?.getTracks().forEach(track=>track.stop());state.stream=null;state.recorder=null;const stop=get('meet-stop-record');if(stop)stop.disabled=true;setStatus('Grabación lista. Procesando audio...');await window.WashMeetings.handleFile(file);};state.recorder.start();const stop=get('meet-stop-record');if(stop)stop.disabled=false;setStatus('Grabando...');window.WashMeetingsUI.setFilePreview({name:'nota de voz en curso',label:'Audio',icon:'🎙️',status:'grabando',note:'Grabando...'});}catch(e){console.warn('No se pudo iniciar la grabación.',e);setStatus('No se pudo acceder al micrófono.');}},
    stopRecording(){if(state.recorder&&state.recorder.state!=='inactive'){setStatus('Deteniendo grabación...');state.recorder.stop();}},
    async handleFile(file){if(!file)return;const preview={name:file.name,type:'detectando',label:'Detectando',icon:'📎',status:'procesando',note:'Procesando archivo...'};window.WashMeetingsUI.setFilePreview(preview);try{const fileInfo=await window.WashMeetingProcessors.processFile(file);state.file={...fileInfo,rawFile:file};window.WashMeetingsUI.setFilePreview(fileInfo);const notes=get('meet-notes');if(notes)notes.value=fileInfo.text;setStatus(`${fileInfo.label} listo · ${fileInfo.note}`);}catch(e){console.warn('No se pudo procesar el archivo de reunión.',e);window.WashMeetingsUI.setFilePreview({name:file.name,label:'Error',icon:'⚠️',status:'pendiente',note:'No se pudo procesar. Pega el contenido manualmente.'});setStatus('No se pudo procesar el archivo.');}},
    exportHTML(){if(!state.lastResult){alert('Procesa y carga un resultado primero.');return;}const {input,result}=state.lastResult;const html=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${esc(input.title)}</title><style>body{font-family:Arial,sans-serif;padding:32px;line-height:1.6;color:#1e293b}h1{color:#0f766e}.card{border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin:12px 0}li{margin:4px 0}@media print{button{display:none}}</style></head><body><h1>${esc(input.title)}</h1><p>${esc(input.type)} · ${esc(input.date||'Sin fecha')} · ${esc(input.fileName||'Sin archivo')}</p><div class="card"><h2>Resumen</h2><p>${esc(result.summary)}</p>${result.classification?`<p><strong>Categoría:</strong> ${esc(result.classification)}</p>`:''}</div><div class="card"><h2>Acuerdos</h2><ul>${list(result.agreements,'Sin acuerdos')}</ul></div><div class="card"><h2>Tareas</h2>${taskList(result.tasks)}</div><div class="card"><h2>Riesgos</h2><ul>${list(result.risks,'Sin riesgos')}</ul></div><div class="card"><h2>Próximos pasos</h2><ul>${list(result.next_steps,'Sin próximos pasos')}</ul></div><div class="card"><h2>Notas</h2><ul>${list(result.notes,'Sin notas operativas adicionales')}</ul></div></body></html>`;if(state.ctx&&state.ctx.dlBlob)state.ctx.dlBlob(html,`reunion_${Date.now()}.html`);else{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([html],{type:'text/html'}));a.download=`reunion_${Date.now()}.html`;a.click();URL.revokeObjectURL(a.href);}}
  };

  window.WashModules.reuniones.render = function(ctx){state.ctx=ctx;return window.WashMeetingsUI.render(ctx,getRoute());};
})();
