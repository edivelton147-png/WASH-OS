window.WashHistoryUI = (function(){
  function esc(value){return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function short(text, max=160){const clean=String(text||'').replace(/\s+/g,' ').trim();return clean.length>max?clean.slice(0,max-1)+'…':clean;}
  function dateLabel(value){const date=new Date(value);return Number.isNaN(date.getTime())?'Fecha no disponible':date.toLocaleString('es-PE',{dateStyle:'medium',timeStyle:'short'});}
  function option(value,label,selected){return `<option value="${esc(value)}" ${String(value)===String(selected||'')?'selected':''}>${esc(label)}</option>`;}
  function toolOptions(tools, selected){return [option('','Todas las herramientas',selected),...tools.map(tool=>option(tool,tool,selected))].join('');}
  function tagPills(tags){return (tags||[]).length ? tags.map(tag=>`<span class="historial-pill tag">#${esc(tag)}</span>`).join('') : '<span class="historial-pill muted">Sin tags</span>';}
  function favoriteButton(record){return `<button class="historial-icon-btn" onclick="event.stopPropagation();WashHistory.toggleFavorite('${esc(record.id)}')" title="Favorito">${record.favorite?'★':'☆'}</button>`;}
  function render(ctx, state, tools){
    const topBar=ctx&&typeof ctx.topBar==='function'?ctx.topBar('Historial operacional','📚'):`<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid #e2e8f0">
    <button onclick="go('home')" style="border:1px solid #e2e8f0;background:#fff;color:#64748b;padding:6px 12px;font-size:12px">← Inicio</button>
    <div style="font-size:16px;font-weight:600">📚 Historial operacional</div>
  </div>`;
    return `<div style="padding:16px">${topBar}
      <div class="historial-shell">
        <div class="historial-nav">
        <div class="historial-toolbar">
          <div class="historial-field"><label>Buscar</label><input id="hist-search" value="${esc(state.filters.q)}" placeholder="Título, resumen, herramienta o tag" oninput="WashHistory.onFilterInput()"></div>
          <div class="historial-field"><label>Herramienta</label><select id="hist-tool" onchange="WashHistory.onFilterInput()">${toolOptions(tools,state.filters.tool)}</select></div>
          <div class="historial-field"><label>Tag</label><input id="hist-tag" value="${esc(state.filters.tag)}" placeholder="Tag" oninput="WashHistory.onFilterInput()"></div>
          <div class="historial-field historial-favorite-field"><label class="historial-favorite-filter"><input id="hist-favorite" type="checkbox" onchange="WashHistory.onFilterInput()" ${state.filters.favorite?'checked':''}><span>Solo favoritos</span></label></div>
          <div class="historial-actions"><button class="historial-btn" onclick="WashHistory.reload()">Actualizar</button><button class="historial-btn secondary" onclick="WashHistory.exportJson()">Exportar JSON</button><button class="historial-btn danger" onclick="WashHistory.clearLocal()">Limpiar</button></div>
        </div>
        <div class="historial-status" id="hist-status">${esc(state.status)}</div>
        <div class="historial-layout">
          <div id="hist-list" class="historial-list"></div>
          <div id="hist-detail" class="historial-detail"></div>
        </div>
      </div>
    </div>`;
  }
  function renderList(records, selectedId){
    if(!records.length)return '<div class="historial-empty">Sin actividades para los filtros seleccionados.<br>El historial general usa localStorage local y no consulta servicios externos.</div>';
    return records.map(record=>`<article class="historial-card ${record.id===selectedId?'active':''}" onclick="WashHistory.openDetail('${esc(record.id)}')">
      <div class="historial-card-head"><div><div class="historial-title">${esc(record.title)}</div><div class="historial-date">${esc(dateLabel(record.created_at))}</div></div>${favoriteButton(record)}</div>
      <div class="historial-summary">${esc(short(record.summary||'Sin resumen disponible.'))}</div>
      <div class="historial-meta"><span class="historial-pill tool">${esc(record.tool)}</span>${tagPills(record.tags)}</div>
    </article>`).join('');
  }
  function renderDetail(record){
    if(!record)return '<div class="historial-detail-empty">Selecciona una actividad para ver el detalle.</div>';
    return `<div class="historial-detail-body">
      <div class="historial-detail-title-row"><h3>${esc(record.title)}</h3>${favoriteButton(record)}</div>
      <div class="historial-detail-sub">${esc(dateLabel(record.created_at))} · ${esc(record.tool)} · ${record.favorite?'Favorito':'No favorito'}</div>
      <div class="historial-section"><h4>Resumen</h4><p>${esc(record.summary||'Sin resumen disponible.')}</p></div>
      <div class="historial-section"><h4>Tags</h4><div class="historial-meta">${tagPills(record.tags)}</div></div>
      <div class="historial-detail-actions"><button class="historial-btn secondary" onclick="WashHistory.toggleFavorite('${esc(record.id)}')">${record.favorite?'★ Quitar favorito':'☆ Marcar favorito'}</button><button class="historial-btn danger" onclick="WashHistory.deleteRecord('${esc(record.id)}')">Eliminar registro</button></div>
    </div>`;
  }
  function updateList(records, selectedId){const el=document.getElementById('hist-list');if(el)el.innerHTML=renderList(records,selectedId);}
  function updateDetail(record){const el=document.getElementById('hist-detail');if(el)el.innerHTML=renderDetail(record);}
  function setStatus(text, error){const el=document.getElementById('hist-status');if(el){el.textContent=text||'';el.className=`historial-status${error?' historial-error':''}`;}}
  return { render, updateList, updateDetail, setStatus, esc };
})();
