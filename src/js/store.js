/*#############################################################################
FILE NAME   : store.js
DESCRIPTION : 데이터 영속 계층 — File System Access API 기반 단일 JSON 파일 저장.
              localStorage 미사용(브라우저 저장소 오염 없음). 데이터는 사용자가
              고른 data.json 파일 하나에만 보관하며, 파일 위치 포인터(핸들)만
              IndexedDB에 저장해 다음 실행 시 재선택을 생략한다.
DATA        : 2026-07-22
Modification: 2026-07-22
#############################################################################*/

// ── 전역 상태 ────────────────────────────────────────
let g_FileHandle  = null;   // FileSystemFileHandle — 활성 data.json
let g_Bundle      = null;   // 부팅 시 로드한 번들 (하이드레이션 소스)
let g_StoreReady  = false;  // 저장 계층 준비 완료 여부
let _persistTimer = null;   // 디바운스 타이머

// ── 파일 핸들 보관용 IndexedDB (데이터 저장 아님) ──────
const IDB_NAME  = 'taskflow_store';
const IDB_STORE = 'handles';
const IDB_KEY   = 'dataFile';

// ── 마이그레이션 대상 레거시 localStorage 키 ──────────
const LEGACY_KEYS = [
  'taskflow_v3', 'taskflow_settings_v1', 'taskflow_recurring_v1',
  'taskflow_annual_v1', 'taskflow_contacts_v1', 'taskflow_schedules_v1',
  'taskflow_inventory_v3', 'taskflow_inventory_v2',
  'taskflow_theme', 'taskflow_font', 'taskflow_backup_meta',
];

/*=============================================================================
FUNCTION    : idbOpen
DESCRIPTION : 핸들 보관용 IndexedDB 연결. 최초 호출 시 objectStore 생성
RETURNED    : Promise<IDBDatabase>
=============================================================================*/
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(IDB_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/*=============================================================================
FUNCTION    : idbGetHandle
DESCRIPTION : 이전에 사용한 파일 핸들을 IndexedDB에서 조회
RETURNED    : Promise<FileSystemFileHandle|null>
=============================================================================*/
async function idbGetHandle() {
  try {
    const db = await idbOpen();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const rq = tx.objectStore(IDB_STORE).get(IDB_KEY);
      rq.onsuccess = () => resolve(rq.result || null);
      rq.onerror   = () => reject(rq.error);
    });
  } catch (e) {
    return null;
  }
}

/*=============================================================================
FUNCTION    : idbSetHandle
DESCRIPTION : 활성 파일 핸들을 IndexedDB에 저장(다음 실행 시 재사용)
PARAMETERS  : FileSystemFileHandle handle - 저장할 파일 핸들
RETURNED    : Promise<void>
=============================================================================*/
async function idbSetHandle(handle) {
  try {
    const db = await idbOpen();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('[TASKFLOW] 파일 핸들 저장 실패', e);
  }
}

/*=============================================================================
FUNCTION    : idbClearHandle
DESCRIPTION : 저장된 파일 핸들 삭제(파일 연결 해제 시)
RETURNED    : Promise<void>
=============================================================================*/
async function idbClearHandle() {
  try {
    const db = await idbOpen();
    await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => resolve();
    });
  } catch (e) { /* 무시 */ }
}

/*=============================================================================
FUNCTION    : defaultBundle
DESCRIPTION : 빈 데이터 번들 생성(신규 파일 초기값)
RETURNED    : object - 기본 번들
=============================================================================*/
function defaultBundle() {
  return {
    version:    1,
    savedAt:    null,
    tasks:      [],
    settings:   null,
    recurring:  [],
    annual:     [],
    contacts:   [],
    schedules:  [],
    inventory:  { activeLedger: null, ledgers: [] },
    ui:         { theme: 'dark', font: 'system' },
    backupMeta: { lastBackup: null, interval: 7 },
  };
}

