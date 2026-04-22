/**
 * calendar.js - 대시보드 통계, 캘린더, 일정(Schedules), 요약 및 주간 업무 로직
 */

// ── DASHBOARD ──────────────────────────────────────────
function renderDashboard() {
  const t = today();
  const totalEl = document.getElementById('stat-total');
  const inprogEl = document.getElementById('stat-inprog');
  const doneTodayEl = document.getElementById('stat-done-today');
  const overdueEl = document.getElementById('stat-overdue');

  if (totalEl) totalEl.textContent      = tasks.filter(x => x.status==='todo'||x.status==='inprogress').length;
  if (inprogEl) inprogEl.textContent     = tasks.filter(x => x.status==='inprogress').length;
  if (doneTodayEl) doneTodayEl.textContent = tasks.filter(x => x.status==='done'&&x.completedAt&&x.completedAt.startsWith(t)).length;
  if (overdueEl) overdueEl.textContent    = tasks.filter(x => isOverdue(x)).length;

  renderSummaryCards();
  renderCalendar();
  renderDashQuickList();
  renderWeekly();
  renderRecurring();
  renderAnnual();
}

function renderDashQuickList(){
  const td=today();
  // 기한 초과 — 연결 업무 포함, stat-overdue 카드와 동일 기준
  const overdue=tasks.filter(x=>isOverdue(x));
  const qoEl=document.getElementById('qlist-overdue');
  const qocEl=document.getElementById('qcount-overdue');
  if(qoEl){
    qocEl.textContent=overdue.length;
    qoEl.innerHTML=overdue.length?overdue.map(x=>{
      const st=settings.statuses.find(s=>s.key===x.status)||{label:x.status};
      const fn=x.linkedSourceType?`openModal('${esc(x.id)}')`:`jumpToLinkedTask('${esc(x.id)}')`;
      return `<div class="quick-item" onclick="${fn}">
        <div class="quick-item-title">${esc(x.title)}</div>
        <div class="quick-item-meta">${x.dueDate||''} · ${esc(st.label)}${x.category?' · '+esc(x.category):''}</div>
      </div>`;
    }).join(''):'<div class="quick-empty">없음</div>';
  }
  const active=tasks.filter(x=>!x.linkedSourceType&&x.status!=='archived');
  // 오늘 마감 (초과 아닌 것)
  const todayDue=active.filter(x=>x.dueDate===td&&!isOverdue(x));
  const qtEl=document.getElementById('qlist-today');
  const qtcEl=document.getElementById('qcount-today');
  if(qtEl){
    qtcEl.textContent=todayDue.length;
    qtEl.innerHTML=todayDue.length?todayDue.map(x=>{
      const st=settings.statuses.find(s=>s.key===x.status)||{label:x.status};
      return `<div class="quick-item" onclick="jumpToLinkedTask('${esc(x.id)}')">
        <div class="quick-item-title">${esc(x.title)}</div>
        <div class="quick-item-meta">${esc(st.label)}${x.category?' · '+esc(x.category):''}</div>
      </div>`;
    }).join(''):'<div class="quick-empty">없음</div>';
  }
  // 오늘 완료
  const doneTd=tasks.filter(x=>x.status==='done'&&x.completedAt&&x.completedAt.startsWith(td));
  const qdEl=document.getElementById('qlist-done');
  const qdcEl=document.getElementById('qcount-done');
  if(qdEl){
    qdcEl.textContent=doneTd.length;
    qdEl.innerHTML=doneTd.length?doneTd.map(x=>`<div class="quick-item" onclick="jumpToLinkedTask('${esc(x.id)}')">
        <div class="quick-item-title">${esc(x.title)}</div>
        <div class="quick-item-meta">${x.completedAt?x.completedAt.slice(0,16).replace('T',' '):''}</div>
      </div>`).join(''):'<div class="quick-empty">없음</div>';
  }
  // 오늘 일정
  const todaySchs = schedules.filter(s=>s.date===td).sort((a,b)=>(a.startTime||'').localeCompare(b.startTime||''));
  const qsEl = document.getElementById('qlist-schedule');
  const qscEl = document.getElementById('qcount-schedule');
  if(qsEl){
    if(qscEl) qscEl.textContent = todaySchs.length;
    qsEl.innerHTML = todaySchs.length ? todaySchs.map(s=>{
      const time = s.startTime?(s.endTime?`${s.startTime}–${s.endTime}`:s.startTime):'';
      return `<div class="quick-item" onclick="openSchModal('${td}',JSON.parse(this.dataset.sch))" data-sch="${esc(JSON.stringify(s))}">
        <div class="quick-item-title" style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:${s.color};flex-shrink:0"></span>${esc(s.title)}</div>
        ${time?`<div class="quick-item-meta">${esc(time)}</div>`:''}
      </div>`;
    }).join('') : '<div class="quick-empty">없음</div>';
  }
}

function renderSummaryCards() {
  const KOM = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const now     = new Date();
  const nowY    = now.getFullYear();
  const nowM    = now.getMonth() + 1; // 1-based, 오늘 날짜 기준 고정

  // ── 정기업무 요약 (이달 기준 고정) ────────────────
  const mk = `${nowY}-${String(nowM).padStart(2,'0')}`;
  const recTotal  = recurringTasks.length;
  const recDone   = recurringTasks.filter(t => t.completions[mk]?.done).length;
  const recUndone = recTotal - recDone;
  const recDates  = recMonthDates(nowY, nowM);
  const isPastDeadline = today() > recDates.end;

  const elMonth = document.getElementById('rec-summary-month');
  const elDone  = document.getElementById('rec-sum-done');
  const elUnd   = document.getElementById('rec-sum-undone');
  const elTot   = document.getElementById('rec-sum-total');
  const elBar   = document.getElementById('rec-sum-bar');
  const elCard  = document.getElementById('rec-summary-card');

  if (elMonth) elMonth.textContent = `${nowY}년 ${KOM[nowM-1]}`;
  if (elDone)  elDone.textContent  = recDone;
  if (elUnd)   { elUnd.textContent = recUndone; elUnd.style.color = (isPastDeadline && recUndone > 0) ? 'var(--red)' : 'var(--text2)'; }
  if (elTot)   elTot.textContent   = recTotal;
  if (elBar)   elBar.style.width   = recTotal ? `${Math.round(recDone/recTotal*100)}%` : '0%';
  if (elCard)  elCard.style.borderColor = (isPastDeadline && recUndone > 0) ? 'var(--red)' : '';

  // ── 연간업무 요약 (annualYear 연동) ───────────────
  const yk   = String(annualYear);
  const allAnn = annualTasks;
  const total  = allAnn.length;

  let annDone = 0, annProg = 0, annPlan = 0, annOver = 0;
  allAnn.forEach(t => {
    const comp   = t.completions[yk] || {};
    const isDone = !!comp.done;
    const isPast = annualYear < nowY || (annualYear === nowY && t.month < nowM);
    const isCur  = annualYear === nowY && t.month === nowM;
    if (isDone)       annDone++;
    else if (isPast)  annOver++;
    else if (isCur)   annProg++;
    else              annPlan++;
  });

  const setEl = (id, val) => { const e = document.getElementById(id); if(e) e.textContent = val; };
  setEl('ann-summary-year', `${annualYear}년`);
  setEl('ann-sum-done', annDone);
  setEl('ann-sum-prog', annProg);
  setEl('ann-sum-plan', annPlan);
  setEl('ann-sum-over', annOver);

  const barDone = document.getElementById('ann-sum-bar-done');
  const barProg = document.getElementById('ann-sum-bar-prog');
  if (barDone) barDone.style.width = total ? `${Math.round(annDone/total*100)}%` : '0%';
  if (barProg) barProg.style.width = total ? `${Math.round(annProg/total*100)}%` : '0%';

  const annCard = document.getElementById('ann-summary-card');
  if (annCard) annCard.style.borderColor = annOver > 0 ? 'var(--red)' : '';
}

