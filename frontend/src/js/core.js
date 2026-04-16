/**
 * core.js - 전역 상태 및 유틸리티
 */

// ── 전역 에러 핸들러 ────────────────────────────────
window.addEventListener('unhandledrejection', e => {
  console.warn('[TASKFLOW]', e.reason);
});

// ── STORAGE KEYS ──────────────────────────────────────
const TASK_KEY      = 'taskflow_v3';
const SETTINGS_KEY  = 'taskflow_settings_v1';
const THEME_KEY     = 'taskflow_theme';
const FONT_KEY      = 'taskflow_font';
const RECURRING_KEY = 'taskflow_recurring_v1';
const ANNUAL_KEY    = 'taskflow_annual_v1';
const CONTACT_KEY   = 'taskflow_contacts_v1';
const SCHEDULE_KEY  = 'taskflow_schedules_v1';

// ── STATE ─────────────────────────────────────────────
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
function load() {
  try { tasks = JSON.parse(localStorage.getItem(TASK_KEY)) || []; } catch { tasks = []; }
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
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
  } catch {}
  try { recurringTasks = JSON.parse(localStorage.getItem(RECURRING_KEY)) || []; } catch { recurringTasks = []; }
  try { annualTasks    = JSON.parse(localStorage.getItem(ANNUAL_KEY))    || []; } catch { annualTasks = []; }
  try { contacts       = JSON.parse(localStorage.getItem(CONTACT_KEY))   || []; } catch { contacts = []; }
  try { schedules      = JSON.parse(localStorage.getItem(SCHEDULE_KEY))  || []; } catch { schedules = []; }
  try {
    const _invRaw = invLoadData();
    invLedgers = _invRaw.ledgers;
    invActiveLedgerId = _invRaw.activeLedger;
    invSt = invMakeState(invLedgers.find(l=>l.id===invActiveLedgerId)?.data || _invRaw.ledgers[0].data);
  } catch(e) { console.warn('inv init error',e); invLedgers=[]; invActiveLedgerId=null; invSt=null; }
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
function save()           { localStorage.setItem(TASK_KEY,      JSON.stringify(tasks)); }
function saveSettings()   { localStorage.setItem(SETTINGS_KEY,  JSON.stringify(settings)); }
function saveRecurring()  { localStorage.setItem(RECURRING_KEY, JSON.stringify(recurringTasks)); }
function saveAnnual()     { localStorage.setItem(ANNUAL_KEY,    JSON.stringify(annualTasks)); }
function saveContacts()   { localStorage.setItem(CONTACT_KEY,   JSON.stringify(contacts)); }

// ── ID GENERATION: 순번 기반 (0, 1, 2, ...)
let _idCounter = -1;
function genId() {
  _idCounter++;
  return String(_idCounter);
}
function initIdCounter() {
  // 기존 데이터에서 숫자 ID의 최댓값을 찾아 이어서 부여
  let max = -1;
  [...tasks, ...recurringTasks, ...annualTasks].forEach(t => {
    const n = parseInt(t.id, 10);
    if (!isNaN(n) && n > max) max = n;
  });
  _idCounter = max; // 다음 genId() 호출 시 max+1 반환
}

function today()          { return new Date().toISOString().split('T')[0]; }
function fmtDate(iso)     { if (!iso) return '—'; const [y,m,d]=iso.split('-'); return `${y}.${m}.${d}`; }
function fmtDateShort(iso){ if (!iso) return ''; const [,m,d]=iso.split('-'); return `${m}/${d}`; }
function isOverdue(t)     { if (!t.dueDate||t.status==='done'||t.status==='archived') return false; return t.dueDate < today(); }
function esc(s)           { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

function priInfo(key)    { return settings.priorities.find(p=>p.key===key) || {key,label:key,color:'var(--text3)'}; }
function statusInfo(key) { return settings.statuses.find(s=>s.key===key)   || {key,label:key}; }
function priClass(p)     { return {critical:'pri-critical',high:'pri-high',medium:'pri-medium',low:'pri-low'}[p]||'pri-low'; }
function accentColor(p)  { return priInfo(p).color; }
function priStyle(key) {
  let c = accentColor(key);
  const varMap={'var(--orange)':'#F07040','var(--red)':'#E05C6A','var(--amber)':'#F4A832','var(--text3)':'#424E66','var(--blue)':'#6AADFF','var(--green)':'#3DDC97'};
  if (c.startsWith('var(')) c = varMap[c] || '#888888';
  if (!c.startsWith('#')) c = '#888888';
  const r=parseInt(c.slice(1,3),16), g=parseInt(c.slice(3,5),16), b=parseInt(c.slice(5,7),16);
  return `background:rgba(${r},${g},${b},.18);color:${c};border:1px solid rgba(${r},${g},${b},.35);`;
}
function priLabel(p)     { return priInfo(p).label; }
function statusLabel(s)  { return statusInfo(s).label; }
function statusColor(s)  {
  const info = statusInfo(s);
  return info.color || '#5E6C88';
}
// statusClass는 이제 동적 색상 인라인 스타일로 대체 — 하위 호환용으로 유지
function statusClass(s)  { return 'status-dynamic'; }
// 상태 배지 HTML 생성 (인라인 색상 적용)
function statusBadge(s) {
  const col = statusColor(s);
  const lbl = statusLabel(s);
  return `<span class="status status-dynamic" style="color:${col};background:${col}22;border:1px solid ${col}44">${esc(lbl)}</span>`;
}
