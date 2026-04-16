/**
 * data.js - 업무(Task) 및 정기/연간 업무 CRUD 및 동기화 로직
 */

// ── TASK CRUD ─────────────────────────────────────────
function createTask(data) {
  const now = new Date().toISOString();
  const t = {
    id: genId(), title: data.title, status: data.status || 'todo',
    priority: data.priority || 'medium', category: data.category || '',
    tags: data.tags || [], createdAt: now, updatedAt: now,
    startDate: data.startDate || null, dueDate: data.dueDate || null,
    completedAt: data.status === 'done' ? now : null, memo: data.memo || '',
    linkedTaskIds: data.linkedTaskIds || [],
  };
  tasks.unshift(t); save(); return t;
}
function updateTask(id, data) {
  const t = tasks.find(x => x.id === id); if (!t) return;
  Object.assign(t, data, { updatedAt: new Date().toISOString() });
  if (data.status === 'done' && !t.completedAt) t.completedAt = new Date().toISOString();
  if (data.status && data.status !== 'done') t.completedAt = null;
  save();
}
function deleteTask(id) { tasks = tasks.filter(t => t.id !== id); save(); }
function archiveDone()  { let c=0; tasks.forEach(t=>{if(t.status==='done'){t.status='archived';c++;}}); save(); renderAll(); toast(`${c}개 아카이브 완료`); }

// ── RECURRING / ANNUAL SYNC ──────────────────────────
/* helper: last day of month as ISO string */
function lastDayOfMonth(y, m) { return new Date(y, m, 0).toISOString().split('T')[0]; }
/* helper: first day of month as ISO string */
function firstDayOfMonth(y, m) { return `${y}-${String(m).padStart(2,'0')}-01`; }

/* ── sync linked task (create or update in tasks[]) ── */
function syncLinkedTask(src, sourceType) {
  // find existing
  let linked = tasks.find(t => t.linkedSourceId === src.id && t.linkedSourceType === sourceType);
  if (!linked) {
    // create
    const now = new Date().toISOString();
    linked = {
      id: genId(),
      linkedSourceId: src.id,
      linkedSourceType: sourceType,
      title: src.title,
      status: src.status || 'todo',
      priority: src.priority || 'medium',
      category: src.category || '',
      tags: [...(src.tags || [])],
      createdAt: now, updatedAt: now,
      startDate: sourceType === 'recurring'
        ? firstDayOfMonth(calYear, calMonth + 1)
        : firstDayOfMonth(annualYear, src.month),
      dueDate: sourceType === 'recurring'
        ? lastDayOfMonth(calYear, calMonth + 1)
        : lastDayOfMonth(annualYear, src.month),
      completedAt: null,
      memo: '',
    };
    tasks.unshift(linked);
  } else {
    Object.assign(linked, {
      title: src.title,
      priority: src.priority || 'medium',
      category: src.category || '',
      tags: [...(src.tags || [])],
      status: linked.status, // preserve current status
      updatedAt: new Date().toISOString(),
    });
  }
  save();
  return linked;
}

/* toggle linked task status when completion checked */
function updateLinkedStatus(srcId, sourceType, done) {
  const linked = tasks.find(t => t.linkedSourceId === srcId && t.linkedSourceType === sourceType);
  if (!linked) return;
  linked.status = done ? 'done' : (linked.status === 'done' ? 'todo' : linked.status);
  if (done && !linked.completedAt) linked.completedAt = new Date().toISOString();
  if (!done) linked.completedAt = null;
  linked.updatedAt = new Date().toISOString();
  save();
}
