/**
 * backup.js - 데이터 백업 및 복원 (JSON)
 */

const BACKUP_KEY     = 'taskflow_backup_meta';
const INV_BACKUP_KEY = 'taskflow_inventory_v3'; // inventory.js INV_KEY와 동일 키 (파일 경계 유지를 위해 localStorage 직접 접근)

function loadBackupMeta() {
  try { return JSON.parse(localStorage.getItem(BACKUP_KEY)) || {lastBackup:null, interval:7}; }
  catch { return {lastBackup:null, interval:7}; }
}
function saveBackupMeta(meta) { localStorage.setItem(BACKUP_KEY, JSON.stringify(meta)); }

async function doBackup() {
  // 인벤토리는 localStorage 키에서 직접 읽어 payload에 포함 (없으면 null)
  let inventory = null;
  try { inventory = JSON.parse(localStorage.getItem(INV_BACKUP_KEY)); } catch { inventory = null; }
  const payload = {tasks, settings, recurringTasks, annualTasks, contacts, schedules, inventory};
  const json = JSON.stringify(payload, null, 2);
  const filename = `taskflow_backup_${today()}.json`;
  const _finish = () => {
    const meta = loadBackupMeta();
    meta.lastBackup = new Date().toISOString();
    saveBackupMeta(meta);
    updateBackupUI();
    toast('백업 완료');
  };
  if (window.showSaveFilePicker) {
    try {
      const fh = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'JSON 백업', accept: {'application/json': ['.json']} }]
      });
      const writable = await fh.createWritable();
      await writable.write(json);
      await writable.close();
      _finish();
      return;
    } catch(e) {
      if (e.name === 'AbortError') return; // 사용자 취소
    }
  }
  // fallback: 기본 다운로드
  const blob = new Blob([json], {type:'application/json'});
  const a = document.createElement('a');
  const burl = URL.createObjectURL(blob);
  a.href = burl; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(burl), 1000);
  _finish();
}

function saveBackupInterval(val) {
  const meta = loadBackupMeta();
  const parsed = parseInt(val, 10);
  meta.interval = isNaN(parsed) ? 7 : parsed; // NaN 가드 — 기본값 7일
  saveBackupMeta(meta);
  updateBackupUI();
}

function updateBackupUI() {
  const meta  = loadBackupMeta();
  const badge = document.getElementById('backup-badge');
  const btn   = document.getElementById('backup-nav-btn');
  // 설정 뷰·백업 뷰 양쪽에 존재하므로 data-속성으로 전체 순회 갱신
  const disps = document.querySelectorAll('[data-backup="last-display"]');
  const sels  = document.querySelectorAll('[data-backup="interval"]');

  sels.forEach(sel => { sel.value = String(meta.interval ?? 7); });

  if (!meta.lastBackup) {
    if (badge) { badge.textContent = '!'; badge.className = 'backup-badge warn'; }
    disps.forEach(disp => { disp.textContent = '기록 없음'; disp.style.color = 'var(--red)'; });
    return;
  }

  const last = new Date(meta.lastBackup);
  const diffDays = Math.floor((Date.now() - last.getTime()) / 86400000);
  const interval = meta.interval ?? 7;
  const overdue  = interval > 0 && diffDays >= interval;

  const diffStr = diffDays === 0 ? '오늘' : diffDays === 1 ? '어제' : `${diffDays}일 전`;
  const fullStr = `${last.getFullYear()}.${String(last.getMonth()+1).padStart(2,'0')}.${String(last.getDate()).padStart(2,'0')} (${diffStr})`;

  if (badge) { badge.textContent = overdue ? '!' : ''; badge.className = overdue ? 'backup-badge warn' : 'backup-badge'; }
  if (btn) btn.classList.toggle('backup-overdue', overdue);
  disps.forEach(disp => { disp.textContent = fullStr; disp.style.color = overdue ? 'var(--red)' : 'var(--green)'; });
}

// 백업 주기 셀렉트 이벤트 바인딩 (인라인 onchange 대체 — 설정·백업 뷰 공용)
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-backup="interval"]').forEach(sel => {
    sel.addEventListener('change', e => saveBackupInterval(e.target.value));
  });
});

function checkBackupAlert() {
  const meta = loadBackupMeta();
  const interval = meta.interval ?? 7;
  if (interval === 0) return;
  if (!meta.lastBackup) {
    setTimeout(() => { if (confirm('📦 TASKFLOW\n\n아직 백업 기록이 없습니다.\n지금 바로 백업하시겠습니까?')) doBackup(); }, 1500);
    return;
  }
  const diffDays = Math.floor((Date.now() - new Date(meta.lastBackup).getTime()) / 86400000);
  if (diffDays >= interval) {
    setTimeout(() => { if (confirm(`📦 TASKFLOW 백업 알림\n\n마지막 백업으로부터 ${diffDays}일이 지났습니다.\n지금 백업하시겠습니까?`)) doBackup(); }, 1500);
  }
}

