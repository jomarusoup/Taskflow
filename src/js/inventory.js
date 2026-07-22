/******************************************************************************
FILE NAME   : inventory.js
DESCRIPTION : 인벤토리 관리 시스템 — 다중 대장·탭·고정열 그리드 (스크롤 재설계판)
              단일 스크롤 컨테이너(.invt-scroll) 안의 단일 테이블 +
              border-collapse:separate + position:sticky 고정헤더/고정열.
              열 너비는 state(colWidths)가 단일 진실원본이며 _invtApplyWidths()가
              colgroup·table width·sticky left를 일괄 반영한다 (DOM 실측 없음).
DATA        : 2026-04-20
Modification: 2026-07-22
******************************************************************************/

// ── 상수 ──────────────────────────────────────────────
const INV_KEY   = 'taskflow_inventory_v3';
const INV_CHK_W = 52;  /* 체크박스 고정열 너비(px) */
const INV_MIN_W = 60;  /* 열 최소 너비(px) */
const INV_MAX_W = 600; /* 열 최대 너비(px, 자동 계산 상한) */
const INV_DEFAULT_ST = [
  {label:'정상',color:'#4caf50'},{label:'경고',color:'#ff9800'},
  {label:'오류',color:'#f44336'},{label:'유휴',color:'#9e9e9e'},{label:'N/A',color:'#cccccc'},
];
const INV_PAL = ['#6aabdb','#4dba8a','#8c82d8','#d8758a','#d4a030','#d47050','#6aaa40','#d06060'];

// ── 유틸 ──────────────────────────────────────────────
function invGenId() { return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2,5); }
function invClone(o) { return JSON.parse(JSON.stringify(o)); }
function invHexRgb(h){return{r:parseInt(h.slice(1,3),16),g:parseInt(h.slice(3,5),16),b:parseInt(h.slice(5,7),16)};}
function invAlpha(h,a){const{r,g,b}=invHexRgb(h);return`rgba(${r},${g},${b},${a})`;}
function invLightBg(hex){const{r,g,b}=invHexRgb(hex);const m=c=>Math.round(c*.2+255*.8);const t=n=>n.toString(16).padStart(2,'0');return'#'+t(m(r))+t(m(g))+t(m(b));}

// ── 전역 상태 ─────────────────────────────────────────
let invLedgers        = [];
let invActiveLedgerId = null;
let invSt             = null; /* 활성 대장의 런타임 상태 */

// ── Load / Save ───────────────────────────────────────
/******************************************************************************
FUNCTION    : invLoadData
DESCRIPTION : localStorage(taskflow_inventory_v3)에서 인벤토리 로드.
              v2 데이터 마이그레이션, 데이터 없으면 기본 대장 생성
RETURNED    : object - {activeLedger, ledgers[]}
******************************************************************************/
function invLoadData() {
  try {
    const raw3 = localStorage.getItem(INV_KEY);
    if (raw3) { const d=JSON.parse(raw3); if(d&&d.ledgers?.length) return d; }
    // migrate v2: [{id,name,columns,rows,memo,...}]
    const raw2 = localStorage.getItem('taskflow_inventory_v2');
    if (raw2) {
      const oldTabs = JSON.parse(raw2);
      if (Array.isArray(oldTabs) && oldTabs.length) {
        const ledgers = oldTabs.map(t => {
          const tid=invGenId(), bc0=invGenId(), bc1=invGenId();
          return { id:invGenId(), name:t.name, data:{
            activeTab:0, colWidths:{}, rowHeights:{}, hiddenCols:[], tabMemos:{[tid]:t.memo||''},
            baseCols:[{id:bc0,name:'No',type:'text',nodels:true},{id:bc1,name:'항목명',type:'text',nodels:true}],
            tabs:[{id:tid,name:'정보',cols:(t.columns||[]).map(c=>({id:c.id,name:c.name,type:c.type||'text',statuses:c.statuses}))}],
            rows:(t.rows||[]).map((r,i)=>({id:r.id,base:{[bc0]:String(i+1).padStart(3,'0'),[bc1]:''},data:{[tid]:r.cells||{}}}))
          }};
        });
        const d={activeLedger:ledgers[0].id,ledgers};
        localStorage.setItem(INV_KEY,JSON.stringify(d)); return d;
      }
    }
  } catch(e){console.warn('invLoadData',e);}
  // default
  const lid=invGenId(),t0=invGenId(),t1=invGenId(),bc0=invGenId(),bc1=invGenId();
  const tc={t0c0:invGenId(),t0c1:invGenId(),t0c2:invGenId(),t0c3:invGenId(),t1c0:invGenId(),t1c1:invGenId(),t1c2:invGenId(),t1c3:invGenId()};
  const r0=invGenId(),r1=invGenId(),r2=invGenId();
  return {activeLedger:lid,ledgers:[{id:lid,name:'시스템 관리 대장',data:{
    activeTab:0,colWidths:{},rowHeights:{},hiddenCols:[],tabMemos:{},
    baseCols:[{id:bc0,name:'No',type:'text',nodels:true},{id:bc1,name:'서버명',type:'text',nodels:true}],
    tabs:[
      {id:t0,name:'기본 정보',cols:[{id:tc.t0c0,name:'OS',type:'text'},{id:tc.t0c1,name:'담당자',type:'text'},{id:tc.t0c2,name:'설치일',type:'text'},{id:tc.t0c3,name:'상태',type:'status',statuses:invClone(INV_DEFAULT_ST)}]},
      {id:t1,name:'리소스',cols:[{id:tc.t1c0,name:'CPU(%)',type:'text'},{id:tc.t1c1,name:'MEM(%)',type:'text'},{id:tc.t1c2,name:'DISK(%)',type:'text'},{id:tc.t1c3,name:'상태',type:'status',statuses:invClone(INV_DEFAULT_ST)}]},
    ],
    rows:[
      {id:r0,base:{[bc0]:'001',[bc1]:'FEP-01'},data:{[t0]:{[tc.t0c0]:'RHEL 8.6',[tc.t0c1]:'담당자',[tc.t0c2]:'2022-03-15',[tc.t0c3]:'정상'},[t1]:{[tc.t1c0]:'34',[tc.t1c1]:'52',[tc.t1c2]:'61',[tc.t1c3]:'정상'}}},
      {id:r1,base:{[bc0]:'002',[bc1]:'FEP-02'},data:{[t0]:{[tc.t0c0]:'RHEL 8.6',[tc.t0c1]:'담당자',[tc.t0c2]:'2022-03-15',[tc.t0c3]:'경고'},[t1]:{[tc.t1c0]:'78',[tc.t1c1]:'81',[tc.t1c2]:'72',[tc.t1c3]:'경고'}}},
      {id:r2,base:{[bc0]:'003',[bc1]:'OMS-01'},data:{[t0]:{[tc.t0c0]:'CentOS 7.9',[tc.t0c1]:'담당자',[tc.t0c2]:'2021-07-20',[tc.t0c3]:'정상'},[t1]:{[tc.t1c0]:'21',[tc.t1c1]:'44',[tc.t1c2]:'38',[tc.t1c3]:'정상'}}},
    ]
  }}]};
}

/* invMakeState: 저장 데이터 → 런타임 상태 (hiddenCols/selected를 Set으로) */
function invMakeState(raw) {
  if (!raw) return null;
  return {...raw, hiddenCols:new Set(raw.hiddenCols||[]), selected:new Set(), filters:{}, sortCol:null};
}

/******************************************************************************
FUNCTION    : invFlushSave
DESCRIPTION : 런타임 상태를 직렬화해 활성 대장에 반영 후 localStorage 저장.
              쓰기 실패(quota 등)는 경고 + toast로 표면화
RETURNED    : 없음
******************************************************************************/
function invFlushSave() {
  if (!invLedgers || !invLedgers.length) return; /* 초기화 실패 시 기존 데이터 덮어쓰기 방지 */
  try {
    const lg = invLedgers.find(l=>l.id===invActiveLedgerId);
    if (lg && invSt) {
      lg.data = {...invSt, hiddenCols:[...invSt.hiddenCols], selected:undefined,
        filters:Object.fromEntries(Object.entries(invSt.filters||{}).map(([k,v])=>[k,v?[...v]:null])), sortCol:invSt.sortCol||null};
      delete lg.data.selected;
    }
    localStorage.setItem(INV_KEY, JSON.stringify({activeLedger:invActiveLedgerId,ledgers:invLedgers}));
  } catch(e){
    console.warn('[TASKFLOW] 인벤토리 저장 실패', e);
    if (typeof toast === 'function') toast('저장 실패: 저장 공간을 확인하세요');
  }
}
let _invTimer=null;
function invSave(){clearTimeout(_invTimer);_invTimer=setTimeout(invFlushSave,400);}
window.addEventListener('beforeunload',invFlushSave);

