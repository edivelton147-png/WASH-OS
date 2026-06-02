window.WashModules = window.WashModules || {};
window.WashModules.gestor = window.WashModules.gestor || {};

window.WashModules.gestor.render = function(ctx){
  const tasks=ctx.tasks;
  const isVencida=ctx.isVencida;
  const fmtTime=ctx.fmtTime;
  const topBar=ctx.topBar;
  const venc=tasks.filter(t=>isVencida(t)).length,prog=tasks.filter(t=>t.estado==='En Progreso').length,comp=tasks.filter(t=>t.estado==='Completada').length,alta=tasks.filter(t=>t.prioridad==='Alta'&&t.estado!=='Completada').length,sec=tasks.reduce((a,t)=>a+t.elapsed,0);return`<div style="padding:16px">${topBar('Gestor de Tareas','✅')}<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:14px">${[{v:tasks.length,l:'Total',c:'#1e293b'},{v:alta,l:'Alta pend.',c:'#dc2626'},{v:prog,l:'En progreso',c:'#1A75BB'},{v:comp,l:'Completadas',c:'#16a34a'},{v:venc>0?'⚠'+venc:venc,l:'Vencidas',c:venc>0?'#dc2626':'#94a3b8'},{v:fmtTime(sec),l:'Tiempo',c:'#1A75BB'}].map(m=>`<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:600;color:${m.c}">${m.v}</div><div style="font-size:10px;color:#64748b;margin-top:2px">${m.l}</div></div>`).join('')}</div><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px"><div style="display:flex;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#fff"><button onclick="gSwitch('lista')" id="gtab-lista" style="padding:7px 14px;font-size:13px;border:none;background:#1A75BB;color:#fff">Mis tareas</button><button onclick="gSwitch('calendario')" id="gtab-calendario" style="padding:7px 14px;font-size:13px;border:none;background:transparent;color:#64748b">Calendario</button><button onclick="gSwitch('nueva')" id="gtab-nueva" style="padding:7px 14px;font-size:13px;border:none;background:transparent;color:#64748b">+ Nueva</button></div><div style="display:flex;gap:8px;align-items:center"><select id="rep-mes" style="width:auto;font-size:12px;padding:5px 8px"></select><button onclick="generarPDF()" style="background:#EEEDFE;color:#3C3489;border:1px solid #AFA9EC;padding:6px 12px;font-size:12px;border-radius:8px">📄 Reporte PDF</button></div></div><div id="g-lista"><div style="display:flex;gap:8px;margin-bottom:10px"><input id="searchInput" placeholder="Buscar tarea..." oninput="renderTaskList()" style="flex:1;font-size:13px"><button onclick="document.getElementById('searchInput').value='';renderTaskList()" style="border:1px solid #e2e8f0;background:#fff;color:#64748b;padding:6px 10px;font-size:12px">✕</button></div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px"><select id="f-cat" onchange="renderTaskList()" style="width:auto;font-size:12px;padding:5px 8px"><option value="">Todas las categorías</option><option>Coordinación</option><option>Documentos</option><option>Resumen</option><option>Revisión de Informes</option><option>Reuniones</option></select><select id="f-pri" onchange="renderTaskList()" style="width:auto;font-size:12px;padding:5px 8px"><option value="">Todas las prioridades</option><option>Alta</option><option>Media</option><option>Baja</option></select><select id="f-est" onchange="renderTaskList()" style="width:auto;font-size:12px;padding:5px 8px"><option value="">Todos los estados</option><option>Pendiente</option><option>En Progreso</option><option>Completada</option><option>Bloqueada</option></select><select id="f-venc" onchange="renderTaskList()" style="width:auto;font-size:12px;padding:5px 8px"><option value="">Todas</option><option value="vencidas">Solo vencidas</option></select></div><div id="task-list" style="display:flex;flex-direction:column;gap:10px"></div></div><div id="g-calendario" style="display:none"><div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px"><div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap"><button onclick="calOffset--;renderCal()" style="border:1px solid #e2e8f0;background:#fff;padding:5px 10px;font-size:12px">← Anterior</button><span id="cal-range" style="font-size:14px;font-weight:500"></span><button onclick="calOffset++;renderCal()" style="border:1px solid #e2e8f0;background:#fff;padding:5px 10px;font-size:12px">Siguiente →</button><button onclick="calOffset=0;renderCal()" style="margin-left:auto;border:1px solid #e2e8f0;background:#fff;padding:5px 10px;font-size:12px">Hoy</button></div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px" id="cal-grid"></div></div></div><div id="g-nueva" style="display:none"><div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px"><div style="font-size:15px;font-weight:600;margin-bottom:12px" id="form-title">Nueva tarea</div><div id="parent-banner" style="display:none;font-size:12px;color:#633806;background:#FAEEDA;border-radius:8px;padding:6px 10px;margin-bottom:12px"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div style="grid-column:1/-1"><label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px">Título *</label><input id="fn-titulo" placeholder="Ej: Revisar informe mensual"/></div><div><label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px">Categoría *</label><select id="fn-cat" onchange="onCatChange()"><option value="">Seleccionar...</option><option>Coordinación</option><option>Documentos</option><option>Resumen</option><option>Revisión de Informes</option><option>Reuniones</option></select></div><div><label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px">Prioridad *</label><select id="fn-pri"><option value="">Seleccionar...</option><option>Alta</option><option>Media</option><option>Baja</option></select></div><div style="grid-column:1/-1"><label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px">Enlace</label><div style="display:flex;gap:8px"><input id="fn-link" type="url" placeholder="https://..."/><button onclick="testLink()" style="border:1px solid #AFA9EC;background:#EEEDFE;color:#3C3489;padding:6px 10px;font-size:12px;white-space:nowrap">Probar</button></div></div><div style="grid-column:1/-1"><label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px">Descripción</label><textarea id="fn-desc" rows="2" placeholder="Detalles..."></textarea></div><div style="grid-column:1/-1"><label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px">Correo de referencia</label><input id="fn-email" type="email" placeholder="nombre@unicef.org"/></div><div style="grid-column:1/-1"><label style="font-size:12px;color:#64748b;display:block;margin-bottom:6px">Duración</label><div style="display:flex;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;width:fit-content;margin-bottom:10px"><button id="btn-dia" onclick="setDurMode('dia')" style="border:none;border-radius:0;background:#1A75BB;color:#fff;padding:6px 14px;font-size:12px">Mismo día</button><button id="btn-varios" onclick="setDurMode('varios')" style="border:none;border-radius:0;background:transparent;padding:6px 14px;font-size:12px;color:#64748b">Varios días</button></div><div id="dur-dia"><label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px">Fecha · Inicio → Cierre</label><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><input type="date" id="fn-fecha-i" style="width:150px" onchange="syncFechaC();calcTiempo()"/><select id="fn-hora-i" style="width:90px" onchange="calcTiempo()"></select><select id="fn-min-i" style="width:70px" onchange="calcTiempo()"></select><span style="color:#94a3b8">→</span><select id="fn-hora-c" style="width:90px" onchange="calcTiempo()"></select><select id="fn-min-c" style="width:70px" onchange="calcTiempo()"></select></div></div><div id="dur-varios" style="display:none;display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px">Inicio</label><div style="display:flex;gap:4px"><input type="date" id="fn-fecha-i-v" onchange="syncToMain();calcTiempo()"/><select id="fn-hora-i-v" style="width:80px" onchange="syncToMain();calcTiempo()"></select><select id="fn-min-i-v" style="width:65px" onchange="syncToMain();calcTiempo()"></select></div></div><div><label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px">Cierre</label><div style="display:flex;gap:4px"><input type="date" id="fn-fecha-c-v" onchange="syncToMain();calcTiempo()"/><select id="fn-hora-c-v" style="width:80px" onchange="syncToMain();calcTiempo()"></select><select id="fn-min-c-v" style="width:65px" onchange="syncToMain();calcTiempo()"></select></div></div></div></div><div id="field-nota" style="display:none;grid-column:1/-1"><label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px">Notas de reunión</label><textarea id="fn-nota" rows="2" placeholder="Agenda..."></textarea></div><div style="grid-column:1/-1"><label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px">Tiempo estimado (min) <span id="fn-tiempo-lbl" style="color:#1A75BB;font-size:11px;margin-left:6px"></span></label><input type="number" id="fn-tiempo" placeholder="Ej: 60" min="0"/></div><input type="hidden" id="fn-fecha-c"/></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button onclick="cancelForm()" style="border:1px solid #e2e8f0;background:#fff;color:#64748b;padding:8px 14px;font-size:13px">Cancelar</button><button onclick="addTask()" style="background:#1A75BB;color:#fff;border:none;padding:8px 16px;font-size:13px">Guardar tarea</button></div></div></div></div>`;
};

