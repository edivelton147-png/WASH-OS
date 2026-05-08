window.WashModules = window.WashModules || {};
window.WashModules.reuniones = window.WashModules.reuniones || {};

(function(){
  const state = { ctx:null, lastResult:null, file:null, recorder:null, stream:null, chunks:[] };
  
const RESULT_SCHEMA = {
  summary:'',
  pending_tasks:[],
  completed_or_coordinated:[],
  risks:[],
  notes:[],
  source_reference:''
};

const PROMPT_FALLBACK = {
  system:'Eres WASH-OS, asistente institucional UNICEF/WASH para reuniones técnicas y seguimiento operacional.',

  summary:'Genera un resumen operacional corto, homogéneo y útil. Máximo 2 a 5 párrafos breves. Resume avances, decisiones, coordinaciones y bloqueos.',

  tasks:'Detecta solo tareas pendientes accionables con título, descripción, prioridad alta/media/baja, responsable y fecha si existe.',

  completed_or_coordinated:'Identifica coordinaciones realizadas, actividades ejecutadas, validaciones y acciones completadas.',

  risks:'Detecta riesgos, retrasos, problemas, interferencias, bloqueos y limitaciones. Si no existen, devolver vacío.',

  notes:'Agrega notas operacionales cortas si aportan contexto útil de seguimiento.',

  source_reference:'Incluye el nombre del archivo, link OneDrive o referencia documental disponible si existe.'
};

  function esc(value){return String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function get(id){return document.getElementById(id);}
  function setStatus(text){const el=get('meet-ai-status');if(el)el.textContent=text;}
  function recordingName(){return `nota-voz-${new Date().toISOString().replace(/[:.]/g,'-')}.webm`;}
  function getRoute(){return window.WashAI&&typeof window.WashAI.routeAI==='function'?window.WashAI.routeAI('meeting'):{provider:'openai',model:'meeting-fallback'};}
  function scriptUrl(path){return state.ctx&&state.ctx.resolveAppPath?state.ctx.resolveAppPath(path):path;}
  function loadScriptOnce(path,test){return new Promise((resolve,reject)=>{if(test())return resolve();const script=document.createElement('script');script.src=scriptUrl(path);script.onload=()=>test()?resolve():reject(new Error('Script cargado sin API esperada: '+path));script.onerror=()=>reject(new Error('No se pudo cargar '+path));document.head.appendChild(script);});}
  async function ensureAIGateway(){await loadScriptOnce('/core/ai/gateway.js',()=>window.WashAI&&typeof window.WashAI.runAI==='function');}
  function getPromptUrl(){return state.ctx&&state.ctx.resolveAppPath?state.ctx.resolveAppPath('/config/prompts/reuniones.json'):'/config/prompts/reuniones.json';}
  async function loadMeetingPrompts(){try{const res=await fetch(getPromptUrl(),{cache:'no-cache'});if(!res.ok)throw new Error(res.status);return {...PROMPT_FALLBACK,...await res.json()};}catch(e){console.warn('No se pudo cargar prompts de reuniones, usando fallback.',e);return PROMPT_FALLBACK;}}
  function copyPromptFallback(prompt,route){if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(prompt).then(()=>setStatus(`Sin API key o gateway disponible. Prompt copiado para ${route.provider}; pega el JSON abajo.`)).catch(()=>setStatus('Sin API key o gateway disponible. Usa el flujo manual.'));}else setStatus('Sin API key o gateway disponible. Usa el flujo manual.');}

  function normalizePriority(value){const priority=String(value||'media').toLowerCase();return ['alta','media','baja'].includes(priority)?priority:'media';}
  function normalizeStringList(items){
    if(typeof items==='string')return items.trim()?[items.trim()]:[];
    if(!Array.isArray(items))return [];
    return items.map(item=>{
      if(typeof item==='string')return item.trim();
      if(item&&typeof item==='object')return (item.title||item.action||item.description||item.text||item.descripcion||JSON.stringify(item)).trim();
      return String(item||'').trim();
    }).filter(Boolean);
  }
  function normalizeTask(task){
    const raw=task&&typeof task==='object'?task:{title:String(task||'')};
    return {
      title:String(raw.title||raw.action||raw.tarea||raw.text||'Tarea pendiente').trim(),
      description:String(raw.description||raw.descripcion||raw.context||raw.contexto||'').trim(),
      priority:normalizePriority(raw.priority||raw.prioridad),
      dueDate:String(raw.dueDate||raw.date||raw.fecha||raw.deadline||'').trim(),
      responsible:String(raw.responsible||raw.responsable||raw.owner||'No especificado').trim(),
      status:'pending'
    };
  }
  function normalizeResult(parsed,rawText){
    const source=parsed&&typeof parsed==='object'?parsed:{};
    const summary=String(source.summary||source.resumen||'').trim() || String(rawText||'').split('\n').slice(0,5).join('\n').trim();
    const taskSource=Array.isArray(source.pending_tasks)?source.pending_tasks:(Array.isArray(source.tasks)?source.tasks:(Array.isArray(source.tareas)?source.tareas:[]));
    return {
      ...RESULT_SCHEMA,
      summary,
      pending_tasks:taskSource.map(normalizeTask).filter(task=>task.title),
      completed_or_coordinated:normalizeStringList(source.completed_or_coordinated||source.completed||source.coordinated||source.completed_actions||source.agreements||source.acuerdos||[]),
      risks:normalizeStringList(source.risks||source.riesgos||[]),
      notes:normalizeStringList(source.notes||source.notas||source.next_steps||[]),
      source_reference:String(source.source_reference||source.sourceReference||source.file_reference||source.referencia||'').trim()
    };
  }
  function stripJsonNoise(text){
    const raw=String(text||'').trim();
    const fenced=raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if(fenced)return fenced[1].trim();
    const first=raw.indexOf('{');
    const last=raw.lastIndexOf('}');
    return first>=0&&last>first?raw.slice(first,last+1):raw;
  }
  function parseLines(text,label){const re=new RegExp(`(?:${label})[:\\n]+([\\s\\S]*?)(\\n[A-ZÁÉÍÓÚ_ ]{4,}:|$)`,'i');const m=String(text||'').match(re);return m?m[1].split(/\n|;/).map(x=>x.replace(/^[-*\d.\s]+/,'').trim()).filter(Boolean):[];}
  function parseResult(text){
    const cleaned=stripJsonNoise(text);
    try{return normalizeResult(JSON.parse(cleaned),cleaned);}catch(e){}
    return normalizeResult({
      summary:String(text||'').split('\n').slice(0,5).join('\n').trim(),
      pending_tasks:parseLines(text,'TAREAS PENDIENTES|PENDING_TASKS|TAREAS|TASKS'),
      completed_or_coordinated:parseLines(text,'COORDINACIONES|COMPLETED_OR_COORDINATED|COMPLETED|EJECUTADO|ACUERDOS|AGREEMENTS'),
      risks:parseLines(text,'RIESGOS|RISKS|BLOQUEOS'),
      notes:parseLines(text,'NOTAS|NOTES')
    },text);
  }

  function meetingInput(){return {title:get('meet-title')?.value.trim()||'Reunión sin título',date:get('meet-date')?.value||'',type:get('meet-type')?.value||'Reunión técnica',content:get('meet-notes')?.value.trim()||'',fileName:state.file?.name||'',fileType:state.file?.type||'',fileLabel:state.file?.label||''};}
  function buildPrompt(input,prompts,route){return `${prompts.system}\n\nTIPO DE REUNIÓN: ${input.type}\nTÍTULO: ${input.title}\nFECHA: ${input.date||'No especificada'}\nARCHIVO: ${input.fileName||'Sin archivo'} (${input.fileLabel||input.fileType||'notas rápidas'})\nMODELO SUGERIDO: ${route.provider}/${route.model}\n\nOBJETIVO:\nGenerar un RESUMEN OPERACIONAL INTELIGENTE WASH. No entregar transcripción completa ni minuta extensa. Si hay audio adjunto, transcribe internamente lo necesario y devuelve solo el resumen operacional estructurado.\n\nINSTRUCCIONES:\n1. ${prompts.summary}\n2. ${prompts.tasks}\n3. ${prompts.completed_or_coordinated}\n4. ${prompts.risks}\n5. ${prompts.notes}\n6. ${prompts.source_reference}\n7. No inventes responsables, fechas, archivos, decisiones ni riesgos.\n8. Si no hay riesgos, devuelve \"risks\": [].\n\nResponde únicamente JSON válido con esta estructura exacta:\n{\n  \"summary\":\"\",\n  \"pending_tasks\":[{\"title\":\"\",\"description\":\"\",\"priority\":\"media\",\"dueDate\":\"\",\"responsible\":\"\",\"status\":\"pending\"}],\n  \"completed_or_coordinated\":[\"\"],\n  \"risks\":[\"\"],\n  \"notes\":[\"\"],\n  \"source_reference\":\"\"\n}\n\nCONTENIDO MULTIMODAL NORMALIZADO:\n${input.content}`;}

  function list(items, empty){return (items&&items.length)?items.map(i=>`<li>${esc(i)}</li>`).join(''):`<li class="meet-muted">${esc(empty)}</li>`;}
  function priorityClass(priority){return `meet-priority meet-priority-${normalizePriority(priority)}`;}
  function taskList(tasks){
    return (tasks&&tasks.length)?tasks.map((raw,i)=>{const t=normalizeTask(raw);return `<div class="meet-task" data-task-index="${i}"><label class="meet-task-row"><input type="checkbox" class="meet-task-check" aria-label="Marcar tarea ${esc(t.title)}"><div class="meet-task-body"><input class="meet-task-title" value="${esc(t.title)}" aria-label="Edición rápida de tarea"><textarea class="meet-task-description" rows="2" aria-label="Descripción de tarea">${esc(t.description)}</textarea><div class="meet-task-meta"><span>👤 ${esc(t.responsible||'No especificado')}</span><span class="${priorityClass(t.priority)}">${esc(t.priority)}</span><span>Estado: ${esc(t.status)}</span></div><div class="meet-task-actions"><input type="date" value="${esc(t.dueDate)}" aria-label="Fecha editable de tarea"><button type="button" class="meet-manager-btn" onclick="WashMeetings.prepareTaskForManager(${i})">Agregar al gestor</button></div></div></label></div>`;}).join(''):'<div class="meet-empty">No se identificaron tareas pendientes.</div>';
  }
  function renderResults(result){
    const box=get('meet-results');if(!box)return;
    box.style.display='grid';
    box.innerHTML=`<div class="meet-result-card meet-result-summary"><div class="meet-section-label">Resumen operacional</div><p class="meet-summary-text">${esc(result.summary||'Sin resumen operacional.')}</p></div><div class="meet-result-card"><div class="meet-section-label">Tareas pendientes accionables</div>${taskList(result.pending_tasks)}</div><div class="meet-result-card"><div class="meet-section-label">Coordinado / ejecutado</div><ul class="meet-clean-list">${list(result.completed_or_coordinated,'No se identificaron coordinaciones cerradas.')}</ul></div><div class="meet-result-card"><div class="meet-section-label">Riesgos y bloqueos</div><ul class="meet-clean-list meet-risk-list">${list(result.risks,'No identificados')}</ul></div><div class="meet-result-card"><div class="meet-section-label">Notas operacionales</div><ul class="meet-clean-list">${list(result.notes,'Sin notas adicionales.')}</ul><div class="meet-source-ref">Fuente: ${esc(result.source_reference||'Sin referencia')}</div></div><div class="meet-result-card meet-export-card"><div class="meet-section-label">Exportación e historial futuro</div><p class="meet-empty">Estructura compatible con fecha, mes, año, proveedor IA, riesgos, tareas, resumen y referencia de archivo.</p><button type="button" class="meet-secondary" onclick="WashMeetings.exportHTML()">Exportar HTML / PDF</button></div>`;
  }
  async function saveResult(input,result,route){
    if(!state.ctx||!state.ctx.historialReuniones)return;
    const baseDate=input.date?new Date(`${input.date}T00:00:00`):new Date();
    const contenido=[result.summary,(result.completed_or_coordinated||[]).join('\n'),(result.notes||[]).join('\n')].filter(Boolean).join('\n\n');
    state.ctx.historialReuniones.unshift({
      titulo:input.title,
      fecha:input.date,
      mes:baseDate.getMonth()+1,
      anio:baseDate.getFullYear(),
      tipo:input.type,
      lugar:'',
      contenido,
      resumen:result.summary,
      pendientes:result.pending_tasks||[],
      tareas:result.pending_tasks||[],
      riesgos:result.risks||[],
      proveedorIA:route.provider,
      modeloIA:route.model,
      archivoNombre:input.fileName,
      archivoTipo:input.fileType,
      referenciaArchivo:result.source_reference||input.fileName||'',
      source_reference:result.source_reference||input.fileName||'',
      resultado:result,
      ts:Date.now()
    });
    if(state.ctx.saveHist)await state.ctx.saveHist('hist-reuniones',state.ctx.historialReuniones);
  }

  window.WashMeetings = {
    async process(){
      const input=meetingInput();
      if(!input.content&&!state.file){alert('Agrega notas, transcripción o un archivo multimodal.');return;}
      const route=getRoute();
      const prompts=await loadMeetingPrompts();
      const prompt=buildPrompt(input,prompts,route);
      const paste=get('meet-ai-paste');
      setStatus(`AI Router: ${route.provider} · ${route.model}`);
      try{
        await ensureAIGateway();
        setStatus(state.file?.type==='audio'?`Transcribiendo audio y generando resumen con ${route.provider}...`:`Enviando automáticamente a ${route.provider}...`);
        const audioFile=state.file&&state.file.type==='audio'?state.file.rawFile:null;
        const ai=await window.WashAI.runAI('meeting',{prompt,systemPrompt:prompts.system,audioFile});
        const result=parseResult(ai.text||JSON.stringify(ai.result));
        if(!result.source_reference&&input.fileName)result.source_reference=input.fileName;
        state.lastResult={input,result,route:ai.route||route};
        renderResults(result);
        await saveResult(input,result,ai.route||route);
        if(paste)paste.style.display='none';
        setStatus(`Resumen operacional generado con ${ai.route.provider}.`);
      }catch(e){
        console.warn('IA automática no disponible; usando fallback manual.',e);
        if(paste)paste.style.display='block';
        copyPromptFallback(prompt,route);
      }
    },
    async loadResult(){const raw=get('meet-ai-output')?.value.trim();if(!raw){alert('Pega el JSON o resultado primero.');return;}const input=meetingInput();const route=getRoute();const result=parseResult(raw);if(!result.source_reference&&input.fileName)result.source_reference=input.fileName;state.lastResult={input,result,route};renderResults(result);await saveResult(input,result,route);setStatus('Resumen operacional guardado en historial de reuniones.');},
    prepareTaskForManager(index){const card=document.querySelector(`[data-task-index="${index}"]`);if(!card)return;card.classList.add('meet-task-ready');setStatus('Tarea preparada para agregar al gestor en la siguiente fase.');},
    async startRecording(){if(!navigator.mediaDevices||!window.MediaRecorder){alert('MediaRecorder no está disponible en este navegador.');return;}try{state.stream=await navigator.mediaDevices.getUserMedia({audio:true});state.chunks=[];state.recorder=new MediaRecorder(state.stream);state.recorder.ondataavailable=e=>{if(e.data&&e.data.size)state.chunks.push(e.data);};state.recorder.onstop=async()=>{const blob=new Blob(state.chunks,{type:'audio/webm'});const file=new File([blob],recordingName(),{type:'audio/webm'});state.stream?.getTracks().forEach(track=>track.stop());state.stream=null;state.recorder=null;const stop=get('meet-stop-record');if(stop)stop.disabled=true;setStatus('Grabación lista. Audio preparado para transcripción IA...');await window.WashMeetings.handleFile(file);};state.recorder.start();const stop=get('meet-stop-record');if(stop)stop.disabled=false;setStatus('Grabando...');window.WashMeetingsUI.setFilePreview({name:'nota de voz en curso',label:'Audio',icon:'🎙️',status:'grabando',note:'Grabando...'});}catch(e){console.warn('No se pudo iniciar la grabación.',e);setStatus('No se pudo acceder al micrófono.');}},
    stopRecording(){if(state.recorder&&state.recorder.state!=='inactive'){setStatus('Deteniendo grabación...');state.recorder.stop();}},
    async handleFile(file){if(!file)return;const preview={name:file.name,type:'detectando',label:'Detectando',icon:'📎',status:'procesando',note:'Procesando archivo...'};window.WashMeetingsUI.setFilePreview(preview);try{const fileInfo=await window.WashMeetingProcessors.processFile(file);state.file={...fileInfo,rawFile:file};window.WashMeetingsUI.setFilePreview(fileInfo);const notes=get('meet-notes');if(notes)notes.value=fileInfo.text;setStatus(`${fileInfo.label} listo · ${fileInfo.note}`);}catch(e){console.warn('No se pudo procesar el archivo de reunión.',e);window.WashMeetingsUI.setFilePreview({name:file.name,label:'Error',icon:'⚠️',status:'pendiente',note:'No se pudo procesar. Pega el contenido manualmente.'});setStatus('No se pudo procesar el archivo.');}},
    exportHTML(){if(!state.lastResult){alert('Procesa y carga un resultado primero.');return;}const {input,result}=state.lastResult;const html=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${esc(input.title)}</title><style>body{font-family:Arial,sans-serif;padding:32px;line-height:1.6;color:#1e293b}h1{color:#0f766e}.card{border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin:12px 0}li{margin:4px 0}.task{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin:8px 0}@media print{button,input,textarea{display:none}}</style></head><body><h1>${esc(input.title)}</h1><p>${esc(input.type)} · ${esc(input.date||'Sin fecha')} · ${esc(result.source_reference||input.fileName||'Sin archivo')}</p><div class="card"><h2>Resumen operacional</h2><p style="white-space:pre-wrap">${esc(result.summary)}</p></div><div class="card"><h2>Tareas pendientes</h2>${(result.pending_tasks||[]).map(task=>`<div class="task"><strong>${esc(task.title)}</strong><p>${esc(task.description)}</p><p>${esc(task.responsible)} · ${esc(task.dueDate||'Sin fecha')} · ${esc(task.priority)}</p></div>`).join('')||'<p>No se identificaron tareas pendientes.</p>'}</div><div class="card"><h2>Coordinado / ejecutado</h2><ul>${list(result.completed_or_coordinated,'Sin coordinaciones cerradas')}</ul></div><div class="card"><h2>Riesgos</h2><ul>${list(result.risks,'No identificados')}</ul></div><div class="card"><h2>Notas</h2><ul>${list(result.notes,'Sin notas')}</ul></div></body></html>`;if(state.ctx&&state.ctx.dlBlob)state.ctx.dlBlob(html,`reunion_${Date.now()}.html`);else{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([html],{type:'text/html'}));a.download=`reunion_${Date.now()}.html`;a.click();URL.revokeObjectURL(a.href);}}
  };

  window.WashModules.reuniones.render = function(ctx){state.ctx=ctx;return window.WashMeetingsUI.render(ctx,getRoute());};
})();