// ── 데이터 헬퍼 ───────────────────────────────────────
function invCurTab(){return invSt.tabs[invSt.activeTab]||invSt.tabs[0];}
function invFindCol(cid){for(const c of invSt.baseCols)if(c.id===cid)return c;for(const t of invSt.tabs)for(const c of t.cols)if(c.id===cid)return c;return null;}
function invIsBase(cid){return !!invSt.baseCols.find(c=>c.id===cid);}
function invVisBaseCols(){return invSt.baseCols.filter(c=>!invSt.hiddenCols.has(c.id));}
function invVisTabCols(){const t=invCurTab();return t?t.cols.filter(c=>!invSt.hiddenCols.has(c.id)):[];}
function invCellVal(row,cid){return invIsBase(cid)?(row.base[cid]||''):((row.data?.[invCurTab().id]?.[cid])||'');}
function invUniqVals(cid){const s=new Set();invSt.rows.forEach(r=>{const v=invCellVal(r,cid).trim();s.add(v||'(빈값)');});return[...s].sort((a,b)=>a.localeCompare(b,'ko'));}
function invFilteredRows(){const f=invSt.filters||{};let rows=invSt.rows.filter(row=>{for(const cid in f){if(!f[cid])continue;const v=invCellVal(row,cid).trim()||'(빈값)';if(!f[cid].has(v))return false;}return true;});if(invSt.sortCol){const{cid,dir}=invSt.sortCol;rows=[...rows].sort((a,b)=>{const va=invCellVal(a,cid),vb=invCellVal(b,cid);return dir==='asc'?va.localeCompare(vb,'ko',{numeric:true}):vb.localeCompare(va,'ko',{numeric:true});});}return rows;}
function invHasFilter(){return Object.values(invSt.filters||{}).some(v=>v!=null)||!!invSt.sortCol;}
function invReorderNo(){const nc=invSt.baseCols.find(c=>c.nodels);if(!nc)return;invSt.rows.forEach((r,i)=>{r.base[nc.id]=String(i+1).padStart(3,'0');});}
function invCloseFloats(){document.querySelectorAll('.inv-flt-popup,.inv-ctx-menu').forEach(e=>e.remove());}

// ── 열 너비 / 고정열 레이아웃 엔진 ────────────────────
/******************************************************************************
FUNCTION    : invAutoW
DESCRIPTION : 열 내용 기반 자동 너비 계산 (전각문자는 2단위로 가중)
PARAMETERS  : string cid - 열 ID
RETURNED    : number - 너비(px, INV_MIN_W~INV_MAX_W)
******************************************************************************/
function invAutoW(cid){
  const col=invFindCol(cid); if(!col) return 80;
  const wide=s=>[...String(s)].reduce((a,ch)=>a+(ch.charCodeAt(0)>127?2:1),0);
  const isB=invIsBase(cid), tid=invCurTab()?invCurTab().id:null;
  let max=wide(col.name)+3; /* 헤더는 드래그핸들·필터버튼 공간 가산 */
  invSt.rows.forEach(r=>{
    const v=isB?(r.base[cid]||''):((r.data?.[tid]?.[cid])||'');
    String(v).split('\n').forEach(l=>{const w=wide(l);if(w>max)max=w;});
  });
  return Math.min(INV_MAX_W, Math.max(INV_MIN_W, max*7+30));
}
function invGetW(cid){return invSt.colWidths[cid]||invAutoW(cid);}

/******************************************************************************
FUNCTION    : _invtLayout
DESCRIPTION : 현재 표시 열 목록·고정열 left 오프셋·테이블 총 너비 계산.
              state의 열 너비만 사용 — DOM 실측 없음 (단일 진실원본)
RETURNED    : object - {bc:공통열[], tc:탭열[], lefts:고정열 left[], total:총너비}
******************************************************************************/
function _invtLayout(){
  const bc=invVisBaseCols(), tc=invVisTabCols();
  const lefts=[0]; /* fix-idx 0 = 체크박스 열 */
  let acc=INV_CHK_W, total=INV_CHK_W;
  bc.forEach(c=>{lefts.push(acc);acc+=invGetW(c.id);});
  [...bc,...tc].forEach(c=>{total+=invGetW(c.id);});
  return {bc,tc,lefts,total};
}

/******************************************************************************
FUNCTION    : _invtApplyWidths
DESCRIPTION : state의 열 너비를 colgroup·table width·sticky left에 일괄 반영.
              리사이즈/자동확장 시 재렌더 없이 호출
RETURNED    : 없음
******************************************************************************/
function _invtApplyWidths(){
  const tbl=document.getElementById('inv-tbl'); if(!tbl||!invSt) return;
  const {lefts,total}=_invtLayout();
  tbl.style.width=total+'px';
  tbl.querySelectorAll('col[data-cid]').forEach(col=>{col.style.width=invGetW(col.dataset.cid)+'px';});
  tbl.querySelectorAll('[data-fix-idx]').forEach(el=>{const v=lefts[+el.dataset.fixIdx];if(v!=null)el.style.left=v+'px';});
}

// ── 렌더 ──────────────────────────────────────────────
function renderInventory(){invRenderSidebar();invRenderTabs();invRenderActionBar();invRenderBody();}

function invRenderSidebar() {
  const list = document.getElementById('inv-sb-list'); if(!list) return;
  list.innerHTML='';
  invLedgers.forEach((lg, idx)=>{
    const isA=lg.id===invActiveLedgerId;
    const item=document.createElement('div'); item.className='inv-sb-item'+(isA?' active':'');
    item.dataset.lidx = idx;
    const handle = document.createElement('span');
    handle.className = 'inv-sb-drag-h';
    handle.textContent = '⠿';
    handle.title = '드래그하여 이동';
    const btn=document.createElement('button'); btn.className='inv-sb-item-btn'; btn.textContent=lg.name; btn.title=lg.name;
    btn.ondblclick=()=>{const n=prompt('대장 이름 변경',lg.name);if(n?.trim()){lg.name=n.trim();invFlushSave();invRenderSidebar();}};
    btn.onclick=()=>{if(!isA)invSwitchLedger(lg.id);};
    const del=document.createElement('button'); del.className='inv-sb-item-del'; del.textContent='×'; del.title='삭제';
    del.onclick=e=>{e.stopPropagation();if(invLedgers.length<=1){alert('최소 1개 대장이 필요합니다.');return;}if(!confirm(`'${lg.name}' 대장을 삭제하시겠습니까?`))return;invLedgers=invLedgers.filter(l=>l.id!==lg.id);if(invActiveLedgerId===lg.id){invActiveLedgerId=invLedgers[0].id;invSt=invMakeState(invLedgers[0].data);}invFlushSave();invRenderSidebar();renderInventory();};
    item.appendChild(handle);item.appendChild(btn);item.appendChild(del);list.appendChild(item);
  });
  _invInitLedgerDrag();
}

function invSwitchLedger(lid){
  invFlushSave(); invActiveLedgerId=lid;
  const next=invLedgers.find(l=>l.id===lid); if(next) invSt=invMakeState(next.data);
  renderInventory();
}

function invRenderTabs(){
  const bar=document.getElementById('inv-tab-bar'); if(!bar||!invSt) return;
  if(!invSt.tabs.length){bar.innerHTML=`<button class="inv-tab-add" onclick="invAddTab()">＋ 탭 추가</button>`;return;}
  if(!invSt.tabs[invSt.activeTab]) invSt.activeTab=0;
  bar.innerHTML=invSt.tabs.map((tab,i)=>{
    const isA=i===invSt.activeTab,color=tab.color||INV_PAL[i%INV_PAL.length];
    const st=isA?`border-color:${color};border-bottom-color:var(--bg);color:${color};`:'';
    return `<div class="inv-tab-group" data-tidx="${i}" oncontextmenu="invOpenTabCtx(${i},event);event.preventDefault()">
      <span class="inv-tab-drag-h" data-dh="tab" title="드래그하여 이동">⠿</span>
      <button class="inv-tab${isA?' active':''}" style="${st}" onclick="invSetTab(${i})">${esc(tab.name)}</button>
      <span class="inv-tab-ctrl">
        <button class="inv-tab-ctrl-btn" onclick="invEditTab(${i})">⚙</button>
      </span></div>`;
  }).join('')+`<button class="inv-tab-add" onclick="invAddTab()">＋</button>`;
  _invInitTabDrag();
}

