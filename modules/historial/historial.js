window.WashModules = window.WashModules || {};
window.WashModules.historial = window.WashModules.historial || {};

(function(){
  const STORAGE_KEY = 'wash-general-history';
  const TOOL_OPTIONS = ['general','traductor','revisor','mejorador','indicadores','propuestas','comparador','reuniones','gestor'];
  const DEFAULT_FILTERS = { tool:'', tag:'', favorite:false, q:'' };
  const state = { ctx:null, records:[], selectedId:null, filters:{...DEFAULT_FILTERS}, status:'Historial general local listo.' };

  function get(id){return document.getElementById(id);}
  function uid(){return `hist-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;}
  function now(){return new Date().toISOString();}
  function cleanText(value, max){return String(value ?? '').replace(/\s+/g,' ').trim().slice(0,max);}
  function normalizeSearch(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
  function parseBoolean(value){return value===true || value==='true' || value===1 || value==='1';}
  function normalizeTags(tags){
    const values = Array.isArray(tags) ? tags : (tags ? [tags] : []);
    return [...new Set(values.map(tag => cleanText(tag,40)).filter(Boolean))].slice(0,12);
  }
  function normalizeTool(tool){const value=cleanText(tool || 'general',40).toLowerCase();return TOOL_OPTIONS.includes(value)?value:'general';}
  function normalizeCreatedAt(value){const d=value?new Date(value):null;return d && !Number.isNaN(d.getTime()) ? d.toISOString() : now();}
  function normalizeRecord(record){
    const safe = record && typeof record==='object' ? record : {};
    return {
      id: cleanText(safe.id,80) || uid(),
      created_at: normalizeCreatedAt(safe.created_at),
      tool: normalizeTool(safe.tool),
      title: cleanText(safe.title,120) || 'Actividad registrada',
      summary: cleanText(safe.summary,300),
      tags: normalizeTags(safe.tags),
      favorite: parseBoolean(safe.favorite)
    };
  }
  function read(){
    try{const data=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(data)?data.map(normalizeRecord):[];}
    catch(error){console.warn('No se pudo leer el historial general local.',error);return [];}
  }
  function write(records){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(records.map(normalizeRecord)));return true;}
    catch(error){console.warn('No se pudo guardar el historial general local.',error);return false;}
  }
  function sortRecords(records){return [...records].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));}
  function add(record){
    const normalized = normalizeRecord(record);
    const records = read().filter(item => item.id !== normalized.id);
    records.unshift(normalized);
    write(sortRecords(records));
    return normalized;
  }
  function list(){return sortRecords(read());}
  function remove(id){const key=String(id||'');const records=read();const next=records.filter(item=>item.id!==key);write(next);return next.length!==records.length;}
  function clear(){write([]);return true;}
  function exportHistory(){return { storage:STORAGE_KEY, exported_at:now(), records:list() };}
  function matches(record){
    if(state.filters.tool && record.tool!==state.filters.tool)return false;
    if(state.filters.favorite && !record.favorite)return false;
    if(state.filters.tag){const tag=normalizeSearch(state.filters.tag);if(!record.tags.some(item=>normalizeSearch(item).includes(tag)))return false;}
    if(state.filters.q){const q=normalizeSearch(state.filters.q);const haystack=normalizeSearch([record.tool,record.title,record.summary,...record.tags].join(' '));if(!haystack.includes(q))return false;}
    return true;
  }
  function filteredRecords(){return state.records.filter(matches);}
  function download(filename, content, type){
    const blob=new Blob([content],{type});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  function setStatus(text, error){state.status=text||'';if(window.WashHistoryUI)window.WashHistoryUI.setStatus(state.status,error);}
  function renderCurrent(){
    if(!window.WashHistoryUI)return;
    const records=filteredRecords();
    window.WashHistoryUI.updateList(records,state.selectedId);
    window.WashHistoryUI.updateDetail(state.records.find(record=>record.id===state.selectedId)||null);
    setStatus(`${records.length} actividad(es) en historial general local.`);
  }
  function load(){state.records=list();if(state.selectedId&&!state.records.some(record=>record.id===state.selectedId))state.selectedId=null;renderCurrent();}
  function init(ctx){
    state.ctx=ctx||state.ctx||{};
    state.records=list();
    const app=get('app');
    if(app && window.WashHistoryUI)app.innerHTML=window.WashHistoryUI.render(state.ctx,state,TOOL_OPTIONS);
    renderCurrent();
  }
  function onFilterInput(){
    state.filters.q=get('hist-search')?.value.trim()||'';
    state.filters.tag=get('hist-tag')?.value.trim()||'';
    state.filters.tool=get('hist-tool')?.value||'';
    state.filters.favorite=!!get('hist-favorite')?.checked;
    renderCurrent();
  }
  function reload(){load();}
  function openDetail(id){state.selectedId=String(id||'');renderCurrent();}
  function toggleFavorite(id){const record=state.records.find(item=>item.id===String(id||''));if(!record)return;add({...record,favorite:!record.favorite});load();}
  function deleteRecord(id){if(!confirm('¿Eliminar este registro del historial general local?'))return;remove(id);load();}
  function clearLocal(){if(!confirm('¿Limpiar todo el historial general local? Esta acción no afecta reuniones ni servicios externos.'))return;clear();state.selectedId=null;load();}
  function exportJson(){const data=exportHistory();download(`wash-general-history-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(data,null,2),'application/json');}

  window.WashGeneralHistory = { add, list, remove, clear, export: exportHistory };
  window.WashHistory = { init, reload, onFilterInput, openDetail, toggleFavorite, deleteRecord, clearLocal, exportJson };
})();