// ── CALENDAR LOGIC ────────────────────────────────────
function calMove(dir) { calMonth+=dir; if(calMonth>11){calMonth=0;calYear++;} if(calMonth<0){calMonth=11;calYear--;} renderCalendar(); }
function calGoToday() { const n=new Date(); calYear=n.getFullYear(); calMonth=n.getMonth(); renderCalendar(); }

function renderCalendar() {
  const KOM=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const label = document.getElementById('cal-month-label');
  if (label) label.textContent = `${calYear}년 ${KOM[calMonth]}`;
  const firstDay=new Date(calYear,calMonth,1).getDay();
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const daysInPrev=new Date(calYear,calMonth,0).getDate();
  const td=today();
  const evMap={};
  const hiddenStatuses = new Set(settings.statuses.filter(s=>s.showInCalendar===false).map(s=>s.key));
  function addEv(ds,task,type){if(!ds)return;if(!evMap[ds])evMap[ds]=[];evMap[ds].push({task,type});}
  tasks.forEach(t=>{
    if(t.status==='archived')return;
    if(hiddenStatuses.has(t.status))return;
    if(t.linkedSourceType==='recurring')return;
    // 마감일 기준으로만 표시 (마감일 없으면 시작일)
    const d = t.dueDate || t.startDate;
    if(d) addEv(d, t, t.dueDate ? 'due' : 'start');
  });

  const total=Math.ceil((firstDay+daysInMonth)/7)*7;

  // ── 셀 HTML 생성 (날짜 숫자만) ──────────────────────
  let cellHtml='';
  const cellDates=[];
  for(let i=0;i<total;i++){
    let dayNum,moff=0;
    if(i<firstDay){dayNum=daysInPrev-(firstDay-1-i);moff=-1;}
    else if(i>=firstDay+daysInMonth){dayNum=i-firstDay-daysInMonth+1;moff=1;}
    else{dayNum=i-firstDay+1;}
    const cm=calMonth+moff;
    const cy=cm<0?calYear-1:cm>11?calYear+1:calYear;
    const cmN=((cm%12)+12)%12;
    const ds=`${cy}-${String(cmN+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
    const isToday=ds===td, isOther=moff!==0, isSel=ds===calSelectedDate;
    const dow=i%7;
    cellDates.push(ds);
    cellHtml+=`<div class="cal-cell${isOther?' other-month':''}${isToday?' today':''}${isSel?' selected':''}${dow===0?' sunday':''}${dow===6?' saturday':''}" onclick="openCalDetail('${ds}')">
      <div class="cal-cell-hd"><div class="cal-day-num">${dayNum}</div><button class="cal-cell-add" onclick="event.stopPropagation();openSchModal('${ds}')" title="일정 추가">＋</button></div>
    </div>`;
  }
  const grid = document.getElementById('cal-grid');
  if (grid) grid.innerHTML = cellHtml;

  // 셀 높이 동적 조정 — 이전 rAF 취소 후 재등록
  if (_calRafId) { cancelAnimationFrame(_calRafId); _calRafId = null; }
  _calRafId = requestAnimationFrame(() => {
    _calRafId = null;
    _renderEventBars(cellDates, total, firstDay, evMap);
  });

  if(calSelectedDate) _renderCalDetail(calSelectedDate);
}

function _renderEventBars(cellDates, total, firstDay, evMap, _retry) {
  if (_retry === undefined) _retry = 0;
  const layer = document.getElementById('cal-events-layer');
  const grid  = document.getElementById('cal-grid');
  if (!layer || !grid) return;

  const gridRect = grid.getBoundingClientRect();
  if (gridRect.width === 0) {
    // 대시보드가 보일 때만 재시도 (숨김 상태에서 무한 루프 방지, 최대 30회)
    const dashView = document.getElementById('view-dashboard');
    if (dashView && dashView.classList.contains('active') && _retry < 30) {
      _calRafId = requestAnimationFrame(() => { _calRafId = null; _renderEventBars(cellDates, total, firstDay, evMap, _retry + 1); });
    }
    return;
  }

  const BAR_H          = 17;
  const BAR_GAP        = 2;
  const BAR_TOP_OFFSET = 28;

  // 날짜 → 셀 인덱스
  const dateToIdx = {};
  cellDates.forEach((ds, i) => { dateToIdx[ds] = i; });

  // 색상 맵
  const colorMap = {
    'var(--orange)':'#F07040','var(--red)':'#E05C6A',
    'var(--amber)':'#F4A832','var(--text3)':'#666E82',
    'var(--blue)':'#6AADFF','var(--green)':'#3DDC97'
  };
  function resolveColor(t) {
    const c = accentColor(t.priority);
    return colorMap[c] || c;
  }

  // 바 수집 — 일정 먼저(최상단 lane 보장), 그 다음 업무
  const firstDate = cellDates[0];
  const lastDate  = cellDates[cellDates.length - 1];
  const hiddenStatuses = new Set(settings.statuses.filter(s=>s.showInCalendar===false).map(s=>s.key));
  const bars = [];
  // 일정(schedule) - 항상 먼저 수집해 lane 0부터 배정
  schedules.forEach(s => {
    if (!s.date || s.date < firstDate || s.date > lastDate) return;
    bars.push({ sch:s, type:'schedule', start:s.date, end:s.date });
  });
  tasks.forEach(t => {
    if (t.status === 'archived') return;
    if (hiddenStatuses.has(t.status)) return;
    if (t.linkedSourceType === 'recurring') return;
    if (!t.startDate && !t.dueDate) return;
    // 마감일 기준 단일 포인트 표시 (마감일 없으면 시작일)
    const d = t.dueDate || t.startDate;
    if (d < firstDate || d > lastDate) return;
    bars.push({ task:t, type:'single', start:d, end:d });
  });

  // lane 배정
  const rowLanes = {};
  function assignLane(row, sIdx, eIdx) {
    if (!rowLanes[row]) rowLanes[row] = [];
    const used = rowLanes[row];
    let lane = 0;
    while (used.some(u => u.lane === lane && u.eIdx >= sIdx)) lane++;
    used.push({ eIdx, lane });
    return lane;
  }

  // 1차: barsHtml 생성 (lane 배정 포함) - 셀 위치는 임시값
  const tempBars = [];
  const allCells = grid.querySelectorAll('.cal-cell');

  bars.forEach(bar => {
    if (bar.type === 'schedule') {
      const s = bar.sch;
      const sIdx = dateToIdx[bar.start];
      if (sIdx === undefined) return;
      const row = Math.floor(sIdx / 7);
      const lane = assignLane(row, sIdx, sIdx);
      tempBars.push({ sch:s, color:s.color||'#6aabdb', type:'schedule', si:sIdx, ei:sIdx, lane });
      return;
    }
    const t = bar.task;
    const color = resolveColor(t);
    const sIdx = dateToIdx[bar.start];
    const eIdx = dateToIdx[bar.end];
    if (sIdx === undefined && eIdx === undefined) return;
    const si = sIdx !== undefined ? sIdx : 0;
    const ei = eIdx !== undefined ? eIdx   : cellDates.length - 1;

    if (bar.type === 'single') {
      const row  = Math.floor(si / 7);
      const lane = assignLane(row, si, si);
      tempBars.push({ t, color, type:'single', si, ei, lane });
    } else {
      let cur = si, isFirst = true;
      while (cur <= ei) {
        const row    = Math.floor(cur / 7);
        const rowEnd = Math.min((row + 1) * 7 - 1, ei);
        // 각 행마다 독립적으로 lane 배정 (행 경계에서 재사용하면 겹침 발생)
        const lane = assignLane(row, cur, Math.min((row+1)*7-1, ei));
        tempBars.push({ t, color, type:'span', si:cur, ei:rowEnd, globalEi:ei, lane, isFirst, isLast: rowEnd>=ei });
        cur = rowEnd + 1;
        isFirst = false;
      }
    }
  });

  // 2: 행별 최대 lane → 셀 높이 설정
  const numRows = Math.ceil(cellDates.length / 7);
  for (let row = 0; row < numRows; row++) {
    const maxLane = rowLanes[row] ? Math.max(...rowLanes[row].map(l => l.lane)) : 0;
    const h = Math.max(110, BAR_TOP_OFFSET + (maxLane + 1) * (BAR_H + BAR_GAP) + 8);
    for (let col = 0; col < 7; col++) {
      const cell = allCells[row * 7 + col];
      if (cell) cell.style.minHeight = h + 'px';
    }
  }

  // 3: 셀 높이 확정 후 실제 위치 계산 → HTML 생성
  const lp = layer.parentElement;
  if (!lp) return;
  const lRect = lp.getBoundingClientRect();
  let barsHtml = '';

  tempBars.forEach(b => {
    const { t, color, type, si, ei, lane, isFirst, isLast } = b;
    const cellS = allCells[si];
    const cellE = allCells[ei];
    if (!cellS || !cellE) return;

    const rS  = cellS.getBoundingClientRect();
    const rE  = cellE.getBoundingClientRect();
    const top = (rS.top - lRect.top) + BAR_TOP_OFFSET + lane * (BAR_H + BAR_GAP);

    if (type === 'schedule') {
      const s = b.sch;
      const left  = rS.left - lRect.left + 2;
      const width = rS.width - 4;
      const txt   = esc(s.title.slice(0, Math.max(4, Math.floor(width/7))));
      const timeStr = s.startTime ? ` ${s.startTime}` : '';
      barsHtml += `<div class="cal-bar cal-bar-sch" style="left:${left}px;top:${top}px;width:${width}px;background:${color};color:#fff;"
        onclick="event.stopPropagation();openSchModal('${esc(s.date)}',${JSON.stringify(s).replace(/"/g,'&quot;')})"
        title="${esc(s.title)}${timeStr}">
        <span class="cal-bar-text">◼ ${txt}${timeStr}</span></div>`;
      return;
    }

    if (type === 'single') {
      const left  = rS.left - lRect.left + 2;
      const width = rS.width - 4;
      const txt   = esc(t.title.slice(0, Math.max(4, Math.floor(width/7))));
      const icon  = (!t.startDate || t.startDate === t.dueDate) && t.dueDate ? ' ◎' : ' ▶';
      barsHtml += `<div class="cal-bar" style="left:${left}px;top:${top}px;width:${width}px;background:${color}28;color:${color};border:1px solid ${color}55"
        onclick="event.stopPropagation();openCalDetail('${esc(b.t.startDate||b.t.dueDate)}')"
        ondblclick="event.stopPropagation();event.preventDefault();jumpToLedger('${esc(t.id)}')"
        title="${esc(t.title)}">
        <span class="cal-chip-dot" style="background:${color}"></span>
        <span class="cal-bar-text">${txt}${icon}</span></div>`;
    } else {
      const left   = rS.left - lRect.left + (isFirst ? 2 : 0);
      const right  = rE.left - lRect.left + rE.width - 2;
      const width  = right - left;
      const bL     = isFirst ? '3px' : '0';
      const bR     = isLast  ? '3px' : '0';
      const maxCh  = Math.max(4, Math.floor(width / 7));
      const txt    = esc(t.title.slice(0, maxCh)) + (t.title.length > maxCh ? '…' : '');
      const content = isFirst ? `<span class="cal-bar-text">${txt}</span>`
                    : isLast  ? `<span class="cal-bar-text" style="justify-content:flex-end">${txt}</span>`
                    : '';
      barsHtml += `<div class="cal-bar" style="left:${left}px;top:${top}px;width:${width}px;background:${color}30;color:${color};border:1px solid ${color}55;border-radius:${bL} ${bR} ${bR} ${bL}"
        onclick="event.stopPropagation();openCalDetail('${esc(b.t.startDate||b.t.dueDate)}')"
        ondblclick="event.stopPropagation();event.preventDefault();jumpToLedger('${esc(t.id)}')"
        title="${esc(t.title)}">${content}</div>`;
    }
  });

  // 4: 최종 렌더
  const finalRect = grid.getBoundingClientRect();
  layer.style.cssText = `position:absolute;top:0;left:0;width:${finalRect.width}px;height:${finalRect.height}px;pointer-events:none;`;
  layer.innerHTML = barsHtml;
  layer.querySelectorAll('.cal-bar').forEach(b => b.style.pointerEvents = 'auto');
}

// detail 패널 렌더만 담당 (renderCalendar 호출 없음)
function _renderCalDetail(ds) {
  const evs=[];
  tasks.forEach(t=>{
    if(t.status==='archived')return;
    // 마감일 기준 단일 포인트 (마감일 없으면 시작일)
    const d = t.dueDate || t.startDate;
    if(d === ds) evs.push({task:t, type: t.dueDate ? 'due' : 'start'});
  });
  const daySchs = schedules.filter(s=>s.date===ds).sort((a,b)=>(a.startTime||'').localeCompare(b.startTime||''));
  const det=document.getElementById('cal-detail');
  if (!det) return;
  det.style.display='';
  const [y,m,d]=ds.split('-');
  const days=['일','월','화','수','목','금','토'];
  const dateEl = document.getElementById('cal-detail-date');
  if (dateEl) dateEl.textContent=`${y}년 ${m}월 ${d}일 (${days[new Date(ds).getDay()]})`;
  // 일정 먼저 표시, 업무 클릭 시 업무대장으로 이동
  const schHtml = `<div class="cal-sch-section">
    <div class="cal-sch-hd"><span>일정</span><button class="btn btn-ghost btn-sm" style="padding:2px 8px;font-size:11px" onclick="openSchModal('${ds}')">＋ 추가</button></div>
    ${daySchs.length ? daySchs.map(s=>{
      const time = s.startTime ? (s.endTime ? `${s.startTime}–${s.endTime}` : s.startTime) : '';
      return `<div class="cal-sch-item" onclick="openSchModal('${ds}',${JSON.stringify(s).replace(/"/g,'&quot;')})">
        <span class="cal-sch-item-dot" style="background:${s.color}"></span>
        <span class="cal-sch-item-title">${esc(s.title)}</span>
        ${time?`<span class="cal-sch-item-time">${esc(time)}</span>`:''}
      </div>`;
    }).join('') : '<div style="font-size:11px;color:var(--text3);padding:4px 0">일정 없음</div>'}
  </div>`;
  const taskHtml = evs.map(e=>{
    return `<div class="cal-detail-item" onclick="jumpToLedger('${e.task.id}')">
      <div class="cal-detail-item-dot" style="background:${accentColor(e.task.priority)}"></div>
      <div class="cal-detail-item-title">${esc(e.task.title)}</div>
      <div class="cal-detail-item-meta">
        ${e.task.category?`<span class="tag">${esc(e.task.category)}</span>`:''}
        <span class="pri" style="${priStyle(e.task.priority)}">${priLabel(e.task.priority)}</span>
        ${statusBadge(e.task.status)}
      </div>
    </div>`;
  }).join('');
  const listEl = document.getElementById('cal-detail-list');
  if (listEl) listEl.innerHTML = schHtml + taskHtml;
}

function openCalDetail(ds, scroll=true){
  calSelectedDate = ds;
  renderCalendar(); // 선택 셀 하이라이트 갱신
  _renderCalDetail(ds);
  if(scroll){
    const det=document.getElementById('cal-detail');
    if(det&&det.style.display!=='none') det.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
}
function closeCalDetail(){calSelectedDate=null; const det = document.getElementById('cal-detail'); if (det) det.style.display='none'; renderCalendar();}

// ── SCHEDULES ──
function schGenId(){ return 's'+Date.now().toString(36)+Math.random().toString(36).slice(2,5); }
function saveSch(){ localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedules)); }

const SCH_COLORS = ['#6aabdb','#4dba8a','#8c82d8','#d8758a','#d4a030','#d47050','#f87171','#a3e635'];

function openSchModal(date, sch=null){
  const isEdit = !!sch;
  const overlay = document.createElement('div');
  overlay.className='modal-overlay';overlay.id='sch-modal-overlay';overlay.style.display='flex';
  overlay.innerHTML=`<div class="modal" style="width:460px">
    <div class="modal-header"><div class="modal-title">${isEdit?'일정 수정':'일정 추가'}</div></div>
    <div class="modal-body">
      <div class="field">
        <label class="field-label">제목</label>
        <input class="field-input" id="sch-title" value="${esc(sch?.title||'')}" placeholder="일정 제목" autocomplete="off">
      </div>
      <div class="field">
        <label class="field-label">날짜</label>
        <input class="field-input" type="date" id="sch-date" value="${esc(sch?.date||date||'')}">
      </div>
      <div class="field-row">
        <div class="field">
          <label class="field-label">시작 시간</label>
          <input class="field-input" type="time" id="sch-start" value="${esc(sch?.startTime||'')}">
        </div>
        <div class="field">
          <label class="field-label">종료 시간</label>
          <input class="field-input" type="time" id="sch-end" value="${esc(sch?.endTime||'')}">
        </div>
      </div>
      <div class="field">
        <label class="field-label">색상</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:4px 0">
          ${SCH_COLORS.map(c=>`<button onclick="document.getElementById('sch-color').value='${c}';this.parentElement.querySelectorAll('button').forEach(b=>b.style.outline='none');this.style.outline='2px solid var(--amber)'" style="width:24px;height:24px;background:${c};border:none;border-radius:50%;cursor:pointer;outline:${(sch?.color||SCH_COLORS[0])===c?'2px solid var(--amber)':'none'};transition:transform .1s" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'"></button>`).join('')}
          <input type="color" id="sch-color" value="${esc(sch?.color||SCH_COLORS[0])}" style="width:32px;height:28px;border:1px solid var(--border);cursor:pointer;border-radius:4px;background:var(--s2);padding:2px">
        </div>
      </div>
      <div class="field">
        <label class="field-label">메모</label>
        <textarea class="field-input" id="sch-memo" style="height:auto;min-height:80px;padding-top:10px" placeholder="일정 관련 메모를 입력하세요...">${esc(sch?.memo||'')}</textarea>
      </div>
    </div>
    <div class="modal-foot">
      ${isEdit?`<button class="btn btn-danger btn-sm" style="margin-right:auto" onclick="deleteSchEntry('${esc(sch.id)}')">삭제</button>`:''}
      <button class="btn btn-ghost" onclick="closeSchModal()">취소</button>
      <button class="btn btn-primary" onclick="saveSchModal(${isEdit?`'${esc(sch.id)}'`:'null'})">저장</button>
    </div>
  </div>`;
  overlay.addEventListener('click',e=>{if(e.target===overlay)closeSchModal();});
  document.body.appendChild(overlay);
  const titleInp = document.getElementById('sch-title');
  if (titleInp) setTimeout(()=>titleInp.focus(),50);
}
function closeSchModal(){ document.getElementById('sch-modal-overlay')?.remove(); }
function saveSchModal(editId){
  const title = document.getElementById('sch-title')?.value.trim();
  if(!title){toast('제목을 입력하세요');return;}
  const date=document.getElementById('sch-date')?.value;
  if(!date){toast('날짜를 선택하세요');return;}
  const obj={
    id:editId||schGenId(), title, date,
    startTime:document.getElementById('sch-start')?.value||'',
    endTime:document.getElementById('sch-end')?.value||'',
    color:document.getElementById('sch-color')?.value||SCH_COLORS[0],
    memo:document.getElementById('sch-memo')?.value||''
  };
  if(editId){ const i=schedules.findIndex(s=>s.id===editId); if(i>=0)schedules[i]=obj; }
  else schedules.push(obj);
  saveSch(); closeSchModal(); renderCalendar(); renderDashQuickList();
  toast(editId?'일정 수정됨':'일정 추가됨');
}
function deleteSchEntry(id){
  if(!confirm('일정을 삭제하시겠습니까?'))return;
  schedules=schedules.filter(s=>s.id!==id);
  saveSch(); closeSchModal(); renderCalendar(); renderDashQuickList();
  toast('일정 삭제됨');
}

// ── WEEKLY ────────────────────────────────────────────
function getNextMonday() {
  const now = new Date();
  now.setHours(0,0,0,0);
  const day = now.getDay(); // 0=일
  const diff = day === 0 ? 1 : (8 - day);
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  return mon;
}

function getThisMonday() {
  const now = new Date();
  now.setHours(0,0,0,0);
  const day = now.getDay();
  const diff = day === 0 ? -6 : (1 - day);
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  return mon;
}

function renderWeekly() {
  const thisMon = getThisMonday();
  const nextMon = getNextMonday();
  const thisSun = new Date(nextMon); thisSun.setDate(nextMon.getDate() - 1);

  const isoStr  = d => d.toISOString().split('T')[0];
  const fmtMD   = d => `${d.getMonth()+1}/${d.getDate()}`;

  const thisMonStr = isoStr(thisMon);
  const thisSunStr = isoStr(thisSun);

  const label = document.getElementById('weekly-label');
  if (label) label.textContent = `${fmtMD(thisMon)}(월) ~ ${fmtMD(thisSun)}(일)`;

  // 이번 주에 걸치는 업무
  const weekTasks = tasks.filter(t => {
    if (t.status === 'archived') return false;
    if (!t.startDate && !t.dueDate) return false;
    const s = t.startDate || t.dueDate;
    const e = t.dueDate   || t.startDate;
    return s <= thisSunStr && e >= thisMonStr;
  });

  const today_ = today();

  // 오늘 기준 마감까지 남은 일수로 분류
  function daysUntilDue(t) {
    const due = t.dueDate || t.startDate;
    if (!due) return 999;
    return Math.ceil((new Date(due) - new Date(today_)) / 86400000);
  }

  const doneGroup   = weekTasks.filter(t => daysUntilDue(t) <= 6);
  const activeGroup = weekTasks.filter(t => daysUntilDue(t) >= 7);

  const priOrder  = settings.priorities.map(p => p.key);
  const sortByPri = arr => [...arr].sort((a,b) => priOrder.indexOf(a.priority) - priOrder.indexOf(b.priority));
  const listEl    = document.getElementById('weekly-list');
  if (!listEl) return;

  if (!weekTasks.length) {
    listEl.innerHTML = '<div class="weekly-empty">이번 주 해당 업무 없음</div>';
    return;
  }

  function simpleStatusBadge(t) {
    if (t.status === 'done') {
      return '<span class="weekly-st-badge weekly-st-done">완료</span>';
    }
    return '<span class="weekly-st-badge weekly-st-active">진행중</span>';
  }

  function renderGroup(label, color, items) {
    if (!items.length) return '';
    const rows = sortByPri(items).map(t => {
      const priColor  = accentColor(t.priority);
      const ovd       = isOverdue(t);
      const startStr  = t.startDate ? fmtDate(t.startDate) : '—';
      const dueStr    = t.dueDate   ? fmtDate(t.dueDate)   : '—';
      const pct       = t.status === 'done'       ? 100
                      : t.status === 'inprogress' ? 50 : 0;
      const fillColor = pct === 100 ? 'var(--green)' : pct > 0 ? 'var(--blue)' : 'var(--border-h)';
      return `<div class="weekly-row" onclick="jumpToLedger('${esc(t.id)}')">
        <div class="weekly-pri-bar" style="background:${priColor}"></div>
        <span class="weekly-title" title="${esc(t.title)}">${esc(t.title)}</span>
        ${t.category ? `<span class="weekly-cat">${esc(t.category)}</span>` : '<span class="weekly-cat" style="opacity:.3">—</span>'}
        <span class="weekly-date${ovd?' overdue':''}">${startStr} → ${dueStr}</span>
        <div class="weekly-progress-wrap">
          <div class="weekly-progress-bar"><div class="weekly-progress-fill" style="width:${pct}%;background:${fillColor}"></div></div>
          <span class="weekly-progress-txt">${pct}%</span>
        </div>
        <span class="weekly-status">${simpleStatusBadge(t)}${statusBadge(t.status)}</span>
      </div>`;
    }).join('');
    return `<div class="weekly-group">
      <div class="weekly-group-header">
        <span class="weekly-group-title" style="color:${color}">${label}</span>
        <span class="weekly-group-count">${items.length}</span>
      </div>
      ${rows}
    </div>`;
  }

  listEl.innerHTML =
    renderGroup(`진행 중 — 차주(${fmtMD(nextMon)}) 이후 마감`, 'var(--blue)',  sortByPri(activeGroup)) +
    renderGroup(`완료 예정 — 차주(${fmtMD(nextMon)}) 이전 마감`, 'var(--amber)', sortByPri(doneGroup));
}

// ── RECURRING / ANNUAL TASKS ──────────────────────────
let annualYear   = new Date().getFullYear();
let annualOpenId = null;
let recMemoOpen  = {}; // {id: 'edit'|'preview'}
let annMemoOpen  = {}; // 미사용 (이전 탭 모드 잔재, 삭제 시 calendar.js 다른 코드 확인 필요)

function recKey() {
  const _n = new Date();
  return `${_n.getFullYear()}-${String(_n.getMonth()+1).padStart(2,'0')}`;
}
function annKey() { return String(annualYear); }

// 매월 첫주 5영업일 계산 (1일 ~ 첫 금요일, 최대 5일)
function recMonthDates(year, month) {
  // month: 1-based
  const result = { start: null, end: null };
  const d = new Date(year, month - 1, 1);
  result.start = d.toISOString().split('T')[0];
  // 첫주 금요일 찾기 (또는 5영업일째 날)
  let bizCount = 0, cur = new Date(d);
  while (bizCount < 5) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) bizCount++;
    if (bizCount < 5) cur.setDate(cur.getDate() + 1);
  }
  result.end = cur.toISOString().split('T')[0];
  return result;
}

/* ═══════════════════════════════════════════════════════
   월간 업무 (매월)
═══════════════════════════════════════════════════════ */
function renderRecurring() {
  const now  = new Date();
  const nowY = now.getFullYear();
  const nowM = now.getMonth() + 1;
  const mk   = `${nowY}-${String(nowM).padStart(2,'0')}`;
  const KOM  = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

  document.getElementById('rec-month-label').textContent = `${nowY}년 ${KOM[nowM-1]}`;

  const total = recurringTasks.length;
  const done  = recurringTasks.filter(t => t.completions[mk]?.done).length;
  const dates2 = recMonthDates(nowY, nowM);
  const isDeadlinePassed = today() > dates2.end;
  const overdueCount = isDeadlinePassed ? recurringTasks.filter(t => !t.completions[mk]?.done).length : 0;

  const carryActive = [];
  for (let m = 1; m < nowM; m++) {
    const prevMk = `${nowY}-${String(m).padStart(2,'0')}`;
    recurringTasks.forEach(t => {
      if (!t.completions[prevMk]?.done && !t.completions[mk]?.done) {
        if (!carryActive.find(c => c.task.id === t.id)) {
          carryActive.push({ task: t, fromMonthLabel: KOM[m-1] });
        }
      }
    });
  }

  const progressText = total ? `${done} / ${total} 완료` : '';
  const overdueText  = overdueCount > 0 ? ` · 미완료 ${overdueCount}건` : '';
  const carryText    = carryActive.length > 0 ? ` · 이월 ${carryActive.length}건` : '';
  document.getElementById('rec-progress').textContent = progressText + overdueText + carryText;
  document.getElementById('rec-progress').style.color =
    overdueCount > 0 ? 'var(--red)' : carryActive.length > 0 ? 'var(--amber)' : '';

  const listEl = document.getElementById('rec-list');
  if (!total) {
    listEl.innerHTML = '<div style="padding:14px 16px;color:var(--text2);font-size:12px">월간 업무 없음 — ＋ 추가 버튼으로 등록하세요.</div>';
    return;
  }

  function renderRecItem(t, carryLabel) {
    const isDetailOpen = recMemoOpen[t.id] !== undefined;
    const curComp = t.completions[mk] || {};
    const isOverdueRec = !curComp.done && isDeadlinePassed;

    const KOM2 = ['1','2','3','4','5','6','7','8','9','10','11','12'];
    const monthChecks = KOM2.map((lbl,i) => {
      const mk2 = `${nowY}-${String(i+1).padStart(2,'0')}`;
      const c   = t.completions[mk2] || {};
      const isCurM = (i === nowM-1);
      return `<div class="rec-month-check-cell ${isCurM?'is-cur-month':''}">
        <div class="rec-month-label">${lbl}월</div>
        <div class="rec-check-sm ${c.done?'checked':''}"
          onclick="toggleRecurringMonth('${t.id}','${mk2}')"
          title="${lbl}월 ${c.done?'완료':'미완료'}${c.date?' ('+c.date+')':''}"
        >${c.done?'✓':''}</div>
        ${c.done&&c.date?`<div class="rec-month-date">${fmtDateShort(c.date)}</div>`:''}
      </div>`;
    }).join('');

    const detailHtml = isDetailOpen ? `
      <div class="rec-detail-panel">
        <div class="rec-detail-chips">
          ${t.category?`<span class="rec-field-label">카테고리</span><span class="tag">${esc(t.category)}</span>`:''}
          ${(t.tags||[]).length?`<span class="rec-field-label" style="margin-left:${t.category?'8px':'0'}">태그</span>${(t.tags||[]).map(tg=>`<span class="tag">${esc(tg)}</span>`).join('')}`:''}
          <span style="margin-left:auto">${statusBadge(t.status)}</span>
        </div>
        <div class="rec-month-grid">${monthChecks}</div>
        <div class="memo-section" style="border-top:1px solid var(--border);padding-top:10px">
          <div class="memo-header">
            <div class="memo-label">${nowY}년 ${nowM}월 비고</div>
          </div>
          <textarea class="memo-textarea" id="rec-memo-${t.id}"
            placeholder="메모를 입력하세요..."
            oninput="autoGrowTextarea(this)"
            onchange="saveRecComp('${t.id}','memo',this.value)"
            onblur="saveRecComp('${t.id}','memo',this.value)"
          >${esc(curComp.memo||'')}</textarea>
        </div>
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
          <div style="font-size:11px;color:var(--text2);margin-bottom:6px">${nowY}년 ${nowM}월 세부사항 (이번 달 한정)</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px">
            <div class="ep-field"><div class="ep-label">시작일</div>
              <input type="date" class="ep-select" id="rd-start-${t.id}" value="${esc(curComp.startDate||'')}" onchange="saveRecMonthDetail('${t.id}')">
            </div>
            <div class="ep-field"><div class="ep-label">마감일</div>
              <input type="date" class="ep-select" id="rd-due-${t.id}" value="${esc(curComp.dueDate||'')}" onchange="saveRecMonthDetail('${t.id}')">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div class="ep-field"><div class="ep-label">카테고리 (빈값=기본 사용)</div>
              <select class="ep-select" id="rd-cat-${t.id}" onchange="saveRecMonthDetail('${t.id}')">
                <option value="">— 기본값 —</option>
                ${settings.categories.map(cat=>`<option value="${esc(cat)}" ${(curComp.category||'')===cat?'selected':''}>${esc(cat)}</option>`).join('')}
              </select>
            </div>
            <div class="ep-field"><div class="ep-label">담당자 (Ctrl+클릭 다중)</div>
              <select class="ep-select" id="rd-assignee-${t.id}" multiple style="min-height:52px" onchange="saveRecMonthDetail('${t.id}')">
                ${contacts.map(c=>`<option value="${esc(c.id)}" ${(curComp.assigneeIds||[]).includes(c.id)?'selected':''}>${esc(_assigneeLabel(c))}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
      </div>` : '';

    const miniDots = Array.from({length:12}, (_,i) => {
      const mk2 = `${nowY}-${String(i+1).padStart(2,'0')}`;
      const c   = t.completions[mk2] || {};
      const isCurM = (i === nowM-1);
      const tipText = `${i+1}월 ${c.done ? '완료' + (c.date ? ' (' + c.date + ')' : '') : '미완료'}`;
      return `<div class="rec-mini-box ${c.done?'done':''} ${isCurM?'cur':''}" title="${tipText}">${i+1}</div>`;
    }).join('');

    const carryBadge = carryLabel
      ? `<span class="carry-badge">${carryLabel} 이월</span>` : '';

    return `<div class="rec-item" id="rec-item-${t.id}" style="${isOverdueRec?'border-left:3px solid var(--red);':''}">
      <div class="rec-item-body">
        <div class="rec-item-top">
          <div style="display:flex;align-items:center;gap:6px;min-width:0">
            <span class="rec-item-title" ondblclick="startRecTitleEdit('${t.id}',this)" style="cursor:text" title="더블클릭으로 수정">${esc(t.title)}</span>
            ${carryBadge}
            <button class="rec-detail-toggle ${isDetailOpen?'open':''}" onclick="recToggleDetail('${t.id}')" style="flex-shrink:0">${isDetailOpen?'▲':'▼'}</button>
          </div>
          <div class="rec-mini-boxes" title="${nowY}년 1~12월 완료 현황">${miniDots}</div>
        </div>
        ${detailHtml}
      </div>
      <div class="rec-item-actions">
        <button class="btn btn-ghost btn-sm btn-icon" onclick="openRecModal('${t.id}')">✎</button>
        <button class="btn btn-danger btn-sm btn-icon" onclick="deleteRecurring('${t.id}')">✕</button>
      </div>
    </div>`;
  }

  let html = '';
  if (carryActive.length > 0) {
    html += `<div class="section-sub-header carry">▲ 이월 미완료 (${carryActive.length}건)</div>`;
    carryActive.forEach(c => { html += renderRecItem(c.task, c.fromMonthLabel); });
    html += `<div style="height:1px;background:var(--border)"></div>`;
  }
  recurringTasks.forEach(t => { html += renderRecItem(t, null); });
  listEl.innerHTML = html;
}

