/******************************************************************************
FILE NAME   : kanban.js
DESCRIPTION : 칸반 보드 렌더링, 카드·컬럼 드래그 앤 드롭, 상태 변경 처리
DATA        : 2026-04-20
Modification: 2026-04-20
******************************************************************************/

let colDragKey = null; // 컬럼 드래그 전용

/******************************************************************************
FUNCTION    : renderKanban
DESCRIPTION : 설정의 statuses 기준으로 칸반 컬럼과 카드를 전체 재렌더링.
              카테고리 필터 적용 및 우선순위 정렬 포함
RETURNED    : void
******************************************************************************/
function renderKanban(){
  const cf=document.getElementById('kanban-cat-filter')?.value || '';
  const COLS=settings.statuses.filter(s=>s.showInKanban!==false);
  const board = document.getElementById('kanban-board');
  const badge = document.getElementById('badge-kanban');
  if (!board) return;

  // archived 상태도 칸반 컬럼에 표시 (showInKanban 설정으로 제어)
  const activeTasks = tasks.filter(t => !t.linkedSourceType);
  if (badge) badge.textContent = activeTasks.filter(t => t.status === 'inprogress').length;

  board.innerHTML=COLS.map(col=>{
    let ct=activeTasks.filter(t=>t.status===col.key);
    if(cf)ct=ct.filter(t=>(t.category||'').split(',').map(s=>s.trim()).includes(cf));
    const priOrder=settings.priorities.map(p=>p.key);
    const s=[...ct].sort((a,b)=>priOrder.indexOf(a.priority)-priOrder.indexOf(b.priority));
    const colColor = col.color || '#888888';
    return `<div class="kanban-col" id="col-${col.key}"
      data-col-key="${col.key}"
      draggable="false"
      ondragover="onColDragOver(event,'${esc(col.key)}')"
      ondrop="onColDrop(event,'${esc(col.key)}')"
      ondragleave="onColDragLeave(event,'${esc(col.key)}')">
      <div class="kanban-col-top-bar" style="background:${colColor}"></div>
      <div class="kanban-col-header"
        draggable="true"
        onmousedown="event.stopPropagation()"
        ondragstart="onColDragStart(event,'${esc(col.key)}')"
        ondragend="onColDragEnd(event)"
        title="드래그로 순서 변경"
        style="cursor:grab">
        <div class="col-dot" style="background:${colColor}"></div>
        <div class="col-title" style="color:${colColor}">${esc(col.label.toUpperCase())}</div>
        <div class="col-count">${s.length}</div>
        <div class="col-drag-hint">⠿</div>
      </div>
      <div style="padding:8px 10px;border-bottom:1px solid var(--border)"><button class="col-add-btn" onclick="openModal(null,'${esc(col.key)}')">＋ 추가</button></div>
      <div class="kanban-cards" id="cards-${esc(col.key)}"
        ondragover="onDragOver(event,'${esc(col.key)}')"
        ondrop="onDrop(event,'${esc(col.key)}')"
        ondragleave="onDragLeave(event,'${esc(col.key)}')">
        ${s.length?s.map(t=>renderKCard(t)).join(''):'<div class="empty-state"><div class="empty-text" style="font-size:12px">비어 있음</div></div>'}
      </div>
    </div>`;
  }).join('');
  document.querySelectorAll('.kcard').forEach(c=>{c.addEventListener('dragstart',onDragStart);c.addEventListener('dragend',onDragEnd);});
}

/******************************************************************************
FUNCTION    : renderKCard
DESCRIPTION : 단일 업무 객체를 칸반 카드 HTML 문자열로 변환
PARAMETERS  : t object - 업무 객체 (id, title, priority, tags, dueDate 사용)
RETURNED    : string - 칸반 카드 HTML
******************************************************************************/
function renderKCard(t){
  const tags=t.tags.map(tg=>`<span class="tag">${esc(tg)}</span>`).join('');
  const due=t.dueDate?`<span class="kcard-due ${isOverdue(t)?'overdue':''}">${fmtDateShort(t.dueDate)}</span>`:'';
  return `<div class="kcard" draggable="true" data-id="${t.id}"
    ondblclick="event.stopPropagation();jumpToLedger('${esc(t.id)}')"
    title="더블클릭: 업무 대장으로 이동">
    <div class="left-accent" style="background:${accentColor(t.priority)}"></div>
    <div style="padding-left:8px"><div class="kcard-title">${esc(t.title)}</div>
    <div class="kcard-foot"><span class="pri" style="${priStyle(t.priority)}">${priLabel(t.priority)}</span>${tags}${due}</div></div>
    <div class="kcard-actions">
      <button class="kcard-btn" onclick="event.stopPropagation();openModal('${esc(t.id)}')">✎</button>
      <button class="kcard-btn" onclick="event.stopPropagation();confirmDelete('${esc(t.id)}')">✕</button>
    </div>
  </div>`;
}

