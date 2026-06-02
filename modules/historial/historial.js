window.WashModules = window.WashModules || {};
window.WashModules.historial = window.WashModules.historial || {};

(function(){
  const CLASSIFICATIONS = ['Emergencia','Salud','WASH','Educación','Otros'];
  const LOCAL_HISTORY_KEY = 'wash-operational-history';
  const FAVORITES_KEY = 'wash-history-favorites';
  const state = { ctx:null, records:[], selectedId:null, selected:null, status:'Listo para cargar historial.', filters:{month:'',year:'',classification:'',q:''}, years:[], timer:null };

  function get(id){return document.getElementById(id);}
  function normalizeText(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
  function asArray(value){return Array.isArray(value)?value:(value?[value]:[]);}
  function readLocalHistory(){try{const records=JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY)||'[]');return Array.isArray(records)?records:[];}catch(error){console.warn('No se pudo leer historial local.',error);return [];} }
  function readFavoriteIds(){try{const ids=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]');return Array.isArray(ids)?ids.map(String).filter(Boolean):[];}catch(error){console.warn('No se pudo leer favoritos locales.',error);return [];} }
  function writeFavoriteIds(ids){try{localStorage.setItem(FAVORITES_KEY,JSON.stringify([...new Set(ids.map(String).filter(Boolean))]));return true;}catch(error){console.warn('No se pudo escribir favoritos locales.',error);return false;} }
  function raw(record){return record.raw_result && typeof record.raw_result==='object' ? record.raw_result : {};}
  function firstArray(...values){for(const value of values){if(Array.isArray(value)&&value.length)return value;}return [];}
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
    return {...record,id:String(record.id||record.created_at||Math.random()),month:parts.month,year:parts.year,classification:inferClassification(record),agreements,tasks,risks,notes,next_steps:next,task_count:tasks.length,risk_count:risks.length,tags:asArray(record.tags)};
  }
  function queryParams(){const params=new URLSearchParams();params.set('type','meeting');params.set('limit','150');if(state.filters.month)params.set('month',state.filters.month);if(state.filters.year)params.set('year',state.filters.year);return params.toString();}
  function matchesClientFilters(record){
    if(state.filters.month&&Number(record.month)!==Number(state.filters.month))return false;
    if(state.filters.year&&Number(record.year)!==Number(state.filters.year))return false;
    if(state.filters.classification&&record.classification!==state.filters.classification)return false;
    if(state.filters.q){const q=normalizeText(state.filters.q);const haystack=normalizeText([record.summary,record.title,...asArray(record.tags)].join(' '));if(!haystack.includes(q))return false;}
    return true;
  }
  function refreshYears(records){const years=[...new Set(records.map(r=>Number(r.year)).filter(Boolean))].sort((a,b)=>b-a);state.years=years;}
  function markFavorites(records){const favorites=new Set(readFavoriteIds());return records.map(record=>({...record,isFavorite:favorites.has(String(record.id))}));}
  function updateYearOptions(){const select=get('hist-year');if(!select)return;const current=select.value;const options=['<option value="">Todos los años</option>',...state.years.map(year=>`<option value="${year}">${year}</option>`)];select.innerHTML=options.join('');select.value=current;}
  function renderCurrent(){if(!window.WashHistoryUI)return;updateYearOptions();window.WashHistoryUI.updateList(state.records,state.selectedId);window.WashHistoryUI.updateDetail(state.selected);window.WashHistoryUI.setStatus(state.status);}
  async function load(){
    if(!window.WashHistoryUI)return;
    state.status='Cargando historial desde Supabase...';window.WashHistoryUI.setStatus(state.status);
    try{
      const response=await fetch(`/api/history?${queryParams()}`,{method:'GET'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.ok)throw new Error(data.error||`History API ${response.status}`);
      const normalized=markFavorites(asArray(data.records).map(normalizeRecord));
      refreshYears(normalized);
      state.records=normalized.filter(matchesClientFilters);
      state.selected=state.records.find(r=>r.id===state.selectedId)||state.records[0]||null;
      state.selectedId=state.selected?state.selected.id:null;
      state.status=`${state.records.length} reuniones cargadas · Supabase meeting_history`;
      renderCurrent();
    }catch(error){
      console.warn('No se pudo cargar historial operacional.',error);
      const localRecords=markFavorites(readLocalHistory().filter(record=>record.type==='meeting').map(record=>normalizeRecord({...record,storage:'local'})));
      refreshYears(localRecords);
      state.records=localRecords.filter(matchesClientFilters);
      state.selected=state.records.find(r=>r.id===state.selectedId)||state.records[0]||null;
      state.selectedId=state.selected?state.selected.id:null;
      state.status=`${state.records.length} registros cargados desde respaldo local`;
      renderCurrent();
      window.WashHistoryUI.setStatus(state.status,!state.records.length);
    }
  }
  function readFilters(){state.filters={month:get('hist-month')?.value||'',year:get('hist-year')?.value||'',classification:get('hist-classification')?.value||'',q:get('hist-search')?.value.trim()||''};}
  function detailText(record){return [`${record.title||'Reunión sin título'}`,`Fecha: ${record.date||record.created_at||'Sin fecha'}`,`Clasificación: ${record.classification}`,`IA: ${[record.provider,record.model].filter(Boolean).join(' / ')||'No especificado'}`,'',`Resumen:\n${record.summary||''}`,'',`Acuerdos:\n${record.agreements.map(x=>typeof x==='string'?x:JSON.stringify(x)).join('\n')}`,'',`Tareas:\n${record.tasks.map(x=>typeof x==='string'?x:JSON.stringify(x)).join('\n')}`,'',`Riesgos:\n${record.risks.map(x=>typeof x==='string'?x:JSON.stringify(x)).join('\n')}`,'',`Próximos pasos:\n${record.next_steps.map(x=>typeof x==='string'?x:JSON.stringify(x)).join('\n')}`].join('\n');}

  window.WashHistory = {
    init(){load();},
    reload(){readFilters();load();},
    applyFilters(){readFilters();load();},
    onFilterInput(){clearTimeout(state.timer);state.timer=setTimeout(()=>{readFilters();load();},300);},
    openDetail(id){state.selectedId=String(id);state.selected=state.records.find(r=>r.id===state.selectedId)||null;renderCurrent();},
    sendTasksToManager(id){const record=state.records.find(r=>r.id===String(id));const tasks=record?record.tasks:[];window.dispatchEvent(new CustomEvent('wash-history-send-tasks',{detail:{source:'historial',record,tasks}}));window.WashHistoryUI.setStatus(`${tasks.length} tareas preparadas para futura integración con gestor.`);},
    toggleFavorite(id){const clean=String(id);const favorites=readFavoriteIds();const exists=favorites.includes(clean);const next=exists?favorites.filter(item=>item!==clean):[...favorites,clean];if(!writeFavoriteIds(next)){window.WashHistoryUI.setStatus('No se pudo guardar favorito local.',true);return;}state.records=markFavorites(state.records);state.selected=state.records.find(r=>r.id===state.selectedId)||null;state.status=exists?'Reunión quitada de favoritos.':'Reunión marcada como favorita.';renderCurrent();},
    copyDetail(id){const record=state.records.find(r=>r.id===String(id));if(!record)return;const text=detailText(record);if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(()=>window.WashHistoryUI.setStatus('Detalle copiado al portapapeles.')).catch(()=>window.WashHistoryUI.setStatus('No se pudo copiar automáticamente.'));}else window.WashHistoryUI.setStatus('Portapapeles no disponible en este navegador.');}
  };

  window.WashModules.historial.render = function(ctx){state.ctx=ctx;return window.WashHistoryUI.render(ctx,state);};
})();