function invRenderActionBar(){
  const bar=document.getElementById('inv-action-bar'); if(!bar||!invSt) return;
  const tab=invCurTab(),color=tab?(tab.color||INV_PAL[invSt.activeTab%INV_PAL.length]):'var(--amber)';
  bar.innerHTML=`
    <button class="btn btn-ghost btn-sm" onclick="invAddRow()">＋ 행 추가</button>
    <button class="btn btn-ghost btn-sm" onclick="invAddBaseCol()">＋ 공통 열</button>
    ${tab?`<button class="btn btn-ghost btn-sm" style="border-color:${color};color:${color}" onclick="invAddTabCol()">＋ [${esc(tab.name)}] 열</button>`:''}
    ${invHasFilter()?`<button class="btn btn-ghost btn-sm" style="border-color:var(--amber);color:var(--amber)" onclick="invClearFilters()">필터 초기화 ×</button>`:''}
    <button class="btn btn-ghost btn-sm" style="margin-left:auto;color:var(--red)" onclick="invDelSelected()">선택 행 삭제</button>`;
}

/******************************************************************************
FUNCTION    : invRenderBody
DESCRIPTION : 메모·숨김열 바·그리드 렌더. 그리드는 단일 스크롤 컨테이너 안의
              단일 테이블로, thead th는 sticky top, 체크박스+공통열은 sticky left.
              고정열∩고정헤더 교차 셀은 z-index 최상위 + 불투명 배경
RETURNED    : 없음
******************************************************************************/
function invRenderBody(){
  const bodyEl=document.getElementById('inv-body'); if(!bodyEl) return;
  if(!invSt){bodyEl.innerHTML='';return;}
  if(!invSt.tabs.length){bodyEl.innerHTML=`<div class="inv-empty">＋ 탭 추가 버튼으로 시작하세요.</div>`;return;}
  if(!invSt.tabs[invSt.activeTab]) invSt.activeTab=0;
  const tab=invCurTab();
  const memoVal=(invSt.tabMemos||{})[tab.id]||'';
  const {bc,tc,lefts,total}=_invtLayout();
  const hidCols=[...invSt.baseCols,...tab.cols].filter(c=>invSt.hiddenCols.has(c.id));
  const rows=invFilteredRows();
  const tabColor=tab.color||INV_PAL[invSt.activeTab%INV_PAL.length];
  const tabBo=invAlpha(tabColor,.35);
  const f=invSt.filters||{}, sc=invSt.sortCol;

  const mkFlt=cid=>{const hasF=f[cid]!=null,isSort=sc&&sc.cid===cid;let cls='invt-flt-btn';if(hasF||isSort)cls+=' active';if(isSort)cls+=(sc.dir==='asc'?' invt-sort-asc':' invt-sort-desc');return`<button class="${cls}" data-flt-cid="${esc(cid)}">▼</button>`;};
  const dh=`<span class="invt-th-drag" data-dh="1">⠿</span>`;
  const alignOf=c=>c.align?`text-align:${c.align};`:'';

  /* colgroup — 모든 열 너비를 px로 명시 (table-layout:fixed와 함께 정확한 너비 보장) */
  let cg=`<colgroup><col style="width:${INV_CHK_W}px">`;
  [...bc,...tc].forEach(c=>{cg+=`<col data-cid="${esc(c.id)}" style="width:${invGetW(c.id)}px">`;});
  cg+='</colgroup>';

  /* thead — 전체 sticky top, 고정열은 sticky left도 부여 */
  let head='<thead><tr>';
  head+=`<th class="invt-fix" data-fix-idx="0" style="left:0"><div class="invt-th-inner" style="justify-content:center"><input type="checkbox" id="inv-chk-all" style="cursor:pointer"></div></th>`;
  bc.forEach((c,i)=>{
    const last=i===bc.length-1?' invt-fix-last':'';
    head+=`<th class="invt-fix${last}" data-fix-idx="${i+1}" data-cid="${esc(c.id)}" data-scope="base" draggable="true" style="left:${lefts[i+1]}px" oncontextmenu="invOpenColCtx('${esc(c.id)}','base',event);event.preventDefault()">
      <div class="invt-th-inner">${dh}${mkFlt(c.id)}<span class="invt-th-label" ondblclick="invRenameCol('${esc(c.id)}')">${esc(c.name)}</span></div>
      <div class="invt-resize-h" data-cid="${esc(c.id)}"></div></th>`;
  });
  tc.forEach((c,i)=>{
    const first=i===0?`border-left:2px solid ${tabColor};`:'';
    head+=`<th data-cid="${esc(c.id)}" data-scope="tab" draggable="true" style="${first}border-right:1px solid ${tabBo};border-bottom:2px solid ${tabColor}" oncontextmenu="invOpenColCtx('${esc(c.id)}','tab',event);event.preventDefault()">
      <div class="invt-th-inner">${dh}${mkFlt(c.id)}<span class="invt-th-label" style="color:${tabColor}" ondblclick="invRenameCol('${esc(c.id)}')">${esc(c.name)}</span></div>
      <div class="invt-resize-h" data-cid="${esc(c.id)}"></div></th>`;
  });
  head+='</tr></thead>';

  /* 상태 셀: 고정열은 반투명 tint를 background-image로 얹어 불투명 배경 유지 */
  const mkStTd=(col,val,rid,tid,isBase,cls,attrs,extra)=>{
    const sts=(col&&col.statuses)||INV_DEFAULT_ST,ev=val||(sts[0]?.label||'');
    const s=sts.find(x=>x.label===ev),tint=s?invAlpha(s.color,.18):'';
    const bdr=s?`box-shadow:inset 0 -1.5px 0 ${invAlpha(s.color,.5)};`:'';
    const bg=tint?(cls.includes('invt-fix')?`background-image:linear-gradient(${tint},${tint});`:`background-color:${tint};`):'';
    const opts=sts.map(x=>`<option${ev===x.label?' selected':''}>${esc(x.label)}</option>`).join('');
    const onChange=isBase?`invSetBase('${esc(rid)}','${esc(col.id)}',this.value)`:`invSetTabData('${esc(rid)}','${esc(tid)}','${esc(col.id)}',this.value)`;
    return`<td class="${cls}" ${attrs} style="${extra}${bg}${bdr}"><div class="invt-status-wrap"><select class="invt-status-sel" onchange="${onChange};invRenderBody()">${opts}</select></div></td>`;
  };
  const mkTxTd=(col,val,onChange,cls,attrs,extra)=>
    `<td class="${cls}" ${attrs} style="${extra}"><div class="invt-cell-wrap"><textarea class="invt-cell-ta" rows="${Math.max(1,val.split('\n').length)}" wrap="off" data-cid="${esc(col.id)}" style="${alignOf(col)}" oninput="_invCellInput(this)" onchange="${onChange}" onblur="invAutoFitCol('${esc(col.id)}')">${esc(val)}</textarea></div></td>`;

  let tbody='<tbody>';
  rows.forEach(row=>{
    const sel=invSt.selected.has(row.id),rh=invSt.rowHeights[row.id];
    tbody+=`<tr data-rid="${esc(row.id)}" style="${rh?`height:${rh}px`:''}" oncontextmenu="invOpenRowCtx('${esc(row.id)}',event);event.preventDefault()">`;
    tbody+=`<td class="invt-fix" data-fix-idx="0" style="left:0">
      <div class="invt-row-drag-cell" data-rid="${esc(row.id)}" style="${rh?`height:${rh}px`:''}">
        <span data-dh="row" style="cursor:grab;color:var(--text3);font-size:11px;user-select:none">⠿</span>
        <input type="checkbox" class="inv-rchk" data-rid="${esc(row.id)}" ${sel?'checked':''} style="cursor:pointer">
        <div class="invt-row-resize-h" data-rid="${esc(row.id)}"></div>
      </div></td>`;
    bc.forEach((c,i)=>{
      const val=row.base[c.id]||'';
      const cls=`invt-fix${i===bc.length-1?' invt-fix-last':''}`;
      const attrs=`data-fix-idx="${i+1}"`, extra=`left:${lefts[i+1]}px;`;
      if(c.type==='status') tbody+=mkStTd(c,val,row.id,'',true,cls,attrs,extra);
      else tbody+=mkTxTd(c,val,`invSetBase('${esc(row.id)}','${esc(c.id)}',this.value)`,cls,attrs,extra);
    });
    const rd=(row.data&&row.data[tab.id])||{};
    tc.forEach((c,i)=>{
      const val=rd[c.id]||'';
      const extra=`${i===0?`border-left:2px solid ${tabColor};`:''}border-right:1px solid ${tabBo};`;
      if(c.type==='status') tbody+=mkStTd(c,val,row.id,tab.id,false,'','',extra);
      else tbody+=mkTxTd(c,val,`invSetTabData('${esc(row.id)}','${esc(tab.id)}','${esc(c.id)}',this.value)`,'','',extra);
    });
    tbody+='</tr>';
  });
  if(!rows.length) tbody+=`<tr><td colspan="${1+bc.length+tc.length}" class="inv-empty" style="white-space:normal">${invSt.rows.length?'필터 조건에 맞는 행이 없습니다.':'행이 없습니다. ＋ 행 추가를 클릭하세요.'}</td></tr>`;
  tbody+='</tbody>';

  const memoHtml=`<div class="inv-memo-wrap">
    <div class="inv-memo-hd" onclick="const b=this.nextElementSibling;b.style.display=b.style.display==='none'?'block':'none'">📝 메모 <span style="margin-left:auto;font-size:10px">▾</span></div>
    <div class="inv-memo-body"><textarea class="inv-memo-ta" placeholder="탭 메모..." oninput="invSaveMemo('${esc(tab.id)}',this.value)">${esc(memoVal)}</textarea></div></div>`;
  const hidBarHtml=hidCols.length?`<div class="inv-hidden-bar"><span class="inv-hidden-label">숨겨진 열:</span>${hidCols.map(c=>`<button class="inv-show-col-btn" onclick="invShowCol('${esc(c.id)}')">${esc(c.name)} ▶</button>`).join('')}</div>`:'';
  const tableHtml=(bc.length+tc.length)===0?`<div class="inv-empty">＋ 공통 열 또는 탭 열을 추가하세요.</div>`:
    `<div class="invt-scroll"><table class="invt-table" id="inv-tbl" style="width:${total}px">${cg}${head}${tbody}</table></div>`;

  bodyEl.innerHTML=`${memoHtml}${hidBarHtml}${tableHtml}`;

  const tbl=document.getElementById('inv-tbl');
  if(tbl){
    tbl.querySelectorAll('.invt-cell-ta').forEach(ta=>{ta.rows=Math.max(1,ta.value.split('\n').length);});
    tbl.querySelectorAll('.invt-flt-btn').forEach(btn=>{btn.addEventListener('click',e=>{e.stopPropagation();invOpenFlt(btn.dataset.fltCid,btn);});});
    _invInitColResize(tbl);_invInitRowResize(tbl);_invInitColDrag(tbl);_invInitRowDrag(tbl);
    const ca=document.getElementById('inv-chk-all');
    if(ca){ca.onchange=function(){tbl.querySelectorAll('.inv-rchk').forEach(cb=>{cb.checked=this.checked;this.checked?invSt.selected.add(cb.dataset.rid):invSt.selected.delete(cb.dataset.rid);});};}
    tbl.querySelectorAll('.inv-rchk').forEach(cb=>{cb.onchange=function(){this.checked?invSt.selected.add(this.dataset.rid):invSt.selected.delete(this.dataset.rid);};});
  }
}