/* confirmDelete: 삭제 확인 후 업무를 제거하고 전체 재렌더링 */
function confirmDelete(id){if(confirm('삭제하시겠습니까?')){deleteTask(id);renderAll();toast('삭제됨');}}

/* 카드 드래그 이벤트 핸들러 */
function onDragStart(e){
  if(colDragKey) return;
  dragSrcId=e.currentTarget.dataset.id;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('type','card');
}
function onDragEnd(e){e.currentTarget.classList.remove('dragging');document.querySelectorAll('.kanban-cards').forEach(c=>c.classList.remove('drag-over'));}
function onDragOver(e,k){
  e.preventDefault();
  if(colDragKey) return;
  document.getElementById('cards-'+k)?.classList.add('drag-over');
}
function onDragLeave(e,k){document.getElementById('cards-'+k)?.classList.remove('drag-over');}
/******************************************************************************
FUNCTION    : onDrop
DESCRIPTION : 카드 드롭 시 해당 컬럼의 상태로 업무를 변경
PARAMETERS  : e DragEvent - 드롭 이벤트
              k string    - 대상 컬럼 상태 키
RETURNED    : void
******************************************************************************/
function onDrop(e,k){
  e.preventDefault();e.stopPropagation();
  document.getElementById('cards-'+k)?.classList.remove('drag-over');
  if(colDragKey||!dragSrcId)return;
  const t=tasks.find(x=>x.id===dragSrcId);
  if(t&&t.status!==k){updateTask(dragSrcId,{status:k});renderAll();toast(`"${t.title.slice(0,18)}" → ${statusLabel(k)}`);}
  dragSrcId=null;
}

/******************************************************************************
FUNCTION    : onColDragStart
DESCRIPTION : 칸반 컬럼 드래그 시작. colDragKey에 현재 컬럼 키 저장
PARAMETERS  : e   DragEvent - 드래그스타트 이벤트
              key string    - 드래그 중인 컬럼 상태 키
RETURNED    : void
******************************************************************************/
function onColDragStart(e, key){
  colDragKey = key;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('type','column');
  e.currentTarget.closest('.kanban-col').style.opacity = '0.5';
}
function onColDragEnd(e){
  colDragKey = null;
  document.querySelectorAll('.kanban-col').forEach(c=>{
    c.style.opacity='';
    c.classList.remove('col-drag-over');
  });
}
function onColDragOver(e, targetKey){
  e.preventDefault();
  if(!colDragKey || colDragKey===targetKey) return;
  e.dataTransfer.dropEffect='move';
  document.querySelectorAll('.kanban-col').forEach(c=>c.classList.remove('col-drag-over'));
  document.getElementById('col-'+targetKey)?.classList.add('col-drag-over');
}
function onColDragLeave(e, targetKey){
  if(!e.relatedTarget || !document.getElementById('col-'+targetKey)?.contains(e.relatedTarget)){
    document.getElementById('col-'+targetKey)?.classList.remove('col-drag-over');
  }
}
/******************************************************************************
FUNCTION    : onColDrop
DESCRIPTION : 컬럼 드롭 시 settings.statuses 배열 순서를 변경하고 저장
PARAMETERS  : e         DragEvent - 드롭 이벤트
              targetKey string    - 드롭 대상 컬럼 상태 키
RETURNED    : void
******************************************************************************/
function onColDrop(e, targetKey){
  e.preventDefault(); e.stopPropagation();
  document.querySelectorAll('.kanban-col').forEach(c=>c.classList.remove('col-drag-over'));
  if(!colDragKey || colDragKey===targetKey){ colDragKey=null; return; }
  const srcIdx = settings.statuses.findIndex(s=>s.key===colDragKey);
  const tgtIdx = settings.statuses.findIndex(s=>s.key===targetKey);
  if(srcIdx<0||tgtIdx<0){ colDragKey=null; return; }
  const [moved] = settings.statuses.splice(srcIdx,1);
  settings.statuses.splice(tgtIdx,0,moved);
  saveSettings();
  colDragKey=null;
  renderKanban();
  toast('컬럼 순서 변경 완료');
}
