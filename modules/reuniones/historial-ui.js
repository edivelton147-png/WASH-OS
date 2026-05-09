window.WashMeetingHistoryUI = (function(){
  const MONTHS = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  function esc(value){return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function options(items, selected){return items.map(item => `<option value="${esc(item.value)}" ${String(item.value)===String(selected||'')?'selected':''}>${esc(item.label)}</option>`).join('');}
  function short(text, max=170){const clean=String(text||'').replace(/\s+/g,' ').trim();return clean.length>max?`${clean.slice(0,max-1)}…`:clean;}
  function itemText(item){if(item===null||item===undefined)return '';if(typeof item==='string')return item;if(typeof item==='number')return String(item);return item.action||item.tarea||item.text||item.descripcion||item.summary||item.title||JSON.stringify(item);}
  function list(items, empty){const data=Array.isArray(items)?items.filter(Boolean):[];if(!data.length)return `<p class="historial-muted">${esc(empty)}</p>`;return `<ul>${data.map(item=>`<li>${esc(itemText(item))}</li>`).join('')}</ul>`;}
  function taskList(items){const data=Array.isArray(items)?items.filter(Boolean):[];if(!data.length)return '<p class="historial-muted">Sin tareas registradas.</p>';return data.map(item=>{const text=itemText(item);const meta=typeof item==='object'&&item?[
      item.responsible||item.responsable?`👤 ${item.responsible||item.responsable}`:'',
      item.date||item.fecha?`📅 ${item.date||item.fecha}`:'',
      item.priority||item.prioridad?`⚑ ${item.priority||item.prioridad}`:''
    ].filter(Boolean).join(' · '):'';return `<div class="historial-task"><strong>${esc(text||'Tarea')}</strong>${meta?`<small>${esc(meta)}</small>`:''}</div>`;}).join('');}
  function riskList(items){const data=Array.isArray(items)?items.filter(Boolean):[];if(!data.length)return '<p class="historial-muted">Sin riesgos registrados.</p>';return data.map(item=>`<div class="historial-risk">${esc(itemText(item))}</div>`).join('');}
  function dateLabel(record){const raw=record.date||record.created_at; if(!raw)return 'Sin fecha'; const d=new Date(raw); return Number.isNaN(d.getTime())?'Sin fecha':d.toLocaleDateString('es-PE',{year:'numeric',month:'short',day:'2-digit'});}
  function lineClass(classification){const key=String(classification||'Otros').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); if(key.includes('emergencia'))return 'historial-line-emergencia'; if(key.includes('wash'))return 'historial-line-wash'; if(key.includes('salud'))return 'historial-line-salud'; if(key.includes('educacion'))return 'historial-line-educacion'; return 'historial-line-otros';}
  function classificationTheme(classification){
    const key=String(classification||'Otros').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if(key.includes('emergencia'))return {bg:'rgba(239,68,68,0.08)',border:'rgba(239,68,68,0.22)',line:'#ef4444'};
    if(key.includes('salud'))return {bg:'rgba(22,163,74,0.08)',border:'rgba(22,163,74,0.22)',line:'#16a34a'};
    if(key.includes('wash'))return {bg:'rgba(14,165,233,0.08)',border:'rgba(14,165,233,0.22)',line:'#0ea5e9'};
    if(key.includes('educacion'))return {bg:'rgba(245,158,11,0.10)',border:'rgba(245,158,11,0.24)',line:'#f59e0b'};
    return {bg:'rgba(100,116,139,0.08)',border:'rgba(100,116,139,0.20)',line:'#64748b'};
  }

  function renderPanel(ctx, state){
    const years = state.years.length ? state.years : [new Date().getFullYear()];
    return `<div class="historial-shell">
        <div class="historial-toolbar">
          <div class="historial-field"><label>Buscar</label><input id="hist-search" value="${esc(state.filters.q)}" placeholder="summary, title o tags" oninput="WashMeetingHistory.onFilterInput()"></div>
          <div class="historial-field"><label>Mes</label><select id="hist-month" onchange="WashMeetingHistory.applyFilters()">${options([{value:'',label:'Todos los meses'},...MONTHS.slice(1).map((m,i)=>({value:i+1,label:m}))],state.filters.month)}</select></div>
          <div class="historial-field"><label>Año</label><select id="hist-year" onchange="WashMeetingHistory.applyFilters()">${options([{value:'',label:'Todos los años'},...years.map(y=>({value:y,label:y}))],state.filters.year)}</select></div>
          <div class="historial-field"><label>Clasificación</label><select id="hist-classification" onchange="WashMeetingHistory.applyFilters()">${options(['','Emergencia','Salud','WASH','Educación','Otros'].map(v=>({value:v,label:v||'Todas'})),state.filters.classification)}</select></div>
          <button class="historial-btn" onclick="WashMeetingHistory.reload()">Actualizar</button>
        </div>
        <div class="historial-status" id="hist-status">${esc(state.status)}</div>
        <div class="historial-layout">
          <div id="hist-list" class="historial-list">${renderList(state.records,state.selectedId)}</div>
          <div id="hist-detail" class="historial-detail">${renderDetail(state.selected)}</div>
        </div>
    </div>`;
  }

  function renderList(records, selectedId){
    if(!records.length)return '<div class="historial-empty">Sin reuniones para los filtros seleccionados.<br>Procesa una reunión o ajusta búsqueda, mes, año o clasificación.</div>';
    return records.map(record=>{const selected=record.id===selectedId;const theme=classificationTheme(record.classification);const activeStyle=selected?`background:${theme.bg};border:1px solid ${theme.border};border-left:4px solid ${theme.line};`:'';return `<article class="historial-card ${selected?'active':''}" style="${activeStyle}" onclick="WashMeetingHistory.openDetail('${esc(record.id)}')">
      <div class="historial-class-line ${lineClass(record.classification)}" style="${selected?`background:${theme.line};width:4px`:''}"></div>
      <div class="historial-card-head"><div class="historial-title">${esc(record.title||'Reunión sin título')}</div><div class="historial-date">${esc(dateLabel(record))}</div></div>
      <div class="historial-summary">${esc(short(record.summary||'Sin resumen disponible.'))}</div>
      <div class="historial-meta">
        <span class="historial-pill classification">${esc(record.classification||'Otros')}</span>
        <span class="historial-pill">✅ ${record.task_count||0} tareas</span>
        <span class="historial-pill">⚠ ${record.risk_count||0} riesgos</span>
        <span class="historial-pill model">${esc([record.provider,record.model].filter(Boolean).join(' · ')||'IA no especificada')}</span>
      </div>
    </article>`;}).join('');
  }

  function renderDetail(record){
    if(!record)return '<div class="historial-detail-empty">Selecciona una reunión para ver el detalle completo.</div>';
    const theme=classificationTheme(record.classification);
    return `<div class="historial-detail-body" style="background:${theme.bg};border:1px solid ${theme.border};border-left:4px solid ${theme.line};border-radius:14px;min-height:100%">
      <h3>${esc(record.title||'Reunión sin título')}</h3>
      <div class="historial-detail-sub">${esc(dateLabel(record))} · ${esc(record.classification||'Otros')} · ${esc([record.provider,record.model].filter(Boolean).join(' / ')||'modelo IA no especificado')}</div>
      <div class="historial-section"><h4>Resumen</h4><p>${esc(record.summary||'Sin resumen disponible.')}</p></div>
      <div class="historial-section"><h4>Acuerdos</h4>${list(record.agreements,'Sin acuerdos registrados.')}</div>
      <div class="historial-section"><h4>Tareas</h4>${taskList(record.tasks)}</div>
      <div class="historial-section"><h4>Riesgos</h4>${riskList(record.risks)}</div>
      <div class="historial-section"><h4>Notas</h4>${list(record.notes,'Sin notas registradas.')}</div>
      <div class="historial-section"><h4>Próximos pasos</h4>${list(record.next_steps,'Sin próximos pasos registrados.')}</div>
      <div class="historial-section"><h4>Referencia fuente</h4><p>${esc(record.source_reference||'Sin referencia fuente.')}</p></div>
      <div class="historial-section"><h4>Modelo IA utilizado</h4><p>${esc([record.provider,record.model].filter(Boolean).join(' / ')||'No especificado')}</p></div>
      <div class="historial-detail-actions"><button class="historial-btn" onclick="WashMeetingHistory.sendTasksToManager('${esc(record.id)}')">Enviar tareas al gestor</button><button class="historial-btn secondary" onclick="WashMeetingHistory.copyDetail('${esc(record.id)}')">Copiar detalle</button><button class="historial-btn secondary" style="color:#b91c1c;border-color:#fecaca;background:#fff" onclick="WashMeetingHistory.deleteRecord('${esc(record.id)}')">Eliminar reunión</button></div>
    </div>`;
  }

  function updateList(records, selectedId){const el=document.getElementById('hist-list');if(el)el.innerHTML=renderList(records,selectedId);}
  function updateDetail(record){const el=document.getElementById('hist-detail');if(el)el.innerHTML=renderDetail(record);}
  function setStatus(text, error){const el=document.getElementById('hist-status');if(el){el.textContent=text||'';el.className=`historial-status${error?' historial-error':''}`;}}
  return { renderPanel, updateList, updateDetail, setStatus, esc };
})();
