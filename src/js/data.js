/******************************************************************************
FILE NAME   : data.js
DESCRIPTION : 업무(Task) CRUD, 월간·연간 업무 연동 태스크 동기화 로직
DATA        : 2026-04-20
Modification: 2026-04-20
******************************************************************************/

// ── TASK CRUD ─────────────────────────────────────────
/******************************************************************************
FUNCTION    : createTask
DESCRIPTION : 새 업무 객체를 생성하고 tasks[] 배열 앞에 추가 후 저장
PARAMETERS  : data object - 업무 초기값 (title, status, priority, category, tags, ...)
RETURNED    : object - 생성된 업무 객체
******************************************************************************/
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
/******************************************************************************
FUNCTION    : updateTask
DESCRIPTION : 지정 ID의 업무 필드를 갱신. done 상태 전환 시 completedAt 자동 처리
PARAMETERS  : id   string - 업무 ID
              data object - 변경할 필드 객체
RETURNED    : void
******************************************************************************/
function updateTask(id, data) {
  const t = tasks.find(x => x.id === id); if (!t) return;
  Object.assign(t, data, { updatedAt: new Date().toISOString() });
  if (data.status === 'done' && !t.completedAt) t.completedAt = new Date().toISOString();
  if (data.status && data.status !== 'done') t.completedAt = null;
  save();
}
/* deleteTask: 지정 ID의 업무를 배열에서 제거하고 저장 */
function deleteTask(id) { tasks = tasks.filter(t => t.id !== id); save(); }
/* archiveDone: done 상태인 모든 업무를 archived로 일괄 전환 */
function archiveDone()  { let c=0; tasks.forEach(t=>{if(t.status==='done'){t.status='archived';c++;}}); save(); renderAll(); toast(`${c}개 아카이브 완료`); }

// ── RECURRING / ANNUAL SYNC ──────────────────────────
/* helper: last day of month as ISO string */
function lastDayOfMonth(y, m) { return new Date(y, m, 0).toISOString().split('T')[0]; }
/* helper: first day of month as ISO string */
function firstDayOfMonth(y, m) { return `${y}-${String(m).padStart(2,'0')}-01`; }

/******************************************************************************
FUNCTION    : syncLinkedTask
DESCRIPTION : 월간·연간 업무 원본(src)에 연결된 tasks[] 항목을 생성 또는 갱신.
              연결 태스크가 없으면 새로 생성, 있으면 제목·우선순위·카테고리 동기화
PARAMETERS  : src        object - 원본 업무 (recurringTask 또는 annualTask)
              sourceType string - 'recurring' | 'annual'
RETURNED    : object - 연결된 tasks[] 항목
******************************************************************************/
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

/******************************************************************************
FUNCTION    : updateLinkedStatus
DESCRIPTION : 월간·연간 업무 완료 체크 시 연결 태스크의 상태를 done/todo로 전환
PARAMETERS  : srcId      string  - 원본 업무 ID
              sourceType string  - 'recurring' | 'annual'
              done       boolean - true: done, false: todo 복원
RETURNED    : void
******************************************************************************/
function updateLinkedStatus(srcId, sourceType, done) {
  const linked = tasks.find(t => t.linkedSourceId === srcId && t.linkedSourceType === sourceType);
  if (!linked) return;
  linked.status = done ? 'done' : (linked.status === 'done' ? 'todo' : linked.status);
  if (done && !linked.completedAt) linked.completedAt = new Date().toISOString();
  if (!done) linked.completedAt = null;
  linked.updatedAt = new Date().toISOString();
  save();
}