// ── 열 리사이즈 ───────────────────────────────────────
function _invInitColResize(tbl){
  tbl.querySelectorAll('.invt-resize-h').forEach(rh=>{
    rh.addEventListener('mousedown',e=>{
      e.preventDefault();e.stopPropagation();rh.classList.add('invt-rsz-drag');
      const cid=rh.dataset.cid,sx=e.clientX,sw=invGetW(cid);
      const mv=ev=>{invSt.colWidths[cid]=Math.max(INV_MIN_W,sw+ev.clientX-sx);_invtApplyWidths();};
      const up=()=>{invSave();rh.classList.remove('invt-rsz-drag');document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);};
      document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
    });
  });
}

// ── 행 리사이즈 ───────────────────────────────────────
function _invInitRowResize(tbl){
  tbl.querySelectorAll('.invt-row-resize-h').forEach(h=>{
    h.addEventListener('mousedown',e=>{
      e.preventDefault();e.stopPropagation();h.classList.add('invt-rr-drag');
      const rid=h.dataset.rid,tr=tbl.querySelector(`tr[data-rid="${rid}"]`),sy=e.clientY,sh=tr?tr.offsetHeight:32;
      const mv=ev=>{const nh=Math.max(28,sh+ev.clientY-sy);if(tr){tr.style.height=nh+'px';const dc=tr.querySelector('.invt-row-drag-cell');if(dc)dc.style.height=nh+'px';}};
      const up=ev=>{const nh=Math.max(28,sh+ev.clientY-sy);if(!invSt.rowHeights)invSt.rowHeights={};invSt.rowHeights[rid]=nh;invSave();h.classList.remove('invt-rr-drag');document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);};
      document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
    });
  });
}

// ── 열 드래그 (같은 scope 내 재정렬) ──────────────────
function _invInitColDrag(tbl){
  let dragCid=null,dragScope=null;
  tbl.querySelectorAll('th[data-cid][draggable]').forEach(th=>{
    th.addEventListener('mousedown',e=>{th.setAttribute('draggable',e.target.dataset.dh?'true':'false');});
    th.addEventListener('dragstart',e=>{if(th.getAttribute('draggable')==='false'){e.preventDefault();return;}dragCid=th.dataset.cid;dragScope=th.dataset.scope;th.classList.add('invt-col-drag-active');e.dataTransfer.effectAllowed='move';});
    th.addEventListener('dragend',()=>{th.classList.remove('invt-col-drag-active');tbl.querySelectorAll('th').forEach(t=>t.classList.remove('invt-col-drag-left','invt-col-drag-right'));dragCid=null;});
    th.addEventListener('dragover',e=>{if(!dragCid||th.dataset.scope!==dragScope||th.dataset.cid===dragCid)return;e.preventDefault();tbl.querySelectorAll('th').forEach(t=>t.classList.remove('invt-col-drag-left','invt-col-drag-right'));const rect=th.getBoundingClientRect();th.classList.add(e.clientX<rect.left+rect.width/2?'invt-col-drag-left':'invt-col-drag-right');});
    th.addEventListener('dragleave',()=>th.classList.remove('invt-col-drag-left','invt-col-drag-right'));
    th.addEventListener('drop',e=>{
      e.preventDefault();if(!dragCid||th.dataset.scope!==dragScope||th.dataset.cid===dragCid)return;
      th.classList.remove('invt-col-drag-left','invt-col-drag-right');
      const arr=dragScope==='base'?invSt.baseCols:invCurTab().cols;
      const fi=arr.findIndex(c=>c.id===dragCid),ti=arr.findIndex(c=>c.id===th.dataset.cid);if(fi<0||ti<0)return;
      const rect=th.getBoundingClientRect(),ib=e.clientX<rect.left+rect.width/2;
      const [col]=arr.splice(fi,1),ni=arr.findIndex(c=>c.id===th.dataset.cid);
      arr.splice(ib?ni:ni+1,0,col);invSave();invRenderBody();invRenderActionBar();
    });
  });
}

// ── 행 드래그 (재정렬) ────────────────────────────────
function _invInitRowDrag(tbl){
  let dragRid=null;const tbody=tbl.querySelector('tbody');
  function rowOf(el){return el.closest('tr[data-rid]');}
  tbody.addEventListener('mousedown',e=>{
    const dh=e.target.closest('[data-dh="row"]'),tr=dh&&rowOf(dh);
    if(!tr)return;tr.setAttribute('draggable','true');dragRid=tr.dataset.rid;
    document.addEventListener('mouseup',function cleanup(){tr.setAttribute('draggable','false');tbl.querySelectorAll('tr[data-rid]').forEach(r=>r.classList.remove('invt-row-drag-active','invt-row-drag-top','invt-row-drag-bot'));document.removeEventListener('mouseup',cleanup);},{once:true});
  });
  tbody.addEventListener('dragstart',e=>{const tr=rowOf(e.target);if(!tr||tr.dataset.rid!==dragRid)return;tr.classList.add('invt-row-drag-active');e.dataTransfer.effectAllowed='move';});
  tbody.addEventListener('dragend',e=>{const tr=rowOf(e.target);if(tr)tr.classList.remove('invt-row-drag-active');tbl.querySelectorAll('tr[data-rid]').forEach(r=>r.classList.remove('invt-row-drag-top','invt-row-drag-bot'));dragRid=null;});
  tbody.addEventListener('dragover',e=>{e.preventDefault();const tr=rowOf(e.target);if(!tr||!dragRid)return;tbl.querySelectorAll('tr[data-rid]').forEach(r=>r.classList.remove('invt-row-drag-top','invt-row-drag-bot'));const rect=tr.getBoundingClientRect();tr.classList.add(e.clientY<rect.top+rect.height/2?'invt-row-drag-top':'invt-row-drag-bot');});
  tbody.addEventListener('dragleave',e=>{const tr=rowOf(e.target);if(tr)tr.classList.remove('invt-row-drag-top','invt-row-drag-bot');});
  tbody.addEventListener('drop',e=>{
    e.preventDefault();const tr=rowOf(e.target);if(!tr||!dragRid||tr.dataset.rid===dragRid)return;
    tr.classList.remove('invt-row-drag-top','invt-row-drag-bot');
    const rows=invSt.rows,fi=rows.findIndex(r=>r.id===dragRid),ti=rows.findIndex(r=>r.id===tr.dataset.rid);if(fi<0||ti<0)return;
    const rect=tr.getBoundingClientRect(),ib=e.clientY<rect.top+rect.height/2;
    const [row]=rows.splice(fi,1),ni=rows.findIndex(r=>r.id===tr.dataset.rid);
    rows.splice(ib?ni:ni+1,0,row);invReorderNo();invSave();invRenderBody();
  });
}