/*=============================================================================
FUNCTION    : normalizeBundle
DESCRIPTION : 파일에서 읽은 원본 JSON을 안전한 번들 형태로 정규화
PARAMETERS  : unknown raw - JSON.parse 결과
RETURNED    : object - 정규화된 번들
=============================================================================*/
function normalizeBundle(raw) {
  const b = defaultBundle();
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    if (Array.isArray(raw.tasks))     b.tasks     = raw.tasks;
    if (raw.settings)                 b.settings  = raw.settings;
    if (Array.isArray(raw.recurring)) b.recurring = raw.recurring;
    if (Array.isArray(raw.annual))    b.annual    = raw.annual;
    if (Array.isArray(raw.contacts))  b.contacts  = raw.contacts;
    if (Array.isArray(raw.schedules)) b.schedules = raw.schedules;
    if (raw.inventory && Array.isArray(raw.inventory.ledgers)) b.inventory = raw.inventory;
    if (raw.ui)         b.ui         = { ...b.ui, ...raw.ui };
    if (raw.backupMeta) b.backupMeta = raw.backupMeta;
  }
  return b;
}

/*=============================================================================
FUNCTION    : collectBundle
DESCRIPTION : 현재 전역 상태를 파일 저장용 번들로 조립
RETURNED    : object - 번들
=============================================================================*/
function collectBundle() {
  if (typeof invSyncActive === 'function') invSyncActive();
  return {
    version:    1,
    savedAt:    new Date().toISOString(),
    tasks:      tasks,
    settings:   settings,
    recurring:  recurringTasks,
    annual:     annualTasks,
    contacts:   contacts,
    schedules:  schedules,
    inventory:  { activeLedger: invActiveLedgerId, ledgers: invLedgers },
    ui:         { theme: g_UiTheme, font: g_UiFont },
    backupMeta: g_BackupMeta,
  };
}

/*=============================================================================
FUNCTION    : verifyPermission
DESCRIPTION : 파일 핸들의 읽기/쓰기 권한 확인 및 요청(사용자 제스처 필요)
PARAMETERS  : FileSystemFileHandle handle - 대상 핸들
              boolean readWrite            - 쓰기 권한 필요 여부
RETURNED    : Promise<boolean> - 권한 획득 여부
=============================================================================*/
async function verifyPermission(handle, readWrite) {
  const opts = readWrite ? { mode: 'readwrite' } : { mode: 'read' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  if ((await handle.requestPermission(opts)) === 'granted') return true;
  return false;
}

/*=============================================================================
FUNCTION    : readBundleFromFile
DESCRIPTION : 파일 핸들에서 JSON을 읽어 번들로 파싱
PARAMETERS  : FileSystemFileHandle handle - 대상 핸들
RETURNED    : Promise<object> - 정규화된 번들
=============================================================================*/
async function readBundleFromFile(handle) {
  const file = await handle.getFile();
  const text = await file.text();
  if (!text.trim()) return defaultBundle();
  return normalizeBundle(JSON.parse(text));
}

/*=============================================================================
FUNCTION    : writeBundleToFile
DESCRIPTION : 번들을 JSON으로 직렬화해 파일에 기록(전체 덮어쓰기)
PARAMETERS  : FileSystemFileHandle handle - 대상 핸들
              object bundle                - 저장할 번들
RETURNED    : Promise<void>
=============================================================================*/
async function writeBundleToFile(handle, bundle) {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(bundle, null, 2));
  await writable.close();
}

/*=============================================================================
FUNCTION    : persistStore
DESCRIPTION : 변경사항을 디바운스(500ms) 후 파일에 자동 저장.
              모든 save 계열 래퍼가 이 함수를 호출한다.
RETURNED    : void
=============================================================================*/
function persistStore() {
  if (!g_StoreReady || !g_FileHandle) return;
  clearTimeout(_persistTimer);
  _persistTimer = setTimeout(_flushStore, 500);
}

/*=============================================================================
FUNCTION    : _flushStore
DESCRIPTION : 디바운스 없이 즉시 파일에 저장
RETURNED    : Promise<void>
=============================================================================*/
async function _flushStore() {
  if (!g_StoreReady || !g_FileHandle) return;
  clearTimeout(_persistTimer);
  try {
    await writeBundleToFile(g_FileHandle, collectBundle());
  } catch (e) {
    console.warn('[TASKFLOW] 저장 실패', e);
    if (typeof toast === 'function') toast('저장 실패: ' + (e && e.message || e));
  }
}

