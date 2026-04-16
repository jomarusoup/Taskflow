/**
 * backup.js - 데이터 백업 및 복원 (JSON)
 */

const BACKUP_KEY = 'taskflow_backup_meta';

function loadBackupMeta() {
  try { return JSON.parse(localStorage.getItem(BACKUP_KEY)) || {lastBackup:null, interval:7}; }
  catch { return {lastBackup:null, interval:7}; }
}
function saveBackupMeta(meta) { localStorage.setItem(BACKUP_KEY, JSON.stringify(meta)); }

async function doBackup() {
  const payload = {tasks, settings, recurringTasks, annualTasks, contacts, schedules};
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
  meta.interval = parseInt(val);
  saveBackupMeta(meta);
  updateBackupUI();
}

function updateBackupUI() {
  const meta = loadBackupMeta();
  const badge = document.getElementById('backup-badge');
  const btn   = document.getElementById('backup-nav-btn');
  const disp  = document.getElementById('last-backup-display');
  const sel   = document.getElementById('backup-interval-sel');

  if (sel) sel.value = String(meta.interval ?? 7);

  if (!meta.lastBackup) {
    if (badge) { badge.textContent = '!'; badge.className = 'backup-badge warn'; }
    if (disp)  { disp.textContent = '기록 없음'; disp.style.color = 'var(--red)'; }
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
  if (disp) { disp.textContent = fullStr; disp.style.color = overdue ? 'var(--red)' : 'var(--green)'; }
}

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
    try {
      const raw = JSON.parse(ev.target.result);
      const imp = Array.isArray(raw) ? raw : raw.tasks;
      if (!Array.isArray(imp)) throw new Error('배열 없음');
      const sanitizeTask = t => {
        if(typeof t !== 'object' || t === null) return null;
        const s = v => typeof v === 'string' ? v.slice(0,500) : v;
        return { ...t, title: s(t.title), category: s(t.category), memo: typeof t.memo === 'string' ? t.memo.slice(0,10000) : t.memo };
      };
      const ids = new Set(tasks.map(t => t.id)); let added = 0;
      imp.forEach(rawTask => { const t = sanitizeTask(rawTask); if(t && !ids.has(t.id)){ tasks.push(t); added++; } });
      if (!Array.isArray(raw) && raw.settings) {
        const strArr = v => Array.isArray(v) && v.every(x => typeof x === 'string');
        if(strArr(raw.settings.categories)) settings.categories = raw.settings.categories.map(s => s.slice(0,100));
        if(strArr(raw.settings.tags))       settings.tags = raw.settings.tags.map(s => s.slice(0,100));
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
      save(); renderAll(); renderSettings(); renderContacts(); toast(`${added}개 업무 가져오기 완료`);
    } catch(err) { toast('JSON 형식 오류: ' + err.message); }
  };
  r.readAsText(file); e.target.value = '';
}