// ── 필터 팝업 ─────────────────────────────────────────
function invOpenFlt(cid, btnEl){
  invCloseFloats();
  const col=invFindCol(cid); if(!col) return;
  const allVals=invUniqVals(cid),activeSet=invSt.filters[cid]||null,sc=invSt.sortCol;
  const pop=document.createElement('div'); pop.className='inv-flt-popup';
  let checkedSet=activeSet?new Set(activeSet):new Set(allVals);
  function buildList(q=''){
    const list=pop.querySelector('#inv-flt-list'); if(!list) return;
    const fv=allVals.filter(v=>v.toLowerCase().includes(q.toLowerCase()));
    const allChk=fv.every(v=>checkedSet.has(v));
    list.innerHTML=`<div class="inv-flt-all-row"><label><input type="checkbox" id="inv-flt-all" ${allChk?'checked':''}> (전체 선택)</label></div>`+
      fv.map(v=>`<div class="inv-flt-item"><input type="checkbox" data-v="${esc(v)}" ${checkedSet.has(v)?'checked':''}><label>${esc(v)||'(빈값)'}</label></div>`).join('');
    const ca = list.querySelector('#inv-flt-all');
    if (ca) ca.onchange=function(){fv.forEach(v=>this.checked?checkedSet.add(v):checkedSet.delete(v));buildList(q);};
    list.querySelectorAll('.inv-flt-item input').forEach(cb=>{cb.onchange=function(){const v=this.dataset.v;this.checked?checkedSet.add(v):checkedSet.delete(v);const all=list.querySelector('#inv-flt-all');if(all)all.checked=fv.every(fv2=>checkedSet.has(fv2));};});
  }
  pop.innerHTML=`<div class="inv-flt-hd"><span>${esc(col.name)}</span><button class="inv-flt-close" onclick="this.closest('.inv-flt-popup').remove()">×</button></div>
    <div class="inv-flt-sort-row">
      <button class="inv-flt-sort-btn${sc?.cid===cid&&sc.dir==='asc'?' active':''}">▲ 오름차순</button>
      <button class="inv-flt-sort-btn${sc?.cid===cid&&sc.dir==='desc'?' active':''}">▼ 내림차순</button>
    </div>
    <input class="inv-flt-search" placeholder="검색..." autocomplete="off">
    <div id="inv-flt-list" class="inv-flt-list"></div>
    <div class="inv-flt-footer">
      <button class="inv-flt-apply">적용</button>
      <button class="inv-flt-reset">초기화</button>
    </div>`;
  document.body.appendChild(pop);
  buildList();
  const [sortAsc,sortDesc]=pop.querySelectorAll('.inv-flt-sort-btn');
  sortAsc.onclick=()=>{invSt.sortCol={cid,dir:'asc'};sortAsc.classList.add('active');sortDesc.classList.remove('active');};
  sortDesc.onclick=()=>{invSt.sortCol={cid,dir:'desc'};sortDesc.classList.add('active');sortAsc.classList.remove('active');};
  const searchInp = pop.querySelector('.inv-flt-search');
  if (searchInp) searchInp.oninput=function(){buildList(this.value);};
  const applyBtn = pop.querySelector('.inv-flt-apply');
  if (applyBtn) applyBtn.onclick=()=>{const all=allVals.every(v=>checkedSet.has(v));invSt.filters[cid]=all?null:new Set(checkedSet);invSave();pop.remove();invRenderBody();invRenderActionBar();};
  const resetBtn = pop.querySelector('.inv-flt-reset');
  if (resetBtn) resetBtn.onclick=()=>{delete invSt.filters[cid];if(invSt.sortCol?.cid===cid)invSt.sortCol=null;invSave();pop.remove();invRenderBody();invRenderActionBar();};
  const rect=btnEl.getBoundingClientRect();
  let left=rect.left,top=rect.bottom+2;
  if(left+224>window.innerWidth)left=window.innerWidth-228;
  if(top+360>window.innerHeight)top=rect.top-360;
  pop.style.left=left+'px';pop.style.top=top+'px';
  setTimeout(()=>{document.addEventListener('mousedown',function h(e){if(!pop.contains(e.target)&&e.target!==btnEl){pop.remove();document.removeEventListener('mousedown',h);}});},10);
}

// ── 열 컨텍스트 메뉴 ──────────────────────────────────
function invOpenColCtx(cid, scope, e){
  invCloseFloats();
  const col=invFindCol(cid); if(!col) return;
  const menu=document.createElement('div'); menu.className='inv-ctx-menu';
  const title=document.createElement('div');title.style.cssText='padding:5px 14px 4px;font-size:10px;color:var(--text3);font-weight:600;letter-spacing:.06em;border-bottom:1px solid var(--border);margin-bottom:2px';title.textContent=col.name;menu.appendChild(title);
  const item=(icon,label,fn,cls='')=>{const btn=document.createElement('button');btn.className='inv-ctx-item'+(cls?' '+cls:'');btn.innerHTML=`<span style="width:16px;text-align:center;font-size:11px">${icon}</span>${label}`;btn.onclick=()=>{invCloseFloats();fn();};return btn;};
  const sep=()=>{const d=document.createElement('div');d.className='inv-ctx-sep';return d;};
  const ca=col.align||'left';
  menu.appendChild(item(ca==='left'?'✓':'','좌측 정렬',()=>{col.align='left';invSave();invRenderBody();},ca==='left'?'active':''));
  menu.appendChild(item(ca==='center'?'✓':'','가운데 정렬',()=>{col.align='center';invSave();invRenderBody();},ca==='center'?'active':''));
  menu.appendChild(item(ca==='right'?'✓':'','우측 정렬',()=>{col.align='right';invSave();invRenderBody();},ca==='right'?'active':''));
  menu.appendChild(sep());
  if(col.type==='status'){menu.appendChild(item('⚙','상태값 설정',()=>invCfgStatus(cid)));menu.appendChild(sep());}
  menu.appendChild(item('✎','열 이름 변경',()=>invRenameCol(cid)));
  menu.appendChild(item('◄','열 숨기기',()=>invHideCol(cid)));
  if(invSt.hiddenCols.size>0){menu.appendChild(item('◉','모든 열 표시',()=>{invSt.hiddenCols.clear();invSave();invRenderBody();}));}
  if(!col.nodels){menu.appendChild(sep());menu.appendChild(item('×','열 삭제',()=>{if(!confirm(`'${col.name}' 열을 삭제하시겠습니까?`))return;if(scope==='base'){invSt.baseCols=invSt.baseCols.filter(c=>c.id!==cid);invSt.rows.forEach(r=>delete r.base[cid]);}else{invCurTab().cols=invCurTab().cols.filter(c=>c.id!==cid);}if(invSt.sortCol?.cid===cid)invSt.sortCol=null;delete invSt.filters[cid];delete invSt.colWidths[cid];invSave();invRenderBody();invRenderActionBar();},'danger'));}
  document.body.appendChild(menu);
  menu.style.left=Math.min(e.clientX,window.innerWidth-170)+'px';menu.style.top=Math.min(e.clientY,window.innerHeight-260)+'px';
  setTimeout(()=>document.addEventListener('mousedown',function h(ev){if(!menu.contains(ev.target)){menu.remove();document.removeEventListener('mousedown',h);};}),10);
}

// ── 행 컨텍스트 메뉴 ──────────────────────────────────
function invOpenRowCtx(rid, e){
  invCloseFloats();
  const menu=document.createElement('div'); menu.className='inv-ctx-menu';
  menu.innerHTML=`<button class="inv-ctx-item" onclick="invCloseFloats();invInsertRow('${esc(rid)}','above')">↑ 위에 행 삽입</button>
    <button class="inv-ctx-item" onclick="invCloseFloats();invInsertRow('${esc(rid)}','below')">↓ 아래에 행 삽입</button>
    <div class="inv-ctx-sep"></div>
    <button class="inv-ctx-item danger" onclick="invCloseFloats();invDelRow('${esc(rid)}')">✕ 행 삭제</button>`;
  document.body.appendChild(menu);
  menu.style.left=Math.min(e.clientX,window.innerWidth-180)+'px';menu.style.top=Math.min(e.clientY,window.innerHeight-130)+'px';
  setTimeout(()=>document.addEventListener('mousedown',function h(ev){if(!menu.contains(ev.target)){menu.remove();document.removeEventListener('mousedown',h);};}),10);
}