// ── 레거시 localStorage 마이그레이션 ─────────────────
/*=============================================================================
FUNCTION    : detectLegacy
DESCRIPTION : 이전 버전 localStorage 데이터 존재 여부 확인
RETURNED    : boolean
=============================================================================*/
function detectLegacy() {
  try {
    return LEGACY_KEYS.some(k => localStorage.getItem(k) !== null);
  } catch (e) {
    return false;
  }
}

/*=============================================================================
FUNCTION    : buildBundleFromLegacy
DESCRIPTION : 기존 localStorage 데이터를 읽어 신규 번들로 변환
RETURNED    : object - 마이그레이션된 번들
=============================================================================*/
function buildBundleFromLegacy() {
  const parse = (key) => {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  };
  const bundle = defaultBundle();

  const _tasks = parse('taskflow_v3');
  if (Array.isArray(_tasks)) bundle.tasks = _tasks;

  const _settings = parse('taskflow_settings_v1');
  if (_settings) bundle.settings = _settings;

  const _recurring = parse('taskflow_recurring_v1');
  if (Array.isArray(_recurring)) bundle.recurring = _recurring;

  const _annual = parse('taskflow_annual_v1');
  if (Array.isArray(_annual)) bundle.annual = _annual;

  const _contacts = parse('taskflow_contacts_v1');
  if (Array.isArray(_contacts)) bundle.contacts = _contacts;

  const _schedules = parse('taskflow_schedules_v1');
  if (Array.isArray(_schedules)) bundle.schedules = _schedules;

  // 인벤토리: v3 우선, 없으면 v2 변환
  const _inv3 = parse('taskflow_inventory_v3');
  if (_inv3 && Array.isArray(_inv3.ledgers) && _inv3.ledgers.length) {
    bundle.inventory = _inv3;
  } else {
    const _inv2 = parse('taskflow_inventory_v2');
    if (Array.isArray(_inv2) && _inv2.length && typeof invConvertV2 === 'function') {
      bundle.inventory = invConvertV2(_inv2);
    }
  }

  const _theme = localStorage.getItem('taskflow_theme');
  if (_theme) bundle.ui.theme = _theme;
  const _font = localStorage.getItem('taskflow_font');
  if (_font) bundle.ui.font = _font;

  const _backupMeta = parse('taskflow_backup_meta');
  if (_backupMeta) bundle.backupMeta = _backupMeta;

  return bundle;
}

/*=============================================================================
FUNCTION    : offerLegacyCleanup
DESCRIPTION : 마이그레이션 완료 후 브라우저에 남은 localStorage 데이터 정리 제안
RETURNED    : void
=============================================================================*/
function offerLegacyCleanup() {
  setTimeout(() => {
    const ok = confirm(
      '기존 브라우저(localStorage) 데이터를 새 파일로 이전했습니다.\n' +
      '브라우저에 남은 원본 데이터를 삭제할까요? (권장 — 파일에 안전하게 저장됨)'
    );
    if (!ok) return;
    try {
      LEGACY_KEYS.forEach(k => localStorage.removeItem(k));
      if (typeof toast === 'function') toast('브라우저 데이터 정리 완료');
    } catch (e) {
      console.warn('[TASKFLOW] localStorage 정리 실패', e);
    }
  }, 800);
}