function saveRecMonthDetail(id) {
  const t = recurringTasks.find(x => x.id === id);
  if (!t) return;
  const mk = recKey();
  if (!t.completions[mk]) t.completions[mk] = { done: false, date: '', memo: '' };
  const startDate   = document.getElementById(`rd-start-${id}`)?.value || null;
  const dueDate     = document.getElementById(`rd-due-${id}`)?.value   || null;
  const category    = document.getElementById(`rd-cat-${id}`)?.value   || null;
  const assigneeIds = Array.from(document.getElementById(`rd-assignee-${id}`)?.selectedOptions||[]).map(o=>o.value);
  Object.assign(t.completions[mk], { startDate: startDate||null, dueDate: dueDate||null, category: category||null, assigneeIds });
  saveRecurring();
}
function recToggleDetail(id) {
  if (recMemoOpen[id] !== undefined) { delete recMemoOpen[id]; } else { recMemoOpen[id] = true; }
  renderRecurring();
  if (recMemoOpen[id]) {
    setTimeout(() => {
      const ta = document.getElementById('rec-memo-' + id);
      if (ta) { attachMemoTabKey(ta); autoGrowTextarea(ta); }
    }, 30);
  }
}
function recToggleMemo(id) { recToggleDetail(id); }
function toggleRecurringMonth(id, monthKey) {
  const t = recurringTasks.find(x => x.id === id); if (!t) return;
  if (!t.completions[monthKey]) t.completions[monthKey] = { done: false, date: '', memo: '' };
  t.completions[monthKey].done = !t.completions[monthKey].done;
  if (t.completions[monthKey].done && !t.completions[monthKey].date) t.completions[monthKey].date = today();
  if (monthKey === recKey()) updateLinkedStatus(id, 'recurring', t.completions[monthKey].done);
  saveRecurring(); renderRecurring(); renderAll();
}
function toggleRecurring(id) { toggleRecurringMonth(id, recKey()); }
function saveRecComp(id, field, val) {
  const mk = recKey();
  const t  = recurringTasks.find(x => x.id === id); if (!t) return;
  if (!t.completions[mk]) t.completions[mk] = { done: false, date: '', memo: '' };
  t.completions[mk][field] = val;
  saveRecurring();
}
function deleteRecurring(id) {
  if (!confirm('이 월간 업무를 삭제하시겠습니까?')) return;
  tasks = tasks.filter(t => !(t.linkedSourceId === id && t.linkedSourceType === 'recurring'));
  recurringTasks = recurringTasks.filter(t => t.id !== id);
  save(); saveRecurring(); renderRecurring(); renderAll(); toast('삭제됨');
}