(function(){
  const state={ctx:null,suggestions:[],installed:false};
  const originalRender=window.WashModules.gestor.render;

  function esc(value){return String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function taskText(item){return item?.action||item?.tarea||item?.title||item?.titulo||item?.text||item?.descripcion||String(item||'Tarea sugerida');}
  function taskPriority(item){const p=item?.priority||item?.prioridad||'Media';return ['Alta','Media','Baja'].includes(p)?p:'Media';}
  const CATEGORIES=['Coordinación','Documentos','Resumen','Revisión de Informes','Reuniones'];
  function taskCategory(item){const c=item?.category||item?.categoria||'Reuniones';return CATEGORIES.includes(c)?c:'Reuniones';}
  function taskLink(item,record){return item?.link||item?.enlace||item?.source||item?.source_reference||item?.document||item?.documento||record?.source_reference||'';}
  function dateParts(y,m,d){y=Number(y);m=Number(m);d=Number(d);const dt=new Date(y,m-1,d);return dt.getFullYear()===y&&dt.getMonth()===m-1&&dt.getDate()===d?`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:'';}
  function sourceYear(record){const raw=String(record?.date||record?.fecha||record?.created_at||record?.createdAt||'').trim();const iso=raw.match(/^(\d{4})-\d{1,2}-\d{1,2}/);if(iso)return Number(iso[1]);const dmy=raw.match(/^\d{1,2}[\/-]\d{1,2}[\/-](\d{4})/);if(dmy)return Number(dmy[1]);const dt=new Date(raw);return Number.isFinite(dt.getTime())?dt.getFullYear():new Date().getFullYear();}
  function taskDate(item,record){const raw=String(item?.date||item?.fecha||'').trim();if(!raw)return '';const iso=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(iso)return dateParts(iso[1],iso[2],iso[3]);const dmy=raw.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{4}))?$/);if(dmy)return dateParts(dmy[3]||sourceYear(record),dmy[2],dmy[1]);const months={enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12};const natural=raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/^(\d{1,2})(?:\s+de)?\s+([a-z]+)(?:\s+de)?(?:\s+(\d{4}))?$/);if(natural&&months[natural[2]])return dateParts(natural[3]||sourceYear(record),months[natural[2]],natural[1]);return '';}
  function taskDesc(item){return item?.description||item?.descripcion||item?.desc||item?.details||item?.detalle||item?.notes||item?.nota||'';}
  function roundCurrentDate(base=new Date()){const d=new Date(base);const minutes=d.getMinutes();if(minutes===0)return d;if(minutes<=30)d.setMinutes(30,0,0);else{d.setHours(d.getHours()+1,0,0,0);}return d;}
  function isoLocal(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:00`;}
  function timeValue(d){return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}
  function suggestionTimes(){const start=roundCurrentDate();const end=new Date(start.getTime()+60*60000);return {start:timeValue(start),end:timeValue(end)};}
  function combineDateWithSmartHour(dateText,timeText){const rounded=roundCurrentDate();if(dateText){const [y,m,d]=dateText.split('-').map(Number);rounded.setFullYear(y,m-1,d);}if(timeText){const [h,m]=timeText.split(':').map(Number);rounded.setHours(h,m,0,0);}return rounded;}
  function combineDateWithBaseHour(dateText,base,timeText){const end=new Date(base.getTime()+60*60000);if(dateText){const [y,m,d]=dateText.split('-').map(Number);end.setFullYear(y,m-1,d);}if(timeText){const [h,m]=timeText.split(':').map(Number);end.setHours(h,m,0,0);}return end;}
  function saveAndRefresh(){if(typeof window.saveTasks==='function')window.saveTasks();if(typeof window.renderTaskList==='function')window.renderTaskList();if(typeof window.renderCal==='function')window.renderCal();}

  function renderSuggestions(){
    if(!state.suggestions.length)return '<div id="gestor-suggested-tray"></div>';
    return `<div id="gestor-suggested-tray" style="background:#fff;border:1px solid #bfdbfe;border-left:4px solid #1A75BB;border-radius:12px;padding:14px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><div><div style="font-size:14px;font-weight:700;color:#0C447C">Tareas sugeridas</div><div style="font-size:12px;color:#64748b;margin-top:2px">Selecciona, edita y confirma antes de crear tareas oficiales.</div></div><div style="display:flex;gap:8px"><button onclick="WashGestorSuggestions.addSelected()" style="background:#1A75BB;color:#fff;border:none;padding:7px 12px;font-size:12px;border-radius:8px">Agregar seleccionadas</button><button onclick="WashGestorSuggestions.clear()" style="background:#fff;color:#64748b;border:1px solid #e2e8f0;padding:7px 12px;font-size:12px;border-radius:8px">Descartar todas</button></div></div>
      <div style="display:flex;flex-direction:column;gap:8px">${state.suggestions.map((s,i)=>`<div data-suggestion="${s.id}" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px"><div style="display:grid;grid-template-columns:24px 1.3fr .8fr .5fr .55fr .55fr .55fr .55fr 1fr auto;gap:8px;align-items:end"><input type="checkbox" id="sg-check-${s.id}" ${s.checked?'checked':''} style="width:16px;height:16px;margin-bottom:7px"><input id="sg-title-${s.id}" value="${esc(s.title)}" style="font-size:12px" placeholder="Título"><select id="sg-cat-${s.id}" style="font-size:12px">${CATEGORIES.map(c=>`<option ${s.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select><select id="sg-pri-${s.id}" style="font-size:12px"><option ${s.priority==='Alta'?'selected':''}>Alta</option><option ${s.priority==='Media'?'selected':''}>Media</option><option ${s.priority==='Baja'?'selected':''}>Baja</option></select><label style="font-size:10px;color:#64748b;display:flex;flex-direction:column;gap:2px">Inicio<input id="sg-date-${s.id}" type="date" value="${esc(s.date)}" style="font-size:12px"></label><label style="font-size:10px;color:#64748b;display:flex;flex-direction:column;gap:2px">Inicio hora<input id="sg-time-${s.id}" type="time" value="${esc(s.startTime)}" style="font-size:12px"></label><label style="font-size:10px;color:#64748b;display:flex;flex-direction:column;gap:2px">Cierre<input id="sg-end-${s.id}" type="date" value="${esc(s.endDate)}" style="font-size:12px"></label><label style="font-size:10px;color:#64748b;display:flex;flex-direction:column;gap:2px">Cierre hora<input id="sg-end-time-${s.id}" type="time" value="${esc(s.endTime)}" style="font-size:12px"></label><input id="sg-link-${s.id}" value="${esc(s.link)}" placeholder="Enlace OneDrive/SharePoint o documento" style="font-size:12px"><button onclick="WashGestorSuggestions.discard('${s.id}')" style="background:#fff;color:#dc2626;border:1px solid #fecaca;padding:6px 10px;font-size:12px;border-radius:8px">Descartar</button></div><textarea id="sg-desc-${s.id}" rows="2" style="margin-top:8px;font-size:12px;resize:vertical" placeholder="Descripción">${esc(s.desc)}</textarea></div>`).join('')}</div>
    </div>`;
  }

  window.WashModules.gestor.render=function(ctx){
    state.ctx=ctx;
    let html=originalRender(ctx);
    html=html.replace('<div id="g-lista">', `${renderSuggestions()}<div id="g-lista">`);
    html=html.replace('<option>Completada</option></select><select id="f-venc"', '<option>Completada</option><option>Bloqueada</option></select><select id="f-venc"');
    return html;
  };

  window.WashGestorSuggestions={
    receive(detail){
      const tasks=Array.isArray(detail?.tasks)?detail.tasks:[];
      state.suggestions=tasks.map((item,i)=>{const times=suggestionTimes();return {id:`sg-${Date.now()}-${i}`,checked:true,title:taskText(item),desc:taskDesc(item),category:taskCategory(item),priority:taskPriority(item),date:taskDate(item,detail?.record),startTime:times.start,endDate:'',endTime:times.end,link:taskLink(item,detail?.record)};});
      if(typeof window.go==='function')window.go('gestor');
      setTimeout(()=>{if(typeof window.renderApp==='function')window.renderApp();else if(typeof window.gSwitch==='function')window.gSwitch('lista');},80);
    },
    discard(id){state.suggestions=state.suggestions.filter(s=>s.id!==id);if(typeof window.renderApp==='function')window.renderApp();},
    clear(){state.suggestions=[];if(typeof window.renderApp==='function')window.renderApp();},
    addSelected(){
      const target=state.ctx?.tasks;
      if(!target)return;
      const kept=[];
      state.suggestions.forEach(s=>{
        const checked=document.getElementById(`sg-check-${s.id}`)?.checked;
        if(!checked){kept.push(s);return;}
        const title=document.getElementById(`sg-title-${s.id}`)?.value.trim();
        if(!title){kept.push(s);return;}
        const date=document.getElementById(`sg-date-${s.id}`)?.value||'';
        const startTime=document.getElementById(`sg-time-${s.id}`)?.value||'';
        const endDate=document.getElementById(`sg-end-${s.id}`)?.value||'';
        const endTime=document.getElementById(`sg-end-time-${s.id}`)?.value||'';
        const start=combineDateWithSmartHour(date,startTime);
        const end=(endDate||endTime)?combineDateWithBaseHour(endDate||date,start,endTime):new Date(start.getTime()+60*60000);
        target.unshift({id:Date.now()+Math.floor(Math.random()*1000),titulo:title,desc:document.getElementById(`sg-desc-${s.id}`)?.value.trim()||'',categoria:document.getElementById(`sg-cat-${s.id}`)?.value||'Reuniones',prioridad:document.getElementById(`sg-pri-${s.id}`)?.value||'Media',inicio:isoLocal(start),cierre:isoLocal(end),estimado:60,email:'',link:document.getElementById(`sg-link-${s.id}`)?.value.trim()||'',nota:'',notaCierre:'',reprogNotas:[],parentId:null,parentTitle:'',estado:'Pendiente',elapsed:0,running:false});
      });
      state.suggestions=kept;
      saveAndRefresh();
      if(typeof window.renderApp==='function')window.renderApp();
    }
  };

  window.addEventListener('wash-history-send-tasks',event=>window.WashGestorSuggestions.receive(event.detail));

  function reschedule(id,mode){
    const task=state.ctx?.tasks?.find(t=>String(t.id)===String(id));if(!task)return;
    const now=new Date();let next=roundCurrentDate(now);
    if(mode==='30m')next=new Date(now.getTime()+30*60000);
    if(mode==='1h')next=new Date(now.getTime()+60*60000);
    if(mode==='tomorrow'){next=roundCurrentDate(now);next.setDate(next.getDate()+1);}
    if(mode==='eod'){next=new Date();next.setHours(17,0,0,0);if(next<now)next.setDate(next.getDate()+1);}
    if(mode==='week'){next=roundCurrentDate(now);next.setDate(next.getDate()+7);}
    const reason=prompt('Motivo de reprogramación','Esperando validación')||'Reprogramación rápida';
    task.inicio=isoLocal(next);task.estado='Pendiente';task.running=false;task.reprogNotas=task.reprogNotas||[];task.reprogNotas.push(`⚠ Reprogramada:\n${reason}`);
    saveAndRefresh();
  }
  function setBlocked(id){const task=state.ctx?.tasks?.find(t=>String(t.id)===String(id));if(!task)return;task.estado='Bloqueada';task.reprogNotas=task.reprogNotas||[];task.reprogNotas.push('⚠ Bloqueada:\nEsperando coordinación');saveAndRefresh();}
  function openTeams(link){if(!link)return;const teams=link.includes('teams.microsoft.com')?link.replace(/^https?:\/\//,'msteams://'):link;window.open(teams,'_blank');}
  function copyTeams(task){const text=`${task.titulo}\nEstado: ${task.estado}\nPrioridad: ${task.prioridad}\n${task.link?`Enlace: ${task.link}`:''}`;navigator.clipboard?.writeText(text);}
  function labelForLink(link){const text=String(link||'').toLowerCase();if(text.includes('teams'))return '🔗 Teams';if(text.includes('acta'))return '📄 Acta';return '📎 Documento';}

  function enhanceCards(){
    const tasks=state.ctx?.tasks||[];
    tasks.forEach(task=>{
      const card=document.getElementById(`card-${task.id}`);if(!card||card.dataset.gestorEnhanced)return;card.dataset.gestorEnhanced='1';
      const links=task.link?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0"><button data-open-link="${task.id}" style="border:1px solid #dbeafe;background:#eff6ff;color:#1d4ed8;padding:4px 9px;font-size:11px;border-radius:999px">${labelForLink(task.link)}</button>${String(task.link).toLowerCase().includes('teams')?`<button data-open-teams="${task.id}" style="border:1px solid #ccfbf1;background:#f0fdfa;color:#0f766e;padding:4px 9px;font-size:11px;border-radius:999px">Abrir Teams</button><button data-copy-teams="${task.id}" style="border:1px solid #e2e8f0;background:#fff;color:#64748b;padding:4px 9px;font-size:11px;border-radius:999px">Copiar formato Teams</button>`:''}</div>`:'';
      const quick=`<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px dashed #e2e8f0"><span style="font-size:11px;color:#64748b;padding:4px 0">Reprogramar:</span>${[['30m','+30m'],['1h','+1h'],['tomorrow','Mañana'],['eod','Fin del día'],['week','Próxima semana']].map(([m,l])=>`<button data-quick-reprog="${m}" data-id="${task.id}" style="border:1px solid #e2e8f0;background:#fff;color:#475569;padding:4px 8px;font-size:11px;border-radius:8px">${l}</button>`).join('')}<button data-blocked="${task.id}" style="border:1px solid #fde68a;background:#fffbeb;color:#92400e;padding:4px 8px;font-size:11px;border-radius:8px">Bloqueada</button></div>`;
      card.insertAdjacentHTML('beforeend',links+quick);
    });
    document.querySelectorAll('[data-quick-reprog]').forEach(btn=>btn.onclick=()=>reschedule(btn.dataset.id,btn.dataset.quickReprog));
    document.querySelectorAll('[data-blocked]').forEach(btn=>btn.onclick=()=>setBlocked(btn.dataset.blocked));
    document.querySelectorAll('[data-open-link]').forEach(btn=>btn.onclick=()=>{const task=tasks.find(t=>String(t.id)===String(btn.dataset.openLink));if(task?.link)window.open(task.link,'_blank');});
    document.querySelectorAll('[data-open-teams]').forEach(btn=>btn.onclick=()=>{const task=tasks.find(t=>String(t.id)===String(btn.dataset.openTeams));openTeams(task?.link);});
    document.querySelectorAll('[data-copy-teams]').forEach(btn=>btn.onclick=()=>{const task=tasks.find(t=>String(t.id)===String(btn.dataset.copyTeams));if(task)copyTeams(task);});
  }

  function install(){
    if(state.installed||typeof window.renderTaskList!=='function')return;
    state.installed=true;
    const originalList=window.renderTaskList;
    window.renderTaskList=function(){originalList();enhanceCards();};
    enhanceCards();
    const originalHours=window.buildHourSelects;
    if(typeof originalHours==='function')window.buildHourSelects=function(){originalHours();const rounded=roundCurrentDate();[['fn-hora-i',rounded.getHours()],['fn-min-i',String(rounded.getMinutes()).padStart(2,'0')],['fn-hora-i-v',rounded.getHours()],['fn-min-i-v',String(rounded.getMinutes()).padStart(2,'0')]].forEach(([id,val])=>{const el=document.getElementById(id);if(el)el.value=String(val);});};
  }
  const timer=setInterval(()=>{install();if(state.installed)clearInterval(timer);},100);
})();