// ── 시작 게이트 UI ───────────────────────────────────
/*=============================================================================
FUNCTION    : buildGate
DESCRIPTION : 데이터 파일 선택 오버레이 DOM/스타일을 생성해 body에 주입
RETURNED    : void
=============================================================================*/
function buildGate() {
  if (document.getElementById('store-gate')) return;

  const style = document.createElement('style');
  style.textContent = `
    #store-gate{position:fixed;inset:0;z-index:99999;display:flex;
      align-items:center;justify-content:center;
      background:var(--bg1,#12151c);color:var(--text1,#e6e9ef);
      font-family:var(--sans,sans-serif);}
    #store-gate .sg-card{width:min(440px,90vw);padding:32px 28px;
      background:var(--bg2,#1a1f2b);border:1px solid var(--border,#2a3140);
      border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.4);}
    #store-gate h1{margin:0 0 6px;font-size:22px;letter-spacing:1px;}
    #store-gate .sg-sub{margin:0 0 22px;font-size:13px;
      color:var(--text3,#8a93a6);line-height:1.6;}
    #store-gate .sg-btn{display:block;width:100%;margin:8px 0;padding:12px 14px;
      font-size:14px;border-radius:9px;cursor:pointer;text-align:center;
      border:1px solid var(--border,#2a3140);
      background:var(--bg3,#232a38);color:var(--text1,#e6e9ef);
      transition:filter .15s;}
    #store-gate .sg-btn:hover{filter:brightness(1.15);}
    #store-gate .sg-btn.primary{background:var(--accent,#6aadff);color:#0b1220;
      border-color:transparent;font-weight:600;}
    #store-gate .sg-note{margin-top:14px;padding:10px 12px;font-size:12px;
      line-height:1.5;border-radius:8px;
      background:rgba(106,173,255,.1);color:var(--text2,#b7c0d0);}
    #store-gate .sg-msg{margin-top:12px;font-size:12px;
      color:var(--red,#f87171);min-height:16px;}
  `;
  document.head.appendChild(style);

  const gate = document.createElement('div');
  gate.id = 'store-gate';
  gate.innerHTML = `
    <div class="sg-card">
      <h1>TASKFLOW</h1>
      <p class="sg-sub">데이터를 저장할 JSON 파일을 선택하세요.<br>
        모든 데이터는 이 파일 하나에만 저장되며, 브라우저에는 남지 않습니다.</p>
      <div id="sg-actions">
        <button class="sg-btn primary" id="sg-resume" style="display:none"></button>
        <button class="sg-btn" id="sg-open">데이터 파일 열기</button>
        <button class="sg-btn" id="sg-create">새 데이터 파일 만들기</button>
      </div>
      <div class="sg-note" id="sg-legacy" style="display:none">
        브라우저에 기존 데이터가 있습니다. <b>새 파일을 만들면</b> 자동으로 이전됩니다.
      </div>
      <div class="sg-msg" id="sg-msg"></div>
    </div>`;
  document.body.appendChild(gate);

  document.getElementById('sg-open').onclick   = gateOpenExisting;
  document.getElementById('sg-create').onclick = gateCreateNew;
  document.getElementById('sg-resume').onclick = gateResume;
}

/*=============================================================================
FUNCTION    : gateMsg
DESCRIPTION : 게이트 하단 메시지 영역에 안내/오류 표시
PARAMETERS  : string text - 표시할 문구
RETURNED    : void
=============================================================================*/
function gateMsg(text) {
  const el = document.getElementById('sg-msg');
  if (el) el.textContent = text || '';
}

function showGate() { const g = document.getElementById('store-gate'); if (g) g.style.display = 'flex'; }
function hideGate() { const g = document.getElementById('store-gate'); if (g) g.remove(); }

/*=============================================================================
FUNCTION    : gateUnsupported
DESCRIPTION : File System Access API 미지원 브라우저 안내 및 수동 모드 진입 옵션
RETURNED    : void
=============================================================================*/
function gateUnsupported() {
  const actions = document.getElementById('sg-actions');
  if (actions) {
    actions.innerHTML =
      '<button class="sg-btn primary" id="sg-manual">수동 백업 모드로 계속</button>';
    document.getElementById('sg-manual').onclick = gateManualContinue;
  }
  gateMsg('이 브라우저는 파일 자동저장을 지원하지 않습니다. Chrome/Edge 권장.');
}

/*=============================================================================
FUNCTION    : gateOpenExisting
DESCRIPTION : 기존 data.json 파일을 열어 로드
RETURNED    : Promise<void>
=============================================================================*/
async function gateOpenExisting() {
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'TASKFLOW 데이터', accept: { 'application/json': ['.json'] } }],
    });
    await useHandle(handle);
  } catch (e) {
    if (e.name !== 'AbortError') gateMsg('파일 열기 실패: ' + e.message);
  }
}