let editingRecId = null;
function openRecModal(id = null) {
  editingRecId = id;
  const t = id ? recurringTasks.find(x => x.id === id) : null;
  showRichModal({
    title: '월간 업무 ' + (id ? '수정' : '추가'),
    data: t,
    onSave: (data) => {
      if (editingRecId) {
        const rec = recurringTasks.find(x => x.id === editingRecId);
        Object.assign(rec, data);
        syncLinkedTask(rec, 'recurring');
      } else {
        const rec = { id: genId(), completions: {}, ...data };
        recurringTasks.push(rec);
        syncLinkedTask(rec, 'recurring');
      }
      saveRecurring(); renderRecurring(); renderAll(); return true;
    },
    onDelete: id ? () => deleteRecurring(id) : null,
  });
}

/* ═══════════════════════════════════════════════════════
   연간 업무 (1~12월)
═══════════════════════════════════════════════════════ */
function annualMove(dir) { annualYear += dir; renderAnnual(); renderSummaryCards(); }

function renderAnnual() {
  const now  = new Date();
  const nowY = now.getFullYear();
  const nowM = now.getMonth() + 1;
  const yk   = String(annualYear);
  const KOM  = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

  document.getElementById('annual-year-label').textContent = `${annualYear}년`;

  let html = '';
  for (let m = 1; m <= 12; m++) {
    const monthTasks = annualTasks.filter(t => t.month === m);
    const isPastM    = annualYear < nowY || (annualYear === nowY && m < nowM);
    const isCur      = annualYear === nowY && m === nowM;
    const doneCount  = monthTasks.filter(t => t.completions[yk]?.done).length;
    const undone     = monthTasks.filter(t => !t.completions[yk]?.done).length;
    const overdueAnn = isPastM && undone > 0;

    const monthLabel = isCur
      ? `${KOM[m-1]} <span style="font-size:10px;color:var(--amber)">▶ 이번 달</span>`
      : isPastM && overdueAnn
        ? `${KOM[m-1]} <span style="font-size:10px;color:var(--red)">미완료</span>`
        : KOM[m-1];

    html += `
    <div class="annual-month-section ${isCur?'is-current':''}">
      <div class="annual-month-header">
        <span class="annual-month-name">${monthLabel}</span>
        ${monthTasks.length ? `<span class="annual-month-prog" style="${overdueAnn?'color:var(--red);font-weight:600':''}">${doneCount}/${monthTasks.length}${overdueAnn?' ⚠️':''}</span>` : ''}
        <button class="kcard-btn" style="margin-left:auto;padding:4px 8px;font-size:11px;border-radius:4px"
          onclick="openAnnualModal(${m})" title="${KOM[m-1]} 업무 추가">＋</button>
      </div>
      <div class="annual-tasks-list">
        ${monthTasks.length ? monthTasks.map(t => {
          const comp    = t.completions[yk] || {};
          const isDone  = !!comp.done;
          const isOpen  = annualOpenId === t.id;
          const memoHtml = isOpen ? `
            <div class="annual-detail-panel" onclick="event.stopPropagation()">
              <div class="annual-detail-row" style="align-items:center">
                <span class="rec-field-label">완료일</span>
                <input type="date" class="rec-mini-input date-inp" value="${comp.date||''}"
                  onchange="saveAnnualComp('${t.id}','date',this.value)">
                <div style="flex:1"></div>
                ${(t.tags||[]).map(tg=>`<span class="tag">${esc(tg)}</span>`).join('')}
                ${statusBadge(t.status)}
                <button class="btn btn-ghost btn-sm btn-icon" onclick="openAnnualModal(${m},'${t.id}')">✎</button>
                <button class="btn btn-danger btn-sm btn-icon" onclick="deleteAnnual('${t.id}')">✕</button>
              </div>
              <div class="annual-detail-row" style="flex-direction:column;gap:4px;margin-top:6px">
                <div class="memo-section" style="border-top:1px solid var(--border);padding-top:10px;width:100%">
                  <div class="memo-header">
                    <div class="memo-label">메모</div>
                  </div>
                  <textarea class="memo-textarea" id="ann-memo-${t.id}"
                    placeholder="메모를 입력하세요..."
                    oninput="autoGrowTextarea(this)"
                    onchange="saveAnnualComp('${t.id}','memo',this.value)"
                    onblur="saveAnnualComp('${t.id}','memo',this.value)"
                  >${esc(comp.memo||'')}</textarea>
                </div>
              </div>
            </div>` : '';
          return `
          <div class="annual-task-item" id="ann-item-${t.id}">
            <div class="annual-task-row" onclick="toggleAnnualDetail('${t.id}')"
              style="${(!isDone && isPastM)?'border-left:3px solid var(--red);padding-left:6px':''}">
              <div class="annual-check ${isDone?'checked':''}"
                onclick="event.stopPropagation();toggleAnnual('${t.id}')">${isDone?'✓':''}</div>
              <span class="annual-task-title ${isDone?'done':''}" ondblclick="event.stopPropagation();startAnnTitleEdit('${t.id}',this)" style="cursor:text" title="더블클릭으로 수정">${esc(t.title)}</span>
              <span class="annual-task-date">${isDone&&comp.date?fmtDateShort(comp.date):''}</span>
              <span style="font-size:10px;color:var(--text3);font-family:var(--mono)">${isOpen?'▲':'▼'}</span>
            </div>
            ${memoHtml}
          </div>`;
        }).join('') : '<div style="padding:8px 16px;font-size:12px;color:var(--text3)">업무 없음</div>'}
      </div>
    </div>`;
  }

  document.getElementById('annual-grid').innerHTML = html;
}