// ── 인벤토리 모달 ─────────────────────────────────────
let _invModalCb=null;
function invOpenModal(title,bodyHtml,cb,okLabel='확인'){
  const bg=document.getElementById('inv-modal-bg'); if(!bg) return;
  document.getElementById('inv-modal-title').textContent=title;
  document.getElementById('inv-modal-body').innerHTML=bodyHtml;
  document.getElementById('inv-modal-ok').textContent=okLabel;
  _invModalCb=cb; bg.classList.add('open');
  setTimeout(()=>{const first=bg.querySelector('input,select,textarea');if(first)first.focus();},50);
}
function invCloseModal(){const bg=document.getElementById('inv-modal-bg');if(bg)bg.classList.remove('open');_invModalCb=null;_invSiData=[];}

// ── 상태값 편집 (모달 내) ─────────────────────────────
let _invSiData=[];
function _invRenderSiList(){
  const wrap=document.getElementById('inv-si-wrap');if(!wrap)return;wrap.innerHTML='';
  _invSiData.forEach((s,i)=>{
    const row=document.createElement('div');row.className='inv-si-row';
    const sw=document.createElement('div');sw.className='inv-si-swatch';sw.style.background=s.color;
    const pk=document.createElement('input');pk.type='color';pk.className='inv-si-color-inp';pk.value=s.color;
    pk.addEventListener('input',ev=>{_invSiData[i].color=ev.target.value;sw.style.background=ev.target.value;});
    sw.appendChild(pk);
    const ni=document.createElement('input');ni.type='text';ni.className='inv-si-name';ni.value=s.label;ni.placeholder='상태명';
    ni.addEventListener('input',ev=>{_invSiData[i].label=ev.target.value;});
    const db=document.createElement('button');db.className='inv-si-del';db.textContent='×';
    db.addEventListener('click',()=>{_invSiData.splice(i,1);_invRenderSiList();});
    row.appendChild(sw);row.appendChild(ni);row.appendChild(db);wrap.appendChild(row);
  });
}
function _invAddSiRow(){_invSiData.push({label:'',color:'#888888'});_invRenderSiList();const w=document.getElementById('inv-si-wrap');if(w){const l=w.querySelector('.inv-si-row:last-child .inv-si-name');if(l)l.focus();}}

// ── 탭 조작 ───────────────────────────────────────────
function invSetTab(i){invSt.activeTab=i;invSt.selected.clear();invSt.filters={};invSt.sortCol=null;invSave();invRenderTabs();invRenderActionBar();invRenderBody();}
function invDelTab(i){if(invSt.tabs.length<=1){alert('최소 1개 탭이 필요합니다.');return;}if(!confirm(`'${invSt.tabs[i].name}' 탭을 삭제하시겠습니까?`))return;invSt.tabs.splice(i,1);invSt.activeTab=Math.min(invSt.activeTab,invSt.tabs.length-1);invSave();invRenderTabs();invRenderActionBar();invRenderBody();}
function invOpenTabCtx(i,e){
  invCloseFloats();
  const tab=invSt.tabs[i]; if(!tab) return;
  const menu=document.createElement('div'); menu.className='inv-ctx-menu';
  const title=document.createElement('div');title.style.cssText='padding:5px 14px 4px;font-size:10px;color:var(--text3);font-weight:600;letter-spacing:.06em;border-bottom:1px solid var(--border);margin-bottom:2px';title.textContent=tab.name;menu.appendChild(title);
  const item=(icon,label,fn,cls='')=>{const btn=document.createElement('button');btn.className='inv-ctx-item'+(cls?' '+cls:'');btn.innerHTML=`<span style="width:16px;text-align:center;font-size:11px">${icon}</span>${label}`;btn.onclick=()=>{invCloseFloats();fn();};return btn;};
  const sep=()=>{const d=document.createElement('div');d.className='inv-ctx-sep';return d;};
  menu.appendChild(item('✎','이름/색상 변경',()=>invEditTab(i)));
  menu.appendChild(sep());
  menu.appendChild(item('×','탭 삭제',()=>invDelTab(i),'danger'));
  document.body.appendChild(menu);
  menu.style.left=Math.min(e.clientX,window.innerWidth-160)+'px';menu.style.top=Math.min(e.clientY,window.innerHeight-120)+'px';
  setTimeout(()=>document.addEventListener('mousedown',function h(ev){if(!menu.contains(ev.target)){menu.remove();document.removeEventListener('mousedown',h);};}),10);
}
function _invInitTabDrag(){
  const bar=document.getElementById('inv-tab-bar'); if(!bar) return;
  let dragIdx=null,dragEl=null,placeholder=null;
  bar.querySelectorAll('.inv-tab-drag-h').forEach(h=>{
    h.addEventListener('mousedown',e=>{
      if(!e.target.dataset.dh) return;
      e.preventDefault();e.stopPropagation();
      const grp=h.closest('.inv-tab-group'); if(!grp) return;
      dragIdx=+grp.dataset.tidx; dragEl=grp;
      dragEl.style.opacity='.4';
      placeholder=document.createElement('div');
      placeholder.className='inv-tab-drag-ph';
      placeholder.style.cssText=`display:inline-flex;width:${grp.offsetWidth}px;height:${grp.offsetHeight}px;border:2px dashed var(--border);border-radius:var(--r) var(--r) 0 0;margin-right:3px;flex-shrink:0;`;
      const mv=ev=>{
        const groups=[...bar.querySelectorAll('.inv-tab-group:not([style*="opacity"])')];
        let targetIdx=invSt.tabs.length;
        for(let g of groups){
          const r=g.getBoundingClientRect();
          if(ev.clientX<r.left+r.width/2){targetIdx=+g.dataset.tidx;break;}
        }
        placeholder.remove();
        const afterEl=bar.querySelectorAll('.inv-tab-group')[targetIdx];
        if(afterEl) bar.insertBefore(placeholder,afterEl); else bar.insertBefore(placeholder,bar.querySelector('.inv-tab-add'));
      };
      const up=ev=>{
        dragEl.style.opacity='';
        placeholder.remove();
        const groups=[...bar.querySelectorAll('.inv-tab-group:not([style*="opacity"])')];
        let toIdx=invSt.tabs.length; // 맨끝 드롭 시 마지막 위치로 (미리보기와 일치)
        for(let g of groups){
          const r=g.getBoundingClientRect();
          if(ev.clientX<r.left+r.width/2){toIdx=+g.dataset.tidx;break;}
        }
        if(toIdx!==dragIdx){
          const moved=invSt.tabs.splice(dragIdx,1)[0];
          const ni=toIdx>dragIdx?toIdx-1:toIdx;
          invSt.tabs.splice(ni,0,moved);
          if(invSt.activeTab===dragIdx) invSt.activeTab=ni;
          else if(invSt.activeTab>dragIdx&&invSt.activeTab<=ni) invSt.activeTab--;
          else if(invSt.activeTab<dragIdx&&invSt.activeTab>=ni) invSt.activeTab++;
          invSave();invRenderTabs();invRenderBody();
        }
        dragIdx=null;dragEl=null;placeholder=null;
        document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);
      };
      document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
    });
  });
}

// ── 사이드바 대장 드래그 ──────────────────────────────
function _invInitLedgerDrag() {
  const list = document.getElementById('inv-sb-list'); if(!list) return;
  let dragIdx=null, dragEl=null, placeholder=null;
  list.querySelectorAll('.inv-sb-drag-h').forEach(h => {
    h.addEventListener('mousedown', e => {
      e.preventDefault(); e.stopPropagation();
      const item = h.closest('.inv-sb-item'); if(!item) return;
      dragIdx = +item.dataset.lidx; dragEl = item;
      dragEl.style.opacity = '.4';
      placeholder = document.createElement('div');
      placeholder.className = 'inv-sb-drag-ph';
      placeholder.style.cssText = `height:${item.offsetHeight}px; border:1px dashed var(--border-h); background:rgba(0,0,0,0.05); margin:2px 0;`;
      const mv = ev => {
        const items = [...list.querySelectorAll('.inv-sb-item:not([style*="opacity"])')];
        let targetIdx = invLedgers.length;
        for(let it of items) {
          const r = it.getBoundingClientRect();
          if(ev.clientY < r.top + r.height/2) { targetIdx = +it.dataset.lidx; break; }
        }
        placeholder.remove();
        const afterEl = list.querySelectorAll('.inv-sb-item')[targetIdx];
        if(afterEl) list.insertBefore(placeholder, afterEl); else list.appendChild(placeholder);
      };
      const up = ev => {
        dragEl.style.opacity = '';
        placeholder.remove();
        const items = [...list.querySelectorAll('.inv-sb-item:not([style*="opacity"])')];
        let toIdx = invLedgers.length; // 맨끝 드롭 시 마지막 위치로 (미리보기와 일치)
        for(let it of items) {
          const r = it.getBoundingClientRect();
          if(ev.clientY < r.top + r.height/2) { toIdx = +it.dataset.lidx; break; }
        }
        if(toIdx !== dragIdx) {
          const moved = invLedgers.splice(dragIdx, 1)[0];
          const ni = toIdx > dragIdx ? toIdx - 1 : toIdx;
          invLedgers.splice(ni, 0, moved);
          invFlushSave(); invRenderSidebar();
        }
        document.removeEventListener('mousemove', mv);
        document.removeEventListener('mouseup', up);
      };
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });
  });
}