/*=============================================================================
FUNCTION    : gateCreateNew
DESCRIPTION : 새 data.json 파일 생성. 레거시 데이터가 있으면 이전 후 저장
RETURNED    : Promise<void>
=============================================================================*/
async function gateCreateNew() {
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'taskflow-data.json',
      types: [{ description: 'TASKFLOW 데이터', accept: { 'application/json': ['.json'] } }],
    });
    const hasLegacy = detectLegacy();
    g_Bundle = hasLegacy ? buildBundleFromLegacy() : defaultBundle();
    await writeBundleToFile(handle, g_Bundle);
    g_FileHandle = handle;
    await idbSetHandle(handle);
    finishBoot();
    if (hasLegacy) offerLegacyCleanup();
  } catch (e) {
    if (e.name !== 'AbortError') gateMsg('파일 생성 실패: ' + e.message);
  }
}

/*=============================================================================
FUNCTION    : gateResume
DESCRIPTION : 이전에 사용한 파일을 다시 열기(IndexedDB 핸들 재사용)
RETURNED    : Promise<void>
=============================================================================*/
async function gateResume() {
  try {
    const handle = await idbGetHandle();
    if (!handle) { gateMsg('저장된 파일 정보가 없습니다.'); return; }
    await useHandle(handle);
  } catch (e) {
    gateMsg('이어서 열기 실패: ' + e.message);
  }
}

/*=============================================================================
FUNCTION    : useHandle
DESCRIPTION : 파일 핸들 권한 확인 → 번들 로드 → 핸들 보관 → 부팅 완료
PARAMETERS  : FileSystemFileHandle handle - 사용할 파일 핸들
RETURNED    : Promise<void>
=============================================================================*/
async function useHandle(handle) {
  if (!(await verifyPermission(handle, true))) {
    gateMsg('파일 접근 권한이 필요합니다.');
    return;
  }
  g_FileHandle = handle;
  g_Bundle = await readBundleFromFile(handle);
  await idbSetHandle(handle);
  finishBoot();
}

/*=============================================================================
FUNCTION    : gateManualContinue
DESCRIPTION : 미지원 브라우저용 수동 모드 진입(파일 자동저장 없음)
RETURNED    : void
=============================================================================*/
function gateManualContinue() {
  g_Bundle = detectLegacy() ? buildBundleFromLegacy() : defaultBundle();
  g_FileHandle = null;
  finishBoot();
  if (typeof toast === 'function') {
    toast('수동 백업 모드 — 변경사항은 백업 메뉴에서 파일로 저장하세요.');
  }
}

/*=============================================================================
FUNCTION    : finishBoot
DESCRIPTION : 저장 계층 준비 완료 표시 후 게이트를 닫고 앱을 시작
RETURNED    : void
=============================================================================*/
function finishBoot() {
  g_StoreReady = true;
  hideGate();
  if (typeof startApp === 'function') startApp();
}

/*=============================================================================
FUNCTION    : bootStore
DESCRIPTION : 앱 진입점. 게이트를 띄우고 지원 여부·레거시·기억된 파일을 점검
RETURNED    : Promise<void>
=============================================================================*/
async function bootStore() {
  buildGate();
  showGate();

  if (!window.showOpenFilePicker || !window.showSaveFilePicker) {
    gateUnsupported();
    return;
  }
  if (detectLegacy()) {
    const note = document.getElementById('sg-legacy');
    if (note) note.style.display = 'block';
  }
  const remembered = await idbGetHandle();
  if (remembered) {
    const btn = document.getElementById('sg-resume');
    if (btn) {
      btn.textContent = `이어서 열기 · ${remembered.name}`;
      btn.style.display = 'block';
    }
  }
}

// ── 종료 직전 저장 시도(best-effort) ─────────────────
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') _flushStore();
});
window.addEventListener('beforeunload', () => { _flushStore(); });