function toggleAnnualDetail(id) {
  if (annualOpenId === id) { annualOpenId = null; } else { annualOpenId = id; }
  renderAnnual();
  if (annualOpenId === id) {
    setTimeout(() => {
      const ta = document.getElementById('ann-memo-' + id);
      if (ta) { attachMemoTabKey(ta); autoGrowTextarea(ta); }
    }, 30);
  }
}
function toggleAnnual(id) {
  const yk = annKey();
  const t  = annualTasks.find(x => x.id === id); if (!t) return;
  if (!t.completions[yk]) t.completions[yk] = { done: false, date: '', memo: '' };
  t.completions[yk].done = !t.completions[yk].done;
  if (t.completions[yk].done && !t.completions[yk].date) t.completions[yk].date = today();
  updateLinkedStatus(id, 'annual', t.completions[yk].done);
  saveAnnual(); renderAnnual(); renderAll();
}
function saveAnnualComp(id, field, val) {
  const yk = annKey();
  const t  = annualTasks.find(x => x.id === id); if (!t) return;
  if (!t.completions[yk]) t.completions[yk] = { done: false, date: '', memo: '' };
  t.completions[yk][field] = val;
  saveAnnual();
}
function deleteAnnual(id) {
  if (!confirm('이 연간 업무를 삭제하시겠습니까?')) return;
  tasks = tasks.filter(t => !(t.linkedSourceId === id && t.linkedSourceType === 'annual'));
  annualTasks = annualTasks.filter(t => t.id !== id);
  annualOpenId = null;
  save(); saveAnnual(); renderAnnual(); renderAll(); toast('삭제됨');
}

