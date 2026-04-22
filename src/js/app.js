/******************************************************************************
FILE NAME   : app.js
DESCRIPTION : 어플리케이션 초기화, 내비게이션, 고수준 렌더링 오케스트레이션
DATA        : 2026-04-20
Modification: 2026-04-20
******************************************************************************/

/******************************************************************************
FUNCTION    : renderAll
DESCRIPTION : 모든 뷰(대시보드, 칸반, 업무대장, 배지, 필터)를 일괄 재렌더링.
              데이터 변경 후 UI 동기화 시 호출
RETURNED    : void
******************************************************************************/
function renderAll() {
  renderDashboard();
  renderKanban();
  renderLedger();
  updateBadges();
  updateFilterDropdowns();
}

/******************************************************************************
FUNCTION    : updateBadges
DESCRIPTION : 사이드바 내비게이션 배지 카운트를 현재 데이터 기준으로 갱신
RETURNED    : void
******************************************************************************/
function updateBadges() {
  const badgeDash = document.getElementById('badge-dashboard');
  const badgeKanban = document.getElementById('badge-kanban');
  const badgeLedger = document.getElementById('badge-ledger');
  const badgeContacts = document.getElementById('badge-contacts');

  if (badgeDash)     badgeDash.textContent = tasks.filter(t => t.status==='todo'||t.status==='inprogress').length;
  if (badgeKanban)   badgeKanban.textContent = tasks.filter(t => t.status==='inprogress').length;
  if (badgeLedger)   badgeLedger.textContent = tasks.length;
  if (badgeContacts) badgeContacts.textContent = contacts.length;
}

/******************************************************************************
FUNCTION    : updateFilterDropdowns
DESCRIPTION : 칸반 카테고리 필터 드롭다운 및 멀티셀렉트 라벨을 현재 데이터로 갱신
RETURNED    : void
******************************************************************************/
function updateFilterDropdowns() {
  // Kanban cat filter
  const kanbanCatFilter = document.getElementById('kanban-cat-filter');
  if (kanbanCatFilter) {
    const cats = [...new Set(tasks.flatMap(t => (t.category||'').split(',').map(s=>s.trim()).filter(Boolean)))].sort();
    kanbanCatFilter.innerHTML = ['<option value="">전체 카테고리</option>', ...cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`)].join('');
  }
  // 멀티셀렉트 라벨 갱신
  if (typeof updateMselLabel === 'function') {
    ['status','priority','cat'].forEach(t => updateMselLabel(t));
  }
}

// ── NAV ──────────────────────────────────────────────
/******************************************************************************
FUNCTION    : switchView
DESCRIPTION : 지정한 이름의 뷰를 활성화하고 해당 뷰의 렌더링 함수를 호출
PARAMETERS  : name string - 뷰 이름 (dashboard|kanban|ledger|contacts|inventory|settings|backup)
RETURNED    : void
******************************************************************************/
function switchView(name){
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const targetView = document.getElementById('view-' + name);
  if (targetView) targetView.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`[onclick="switchView('${name}')"]`);
  if (btn) btn.classList.add('active');

  if (name === 'dashboard') {
    requestAnimationFrame(() => renderCalendar());
  }
  if (name === 'contacts')  renderContacts();
  if (name === 'inventory') renderInventory();
  if (name === 'kanban')    renderKanban();
  if (name === 'ledger')    renderLedger();
  if (name === 'settings') {
    renderSettings();
    renderFontSelect();
    updateBackupUI();
  }
  if (name === 'backup') {
    updateBackupUI();
  }
}

// ── KEYBOARD ──────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (typeof closeModal === 'function') closeModal();
    if (typeof collapseExpand === 'function') collapseExpand();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    if (typeof openModal === 'function') openModal();
  }
});

// ── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  load();
  initIdCounter();
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
  applyFont(localStorage.getItem(FONT_KEY) || 'system');
  updateClock();
  setInterval(updateClock, 1000);
  renderAll();
  updateBackupUI();
  checkBackupAlert();

  // 초기 로드 시 캘린더 이벤트 바 확실히 렌더
  requestAnimationFrame(() => requestAnimationFrame(() => renderCalendar()));

  // 인벤토리 사이드바 버튼 연결
  const sbAdd = document.getElementById('inv-sb-add');
  if (sbAdd) sbAdd.onclick = () => {
    const n = prompt('새 대장 이름', '새 관리 대장');
    if (!n?.trim()) return;
    const nid = invGenId(), bc0 = invGenId(), bc1 = invGenId(), tid = invGenId();
    const nd = {
      activeTab: 0, colWidths: {}, rowHeights: {}, hiddenCols: [], tabMemos: {},
      baseCols: [{id: bc0, name: 'No', type: 'text', nodels: true}, {id: bc1, name: '항목명', type: 'text', nodels: true}],
      tabs: [{id: tid, name: '기본', cols: []}], rows: []
    };
    invLedgers.push({id: nid, name: n.trim(), data: nd});
    invSwitchLedger(nid);
  };

  const sbExport = document.getElementById('inv-sb-export');
  if (sbExport) sbExport.onclick = invExport;

  // 초기 데이터 샘플
  if (tasks.length === 0) {
    [
      {title:'FEP 거래소 연결 상태 점검',status:'inprogress',priority:'high',category:'FEP운영',tags:['긴급','모니터링'],startDate:today(),dueDate:today(),memo:'## 점검 항목\n\n- [x] L3 ping 확인\n- [ ] TCP 세션 확인\n- [ ] Heartbeat 응답 시간\n\n```bash\nss -tnp | grep :8080\n```\n\n**참고:** 거래소 방화벽 변경 이력 확인 필요'},
      {title:'OMS 장애 분석 보고서',status:'todo',priority:'medium',category:'보고',tags:['Oracle','OMS'],startDate:null,dueDate:null,memo:'## 원인\n\nPro*C implicit cursor 상태 오염 → **ORA-01403** 체인\n\n## 재발 방지\n\n- 오류 분기에 `EXEC SQL ROLLBACK` 명시'},
      {title:'CPU 코어 바인딩 최적화',status:'todo',priority:'low',category:'개발',tags:['Low-Latency','Linux'],startDate:null,dueDate:null,memo:''},
      {title:'증권투자권유자문인력 O/X 복습',status:'todo',priority:'high',category:'자격증',tags:['스터디'],startDate:null,dueDate:null,memo:''},
    ].forEach(s => createTask(s));
    renderAll();
  }
});