// ── 탭 추가/편집 ──────────────────────────────────────
function invAddTab(){
  invOpenModal('탭 추가',`<label class="inv-modal-label">탭 이름</label><input class="inv-modal-inp" id="im_name" placeholder="예: 네트워크" autocomplete="off">
    <label class="inv-modal-label">탭 색상</label>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">${INV_PAL.map(p=>`<button onclick="document.getElementById('im_color').value='${p}';this.parentElement.querySelectorAll('button').forEach(b=>b.style.outline='none');this.style.outline='2px solid var(--amber)'" style="width:24px;height:24px;background:${invLightBg(p)};border:2px solid ${p};border-radius:3px;cursor:pointer"></button>`).join('')}</div>
    <input type="color" id="im_color" value="${INV_PAL[invSt.tabs.length%INV_PAL.length]}" style="width:100%;height:32px;border:1px solid var(--border);border-radius:var(--r);cursor:pointer;background:var(--s2);margin-bottom:10px">`,
  ()=>{const n=document.getElementById('im_name').value.trim();if(!n)return false;const color=document.getElementById('im_color').value;invSt.tabs.push({id:invGenId(),name:n,color,cols:[]});invSt.activeTab=invSt.tabs.length-1;invSave();renderInventory();return true;},'추가');
}
function invEditTab(i){
  const tab=invSt.tabs[i]; if(!tab) return;
  const curColor=tab.color||INV_PAL[i%INV_PAL.length];
  invOpenModal('탭 편집',`<label class="inv-modal-label">탭 이름</label><input class="inv-modal-inp" id="im_name" value="${esc(tab.name)}" autocomplete="off">
    <label class="inv-modal-label">탭 색상</label>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">${INV_PAL.map(p=>`<button onclick="document.getElementById('im_color').value='${p}';document.getElementById('im_prev').style.borderColor='${p}';document.getElementById('im_prev').style.background='${invLightBg(p)}'" style="width:24px;height:24px;background:${invLightBg(p)};border:2px solid ${p};border-radius:3px;cursor:pointer"></button>`).join('')}</div>
    <input type="color" id="im_color" value="${curColor}" style="width:100%;height:32px;border:1px solid var(--border);border-radius:var(--r);cursor:pointer;background:var(--s2);margin-bottom:10px" oninput="document.getElementById('im_prev').style.borderColor=this.value;document.getElementById('im_prev').style.background='inherit'">
    <div id="im_prev" style="padding:6px 12px;border:2px solid ${curColor};background:${invLightBg(curColor)};border-radius:var(--r);font-size:13px;font-weight:600;color:var(--text)">${esc(tab.name)}</div>`,
  ()=>{const n=document.getElementById('im_name').value.trim();if(!n)return false;tab.name=n;tab.color=document.getElementById('im_color').value;invSave();renderInventory();return true;},'저장');
  setTimeout(()=>{const ni=document.getElementById('im_name'),pr=document.getElementById('im_prev');if(ni&&pr)ni.addEventListener('input',()=>{pr.textContent=ni.value||'미리보기';});},30);
}

// ── 열 조작 ───────────────────────────────────────────
function invAddBaseCol(){
  _invSiData=invClone(INV_DEFAULT_ST);
  invOpenModal('공통 열 추가',`<label class="inv-modal-label">열 이름</label><input class="inv-modal-inp" id="im_name" placeholder="예: IP주소" autocomplete="off">
    <label class="inv-modal-label">타입</label><select class="inv-modal-sel" id="im_type"><option value="text">텍스트</option><option value="status">상태 (드롭다운)</option></select>
    <div id="im_si_sec" style="display:none"><p class="inv-hint">상태값 목록</p><div class="inv-si-list" id="inv-si-wrap"></div><button class="inv-si-add" onclick="_invAddSiRow()">＋ 상태값 추가</button></div>`,
  ()=>{const n=document.getElementById('im_name').value.trim();if(!n)return false;const type=document.getElementById('im_type').value;const col={id:invGenId(),name:n,type};if(type==='status'){const v=_invSiData.filter(s=>s.label.trim());col.statuses=v.length?v.map(s=>({label:s.label.trim(),color:s.color})):invClone(INV_DEFAULT_ST);}invSt.baseCols.push(col);invSave();invRenderBody();invRenderActionBar();return true;},'추가');
  setTimeout(()=>{const te=document.getElementById('im_type'),ss=document.getElementById('im_si_sec');if(te&&ss){te.addEventListener('change',()=>{if(te.value==='status'){ss.style.display='block';_invRenderSiList();}else ss.style.display='none';});}},30);
}
function invAddTabCol(){
  const tab=invCurTab();if(!tab)return;
  _invSiData=invClone(INV_DEFAULT_ST);
  invOpenModal(`[${esc(tab.name)}] 열 추가`,`<label class="inv-modal-label">열 이름</label><input class="inv-modal-inp" id="im_name" placeholder="예: 메모" autocomplete="off">
    <label class="inv-modal-label">타입</label><select class="inv-modal-sel" id="im_type"><option value="text">텍스트</option><option value="status">상태 (드롭다운)</option></select>
    <div id="im_si_sec" style="display:none"><p class="inv-hint">상태값 목록</p><div class="inv-si-list" id="inv-si-wrap"></div><button class="inv-si-add" onclick="_invAddSiRow()">＋ 상태값 추가</button></div>`,
  ()=>{const n=document.getElementById('im_name').value.trim();if(!n)return false;const type=document.getElementById('im_type').value;const col={id:invGenId(),name:n,type};if(type==='status'){const v=_invSiData.filter(s=>s.label.trim());col.statuses=v.length?v.map(s=>({label:s.label.trim(),color:s.color})):invClone(INV_DEFAULT_ST);}tab.cols.push(col);invSave();invRenderBody();invRenderActionBar();return true;},'추가');
  setTimeout(()=>{const te=document.getElementById('im_type'),ss=document.getElementById('im_si_sec');if(te&&ss){te.addEventListener('change',()=>{if(te.value==='status'){ss.style.display='block';_invRenderSiList();}else ss.style.display='none';});}},30);
}
function invRenameCol(cid){invCloseFloats();const col=invFindCol(cid);if(!col)return;const n=prompt('열 이름 변경',col.name);if(!n?.trim())return;col.name=n.trim();invSave();invRenderBody();}
function invHideCol(cid){invCloseFloats();invSt.hiddenCols.add(cid);invSave();invRenderBody();}
function invShowCol(cid){invSt.hiddenCols.delete(cid);invSave();invRenderBody();}
function invCfgStatus(cid){
  invCloseFloats();const col=invFindCol(cid);if(!col)return;
  _invSiData=invClone(col.statuses||INV_DEFAULT_ST);
  invOpenModal(`[${esc(col.name)}] 상태값 설정`,`<p class="inv-hint">색상 칸 클릭 → color picker. 상태명 입력 후 저장.</p><div class="inv-si-list" id="inv-si-wrap"></div><button class="inv-si-add" onclick="_invAddSiRow()">＋ 상태값 추가</button>`,
  ()=>{const v=_invSiData.filter(s=>s.label.trim());if(!v.length){alert('최소 1개 필요');return false;}col.statuses=v.map(s=>({label:s.label.trim(),color:s.color}));invSave();invRenderBody();return true;},'저장');
  _invRenderSiList();
}
function invClearFilters(){invSt.filters={};invSt.sortCol=null;invSave();invRenderBody();invRenderActionBar();}

