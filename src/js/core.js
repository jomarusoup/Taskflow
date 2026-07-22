/******************************************************************************
FILE NAME   : core.js
DESCRIPTION : 전역 상태 관리, 번들 하이드레이션(load), 공통 유틸리티 함수
DATA        : 2026-04-20
Modification: 2026-04-20
******************************************************************************/

// ── 전역 에러 핸들러 ────────────────────────────────
window.addEventListener('unhandledrejection', e => {
  console.warn('[TASKFLOW]', e.reason);
});

// ── STATE ─────────────────────────────────────────────
// 데이터 영속은 store.js(File System Access API + data.json)가 전담한다.
// 저장은 persistStore(), 로드는 g_Bundle 하이드레이션을 경유한다.
let tasks = [];
let settings = {
  categories: ['FEP운영','OMS운영','개발','보고','자격증','기타'],
  tags: ['긴급','모니터링','장애','Oracle','OMS','Low-Latency','Linux','스터디'],
  priorities: [
    {key:'critical', label:'Critical', color:'var(--orange)'},
    {key:'high',     label:'High',    color:'var(--red)'},
    {key:'medium',   label:'Medium',  color:'var(--amber)'},
    {key:'low',      label:'Low',     color:'var(--text3)'},
  ],
  statuses: [
    {key:'todo',       label:'To Do',       showInKanban:true,  showInCalendar:true,  color:'#5E6C88'},
    {key:'inprogress', label:'In Progress',  showInKanban:true,  showInCalendar:true,  color:'#6AADFF'},
    {key:'done',       label:'Done',         showInKanban:true,  showInCalendar:true,  color:'#3DDC97'},
    {key:'archived',   label:'Archived',     showInKanban:false, showInCalendar:false, color:'#3E4A5E'},
  ],
};
let editingId = null;
let dragSrcId = null;
let expandedId = null;
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let calSelectedDate = null;
let _calRafId = null; // rAF 중복 등록 방지
let selectedTags = [];
let selectedCategories = [];
let selectedLinkedTasks = [];
let selectedAssignees = [];
let selectedContactCats = [];
let contactCategoryRoles = {}; // {category: 'main'|'sub'}
// recurring & annual
let recurringTasks = [];
let annualTasks    = [];
let contacts       = []; // {id,name,dept,phone,email,category,memo}
let schedules      = []; // {id,title,date,startTime,endTime,color,memo}

// ── DATA LAYER ────────────────────────────────────────
/******************************************************************************
FUNCTION    : load
DESCRIPTION : store.js가 로드한 g_Bundle에서 모든 데이터를 읽어 전역 변수에 초기화.
              스키마 마이그레이션(assigneeIds, categoryRoles 등)도 함께 수행
RETURNED    : void
******************************************************************************/
function load() {
  const b = (typeof g_Bundle === 'object' && g_Bundle) ? g_Bundle : {};
  tasks = Array.isArray(b.tasks) ? b.tasks : [];
  const s = b.settings;
  if (s) {
    if (s.categories) settings.categories = s.categories;
    if (s.tags)       settings.tags       = s.tags;
    if (s.priorities) settings.priorities = s.priorities;
    if (s.statuses) {
      settings.statuses = s.statuses;
      // migrate: ensure showInKanban and color exist
      const defaultColors = {todo:'#5E6C88',inprogress:'#6AADFF',done:'#3DDC97',archived:'#3E4A5E'};
      settings.statuses.forEach(st => {
        if (st.showInKanban === undefined) st.showInKanban = (st.key !== 'archived');
        if (st.showInCalendar === undefined) st.showInCalendar = (st.key !== 'archived');
        if (!st.color) st.color = defaultColors[st.key] || '#888888';
      });
    }
  }
  recurringTasks = Array.isArray(b.recurring) ? b.recurring : [];
  annualTasks    = Array.isArray(b.annual)    ? b.annual    : [];
  contacts       = Array.isArray(b.contacts)  ? b.contacts  : [];
  schedules      = Array.isArray(b.schedules) ? b.schedules : [];
  try {
    const _invRaw = invLoadData();
    invLedgers = _invRaw.ledgers;
    invActiveLedgerId = _invRaw.activeLedger;
    invSt = invMakeState(invLedgers.find(l=>l.id===invActiveLedgerId)?.data || _invRaw.ledgers[0].data);
  } catch(e) { console.warn('inv init error',e); invLedgers=[]; invActiveLedgerId=null; invSt=null; }
  // UI(테마·폰트) 및 백업 메타 초기화
  g_UiTheme    = (b.ui && b.ui.theme) || 'dark';
  g_UiFont     = (b.ui && b.ui.font)  || 'system';
  g_BackupMeta = b.backupMeta || {lastBackup:null, interval:7};
  // migrate: ensure linkedTaskIds exists
  tasks.forEach(t => {
    if (!t.linkedTaskIds) t.linkedTaskIds = [];
    // migrate: assigneeId → assigneeIds[]
    if (!t.assigneeIds) t.assigneeIds = t.assigneeId ? [t.assigneeId] : [];
  });
  // migrate: contacts[].category → categories[]
  contacts.forEach(c => {
    if (!c.categories) c.categories = c.category ? [c.category] : [];
    // migrate: type → categoryRoles[]
    if (!c.categoryRoles) c.categoryRoles = c.categories.map(cat => ({category: cat, role: c.type || 'main'}));
  });
}
/* 각 데이터 유형 저장 래퍼 — 모두 store.js의 persistStore()로 위임(파일 자동저장) */
function save()           { persistStore(); }
function saveSettings()   { persistStore(); }
function saveRecurring()  { persistStore(); }
function saveAnnual()     { persistStore(); }
function saveContacts()   { persistStore(); }

