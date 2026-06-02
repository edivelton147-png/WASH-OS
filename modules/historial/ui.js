window.WashHistoryUI = (function(){
  const MONTHS = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  function esc(value){return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function options(items, selected){return items.map(item => `<option value="${esc(item.value)}" ${String(item.value)===String(selected||'')?'selected':''}>${esc(item.label)}</option>`).join('');}
  function short(text, max=170){const clean=String(text||'').replace(/\s+/g,' ').trim();return clean.length>max?`${clean.slice(0,max-1)}…`:clean;}
  function itemText(item){if(item===null||item===undefined)return '';if(typeof item==='string')return item;if(typeof item==='number')return String(item);return item.action||item.tarea||item.text||item.descripcion||item.summary||item.title||JSON.stringify(item);}
  function list(items, empty){const data=Array.isArray(items)?items.filter(Boolean):[];if(!data.length)return `<p class="historial-muted">${esc(empty)}</p>`;return `<ul>${data.map(item=>`<li>${esc(itemText(item))}</li>`).join('')}</ul>`;}
  function compactList(items, empty, max=3){const data=Array.isArray(items)?items.filter(Boolean):[];if(!data.length)return `<p class="historial-muted">${esc(empty)}</p>`;const more=data.length>max?`<p class="historial-muted">+${data.length-max} más en el TXT.</p>`:'';return `<ul>${data.slice(0,max).map(item=>`<li>${esc(short(itemText(item),120))}</li>`).join('')}</ul>${more}`;}
  function taskList(items){const data=Array.isArray(items)?items.filter(Boolean):[];if(!data.length)return '<p class="historial-muted">Sin tareas registradas.</p>';const max=5;const more=data.length>max?`<p class="historial-muted">+${data.length-max} tareas más en el TXT.</p>`:'';return data.slice(0,max).map(item=>{const text=itemText(item);const meta=typeof item==='object'&&item?[
      item.responsible||item.responsable?`👤 ${item.responsible||item.responsable}`:'',
      item.date||item.fecha?`📅 ${item.date||item.fecha}`:'',
      item.priority||item.prioridad?`⚑ ${item.priority||item.prioridad}`:''
    ].filter(Boolean).join(' · '):'';return `<div class="historial-task"><strong>${esc(short(text||'Tarea',120))}</strong>${meta?`<small>${esc(meta)}</small>`:''}</div>`;}).join('')+more;}
  function riskSummary(items){const data=Array.isArray(items)?items.filter(Boolean):[];if(!data.length)return '<p class="historial-muted">Sin riesgos registrados.</p>';return `<p>${data.length} riesgo${data.length===1?'':'s'} registrado${data.length===1?'':'s'}${data[0]?`: ${esc(short(itemText(data[0]),120))}`:''}</p>`;}
  function dateLabel(record){const raw=record.date||record.created_at; if(!raw)return 'Sin fecha'; const d=new Date(raw); return Number.isNaN(d.getTime())?'Sin fecha':d.toLocaleDateString('es-PE',{year:'numeric',month:'short',day:'2-digit'});}
  function lineClass(classification){const key=String(classification||'Otros').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); if(key.includes('emergencia'))return 'historial-line-emergencia'; if(key.includes('wash'))return 'historial-line-wash'; if(key.includes('salud'))return 'historial-line-salud'; if(key.includes('educacion'))return 'historial-line-educacion'; return 'historial-line-otros';}

  function render(ctx, state){
    const years = state.years.length ? state.years : [new Date().getFullYear()];
    return `<div style="padding:16px">${ctx.topBar('Historial operacional','📚')}
      <div class="historial-shell">
        <div class="historial-toolbar">
          <div class="historial-field"><label>Buscar</label><input id="hist-search" value="${esc(state.filters.q)}" placeholder="summary, title o tags" oninput="WashHistory.onFilterInput()"></div>
          <div class="historial-field"><label>Tag</label><input id="hist-tag" value="${esc(state.filters.tag)}" placeholder="Tag" oninput="WashHistory.onFilterInput()"></div>
          <div class="historial-field historial-favorite-field"><label class="historial-favorite-filter"><input id="hist-favorite" type="checkbox" onchange="WashHistory.onFilterInput()" ${state.filters.favorite?'checked':''}><span>Solo favoritos</span></label></div>
          <div class="historial-field"><label>Mes</label><select id="hist-month" onchange="WashHistory.applyFilters()">${options([{value:'',label:'Todos los meses'},...MONTHS.slice(1).map((m,i)=>({value:i+1,label:m}))],state.filters.month)}</select></div>
          <div class="historial-field"><label>Año</label><select id="hist-year" onchange="WashHistory.applyFilters()">${options([{value:'',label:'Todos los años'},...years.map(y=>({value:y,label:y}))],state.filters.year)}</select></div>
          <div class="historial-field"><label>Clasificación</label><select id="hist-classification" onchange="WashHistory.applyFilters()">${options(['','Emergencia','Salud','WASH','Educación','Otros'].map(v=>({value:v,label:v||'Todas'})),state.filters.classification)}</select></div>
          <button class="historial-btn" onclick="WashHistory.reload()">Actualizar</button>
        </div>
        <div class="historial-status" id="hist-status">${esc(state.status)}</div>
        <div class="historial-layout">
          <div id="hist-list" class="historial-list">${renderList(state.records,state.selectedId)}</div>
          <div id="hist-detail" class="historial-detail">${renderDetail(state.selected)}</div>
        </div>
      </div>
    </div>`;
  }

  function renderList(records, selectedId){
    if(!records.length)return '<div class="historial-empty">Sin reuniones para los filtros seleccionados.<br>Procesa una reunión o ajusta búsqueda, mes, año o clasificación.</div>';
    return records.map(record=>`<article class="historial-card ${record.id===selectedId?'active':''}" onclick="WashHistory.openDetail('${esc(record.id)}')">
      <div class="historial-class-line ${lineClass(record.classification)}"></div>
      <div class="historial-card-head"><div class="historial-title">${esc(record.title||'Reunión sin título')}</div><div class="historial-date">${esc(dateLabel(record))}</div></div>
      <div class="historial-summary">${esc(short(record.summary||'Sin resumen disponible.'))}</div>
      <div class="historial-meta">
        <span class="historial-pill classification">${esc(record.classification||'Otros')}</span>
        <span class="historial-pill">✅ ${record.task_count||0} tareas</span>
        <span class="historial-pill">⚠ ${record.risk_count||0} riesgos</span>
        <span class="historial-pill model">${esc([record.provider,record.model].filter(Boolean).join(' · ')||'IA no especificada')}</span>
      </div>
    </article>`).join('');
  }

  function renderDetail(record){
    if(!record)return '<div class="historial-detail-empty">Selecciona una reunión para ver el detalle completo.</div>';
    return `<div class="historial-detail-body">
      <h3>${esc(record.title||'Reunión sin título')}</h3>
      <div class="historial-detail-sub">${esc(dateLabel(record))} · ${esc(record.classification||'Otros')} · ${esc([record.provider,record.model].filter(Boolean).join(' / ')||'modelo IA no especificado')}</div>
      <div class="historial-section"><h4>Resumen</h4><p>${esc(record.summary||'Sin resumen disponible.')}</p></div>
      <div class="historial-section"><h4>Acuerdos clave</h4>${compactList(record.agreements,'Sin acuerdos registrados.')}</div>
      <div class="historial-section"><h4>Tareas</h4>${taskList(record.tasks)}</div>
      <div class="historial-section"><h4>Riesgos</h4>${riskSummary(record.risks)}</div>
      <div class="historial-section"><h4>Notas y próximos pasos</h4><p>${(record.notes||[]).length} notas · ${(record.next_steps||[]).length} próximos pasos. Usa “Exportar TXT” para el detalle completo.</p></div>
      <div class="historial-section"><h4>Referencia fuente</h4><p>${esc(record.source_reference||'Sin referencia fuente.')}</p></div>
      <div class="historial-section"><h4>Modelo IA utilizado</h4><p>${esc([record.provider,record.model].filter(Boolean).join(' / ')||'No especificado')}</p></div>
      <div class="historial-detail-actions"><button class="historial-btn" onclick="WashHistory.sendTasksToManager('${esc(record.id)}')">Enviar tareas al gestor</button><button class="historial-btn secondary" onclick="WashHistory.copyDetail('${esc(record.id)}')">Copiar detalle</button><button class="historial-btn secondary" onclick="WashHistory.exportDetail('${esc(record.id)}')">Exportar TXT</button><button class="historial-btn secondary" onclick="WashHistory.toggleFavorite('${esc(record.id)}')">${record.isFavorite?'★':'☆'} Favorito</button></div>
    </div>`;
  }

  function updateList(records, selectedId){const el=document.getElementById('hist-list');if(el)el.innerHTML=renderList(records,selectedId);}
  function updateDetail(record){const el=document.getElementById('hist-detail');if(el)el.innerHTML=renderDetail(record);}
  function setStatus(text, error){const el=document.getElementById('hist-status');if(el){el.textContent=text||'';el.className=`historial-status${error?' historial-error':''}`;}}
  return { render, updateList, updateDetail, setStatus, esc };
})();