// ── 행 조작 ───────────────────────────────────────────
function invAddRow(){
  const noCol=invSt.baseCols.find(c=>c.nodels);
  const editCols=invSt.baseCols.filter(c=>c!==noCol);
  if(!invSt.baseCols.length){const r={id:invGenId(),base:{},data:{}};invSt.rows.push(r);invReorderNo();invSave();invRenderBody();return;}
  const formHtml=editCols.length?editCols.map(c=>{if(c.type==='status'){const sts=c.statuses||INV_DEFAULT_ST;return`<label class="inv-modal-label">${esc(c.name)}</label><select class="inv-modal-sel" id="im_${esc(c.id)}">${sts.map(s=>`<option>${esc(s.label)}</option>`).join('')}</select>`;}return`<label class="inv-modal-label">${esc(c.name)}</label><input class="inv-modal-inp" id="im_${esc(c.id)}" placeholder="" autocomplete="off">`;}).join(''):`<p style="color:var(--text3);font-size:13px">No만 있습니다. 행을 추가합니다.</p>`;
  invOpenModal('행 추가',formHtml,()=>{
    const base={};editCols.forEach(c=>{const el=document.getElementById(`im_${c.id}`);base[c.id]=el?el.value.trim():'';});
    if(editCols[0]&&!base[editCols[0].id]){alert(`'${editCols[0].name}'은 필수 입력입니다.`);return false;}
    invSt.rows.push({id:invGenId(),base,data:{}});invReorderNo();invSave();invRenderBody();return true;},'추가');
}
function invInsertRow(rid,pos){invCloseFloats();const idx=invSt.rows.findIndex(r=>r.id===rid);if(idx<0)return;invSt.rows.splice(pos==='above'?idx:idx+1,0,{id:invGenId(),base:{},data:{}});invReorderNo();invSave();invRenderBody();}
function invDelRow(rid){invCloseFloats();if(!confirm('이 행을 삭제하시겠습니까?'))return;invSt.rows=invSt.rows.filter(r=>r.id!==rid);invReorderNo();invSave();invRenderBody();}
function invDelSelected(){if(!invSt.selected.size){alert('삭제할 행을 선택하세요.');return;}if(!confirm(`${invSt.selected.size}개 행을 삭제하시겠습니까?`))return;invSt.rows=invSt.rows.filter(r=>!invSt.selected.has(r.id));invSt.selected.clear();invReorderNo();invSave();invRenderBody();}
function invSetBase(rid,cid,val){const r=invSt.rows.find(r=>r.id===rid);if(!r)return;if(!r.base)r.base={};r.base[cid]=val;invSave();}
function invSetTabData(rid,tid,cid,val){const r=invSt.rows.find(r=>r.id===rid);if(!r)return;if(!r.data)r.data={};if(!r.data[tid])r.data[tid]={};r.data[tid][cid]=val;invSave();}
function invSaveMemo(tid,val){if(!invSt.tabMemos)invSt.tabMemos={};invSt.tabMemos[tid]=val;invSave();}
function invAutoFitCol(cid){const nw=invAutoW(cid);if((invSt.colWidths[cid]||0)>nw)return;invSt.colWidths[cid]=nw;_invtApplyWidths();invSave();}
function _invCellInput(ta){
  ta.rows=Math.max(1,ta.value.split('\n').length);
  const cid=ta.dataset.cid; if(!cid) return;
  /* overflow:hidden 상태에선 scrollWidth가 clientWidth를 초과하지 않으므로 측정 전 해제 */
  ta.style.overflowX='auto';
  const sw=ta.scrollWidth;
  ta.style.overflowX='';
  if(sw>ta.clientWidth){
    invSt.colWidths[cid]=Math.min(INV_MAX_W,Math.max(invGetW(cid),sw+20));
    _invtApplyWidths();
    invSave();
  }
}

// ── 내보내기 (Excel XML) ──────────────────────────────
function invExport() {
  if (!invLedgers.length) {
    toast('내보낼 대장이 없습니다.');
    return;
  }
  const ledgerOptions = invLedgers.map(lg => `
    <label style="display:flex; align-items:center; gap:8px; padding:10px; border:1px solid var(--border); border-radius:var(--r); margin-bottom:8px; cursor:pointer">
      <input type="radio" name="export-ledger" value="${esc(lg.id)}" ${lg.id === invActiveLedgerId ? 'checked' : ''}>
      <span style="font-size:14px; color:var(--text)">${esc(lg.name)}</span>
      <span style="margin-left:auto; font-size:11px; color:var(--text3)">${lg.data.tabs.length}개 탭</span>
    </label>
  `).join('');
  const bodyHtml = `
    <div style="margin-bottom:15px; font-size:13px; color:var(--text2)">내보낼 대장을 선택하세요:</div>
    <div id="export-ledger-list" style="max-height:300px; overflow-y:auto; padding-right:5px">
      ${ledgerOptions}
    </div>
  `;
  invOpenModal('대장 내보내기 (1/2)', bodyHtml, () => {
    const selectedId = document.querySelector('input[name="export-ledger"]:checked')?.value;
    if (!selectedId) return false;
    invShowTabSelection(selectedId);
    return false; // 탭 선택 단계로 교체하므로 자동 닫기 방지
  }, '다음');
}

function invShowTabSelection(ledgerId) {
  const ledger = invLedgers.find(l => l.id === ledgerId);
  if (!ledger) return;
  const tabOptions = ledger.data.tabs.map((tab, idx) => `
    <label style="display:flex; align-items:center; gap:8px; padding:10px; border:1px solid var(--border); border-radius:var(--r); margin-bottom:8px; cursor:pointer">
      <input type="checkbox" name="export-tabs" value="${idx}" checked>
      <span style="font-size:14px; color:var(--text)">${esc(tab.name)}</span>
      <span style="margin-left:auto; font-size:11px; color:var(--text3)">${tab.cols.length}개 컬럼</span>
    </label>
  `).join('');
  const bodyHtml = `
    <div style="margin-bottom:15px; font-size:13px; color:var(--text2)">
      <strong>${esc(ledger.name)}</strong> 대장에서 내보낼 탭을 선택하세요:
    </div>
    <div style="display:flex; gap:10px; margin-bottom:10px">
      <button class="btn btn-ghost btn-sm" onclick="document.querySelectorAll('input[name=\\'export-tabs\\']').forEach(i=>i.checked=true)">전체 선택</button>
      <button class="btn btn-ghost btn-sm" onclick="document.querySelectorAll('input[name=\\'export-tabs\\']').forEach(i=>i.checked=false)">전체 해제</button>
    </div>
    <div id="export-tab-list" style="max-height:300px; overflow-y:auto; padding-right:5px">
      ${tabOptions}
    </div>
  `;
  invOpenModal('탭 선택 (2/2)', bodyHtml, () => {
    const selectedIndices = Array.from(document.querySelectorAll('input[name="export-tabs"]:checked')).map(i => parseInt(i.value));
    if (!selectedIndices.length) {
      toast('최소 하나의 탭을 선택해야 합니다.');
      return;
    }
    invPerformExport(ledgerId, selectedIndices);
  }, '엑셀 다운로드');
}

function invPerformExport(ledgerId, tabIndices) {
  const ledger = invLedgers.find(l => l.id === ledgerId);
  if (!ledger) return;
  const ledgerData = ledger.data;
  const ledgerName = ledger.name;
  let xml = `<?xml version="1.0" encoding="utf-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="맑은 고딕" x:CharSet="129" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="맑은 고딕" x:CharSet="129" x:Family="Swiss" ss:Size="11" ss:Color="#000000" ss:Bold="1"/>
   <Interior ss:Color="#E2E2E2" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
  </Style>
  <Style ss:ID="Cell">
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
  </Style>
 </Styles>`;
  const escXml = v => String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
  tabIndices.forEach(idx => {
    const tab = ledgerData.tabs[idx];
    xml += `\n <Worksheet ss:Name="${escXml(tab.name)}">`;
    xml += `\n  <Table>`;
    const allCols = [...ledgerData.baseCols, ...tab.cols];
    xml += `\n   <Row ss:Height="20">`;
    allCols.forEach(col => {
      xml += `\n    <Cell ss:StyleID="Header"><Data ss:Type="String">${escXml(col.name)}</Data></Cell>`;
    });
    xml += `\n   </Row>`;
    ledgerData.rows.forEach(row => {
      xml += `\n   <Row ss:AutoFitHeight="1">`;
      allCols.forEach(col => {
        const isBase = !!ledgerData.baseCols.find(c => c.id === col.id);
        const val = isBase ? (row.base[col.id] || '') : ((row.data?.[tab.id]?.[col.id]) || '');
        xml += `\n    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escXml(val)}</Data></Cell>`;
      });
      xml += `\n   </Row>`;
    });
    xml += `\n  </Table>`;
    xml += `\n </Worksheet>`;
  });
  xml += `\n</Workbook>`;
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a');
  const fileName = `${ledgerName.replace(/[\/\\?%*:|"<>]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xls`;
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`엑셀 내보내기 완료 (${tabIndices.length}개 탭)`);
}

// ── 초기화 (DOM 로드 후 모달 버튼 연결) ───────────────
document.addEventListener('DOMContentLoaded', () => {
  const bg = document.getElementById('inv-modal-bg');
  if (bg) {
    const okBtn = document.getElementById('inv-modal-ok');
    const cancelBtn = document.getElementById('inv-modal-cancel');
    if (okBtn) okBtn.addEventListener('click', () => { if (_invModalCb) { const ok = _invModalCb(); if (ok === false) return; } invCloseModal(); });
    if (cancelBtn) cancelBtn.addEventListener('click', invCloseModal);
    bg.addEventListener('click', e => { if (e.target === bg) invCloseModal(); });
  }
});
