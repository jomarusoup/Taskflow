/*#############################################################################
FILE NAME   : store.js
DESCRIPTION : 데이터 영속 계층 — IndexedDB 기반 단일 저장.
              index.html 을 file:// 로 직접 열어 실행 가능(서버 불필요).
              앱 전용 DB(taskflow_store)에만 저장하므로 다른 앱/시스템에
              영향을 주지 않는다(localStorage 평면 키 공유 없음).
              데이터는 JSON 구조이며 백업 메뉴로 언제든 .json 파일로 내보내기·
              가져오기가 가능하다.
DATA        : 2026-07-22
Modification: 2026-07-22
#############################################################################*/

// ── 전역 상태 ────────────────────────────────────────
let g_Bundle      = null;   // 로드한 데이터 번들(하이드레이션 소스)
let g_StoreReady  = false;  // 저장 계층 준비 완료 여부
let _persistTimer = null;   // 디바운스 타이머

// ── IndexedDB (앱 전용 저장소) ───────────────────────
const IDB_NAME  = 'taskflow_store';
const IDB_STORE = 'bundle';
const IDB_KEY   = 'data';

// ── 마이그레이션 대상 레거시 localStorage 키 ──────────
const LEGACY_KEYS = [
  'taskflow_v3', 'taskflow_settings_v1', 'taskflow_recurring_v1',
  'taskflow_annual_v1', 'taskflow_contacts_v1', 'taskflow_schedules_v1',
  'taskflow_inventory_v3', 'taskflow_inventory_v2',
  'taskflow_theme', 'taskflow_font', 'taskflow_backup_meta',
];

/*=============================================================================
FUNCTION    : idbOpen
DESCRIPTION : 앱 전용 IndexedDB 연결. 최초 호출 시 objectStore 생성
RETURNED    : Promise<IDBDatabase>
=============================================================================*/
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/*=============================================================================
FUNCTION    : idbGetBundle
DESCRIPTION : 저장된 데이터 번들을 IndexedDB에서 조회
RETURNED    : Promise<object|null>
=============================================================================*/
async function idbGetBundle() {
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
FUNCTION    : idbPutBundle
DESCRIPTION : 데이터 번들을 IndexedDB에 저장(전체 덮어쓰기)
PARAMETERS  : object bundle - 저장할 번들
RETURNED    : Promise<void>
=============================================================================*/
async function idbPutBundle(bundle) {
  const db = await idbOpen();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(bundle, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

/*=============================================================================
FUNCTION    : defaultBundle
DESCRIPTION : 빈 데이터 번들 생성(최초 실행 초기값)
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
DESCRIPTION : 저장소/파일에서 읽은 원본을 안전한 번들 형태로 정규화
PARAMETERS  : unknown raw - 원본 객체
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
DESCRIPTION : 현재 전역 상태를 저장용 번들로 조립
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
FUNCTION    : persistStore
DESCRIPTION : 변경사항을 디바운스(500ms) 후 IndexedDB에 자동 저장.
              모든 save 계열 래퍼가 이 함수를 호출한다.
RETURNED    : void
=============================================================================*/
function persistStore() {
  if (!g_StoreReady) return;
  clearTimeout(_persistTimer);
  _persistTimer = setTimeout(_flushStore, 500);
}

/*=============================================================================
FUNCTION    : _flushStore
DESCRIPTION : 디바운스 없이 즉시 저장
RETURNED    : Promise<void>
=============================================================================*/
async function _flushStore() {
  if (!g_StoreReady) return;
  clearTimeout(_persistTimer);
  try {
    await idbPutBundle(collectBundle());
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
      '기존 브라우저(localStorage) 데이터를 앱 저장소로 이전했습니다.\n' +
      '브라우저에 남은 원본 데이터를 삭제할까요? (권장)'
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

/*=============================================================================
FUNCTION    : bootStore
DESCRIPTION : 앱 진입점. IndexedDB에서 데이터를 로드(없으면 레거시 이전) 후
              앱을 시작한다. 별도 파일 선택 없이 바로 실행된다.
RETURNED    : Promise<void>
=============================================================================*/
async function bootStore() {
  let stored = await idbGetBundle();
  if (!stored && detectLegacy()) {
    stored = buildBundleFromLegacy();
    try { await idbPutBundle(stored); } catch (e) { console.warn('[TASKFLOW] 마이그레이션 저장 실패', e); }
    offerLegacyCleanup();
  }
  g_Bundle = stored ? normalizeBundle(stored) : defaultBundle();
  g_StoreReady = true;
  if (typeof startApp === 'function') startApp();
}

// ── 종료 직전 저장 시도(best-effort) ─────────────────
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') _flushStore();
});
window.addEventListener('beforeunload', () => { _flushStore(); });