let editingAnnualId = null;
let annualModalDefaultMonth = 1;
function openAnnualModal(month = null, id = null) {
  editingAnnualId = id;
  annualModalDefaultMonth = month || (calMonth + 1);
  const t = id ? annualTasks.find(x => x.id === id) : null;
  showRichModal({
    title: '연간 업무 ' + (id ? '수정' : '추가'),
    data: t,
    extraTop: (() => {
      const KOM=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
      const sel = KOM.map((lbl,i)=>`<option value="${i+1}" ${(t?t.month:annualModalDefaultMonth)===i+1?'selected':''}>${lbl}</option>`).join('');
      return `<div class="field"><div class="field-label">수행 월</div><select class="field-select" id="rm-month">${sel}</select></div>
        <div class="field-row">
          <div class="field"><div class="field-label">시작일</div><input type="date" class="field-input" id="rm-ann-start" value="${t?.startDate||''}"></div>
          <div class="field"><div class="field-label">마감일</div><input type="date" class="field-input" id="rm-ann-due" value="${t?.dueDate||''}"></div>
        </div>`;
    })(),
    onSave: (data) => {
      const m = parseInt(document.getElementById('rm-month').value);
      const annStart = document.getElementById('rm-ann-start')?.value || null;
      const annDue   = document.getElementById('rm-ann-due')?.value   || null;
      if (editingAnnualId) {
        const rec = annualTasks.find(x => x.id === editingAnnualId);
        Object.assign(rec, data, { month: m, startDate: annStart, dueDate: annDue });
        syncLinkedTask(rec, 'annual');
      } else {
        const rec = { id: genId(), month: m, completions: {}, startDate: annStart, dueDate: annDue, ...data };
        annualTasks.push(rec);
        syncLinkedTask(rec, 'annual');
      }
      saveAnnual(); renderAnnual(); renderAll(); return true;
    },
    onDelete: id ? () => deleteAnnual(id) : null,
  });
}