// ── ID GENERATION: 순번 기반 (0, 1, 2, ...)
let _idCounter = -1;

/******************************************************************************
FUNCTION    : genId
DESCRIPTION : 순번 기반 고유 ID 생성. 호출마다 1씩 증가
RETURNED    : string - 숫자 문자열 ID
******************************************************************************/
function genId() {
  _idCounter++;
  return String(_idCounter);
}
/******************************************************************************
FUNCTION    : initIdCounter
DESCRIPTION : 기존 데이터의 최대 숫자 ID를 찾아 _idCounter를 초기화.
              앱 시작 시 한 번 호출해야 ID 중복을 방지함
RETURNED    : void
******************************************************************************/
function initIdCounter() {
  // 기존 데이터에서 숫자 ID의 최댓값을 찾아 이어서 부여
  let max = -1;
  [...tasks, ...recurringTasks, ...annualTasks].forEach(t => {
    const n = parseInt(t.id, 10);
    if (!isNaN(n) && n > max) max = n;
  });
  _idCounter = max; // 다음 genId() 호출 시 max+1 반환
}

/* today: 로컬 시간 기준 오늘 날짜를 YYYY-MM-DD 형식으로 반환 */
function today()          { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
/* fmtDate: ISO 날짜(YYYY-MM-DD)를 YYYY.MM.DD 형식으로 변환 */
function fmtDate(iso)     { if (!iso) return '—'; const [y,m,d]=iso.split('-'); return `${y}.${m}.${d}`; }
/* fmtDateShort: ISO 날짜에서 MM/DD 형식만 반환 */
function fmtDateShort(iso){ if (!iso) return ''; const [,m,d]=iso.split('-'); return `${m}/${d}`; }
/* isOverdue: 업무의 마감일이 오늘보다 이전이고 미완료 상태인지 확인 */
function isOverdue(t)     { if (!t.dueDate||t.status==='done'||t.status==='archived') return false; return t.dueDate < today(); }
/* esc: HTML 특수문자를 이스케이프하여 XSS 방지 */
function esc(s)           { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

/* priInfo: 우선순위 키로 설정 객체({key,label,color}) 반환 */
function priInfo(key)    { return settings.priorities.find(p=>p.key===key) || {key,label:key,color:'var(--text3)'}; }
/* statusInfo: 상태 키로 설정 객체({key,label,color}) 반환 */
function statusInfo(key) { return settings.statuses.find(s=>s.key===key)   || {key,label:key}; }
/* priClass: 우선순위 키를 CSS 클래스명으로 변환 */
function priClass(p)     { return {critical:'pri-critical',high:'pri-high',medium:'pri-medium',low:'pri-low'}[p]||'pri-low'; }
/* accentColor: 우선순위 키에 해당하는 색상 문자열 반환 */
function accentColor(p)  { return priInfo(p).color; }

/******************************************************************************
FUNCTION    : priStyle
DESCRIPTION : 우선순위 키를 인라인 CSS 스타일 문자열로 변환.
              CSS 변수를 실제 HEX 값으로 해석하여 rgba 배경색 생성
PARAMETERS  : key string - 우선순위 키 (critical|high|medium|low)
RETURNED    : string - background/color/border 인라인 스타일 문자열
******************************************************************************/
function priStyle(key) {
  let c = accentColor(key);
  const varMap={'var(--orange)':'#F07040','var(--red)':'#E05C6A','var(--amber)':'#F4A832','var(--text3)':'#424E66','var(--blue)':'#6AADFF','var(--green)':'#3DDC97'};
  if (c.startsWith('var(')) c = varMap[c] || '#888888';
  if (!c.startsWith('#')) c = '#888888';
  const r=parseInt(c.slice(1,3),16), g=parseInt(c.slice(3,5),16), b=parseInt(c.slice(5,7),16);
  return `background:rgba(${r},${g},${b},.18);color:${c};border:1px solid rgba(${r},${g},${b},.35);`;
}
/* priLabel: 우선순위 키를 표시 레이블로 변환 */
function priLabel(p)     { return priInfo(p).label; }
/* statusLabel: 상태 키를 표시 레이블로 변환 */
function statusLabel(s)  { return statusInfo(s).label; }
/* statusColor: 상태 키에 해당하는 색상 코드 반환 */
function statusColor(s)  {
  const info = statusInfo(s);
  return info.color || '#5E6C88';
}
/* statusClass: 하위 호환용 — 동적 색상 인라인 스타일로 대체됨 */
function statusClass(s)  { return 'status-dynamic'; }

/******************************************************************************
FUNCTION    : statusBadge
DESCRIPTION : 상태 키를 인라인 색상이 적용된 배지 HTML 문자열로 생성
PARAMETERS  : s string - 상태 키 (todo|inprogress|done|archived)
RETURNED    : string - <span> 배지 HTML
******************************************************************************/
function statusBadge(s) {
  const col = statusColor(s);
  const lbl = statusLabel(s);
  return `<span class="status status-dynamic" style="color:${col};background:${col}22;border:1px solid ${col}44">${esc(lbl)}</span>`;
}
