
(function(){
  const CLASSIFICATIONS = ['Emergencia','Salud','WASH','Educación','Otros'];

  const LOCAL_HISTORY_KEY = 'wash-operational-history';
  const state = { ctx:null, records:[], selectedId:null, selected:null, status:'Listo para cargar historial.', filters:{month:'',year:'',classification:'',q:''}, years:[], timer:null };

  function get(id){return document.getElementById(id);}
  function normalizeText(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
  function asArray(value){return Array.isArray(value)?value:(value?[value]:[]);}
  function readLocalHistory(){try{return JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY)||'[]');}catch(error){console.warn('No se pudo leer historial local.',error);return [];} }
  function writeLocalHistory(records){try{localStorage.setItem(LOCAL_HISTORY_KEY,JSON.stringify(records));return true;}catch(error){console.warn('No se pudo escribir historial local.',error);return false;} }
  function deleteLocalHistory(id){const records=readLocalHistory();const next=records.filter(record=>String(record.id)!==String(id));if(next.length===records.length)return false;return writeLocalHistory(next);}
  function raw(record){return record.raw_result && typeof record.raw_result==='object' ? record.raw_result : {};}
  function firstArray(...values){for(const value of values){if(Array.isArray(value)&&value.length)return value;}return [];}
  function isMissingTitle(title){const text=String(title||'').trim().toLowerCase();return !text||text==='reunión sin título'||text==='reunion sin titulo'||text==='sin título'||text==='sin titulo';}
  function autoTitleFromContext(record,data,classification){
    const context=[record.summary,data.summary,data.resumen,record.source_reference,record.type,...asArray(record.tags)].join(' ');
    const text=normalizeText(context);
    if(text.includes('pma')&&text.includes('pao'))return 'Coordinación PMA PAO';
    if(text.includes('tienda')&&text.includes('humanitaria'))return 'Seguimiento Tienda Humanitaria';
    if(text.includes('cartilla')&&text.includes('pao'))return 'Actualización cartilla PAO';
    if(classification==='Emergencia')return text.includes('wash')?'WASH emergencia operativa':'Emergencia seguimiento operativo';
    if(classification==='Salud')return 'Seguimiento operativo Salud';
    if(classification==='Educación')return 'Coordinación operativa Educación';
    if(classification==='WASH')return 'Seguimiento operativo WASH';

    const stop=new Set('reunion reunión tecnica técnica seguimiento operativo operativa coordinacion coordinación actualizacion actualización de del la el los las y en para con por un una sobre desde hacia se que al'.split(' '));
    const words=text.match(/[a-z0-9áéíóúñ]+/g)||[];
    const picked=[];
    for(const word of words){
      if(word.length<3||stop.has(word)||picked.includes(word))continue;
      picked.push(word.toUpperCase()==='pao'||word.toUpperCase()==='pma'?word.toUpperCase():word.charAt(0).toUpperCase()+word.slice(1));
      if(picked.length>=4)break;
    }
    return picked.length?`Seguimiento ${picked.join(' ')}`.split(' ').slice(0,6).join(' '):'Reunión técnica';
  }

  function inferClassification(record){
    const data=raw(record);
    const explicit=data.classification||data.clasificacion||record.classification||record.clasificacion;
    if(explicit)return normalizeClassification(explicit);
    const haystack=normalizeText([record.title,record.summary,record.type,record.source_reference,...asArray(record.tags)].join(' '));
    if(/emergencia|urgente|alerta|crisis|desastre|inundacion|brote/.test(haystack))return 'Emergencia';
    if(/\bwash\b|agua|saneamiento|higiene|letrina|cloracion/.test(haystack))return 'WASH';
    if(/salud|sanitario|clinica|hospital|brote|epidemi/.test(haystack))return 'Salud';
    if(/educacion|escuela|docente|aprendizaje|estudiante/.test(haystack))return 'Educación';
    return 'Otros';
  }
  function normalizeClassification(value){const text=normalizeText(value);if(text.includes('emergencia'))return 'Emergencia';if(text.includes('wash'))return 'WASH';if(text.includes('salud'))return 'Salud';if(text.includes('educacion'))return 'Educación';return CLASSIFICATIONS.includes(value)?value:'Otros';}
  function dateParts(record){const d=record.date?new Date(record.date):record.created_at?new Date(record.created_at):null;const ok=d&&!Number.isNaN(d.getTime());return {month:Number(record.month)||(ok?d.getUTCMonth()+1:''),year:Number(record.year)||(ok?d.getUTCFullYear():'')};}
  function normalizeRecord(record){
    const data=raw(record);const parts=dateParts(record);
    const agreements=firstArray(record.completed_or_coordinated,data.agreements,data.acuerdos,data.completed_or_coordinated);
    const tasks=firstArray(record.pending_tasks,data.tasks,data.tareas,data.pending_tasks);
    const risks=firstArray(record.risks,data.risks,data.riesgos);
    const next=firstArray(data.next_steps,data.proximos_pasos,data.nextSteps,record.next_steps,record.notes);
    const notes=firstArray(data.notes,data.notas,record.observations,record.notas);
    const classification=inferClassification(record);
    const sourceTitle=record.title||data.title||data.titulo;
    const title=isMissingTitle(sourceTitle)?autoTitleFromContext(record,data,classification):String(sourceTitle).trim().split(/\s+/).slice(0,6).join(' ');
    return {...record,title,id:String(record.id||record.created_at||Math.random()),month:parts.month,year:parts.year,classification,agreements,tasks,risks,notes,next_steps:next,task_count:tasks.length,risk_count:risks.length,tags:asArray(record.tags)};
  }
  function queryParams(){const params=new URLSearchParams();params.set('type','meeting');params.set('limit','150');if(state.filters.month)params.set('month',state.filters.month);if(state.filters.year)params.set('year',state.filters.year);return params.toString();}
  function matchesClientFilters(record){
    if(state.filters.classification&&record.classification!==state.filters.classification)return false;
    if(state.filters.q){const q=normalizeText(state.filters.q);const haystack=normalizeText([record.summary,record.title,...asArray(record.tags)].join(' '));if(!haystack.includes(q))return false;}
    return true;
  }
  function refreshYears(records){const years=[...new Set(records.map(r=>Number(r.year)).filter(Boolean))].sort((a,b)=>b-a);state.years=years;}
  function updateYearOptions(){const select=get('hist-year');if(!select)return;const current=select.value;const options=['<option value="">Todos los años</option>',...state.years.map(year=>`<option value="${year}">${year}</option>`)];select.innerHTML=options.join('');select.value=current;}
  function renderCurrent(){if(!window.WashMeetingHistoryUI)return;updateYearOptions();window.WashMeetingHistoryUI.updateList(state.records,state.selectedId);window.WashMeetingHistoryUI.updateDetail(state.selected);window.WashMeetingHistoryUI.setStatus(state.status);}
  async function load(){
    if(!window.WashMeetingHistoryUI)return;
    state.status='Cargando historial desde Supabase...';window.WashMeetingHistoryUI.setStatus(state.status);
    try{
      const response=await fetch(`/api/history?${queryParams()}`,{method:'GET'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.ok)throw new Error(data.error||`History API ${response.status}`);
      const normalized=asArray(data.records).map(record=>normalizeRecord({...record,storage:'supabase'}));
      refreshYears(normalized);
      state.records=normalized.filter(matchesClientFilters);
      state.selected=state.records.find(r=>r.id===state.selectedId)||state.records[0]||null;
      state.selectedId=state.selected?state.selected.id:null;
      state.status=`${state.records.length} reuniones cargadas · Supabase meeting_history`;
      renderCurrent();
    }catch(error){
      console.warn('No se pudo cargar historial operacional.',error);
      const localRecords=readLocalHistory().filter(record=>record.type==='meeting').map(record=>normalizeRecord({...record,storage:'local'})).filter(matchesClientFilters);
      refreshYears(localRecords);
      state.records=localRecords;
      state.selected=state.records.find(r=>r.id===state.selectedId)||state.records[0]||null;
      state.selectedId=state.selected?state.selected.id:null;
      state.status=localRecords.length?`${localRecords.length} reuniones cargadas desde respaldo local`:`No se pudo cargar Supabase: ${error.message}`;
      renderCurrent();
      window.WashMeetingHistoryUI.setStatus(state.status,!localRecords.length);
    }
  }
  function readFilters(){state.filters={month:get('hist-month')?.value||'',year:get('hist-year')?.value||'',classification:get('hist-classification')?.value||'',q:get('hist-search')?.value.trim()||''};}
  function detailText(record){return [`${record.title||'Reunión sin título'}`,`Fecha: ${record.date||record.created_at||'Sin fecha'}`,`Clasificación: ${record.classification}`,`IA: ${[record.provider,record.model].filter(Boolean).join(' / ')||'No especificado'}`,'',`Resumen:\n${record.summary||''}`,'',`Acuerdos:\n${record.agreements.map(x=>typeof x==='string'?x:JSON.stringify(x)).join('\n')}`,'',`Tareas:\n${record.tasks.map(x=>typeof x==='string'?x:JSON.stringify(x)).join('\n')}`,'',`Riesgos:\n${record.risks.map(x=>typeof x==='string'?x:JSON.stringify(x)).join('\n')}`,'',`Próximos pasos:\n${record.next_steps.map(x=>typeof x==='string'?x:JSON.stringify(x)).join('\n')}`].join('\n');}
  function exportFileName(record){const rawDate=record.date||record.created_at;const d=rawDate?new Date(rawDate):null;const date=(!d||Number.isNaN(d.getTime()))?new Date():d;return `reunion_${date.toISOString().slice(0,10)}.txt`;}
  function downloadTextFile(filename,text){const blob=new Blob([text],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();document.body.removeChild(link);URL.revokeObjectURL(url);}

  async function deleteRemote(id){
    const response=await fetch(`/api/history?id=${encodeURIComponent(id)}`,{method:'DELETE'});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.ok)throw new Error(data.error||`History API ${response.status}`);
    return data.deleted||[];
  }
  function removeFromState(id){state.records=state.records.filter(record=>record.id!==String(id));state.selected=state.records[0]||null;state.selectedId=state.selected?state.selected.id:null;renderCurrent();}

  window.WashMeetingHistory = {
    init(){load();},
    reload(){readFilters();load();},
    applyFilters(){readFilters();load();},
    onFilterInput(){clearTimeout(state.timer);state.timer=setTimeout(()=>{readFilters();load();},300);},
    openDetail(id){state.selectedId=String(id);state.selected=state.records.find(r=>r.id===state.selectedId)||null;renderCurrent();},
    sendTasksToManager(id){const record=state.records.find(r=>r.id===String(id));const tasks=record?record.tasks:[];window.dispatchEvent(new CustomEvent('wash-history-send-tasks',{detail:{source:'historial',record,tasks}}));window.WashMeetingHistoryUI.setStatus(`${tasks.length} tareas preparadas para futura integración con gestor.`);},
    async deleteRecord(id){
      const record=state.records.find(r=>r.id===String(id));
      if(!record)return;
      if(!confirm('¿Eliminar esta reunión del historial?'))return;
      window.WashMeetingHistoryUI.setStatus('Eliminando reunión del historial...');
      try{
        await deleteRemote(id);
        deleteLocalHistory(id);
        removeFromState(id);
        window.WashMeetingHistoryUI.setStatus('Reunión eliminada del historial.');
      }catch(error){
        const removedLocal=deleteLocalHistory(id);
        if(record.storage==='local'||removedLocal){removeFromState(id);window.WashMeetingHistoryUI.setStatus('Reunión eliminada del respaldo local.');return;}
        console.warn('No se pudo eliminar reunión.',error);
        window.WashMeetingHistoryUI.setStatus(`No se pudo eliminar: ${error.message}`,true);
      }
    },
    copyDetail(id){const record=state.records.find(r=>r.id===String(id));if(!record)return;const text=detailText(record);if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(()=>window.WashMeetingHistoryUI.setStatus('Detalle copiado al portapapeles.')).catch(()=>window.WashMeetingHistoryUI.setStatus('No se pudo copiar automáticamente.'));}else window.WashMeetingHistoryUI.setStatus('Portapapeles no disponible en este navegador.');},
    exportDetail(id){const record=state.records.find(r=>r.id===String(id));if(!record)return;downloadTextFile(exportFileName(record),detailText(record));window.WashMeetingHistoryUI.setStatus('Detalle exportado como TXT.');}
  };

  window.WashMeetingHistory.renderPanel = function(ctx){state.ctx=ctx;return window.WashMeetingHistoryUI.renderPanel(ctx,state);};
})();