function startRecTitleEdit(id, spanEl) {
  const t = recurringTasks.find(x => x.id === id); if (!t) return;
  _inlineTitleEdit(spanEl, t.title, val => {
    t.title = val; saveRecurring(); renderRecurring(); toast('월간업무 제목 수정됨');
  });
}
function startAnnTitleEdit(id, spanEl) {
  const t = annualTasks.find(x => x.id === id); if (!t) return;
  _inlineTitleEdit(spanEl, t.title, val => {
    t.title = val; saveAnnual(); renderAnnual(); toast('연간업무 제목 수정됨');
  });
}

/**
 * 주간 업무 목록을 Excel(CSV)로 내보내기
 */
function exportWeeklyCSV() {
  const thisMon = getThisMonday();
  const nextMon = getNextMonday();
  const thisSun = new Date(nextMon); thisSun.setDate(nextMon.getDate() - 1);
  const isoStr  = d => d.toISOString().split('T')[0];
  const thisMonStr = isoStr(thisMon);
  const thisSunStr = isoStr(thisSun);

  const weekTasks = tasks.filter(t => {
    if (t.status === 'archived') return false;
    if (!t.startDate && !t.dueDate) return false;
    const s = t.startDate || t.dueDate;
    const e = t.dueDate   || t.startDate;
    return s <= thisSunStr && e >= thisMonStr;
  });

  if (!weekTasks.length) {
    toast('이번 주 내보낼 업무가 없습니다.');
    return;
  }

  // 우선순위 정렬 반영 (dashboard와 동일하게)
  const priOrder  = settings.priorities.map(p => p.key);
  const sortedTasks = [...weekTasks].sort((a,b) => priOrder.indexOf(a.priority) - priOrder.indexOf(b.priority));

  const headers = ['제목','카테고리','우선순위','상태','태그','시작일','마감일','완료일','메모'];
  const esc_csv = v => {
    const s = (v == null ? '' : String(v));
    return (s.includes(',') || s.includes('\n') || s.includes('"'))
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  };

  const rows = sortedTasks.map(t => [
    t.title,
    t.category   || '',
    priLabel(t.priority   || ''),
    statusLabel(t.status  || ''),
    (t.tags || []).join(' / '),
    t.startDate  || '',
    t.dueDate    || '',
    t.completedAt ? t.completedAt.slice(0,10) : '',
    (t.memo      || '').replace(/\n/g, ' '),
  ].map(esc_csv).join(','));

  const csv     = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob    = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const link    = document.createElement('a');
  link.href     = url;
  link.download = `weekly_tasks_${thisMonStr}_to_${thisSunStr}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast(`주간 업무 CSV 내보내기 완료 (${weekTasks.length}건)`);
}