function importData(e){
  const file = e.target.files[0]; if(!file) return;
  const r = new FileReader();
  r.onload = ev => {
    let added = 0;
    let imported = false;
    try {
      const raw = JSON.parse(ev.target.result);
      const imp = Array.isArray(raw) ? raw : raw.tasks;
      if (!Array.isArray(imp)) throw new Error('배열 없음');
      // 필수 필드 정규화 — tags/status/priority/linkedTaskIds/assigneeIds 보장 (렌더 크래시 방지)
      const sanitizeTask = t => {
        if(typeof t !== 'object' || t === null) return null;
        const s = v => typeof v === 'string' ? v.slice(0,500) : v;
        return {
          ...t,
          title: s(t.title),
          category: typeof t.category === 'string' ? t.category.slice(0,500) : '',
          memo: typeof t.memo === 'string' ? t.memo.slice(0,10000) : '',
          status: typeof t.status === 'string' && t.status ? t.status : 'todo',
          priority: typeof t.priority === 'string' && t.priority ? t.priority : 'medium',
          tags: Array.isArray(t.tags) ? t.tags.filter(x => typeof x === 'string') : [],
          linkedTaskIds: Array.isArray(t.linkedTaskIds) ? t.linkedTaskIds : [],
          assigneeIds: Array.isArray(t.assigneeIds) ? t.assigneeIds : (t.assigneeId ? [t.assigneeId] : []),
        };
      };
      const ids = new Set(tasks.map(t => t.id));
      imp.forEach(rawTask => {
        const t = sanitizeTask(rawTask);
        if(t && !ids.has(t.id)){ tasks.push(t); ids.add(t.id); added++; }
      });
      if (!Array.isArray(raw) && raw.settings) {
        const strArr   = v => Array.isArray(v) && v.every(x => typeof x === 'string');
        const keyedArr = v => Array.isArray(v) && v.length > 0
          && v.every(x => x && typeof x === 'object' && typeof x.key === 'string' && typeof x.label === 'string');
        if(strArr(raw.settings.categories)) settings.categories = raw.settings.categories.map(s => s.slice(0,100));
        if(strArr(raw.settings.tags))       settings.tags = raw.settings.tags.map(s => s.slice(0,100));
        // priorities/statuses 복원 — core.js load() 마이그레이션과 동일 규칙 적용
        if(keyedArr(raw.settings.priorities)) {
          settings.priorities = raw.settings.priorities.map(p => ({
            key: p.key, label: p.label,
            color: typeof p.color === 'string' && p.color ? p.color : 'var(--text3)',
          }));
        }
        if(keyedArr(raw.settings.statuses)) {
          const defaultColors = {todo:'#5E6C88',inprogress:'#6AADFF',done:'#3DDC97',archived:'#3E4A5E'};
          settings.statuses = raw.settings.statuses.map(st => ({
            key: st.key, label: st.label,
            showInKanban:   st.showInKanban   === undefined ? (st.key !== 'archived') : !!st.showInKanban,
            showInCalendar: st.showInCalendar === undefined ? (st.key !== 'archived') : !!st.showInCalendar,
            color: typeof st.color === 'string' && st.color ? st.color : (defaultColors[st.key] || '#888888'),
          }));
        }
        saveSettings();
      }
      if (!Array.isArray(raw) && Array.isArray(raw.recurringTasks)) {
        const rids = new Set(recurringTasks.map(t => t.id));
        raw.recurringTasks.forEach(t => { if(!rids.has(t.id)) recurringTasks.push(t); });
        saveRecurring();
      }
      if (!Array.isArray(raw) && Array.isArray(raw.annualTasks)) {
        const aids = new Set(annualTasks.map(t => t.id));
        raw.annualTasks.forEach(t => { if(!aids.has(t.id)) annualTasks.push(t); });
        saveAnnual();
      }
      if (!Array.isArray(raw) && Array.isArray(raw.contacts)) {
        const cids = new Set(contacts.map(c => c.id));
        raw.contacts.forEach(c => { if(!cids.has(c.id)) contacts.push(c); });
        saveContacts();
      }
      if (!Array.isArray(raw) && Array.isArray(raw.schedules)) {
        const sids = new Set(schedules.map(s => s.id));
        raw.schedules.forEach(s => { if(!sids.has(s.id)) schedules.push(s); });
        saveSch();
      }
      // 인벤토리 복원 — 형태 검증 후 localStorage에 기록 (구버전 백업엔 inventory 없음 → 건너뜀)
      if (!Array.isArray(raw) && raw.inventory && typeof raw.inventory === 'object'
          && Array.isArray(raw.inventory.ledgers) && raw.inventory.ledgers.length) {
        localStorage.setItem(INV_BACKUP_KEY, JSON.stringify(raw.inventory));
      }
      save();          // tasks 영속화 (아래 load()가 localStorage를 재적재하므로 반드시 선행)
      load();          // 전역 상태 재적재 — 복원된 인벤토리 상태(invSt 등)도 함께 재구성
      initIdCounter(); // 가져온 숫자 ID와 신규 genId() 발급 충돌 방지
      imported = true;
    } catch(err) { toast('JSON 형식 오류: ' + err.message); }
    if (!imported) return;
    // 화면 갱신은 저장과 분리 — 렌더 오류가 "JSON 형식 오류"로 오보되지 않게
    try {
      renderAll(); renderSettings(); renderContacts();
      toast(`${added}개 업무 가져오기 완료`);
    } catch(err) {
      console.warn('[TASKFLOW] import render error', err);
      toast(`${added}개 업무 가져오기 완료 (화면 갱신 오류 — 새로고침 권장)`);
    }
  };
  r.readAsText(file); e.target.value = '';
}
