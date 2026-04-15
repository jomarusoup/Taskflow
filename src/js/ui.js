/**
 * ui.js - 공통 UI 요소 (테마, 폰트, 토스트, 시계, 마크다운, 공통 섹션 토글)
 */

// ── THEME ─────────────────────────────────────────────
function applyTheme(theme){
  document.documentElement.setAttribute('data-theme',theme);
  localStorage.setItem(THEME_KEY,theme);
  const isDark=theme==='dark';
  const icon = document.getElementById('theme-icon');
  const label = document.getElementById('theme-label');
  if (icon) icon.textContent=isDark?'☾':'☀';
  if (label) label.textContent=isDark?'다크 모드':'라이트 모드';
}
function toggleTheme(){applyTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark');}

// ── FONT ──────────────────────────────────────────────
const FONTS = [
  { key: 'system',    label: '시스템 기본',    sans: '-apple-system,BlinkMacSystemFont,"Segoe UI","Malgun Gothic","Apple SD Gothic Neo",sans-serif', mono: 'Consolas,"D2Coding",Menlo,"Courier New",monospace' },
  { key: 'malgun',    label: '맑은 고딕',      sans: '"Malgun Gothic",sans-serif',                                                                    mono: 'Consolas,monospace' },
  { key: 'd2coding',  label: 'D2Coding',       sans: '"D2Coding","Malgun Gothic",sans-serif',                                                         mono: '"D2Coding",monospace' },
  { key: 'nanum',     label: '나눔고딕',       sans: '"NanumGothic","Malgun Gothic",sans-serif',                                                      mono: '"NanumGothicCoding",Consolas,monospace' },
  { key: 'pretendard',label: 'Pretendard',     sans: '"Pretendard","Malgun Gothic",sans-serif',                                                       mono: 'Consolas,monospace' },
  { key: 'gothic',    label: 'Apple SD Gothic',sans: '"Apple SD Gothic Neo","Malgun Gothic",sans-serif',                                              mono: 'Menlo,Consolas,monospace' },
];

function applyFont(key) {
  const f = FONTS.find(x => x.key === key) || FONTS[0];
  document.documentElement.style.setProperty('--sans', f.sans);
  document.documentElement.style.setProperty('--mono', f.mono);
  localStorage.setItem(FONT_KEY, key);
  // 드롭다운 동기화
  const sel = document.getElementById('font-select');
  if (sel) sel.value = key;
}

function renderFontSelect() {
  const sel = document.getElementById('font-select');
  if (!sel) return;
  const cur = localStorage.getItem(FONT_KEY) || 'system';
  sel.innerHTML = FONTS.map(f => `<option value="${f.key}" ${cur===f.key?'selected':''}>${f.label}</option>`).join('');
  sel.value = cur;
}

// ── CLOCK ─────────────────────────────────────────────
function updateClock(){
  const n=new Date(),p=v=>String(v).padStart(2,'0');
  const clock = document.getElementById('clock');
  const clockDate = document.getElementById('clock-date');
  const dashDateLabel = document.getElementById('dash-date-label');
  if (clock) clock.textContent=`${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`;
  const days=['일','월','화','수','목','금','토'];
  const ds=`${n.getFullYear()}.${p(n.getMonth()+1)}.${p(n.getDate())} (${days[n.getDay()]})`;
  if (clockDate) clockDate.textContent=ds;
  if (dashDateLabel) dashDateLabel.textContent=ds+' 현황';
}

// ── TOAST ─────────────────────────────────────────────
function toast(msg){
  const c=document.getElementById('toast-container');
  if (!c) return;
  const el=document.createElement('div');el.className='toast';
  const dot=document.createElement('div');dot.className='toast-dot';el.appendChild(dot);el.appendChild(document.createTextNode(msg));
  c.appendChild(el);setTimeout(()=>el.remove(),2500);
}

// ── SECTION TOGGLE ────────────────────────────────────
const sectionCollapsed = {};
const _secOpen = {font:true, help:false, backup:true, cats:true, tags:true, pri:true, status:true};
const _dashBodyMap = {weekly:'weekly-list', rec:'rec-list', annual:'annual-grid'};

function toggleSection(id) {
  if (_dashBodyMap[id] !== undefined) {
    sectionCollapsed[id] = !sectionCollapsed[id];
    const body    = document.getElementById(_dashBodyMap[id]);
    const chevron = document.getElementById('chevron-' + id);
    if (body)    body.classList.toggle('collapsed', !!sectionCollapsed[id]);
    if (chevron) chevron.classList.toggle('collapsed', !!sectionCollapsed[id]);
    return;
  }
  _secOpen[id] = !_secOpen[id];
  const body = document.getElementById('sec-body-'+id);
  const chev = document.getElementById('sec-chev-'+id);
  if (body) body.style.display = _secOpen[id] ? '' : 'none';
  if (chev) { chev.style.transform = _secOpen[id] ? 'rotate(90deg)' : ''; chev.textContent = _secOpen[id] ? '▼' : '▶'; }
}
function toggleHelp() { toggleSection('help'); }

// ── MARKDOWN ──────────────────────────────────────────
function parseMarkdown(md){
  if(!md)return '<span style="color:var(--text3);font-style:italic">메모 없음</span>';

  // 1. 코드 블록 먼저 추출 (내부 처리 방지)
  const codeBlocks = [];
  let h = esc(md).replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    codeBlocks.push(`<pre><code>${code.trimEnd()}</code></pre>`);
    return `\x00CODE${codeBlocks.length-1}\x00`;
  });

  // 2. 헤더
  h=h.replace(/^### (.+)$/gm,'<h3>$1</h3>');
  h=h.replace(/^## (.+)$/gm,'<h2>$1</h2>');
  h=h.replace(/^# (.+)$/gm,'<h1>$1</h1>');
  h=h.replace(/^---$/gm,'<hr>');
  h=h.replace(/^&gt; (.+)$/gm,'<blockquote>$1</blockquote>');

  // 3. 중첩 리스트 파싱 (들여쓰기 레벨 처리)
  const lines = h.split('\n');
  const out = [];
  let listStack = []; // [{type:'ul'|'ol', indent:N}]

  function closeListsTo(targetIndent) {
    while (listStack.length && listStack[listStack.length-1].indent > targetIndent) {
      out.push('</' + listStack.pop().type + '>');
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    // 체크박스
    const cbX  = raw.match(/^( *)- \[x\] (.+)$/);
    const cbO  = raw.match(/^( *)- \[ \] (.+)$/);
    const ulM  = raw.match(/^( *)[-*] (.+)$/);
    const olM  = raw.match(/^( *)\d+\. (.+)$/);

    if (cbX || cbO || ulM || ulM || olM) {
      const match = cbX || cbO || ulM || olM;
      if (!match) continue;
      const spaces = match[1].length;
      const indent  = Math.floor(spaces / 2); // 2칸 또는 4칸 들여쓰기 허용
      const type    = (olM && !cbX && !cbO) ? 'ol' : 'ul';
      const content = cbX ? `<input type="checkbox" checked disabled> ${cbX[2]}`
                    : cbO ? `<input type="checkbox" disabled> ${cbO[2]}`
                    : ulM ? ulM[2] : olM[2];

      // 현재보다 깊은 레벨: 새 리스트 열기
      if (!listStack.length || indent > listStack[listStack.length-1].indent) {
        out.push(`<${type}>`);
        listStack.push({type, indent});
      }
      // 현재보다 얕은 레벨: 상위로 닫기
      else if (indent < listStack[listStack.length-1].indent) {
        closeListsTo(indent);
      }
      out.push(`<li>${content}</li>`);
    } else {
      // 리스트 아닌 줄 → 모든 열린 리스트 닫기
      closeListsTo(-1);
      out.push(raw);
    }
  }
  closeListsTo(-1);
  h = out.join('\n');

  // 4. 테이블
  h=h.replace(/^(\|.+\|)\n\|[-| :]+\|\n((?:\|.+\|\n?)*)/gm, (_, hdrLine, bodyLines) => {
    const ths = hdrLine.split('|').filter((_,i,a)=>i>0&&i<a.length-1)
      .map(c=>`<th>${c.trim()}</th>`).join('');
    const trs = bodyLines.trim().split('\n').map(row =>
      '<tr>' + row.split('|').filter((_,i,a)=>i>0&&i<a.length-1)
        .map(c=>`<td>${c.trim()}</td>`).join('') + '</tr>'
    ).join('');
    return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
  });

  // 5. 인라인 스타일
  h=h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  h=h.replace(/\*(.+?)\*/g,'<em>$1</em>');
  h=h.replace(/`(.+?)`/g,'<code>$1</code>');
  h=h.replace(/\[(.+?)\]\((.+?)\)/g,(_,text,url)=>{
    const safe=/^(javascript|data|vbscript):/i.test(url.trim())?'#':url;
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });

  // 6. 일반 텍스트 줄 → <p> (이미 HTML 태그인 줄 제외, 들여쓰기 공백 보존)
  h=h.replace(/^(?!<[a-zA-Z\/\x00]).+$/gm, line => {
    // 줄 앞 공백을 &nbsp;로 변환
    const indented = line.replace(/^ +/, sp => '&nbsp;'.repeat(sp.length));
    return `<p>${indented}</p>`;
  });

  // 7. 코드 블록 복원
  h = h.replace(/\x00CODE(\d+)\x00/g, (_, i) => codeBlocks[parseInt(i)]);

  return h;
}

// ── SETTINGS RENDERING ────────────────────────────────
function renderSettings(){
  document.getElementById('settings-cats').innerHTML = settings.categories.length
    ? settings.categories.map((c,i)=>`
      <div class="settings-item" id="scat-${i}">
        <span class="settings-item-label" id="scat-label-${i}">${esc(c)}</span>
        <span class="settings-item-sub">${tasks.filter(t=>t.category===c).length}개 업무</span>
        <button class="btn btn-ghost btn-sm btn-icon" onclick="editInline('scat',${i},'categories')" title="수정">✎</button>
        <button class="btn btn-danger btn-sm btn-icon" onclick="removeSetting('categories',${i},'category')" title="삭제">✕</button>
      </div>`).join('')
    : '<div style="padding:8px 16px;color:var(--text2);font-size:12px">카테고리 없음</div>';

  document.getElementById('settings-tags').innerHTML = settings.tags.length
    ? settings.tags.map((tag,i)=>`
      <div class="settings-item" id="stag-${i}">
        <span class="settings-item-label" id="stag-label-${i}">${esc(tag)}</span>
        <span class="settings-item-sub">${tasks.filter(t=>t.tags.includes(tag)).length}개 업무</span>
        <button class="btn btn-ghost btn-sm btn-icon" onclick="editInline('stag',${i},'tags')" title="수정">✎</button>
        <button class="btn btn-danger btn-sm btn-icon" onclick="removeSetting('tags',${i},'tag')" title="삭제">✕</button>
      </div>`).join('')
    : '<div style="padding:8px 16px;color:var(--text2);font-size:12px">태그 없음</div>';

  document.getElementById('settings-priorities').innerHTML = settings.priorities.map((p,i)=>`
    <div class="settings-item" id="spri-${i}">
      <input type="color" class="settings-color-input" value="${colorHex(p.color)}"
        onchange="updatePriColor(${i},this.value)" title="색상 변경">
      <span class="pri" style="${priStyle(p.key)};min-width:64px;text-align:center">${esc(p.label)}</span>
      <span class="settings-item-sub" style="font-family:var(--mono)">${p.key}</span>
      <span class="settings-item-sub" style="margin-left:auto">${tasks.filter(t=>t.priority===p.key).length}개</span>
      <button class="btn btn-ghost btn-sm btn-icon" onclick="editPriLabel(${i})" title="이름 수정">✎</button>
      <button class="btn btn-danger btn-sm btn-icon" onclick="removePriority(${i})" title="삭제">✕</button>
    </div>`).join('');

  document.getElementById('settings-statuses').innerHTML = settings.statuses.map((s,i)=>{
    const inKanban   = s.showInKanban   !== false;
    const inCalendar = s.showInCalendar !== false;
    const col = s.color || '#5E6C88';
    return `
    <div class="settings-item" id="sst-${i}">
      <input type="color" class="settings-color-input" value="${colorHex(col)}"
        onchange="updateStatusColor(${i},this.value)" title="색상 변경">
      <span class="status status-dynamic"
        style="min-width:88px;text-align:center;color:${col};background:${col}22;border:1px solid ${col}44"
      >${esc(s.label)}</span>
      <span class="settings-item-sub" style="font-family:var(--mono)">${s.key}</span>
      <label class="kanban-toggle-label" title="칸반 보드 표시">
        <input type="checkbox" class="kanban-toggle-cb" ${inKanban?'checked':''}
          onchange="toggleKanbanStatus(${i},this.checked)">
        <span class="kanban-toggle-txt">칸반</span>
      </label>
      <label class="kanban-toggle-label" title="캘린더 표시">
        <input type="checkbox" class="kanban-toggle-cb" ${inCalendar?'checked':''}
          onchange="toggleCalendarStatus(${i},this.checked)">
        <span class="kanban-toggle-txt">캘린더</span>
      </label>
      <span class="settings-item-sub" style="margin-left:auto">${tasks.filter(t=>t.status===s.key).length}개</span>
      <button class="btn btn-ghost btn-sm btn-icon" onclick="editStatusLabel(${i})" title="이름 수정">✎</button>
      <button class="btn btn-danger btn-sm btn-icon" onclick="removeStatus(${i})" title="삭제">✕</button>
    </div>`;
  }).join('');
}

function colorHex(cssVal){
  const map={'var(--orange)':'#F07040','var(--red)':'#E05C6A','var(--amber)':'#F4A832','var(--text3)':'#424E66','var(--blue)':'#6AADFF','var(--green)':'#3DDC97'};
  return map[cssVal] || (cssVal.startsWith('#') ? cssVal : '#888888');
}

function editInline(prefix, idx, type){
  const label = document.getElementById(`${prefix}-label-${idx}`);
  const cur   = type==='categories' ? settings.categories[idx] : settings.tags[idx];
  label.style.display='none';
  const inp = document.createElement('input');
  inp.className='settings-inline-input'; inp.value=cur; inp.style.flex='1';
  label.parentNode.insertBefore(inp, label);
  inp.focus(); inp.select();
  function commit(){
    const val=inp.value.trim();
    if(val && val!==cur){
      if(type==='categories') tasks.forEach(t=>{if(t.category===cur)t.category=val;});
      else tasks.forEach(t=>{t.tags=t.tags.map(tg=>tg===cur?val:tg);});
      settings[type][idx]=val;
      save(); saveSettings(); toast(`"${cur}" → "${val}" 수정 완료`);
    }
    inp.remove(); label.style.display='';
    renderSettings(); renderAll();
  }
  inp.addEventListener('blur', commit);
  inp.addEventListener('keydown', e=>{ if(e.key==='Enter')inp.blur(); if(e.key==='Escape'){inp.remove();label.style.display='';} });
}

function editPriLabel(idx){
  const row  = document.getElementById(`spri-${idx}`);
  const badge= row.querySelector('.pri');
  const cur  = settings.priorities[idx].label;
  badge.style.display='none';
  const inp=document.createElement('input');
  inp.className='settings-inline-input'; inp.value=cur; inp.style.width='120px';
  badge.parentNode.insertBefore(inp, badge);
  inp.focus(); inp.select();
  function commit(){
    const val=inp.value.trim();
    if(val&&val!==cur){ settings.priorities[idx].label=val; saveSettings(); toast(`우선순위 이름 수정: "${val}"`); }
    inp.remove(); badge.style.display=''; renderSettings(); updateFilterDropdowns();
  }
  inp.addEventListener('blur',commit);
  inp.addEventListener('keydown',e=>{if(e.key==='Enter')inp.blur();if(e.key==='Escape'){inp.remove();badge.style.display='';}});
}

function updatePriColor(idx, hexVal){ settings.priorities[idx].color=hexVal; saveSettings(); renderSettings(); renderAll(); }

function addPriority(){
  const key  = document.getElementById('new-pri-key').value.trim().toLowerCase().replace(/\s+/g,'-');
  const label= document.getElementById('new-pri-label').value.trim();
  const color= document.getElementById('new-pri-color').value;
  if(!key||!label){toast('키와 이름을 모두 입력하세요');return;}
  if(settings.priorities.some(p=>p.key===key)){toast('이미 존재하는 키');return;}
  settings.priorities.push({key,label,color});
  saveSettings();
  document.getElementById('new-pri-key').value='';
  document.getElementById('new-pri-label').value='';
  renderSettings(); updateFilterDropdowns(); toast(`우선순위 "${label}" 추가`);
}

function removePriority(idx){
  const p=settings.priorities[idx];
  const cnt=tasks.filter(t=>t.priority===p.key).length;
  if(!confirm(`"${p.label}" 우선순위를 삭제하시겠습니까?\n(연결된 업무 ${cnt}개는 유지됩니다)`))return;
  settings.priorities.splice(idx,1);
  saveSettings(); renderSettings(); updateFilterDropdowns(); toast('삭제됨');
}

function editStatusLabel(idx){
  const row  = document.getElementById(`sst-${idx}`);
  const badge= row.querySelector('.status');
  const cur  = settings.statuses[idx].label;
  badge.style.display='none';
  const inp=document.createElement('input');
  inp.className='settings-inline-input'; inp.value=cur; inp.style.width='130px';
  badge.parentNode.insertBefore(inp, badge);
  inp.focus(); inp.select();
  function commit(){
    const val=inp.value.trim();
    if(val&&val!==cur){ settings.statuses[idx].label=val; saveSettings(); toast(`상태 이름 수정: "${val}"`); }
    inp.remove(); badge.style.display=''; renderSettings(); updateFilterDropdowns();
  }
  inp.addEventListener('blur',commit);
  inp.addEventListener('keydown',e=>{if(e.key==='Enter')inp.blur();if(e.key==='Escape'){inp.remove();badge.style.display='';}});
}

function updateStatusColor(idx, hexVal){ settings.statuses[idx].color=hexVal; saveSettings(); renderSettings(); renderAll(); }

function toggleCalendarStatus(idx, checked){
  settings.statuses[idx].showInCalendar=checked;
  saveSettings(); renderSettings(); renderCalendar();
  toast(`"${settings.statuses[idx].label}" 캘린더 ${checked?'표시':'숨김'}`);
}

function toggleKanbanStatus(idx, checked){
  settings.statuses[idx].showInKanban=checked;
  saveSettings(); renderSettings(); renderKanban();
  toast(`"${settings.statuses[idx].label}" 칸반 ${checked?'표시':'숨김'}`);
}

function addStatus(){
  const key   = document.getElementById('new-st-key').value.trim().toLowerCase().replace(/\s+/g,'-');
  const label = document.getElementById('new-st-label').value.trim();
  const color = document.getElementById('new-st-color').value || '#888888';
  if(!key||!label){toast('키와 이름을 모두 입력하세요');return;}
  if(settings.statuses.some(s=>s.key===key)){toast('이미 존재하는 키');return;}
  settings.statuses.push({key, label, color, showInKanban:true, showInCalendar:true});
  saveSettings();
  document.getElementById('new-st-key').value='';
  document.getElementById('new-st-label').value='';
  renderSettings(); updateFilterDropdowns(); toast(`상태 "${label}" 추가`);
}

function removeStatus(idx){
  const s=settings.statuses[idx];
  const cnt=tasks.filter(t=>t.status===s.key).length;
  if(!confirm(`"${s.label}" 상태를 삭제하시겠습니까?\n(연결된 업무 ${cnt}개는 유지됩니다)`))return;
  settings.statuses.splice(idx,1);
  saveSettings(); renderSettings(); updateFilterDropdowns(); toast('삭제됨');
}

function addCategory(){
  const input=document.getElementById('new-cat-input');
  const val=input.value.trim();
  if(!val)return;
  if(settings.categories.includes(val)){toast('이미 존재하는 카테고리');return;}
  settings.categories.push(val);
  saveSettings(); input.value=''; renderSettings(); toast(`카테고리 "${val}" 추가`);
}

function addTag(){
  const input=document.getElementById('new-tag-input');
  const val=input.value.trim();
  if(!val)return;
  if(settings.tags.includes(val)){toast('이미 존재하는 태그');return;}
  settings.tags.push(val);
  saveSettings(); input.value=''; renderSettings(); toast(`태그 "${val}" 추가`);
}

function removeSetting(type,idx,kind){
  const item=settings[type][idx];
  if(!confirm(`"${item}" 를 삭제하시겠습니까?`))return;
  settings[type].splice(idx,1);
  saveSettings(); renderSettings(); updateFilterDropdowns(); toast('삭제됨');
}
