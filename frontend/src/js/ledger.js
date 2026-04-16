/**
 * ledger.js - 업무대장 (리스트/그룹 뷰), 필터링, 정렬, 상세 패널
 */

let ledgerMode = 'list'; // 'list' | 'group'
let ledgerSort = { key: 'id', dir: -1 };
let grpSort = {}; // {category: {key, dir}}
let grpOpen = new Set();
let grpExpandedId = null; // 그룹 모드 인라인 상세
const mselState = { status: new Set(), priority: new Set(), cat: new Set() };
const _epCatState = {};    // taskId → string[] (상세패널 카테고리)
const _epTagState = {};    // taskId → string[] (상세패널 태그)
const _epLinkedState = {}; // taskId → string[] (상세패널 연결업무)

function setLedgerMode(mode) {
  ledgerMode = mode;
  const listBtn = document.getElementById('ledger-toggle-list');
  const groupBtn = document.getElementById('ledger-toggle-group');
  if (listBtn) listBtn.classList.toggle('active', mode === 'list');
  if (groupBtn) groupBtn.classList.toggle('active', mode === 'group');
  renderLedger();
}

function renderLedger(){
  const badge = document.getElementById('badge-ledger');
  const activeTasks = tasks.filter(t => !t.linkedSourceType && t.status !== 'archived');
  if (badge) badge.textContent = activeTasks.length;

  let list = tasks.filter(t => !t.linkedSourceType);
  const search = (document.getElementById('ledger-search')?.value || '').trim().toLowerCase();
  const tag = (document.getElementById('ledger-tag')?.value || '').trim().toLowerCase();
  const selSt = mselState.status;
  const selPri = mselState.priority;
  const selCat = mselState.cat;

  if(search) list = list.filter(t => t.title.toLowerCase().includes(search) || (t.memo||'').toLowerCase().includes(search));
  if(selSt.size)  list = list.filter(t => selSt.has(t.status));
  if(selPri.size) list = list.filter(t => selPri.has(t.priority));
  if(selCat.size && ledgerMode !== 'group') list = list.filter(t => (t.category||'').split(',').map(s=>s.trim()).some(c=>selCat.has(c)));
  if(tag)         list = list.filter(t => t.tags.some(tg => tg.toLowerCase().includes(tag)));

  // 정렬 적용
  list = _applyLedgerSort(list);
  _updateSortHeaders();

  const tableWrap = document.getElementById('ledger-table-wrap');
  const groupWrap = document.getElementById('ledger-group-wrap');
  if (!tableWrap || !groupWrap) return;

  if (ledgerMode === 'group') {
    tableWrap.style.display = 'none';
    groupWrap.classList.add('visible');
    _renderLedgerGroup(list);
    return;
  }

  // ── 리스트 모드 ──────────────────────────────────
  tableWrap.style.display = '';
  groupWrap.classList.remove('visible');

  const tbody = document.getElementById('ledger-tbody');
  if (!tbody) return;
  if (!list.length) { tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:32px;color:var(--text2)">조건에 맞는 업무 없음</td></tr>`; return; }

  tbody.innerHTML = list.map(t => {
    const isExp = expandedId === t.id;
    const ovd = isOverdue(t);
    const assigneeNames = (t.assigneeIds||[]).map(id => { const c = contacts.find(x => x.id === id); return c ? esc(c.name) : null; }).filter(Boolean);
    const assigneeLabel = assigneeNames.length ? assigneeNames.join(', ') : '—';

    return `
    <tr class="data-row">
      <td class="td-id">${t.id}</td>
      <td class="td-title"><div class="td-title-inner">
        <button class="expand-btn ${isExp?'open':''}" onclick="toggleExpand('${t.id}')" title="상세 편집">▶</button>
        <span class="td-title-text" title="${esc(t.title)}" ondblclick="startTitleEdit('${esc(t.id)}', this)" style="cursor:text">${esc(t.title)}</span>
      </div></td>
      <td class="td-date">${fmtDate(t.startDate)}</td>
      <td class="td-date ${ovd?'overdue':''}">${fmtDate(t.dueDate)}</td>
      <td class="td-nowrap" style="font-size:12px;color:var(--text2)">${esc(t.category||'—')}</td>
      <td class="td-nowrap"><span class="pri" style="${priStyle(t.priority)}">${priLabel(t.priority)}</span></td>
      <td class="td-nowrap">${statusBadge(t.status)}</td>
      <td class="td-nowrap" style="font-size:11px;color:var(--text2)">${assigneeLabel}</td>
      <td class="td-nowrap">${t.tags.map(tg => `<span class="tag" style="margin-right:3px">${esc(tg)}</span>`).join('')}</td>
      <td class="td-date td-nowrap">${t.completedAt?fmtDate(t.completedAt.split('T')[0]):'—'}</td>
      <td class="td-actions"><button class="btn btn-danger btn-sm btn-icon" onclick="confirmDelete('${t.id}')">✕</button></td>
    </tr>
    <tr class="expand-row ${isExp?'open':''}" id="exp-row-${t.id}">
      <td colspan="11">${isExp?buildExpandPanel(t):''}</td>
    </tr>`;
  }).join('');

  if (expandedId) {
    const ta = document.getElementById('ep-memo-' + expandedId);
    if (ta) {
      attachMemoTabKey(ta);
      autoGrowTextarea(ta);
      ta.addEventListener('keydown', e => { if((e.ctrlKey||e.metaKey) && e.key === 's'){ e.preventDefault(); saveExpandRow(expandedId); } });
    }
    renderEpCatMulti(expandedId);
    renderEpTagMulti(expandedId);
    renderEpLinkedTaskMulti(expandedId);
  }
}

function _renderLedgerGroup(list) {
  window._lastGrpList = list;
  const wrap = document.getElementById('ledger-group-wrap');
  if (!wrap) return;
  if (!list.length) { wrap.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);font-size:13px">조건에 맞는 업무 없음</div>'; return; }

  // 다중 카테고리: category 필드를 쉼표로 분리해 각 그룹에 배치
  const groups = {};
  list.forEach(t => {
    const cats = (t.category || '').split(',').map(c => c.trim()).filter(Boolean);
    if (!cats.length) cats.push('미분류');
    cats.forEach(cat => { if (!groups[cat]) groups[cat] = []; groups[cat].push(t); });
  });
  const orderedCats = [ ...settings.categories.filter(c => groups[c]), ...(groups['미분류'] ? ['미분류'] : []) ];
  if (grpOpen.size === 0) orderedCats.forEach(c => grpOpen.add(c));

  wrap.innerHTML = orderedCats.map(cat => {
    const items = _applyGrpSort(groups[cat], cat);
    const isOpen = grpOpen.has(cat);
    const doneCount = items.filter(t => t.status === 'done').length;
    const overdueCount = items.filter(t => isOverdue(t)).length;

    const rows = items.map(t => {
      const isExp = grpExpandedId === t.id;
      const ovd = isOverdue(t);
      const tags = t.tags.slice(0,3).map(tg => `<span class="tag">${esc(tg)}</span>`).join('');
      const assigneeNames = (t.assigneeIds||[]).map(id => { const c = contacts.find(x => x.id === id); return c ? esc(c.name) : null; }).filter(Boolean);
      const assigneeLabel = assigneeNames.length ? assigneeNames.join(', ') : '—';
      const accentBar = `<div style="width:3px;height:14px;border-radius:2px;background:${accentColor(t.priority)};flex-shrink:0"></div>`;
      const expandRows = isExp ? `<tr class="expand-row open" id="grp-exp-row-${t.id}"><td colspan="9" style="padding:0">${buildExpandPanel(t)}</td></tr>` : '';
      return `<tr class="data-row" onclick="toggleGrpExpand('${esc(t.id)}')">
        <td class="grp-row-id">${t.id}</td>
        <td class="td-title"><div class="td-title-inner">
          <button class="expand-btn ${isExp?'open':''}" onclick="event.stopPropagation();toggleGrpExpand('${esc(t.id)}')">▶</button>
          ${accentBar}
          <span class="td-title-text" title="${esc(t.title)}">${esc(t.title)}</span>
        </div></td>
        <td class="grp-row-date">${fmtDate(t.startDate)}</td>
        <td class="grp-row-date ${ovd?'overdue':''}">${fmtDate(t.dueDate)}</td>
        <td><span class="pri" style="${priStyle(t.priority)}">${priLabel(t.priority)}</span></td>
        <td>${statusBadge(t.status)}</td>
        <td style="font-size:11px;color:var(--text2)">${assigneeLabel}</td>
        <td><div class="grp-row-tags">${tags}</div></td>
        <td class="grp-row-date">${t.completedAt?fmtDate(t.completedAt.split('T')[0]):''}</td>
      </tr>${expandRows}`;
    }).join('');

    const pct = items.length ? Math.round(doneCount/items.length*100) : 0;
    const headerExtra = overdueCount > 0 ? `<span style="font-size:10px;color:var(--red);font-family:var(--mono);margin-left:4px">⚠️ ${overdueCount}</span>` : '';

    return `<div class="grp-card">
      <div class="grp-header ${isOpen?'open':''}" onclick="toggleGrp('${esc(cat)}')">
        <span class="grp-icon">📁</span>
        <span class="grp-name">${esc(cat)}</span>
        ${headerExtra}
        <span class="grp-count">${doneCount}/${items.length}</span>
        <div style="flex:1;height:4px;background:var(--s3);border-radius:2px;overflow:hidden;max-width:80px">
          <div style="height:100%;width:${pct}%;background:var(--green);border-radius:2px"></div>
        </div>
        <span class="grp-chevron">▶</span>
      </div>
      <div class="grp-body">
        <table class="grp-table">
          <colgroup><col style="width:45px"><col><col style="width:90px"><col style="width:90px"><col style="width:80px"><col style="width:110px"><col style="width:90px"><col style="width:150px"><col style="width:90px"></colgroup>
          <thead>
            <tr style="background:var(--s2)">
              <th style="padding:6px 10px;font-size:10px;color:var(--text2);font-weight:600;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap">ID</th>
              <th style="padding:6px 10px;font-size:10px;color:var(--text2);font-weight:600;text-align:left;border-bottom:1px solid var(--border);cursor:pointer;user-select:none" onclick="setGrpSort('${esc(cat)}','title')">제목 <span style="font-size:9px">${(grpSort[cat]?.key==='title')?(grpSort[cat]?.dir===1?'▲':'▼'):'⇅'}</span></th>
              <th style="padding:6px 10px;font-size:10px;color:var(--text2);font-weight:600;text-align:left;border-bottom:1px solid var(--border);cursor:pointer;user-select:none" onclick="setGrpSort('${esc(cat)}','startDate')">시작일 <span style="font-size:9px">${(grpSort[cat]?.key==='startDate')?(grpSort[cat]?.dir===1?'▲':'▼'):'⇅'}</span></th>
              <th style="padding:6px 10px;font-size:10px;color:var(--text2);font-weight:600;text-align:left;border-bottom:1px solid var(--border);cursor:pointer;user-select:none" onclick="setGrpSort('${esc(cat)}','dueDate')">마감일 <span style="font-size:9px">${(grpSort[cat]?.key==='dueDate')?(grpSort[cat]?.dir===1?'▲':'▼'):'⇅'}</span></th>
              <th style="padding:6px 10px;font-size:10px;color:var(--text2);font-weight:600;text-align:left;border-bottom:1px solid var(--border);cursor:pointer;user-select:none" onclick="setGrpSort('${esc(cat)}','priority')">우선순위 <span style="font-size:9px">${(grpSort[cat]?.key==='priority')?(grpSort[cat]?.dir===1?'▲':'▼'):'⇅'}</span></th>
              <th style="padding:6px 10px;font-size:10px;color:var(--text2);font-weight:600;text-align:left;border-bottom:1px solid var(--border);cursor:pointer;user-select:none" onclick="setGrpSort('${esc(cat)}','status')">상태 <span style="font-size:9px">${(grpSort[cat]?.key==='status')?(grpSort[cat]?.dir===1?'▲':'▼'):'⇅'}</span></th>
              <th style="padding:6px 10px;font-size:10px;color:var(--text2);font-weight:600;text-align:left;border-bottom:1px solid var(--border)">담당자</th>
              <th style="padding:6px 10px;font-size:10px;color:var(--text2);font-weight:600;text-align:left;border-bottom:1px solid var(--border)">태그</th>
              <th style="padding:6px 10px;font-size:10px;color:var(--text2);font-weight:600;text-align:left;border-bottom:1px solid var(--border)">완료일</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  }).join('');

  if (grpExpandedId) {
    const ta = document.getElementById('ep-memo-' + grpExpandedId);
    if (ta) { attachMemoTabKey(ta); autoGrowTextarea(ta); ta.addEventListener('keydown', e => { if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();saveExpandRow(grpExpandedId);} }); }
    renderEpCatMulti(grpExpandedId);
    renderEpTagMulti(grpExpandedId);
    renderEpLinkedTaskMulti(grpExpandedId);
  }
}

function toggleGrp(cat) {
  if (grpOpen.has(cat)) grpOpen.delete(cat); else grpOpen.add(cat);
  const headers = document.querySelectorAll('.grp-header');
  headers.forEach(h => { if (h.getAttribute('onclick') === `toggleGrp('${cat}')`) h.classList.toggle('open'); });
}

function toggleGrpExpand(id) {
  grpExpandedId = (grpExpandedId === id) ? null : id;
  renderLedger();
  if (grpExpandedId === id) {
    setTimeout(() => {
      const row = document.getElementById('grp-exp-row-' + id);
      if (row) {
        row.scrollIntoView({behavior:'smooth', block:'nearest'});
        const ta = document.getElementById('ep-memo-' + id);
        if (ta) { attachMemoTabKey(ta); autoGrowTextarea(ta); ta.addEventListener('keydown', e => { if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();saveExpandRow(id);} }); }
        renderEpCatMulti(id);
        renderEpTagMulti(id);
        renderEpLinkedTaskMulti(id);
      }
    }, 60);
  }
}

function switchToListAndExpand(taskId) {
  setLedgerMode('list');
  expandedId = taskId;
  renderLedger();
  setTimeout(() => { const row = document.getElementById('exp-row-' + taskId); if (row) row.scrollIntoView({behavior:'smooth', block:'center'}); }, 60);
}

function toggleExpand(id){
  const opening = (expandedId !== id);
  expandedId = opening ? id : null;
  if(opening){
    const t = tasks.find(x => x.id === id);
    if(t){
      _epCatState[id] = (t.category||'').split(',').map(s=>s.trim()).filter(Boolean);
      _epTagState[id] = [...(t.tags||[])];
      _epLinkedState[id] = [...(t.linkedTaskIds||[])];
    }
  }
  renderLedger();
  if(expandedId) setTimeout(() => {
    const r = document.getElementById('exp-row-' + expandedId);
    if(r) r.scrollIntoView({behavior:'smooth', block:'nearest'});
    renderEpCatMulti(expandedId);
    renderEpTagMulti(expandedId);
    renderEpLinkedTaskMulti(expandedId);
  }, 60);
}
function collapseExpand(){
  expandedId = null; grpExpandedId = null;
  // states will be cleared or overwritten on next toggle
  renderLedger();
}

function confirmDelete(id) { if (confirm('정말 삭제하시겠습니까?')) { deleteTask(id); renderAll(); toast('삭제되었습니다.'); } }

// ── SORT & FILTER UTILS ───────────────────────────────
function setLedgerSort(key) { if (ledgerSort.key === key) ledgerSort.dir *= -1; else { ledgerSort.key = key; ledgerSort.dir = 1; } renderLedger(); }
function setGrpSort(cat, key) { if (!grpSort[cat]) grpSort[cat] = { key: 'id', dir: 1 }; if (grpSort[cat].key === key) grpSort[cat].dir *= -1; else { grpSort[cat].key = key; grpSort[cat].dir = 1; } _renderLedgerGroup(window._lastGrpList); }

function _applyLedgerSort(list) {
  const { key, dir } = ledgerSort;
  return [...list].sort((a,b) => {
    let va = a[key], vb = b[key];
    if (key === 'id') return (parseInt(a.id) - parseInt(b.id)) * dir;
    if (key === 'priority') { const p = settings.priorities.map(x=>x.key); return (p.indexOf(a.priority) - p.indexOf(b.priority)) * dir; }
    if (key === 'status') { const s = settings.statuses.map(x=>x.key); return (s.indexOf(a.status) - s.indexOf(b.status)) * dir; }
    va = (va || '').toString().toLowerCase(); vb = (vb || '').toString().toLowerCase();
    return va < vb ? -dir : va > vb ? dir : 0;
  });
}

function _applyGrpSort(list, cat) {
  const s = grpSort[cat] || { key: 'id', dir: 1 };
  const { key, dir } = s;
  return [...list].sort((a,b) => {
    let va = a[key], vb = b[key];
    if (key === 'id') return (parseInt(a.id) - parseInt(b.id)) * dir;
    if (key === 'priority') { const p = settings.priorities.map(x=>x.key); return (p.indexOf(a.priority) - p.indexOf(b.priority)) * dir; }
    if (key === 'status') { const s = settings.statuses.map(x=>x.key); return (s.indexOf(a.status) - s.indexOf(b.status)) * dir; }
    va = (va || '').toString().toLowerCase(); vb = (vb || '').toString().toLowerCase();
    return va < vb ? -dir : va > vb ? dir : 0;
  });
}

function _updateSortHeaders() {
  const headers = document.querySelectorAll('#ledger-table th[onclick^="setLedgerSort"]');
  headers.forEach(th => {
    const key = th.getAttribute('onclick').match(/'([^']+)'/)[1];
    const icon = (ledgerSort.key === key) ? (ledgerSort.dir === 1 ? ' ▲' : ' ▼') : ' ⇅';
    const span = th.querySelector('span') || th;
    if (th.querySelector('span')) th.querySelector('span').textContent = icon;
  });
}

// ── MULTI SELECT FILTER ──────────────────────────────
function toggleMsel(type) {
  const dd = document.getElementById('msel-' + type + '-dd');
  if (!dd) return;
  const isOpen = dd.classList.contains('open');
  // close all others
  ['status','priority','cat'].forEach(t => { const d = document.getElementById('msel-' + t + '-dd'); if(d) d.classList.remove('open'); });
  if (!isOpen) {
    _renderMselOptions(type);
    dd.classList.add('open');
  }
}

function _renderMselOptions(type) {
  const dd = document.getElementById('msel-' + type + '-dd');
  if (!dd) return;
  let items = [];
  if (type === 'status') items = settings.statuses.map(s => ({ key: s.key, label: s.label }));
  else if (type === 'priority') items = settings.priorities.map(p => ({ key: p.key, label: p.label }));
  else if (type === 'cat') items = settings.categories.map(c => ({ key: c, label: c }));

  dd.innerHTML = items.map(item => {
    const isSel = mselState[type].has(item.key);
    return `<div class="msel-item ${isSel?'active':''}" onclick="event.stopPropagation();toggleMselItem('${type}','${esc(item.key)}')">
      <div class="msel-chk">${isSel?'✓':''}</div>${esc(item.label)}
    </div>`;
  }).join('');
}

function toggleMselItem(type, key) {
  if (mselState[type].has(key)) mselState[type].delete(key); else mselState[type].add(key);
  _renderMselOptions(type);
  updateMselLabel(type);
  renderLedger();
}

function updateMselLabel(type) {
  const label = document.getElementById('msel-' + type + '-label');
  if (!label) return;
  const count = mselState[type].size;
  const baseLabels = { status: '상태', priority: '우선순위', cat: '카테고리' };
  label.textContent = count > 0 ? `${baseLabels[type]} (${count})` : baseLabels[type];
  label.parentElement.classList.toggle('has-val', count > 0);
}

function clearFilters() {
  const search = document.getElementById('ledger-search');
  const tag = document.getElementById('ledger-tag');
  if (search) search.value = '';
  if (tag) tag.value = '';
  mselState.status.clear();
  mselState.priority.clear();
  mselState.cat.clear();
  ['status','priority','cat'].forEach(t => updateMselLabel(t));
  renderLedger();
}

// ── TITLE INLINE EDIT ────────────────────────────────
function _inlineTitleEdit(spanEl, origTitle, onSave) {
  if (spanEl.querySelector('input')) return;
  const input = document.createElement('input');
  input.value = origTitle;
  input.style.cssText = 'width:100%;background:var(--s2);border:1px solid var(--amber);color:var(--text);font-family:var(--sans);font-size:13px;font-weight:500;padding:1px 6px;border-radius:3px;outline:none;';
  spanEl.textContent = '';
  spanEl.appendChild(input);
  input.focus(); input.select();
  const commit = () => {
    const val = input.value.trim();
    if (val && val !== origTitle) { onSave(val); }
    else { spanEl.textContent = origTitle; spanEl.title = origTitle; }
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.removeEventListener('blur', commit); spanEl.textContent = origTitle; }
  });
}

function startTitleEdit(id, spanEl) {
  const t = tasks.find(x => x.id === id); if (!t) return;
  _inlineTitleEdit(spanEl, t.title, val => { updateTask(id, { title: val }); renderAll(); toast('제목 수정됨'); });
}

// ── EXPAND PANEL HELPERS ──────────────────────────────
// 메모 textarea 자동 높이 조절
function autoGrowTextarea(ta) {
  if (!ta) return;
  ta.style.height = 'auto';
  ta.style.height = Math.max(ta.scrollHeight, 80) + 'px';
}

function attachMemoTabKey(ta) {
  if (!ta || ta._tabBound) return;
  ta._tabBound = true;
  ta.addEventListener('keydown', function(e) {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const val = ta.value, pos = ta.selectionStart, lines = val.split('\n');
    let lineIdx = 0, charCount = 0;
    for (let i = 0; i < lines.length; i++) { if (charCount + lines[i].length >= pos) { lineIdx = i; break; } charCount += lines[i].length + 1; }
    const curLine = lines[lineIdx];
    const isTableRow = /^\|.+\|/.test(curLine.trim()), isSepRow = /^\|[-| :]+\|/.test(curLine.trim());
    if (isTableRow && !isSepRow) {
      const aligned = _alignTable(lines, lineIdx);
      ta.value = aligned.lines.join('\n');
      // logic for moving cursor in table... (simplified for now)
    } else {
      ta.value = val.slice(0, pos) + '    ' + val.slice(ta.selectionEnd);
      ta.selectionStart = ta.selectionEnd = pos + 4;
    }
    ta.dispatchEvent(new Event('input'));
  });
}

function _alignTable(lines, cursorLineIdx) {
  let tableStart = cursorLineIdx, tableEnd = cursorLineIdx;
  while (tableStart > 0 && /^\|/.test(lines[tableStart - 1].trim())) tableStart--;
  while (tableEnd < lines.length - 1 && /^\|/.test(lines[tableEnd + 1].trim())) tableEnd++;
  const tableLines = lines.slice(tableStart, tableEnd + 1);
  if (tableLines.length < 2) return { lines, tableStart, tableEnd };
  const rows = tableLines.map(l => { const parts = l.split('|'); return parts.slice(1, parts.length - 1).map(c => c.trim()); });
  const colCount = Math.max(...rows.map(r => r.length));
  const sepIdx = rows.findIndex(r => r.every(c => /^[-: ]+$/.test(c)));
  const colWidths = Array.from({length: colCount}, (_, ci) => {
    let max = 3;
    rows.forEach(r => { if (ci < r.length) { if (r[ci] && !/^[-: ]+$/.test(r[ci]) && r[ci].length > max) max = r[ci].length; } });
    return max;
  });
  const alignedLines = rows.map((row, ri) => {
    const isSep = sepIdx !== -1 && ri === sepIdx;
    const cells = Array.from({length: colCount}, (_, ci) => { const cell = ci < row.length ? row[ci] : ''; const w = colWidths[ci]; if (isSep) return '-'.repeat(w); return cell.padEnd(w, ' '); });
    return '| ' + cells.join(' | ') + ' |';
  });
  const newLines = [...lines];
  for (let i = 0; i < alignedLines.length; i++) { newLines[tableStart + i] = alignedLines[i]; }
  return { lines: newLines, tableStart, tableEnd };
}

function buildExpandPanel(t){
  const priOpts = settings.priorities.map(p => `<option value="${esc(p.key)}" ${t.priority===p.key?'selected':''}>${esc(p.label)}</option>`).join('');
  const stOpts = settings.statuses.map(s => `<option value="${esc(s.key)}" ${t.status===s.key?'selected':''}>${esc(s.label)}</option>`).join('');
  return `<div class="expand-panel">
    <div class="ep-row-3">
      <div class="ep-field"><div class="ep-label">시작일</div><input class="ep-select" type="date" id="ep-start-${t.id}" value="${t.startDate||''}"></div>
      <div class="ep-field"><div class="ep-label">마감일</div><input class="ep-select" type="date" id="ep-due-${t.id}" value="${t.dueDate||''}"></div>
      <div></div>
    </div>
    <div class="ep-row-3">
      <div class="ep-field">
        <div class="ep-label">카테고리</div>
        <div class="tag-multi" id="ep-cat-multi-${t.id}" onclick="toggleEpCatDropdown(event,'${t.id}')">
          <div class="tag-multi-selected" id="ep-cat-multi-selected-${t.id}">
            <span class="tag-placeholder" id="ep-cat-placeholder-${t.id}">카테고리 선택...</span>
          </div>
          <div class="tag-dropdown" id="ep-cat-dropdown-${t.id}">
            <div style="padding:8px;position:sticky;top:0;background:var(--s1);border-bottom:1px solid var(--border);z-index:1">
              <input class="ep-select" id="ep-cat-search-${t.id}" placeholder="카테고리 검색/입력..." oninput="filterEpCats('${t.id}', this.value)" onclick="event.stopPropagation()" onkeydown="if(event.key==='Enter'){ addEpCat(event,'${t.id}',this.value); this.value=''; }">
            </div>
            <div id="ep-cat-list-${t.id}"></div>
          </div>
        </div>
      </div>
      <div class="ep-field">
        <div class="ep-label">태그</div>
        <div class="tag-multi" id="ep-tag-multi-${t.id}" onclick="toggleEpTagDropdown(event,'${t.id}')">
          <div class="tag-multi-selected" id="ep-tag-multi-selected-${t.id}">
            <span class="tag-placeholder" id="ep-tag-placeholder-${t.id}">태그 선택...</span>
          </div>
          <div class="tag-dropdown" id="ep-tag-dropdown-${t.id}">
            <div style="padding:8px;position:sticky;top:0;background:var(--s1);border-bottom:1px solid var(--border);z-index:1">
              <input class="ep-select" id="ep-tag-search-${t.id}" placeholder="태그 검색/입력..." oninput="filterEpTags('${t.id}', this.value)" onclick="event.stopPropagation()" onkeydown="if(event.key==='Enter'){ addEpTag(event,'${t.id}',this.value); this.value=''; }">
            </div>
            <div id="ep-tag-list-${t.id}"></div>
          </div>
        </div>
      </div>
      <div></div>
    </div>
    <div class="ep-row-3">
      <div class="ep-field"><div class="ep-label">우선순위</div><select class="ep-select" id="ep-pri-${t.id}">${priOpts}</select></div>
      <div class="ep-field"><div class="ep-label">상태</div><select class="ep-select" id="ep-status-${t.id}">${stOpts}</select></div>
      <div></div>
    </div>
    <div class="link-section">
      <div class="link-section-hd">연락처</div>
      <div class="link-add-row"><select class="ep-select" id="ep-contact-sel-${t.id}" style="flex:1">${buildContactOptions(t)}</select><button class="btn btn-ghost btn-sm" onclick="addTaskContact('${t.id}')">연락처 추가</button></div>
      <div class="link-list" id="ep-contact-list-${t.id}">${buildContactList(t)}</div>
    </div>
    <div class="link-section">
      <div class="link-section-hd">연결 업무</div>
      <div class="tag-multi" id="ep-linked-multi-${t.id}" onclick="toggleEpLinkedDropdown(event,'${t.id}')">
        <div class="tag-multi-selected" id="ep-linked-multi-selected-${t.id}">
          <span class="tag-placeholder" id="ep-linked-placeholder-${t.id}">연결할 업무 선택...</span>
        </div>
        <div class="tag-dropdown" id="ep-linked-dropdown-${t.id}">
          <div style="padding:8px;position:sticky;top:0;background:var(--s1);border-bottom:1px solid var(--border);z-index:1">
            <input class="ep-select" id="ep-linked-search-${t.id}" placeholder="제목/ID 검색..." oninput="filterEpLinkedTasks('${t.id}', this.value)" onclick="event.stopPropagation()">
          </div>
          <div id="ep-linked-task-list-${t.id}"></div>
        </div>
      </div>
      <div class="link-list" id="ep-link-list-${t.id}">${buildLinkList(t)}</div>
    </div>
    <div class="memo-section"><div class="memo-header"><div class="memo-label">메모</div><button class="btn btn-ghost btn-sm" onclick="copyMemo('${t.id}')" title="메모 복사">복사</button></div>
      <textarea class="memo-textarea" id="ep-memo-${t.id}" placeholder="메모를 입력하세요..." oninput="autoGrowTextarea(this)" onblur="saveExpandRow('${t.id}')">${esc(t.memo||'')}</textarea>
    </div>
    <div class="ep-footer"><span class="ep-save-hint">Ctrl+S — 저장</span><button class="btn btn-ghost btn-sm" onclick="collapseExpand()">닫기</button><button class="btn btn-primary btn-sm" onclick="saveExpandRow('${t.id}')">저장</button></div>
  </div>`;
}

function saveExpandRow(id){
  const g = sid => { const el = document.getElementById(sid); return el ? el.value : ''; };
  const categories = _epCatState[id] ? _epCatState[id].join(', ') : '';
  const tags = _epTagState[id] || [];
  const linkedTaskIds = _epLinkedState[id] || [];
  
  updateTask(id, {
    startDate: g(`ep-start-${id}`)||null, dueDate: g(`ep-due-${id}`)||null,
    tags: tags,
    category: categories,
    priority: g(`ep-pri-${id}`), 
    status: g(`ep-status-${id}`),
    memo: g(`ep-memo-${id}`),
    linkedTaskIds: linkedTaskIds
  });
  renderAll(); toast('저장 완료');
}

// ── EP Multi-select Helpers ───────────────────────────
function renderEpTagMulti(taskId) {
  const sel = document.getElementById(`ep-tag-multi-selected-${taskId}`);
  const ph  = document.getElementById(`ep-tag-placeholder-${taskId}`);
  const tags = _epTagState[taskId] || [];
  if (!sel) return;
  sel.querySelectorAll('.tag-pill').forEach(el => el.remove());
  if (tags.length === 0) {
    if (ph) ph.style.display = '';
  } else {
    if (ph) ph.style.display = 'none';
    tags.forEach(tag => {
      const pill = document.createElement('div');
      pill.className = 'tag-pill';
      pill.innerHTML = `${esc(tag)} <span class="tag-pill-x" onclick="removeEpTag(event,'${taskId}','${esc(tag)}')">✕</span>`;
      sel.insertBefore(pill, ph);
    });
  }
  _refreshEpTagDd(taskId);
}
function _refreshEpTagDd(taskId, query) {
  const wrap = document.getElementById(`ep-tag-list-${taskId}`);
  if (!wrap) return;
  const q = (query || '').trim().toLowerCase();
  const selected = _epTagState[taskId] || [];
  const allTags = [...new Set([...settings.tags, ...tasks.flatMap(t => t.tags || [])])].sort();
  const list = allTags.filter(t => !q || t.toLowerCase().includes(q));

  wrap.innerHTML = list.length
    ? list.map(tag => {
        const isSel = selected.includes(tag);
        return `<div class="tag-option ${isSel?'selected':''}" onclick="toggleEpTag(event,'${taskId}','${esc(tag)}')">
          <div class="tag-check">${isSel?'✓':''}</div>${esc(tag)}
        </div>`;
      }).join('')
    : '<div style="padding:8px 12px;font-size:12px;color:var(--text3)">태그 없음</div>';
}
function toggleEpTagDropdown(e, taskId) {
  if (e) e.stopPropagation();
  const dd = document.getElementById(`ep-tag-dropdown-${taskId}`);
  if (!dd) return;
  const isOpen = dd.classList.contains('open');
  dd.classList.toggle('open');
  if (!isOpen) {
    const si = document.getElementById(`ep-tag-search-${taskId}`);
    if (si) { si.value = ''; si.focus(); }
    _refreshEpTagDd(taskId, '');
  }
  // Close other dropdowns
  document.querySelectorAll('.tag-dropdown.open').forEach(el => {
    if (el !== dd) el.classList.remove('open');
  });
}
function filterEpTags(taskId, q) {
  _refreshEpTagDd(taskId, q);
}
function toggleEpTag(e, taskId, tag) {
  if (e) e.stopPropagation();
  if (!_epTagState[taskId]) _epTagState[taskId] = [];
  const idx = _epTagState[taskId].indexOf(tag);
  if (idx >= 0) _epTagState[taskId].splice(idx, 1);
  else _epTagState[taskId].push(tag);
  renderEpTagMulti(taskId);
}
function addEpTag(e, taskId, tag) {
  if (e) e.stopPropagation();
  const t = tag.trim();
  if (!t) return;
  if (!_epTagState[taskId]) _epTagState[taskId] = [];
  if (!_epTagState[taskId].includes(t)) {
    _epTagState[taskId].push(t);
    renderEpTagMulti(taskId);
  }
}
function removeEpTag(e, taskId, tag) {
  if (e) e.stopPropagation();
  if (_epTagState[taskId]) {
    _epTagState[taskId] = _epTagState[taskId].filter(t => t !== tag);
    renderEpTagMulti(taskId);
  }
}

function renderEpCatMulti(taskId) {
  const sel = document.getElementById(`ep-cat-multi-selected-${taskId}`);
  const ph  = document.getElementById(`ep-cat-placeholder-${taskId}`);
  const cats = _epCatState[taskId] || [];
  if (!sel) return;
  sel.querySelectorAll('.tag-pill').forEach(el => el.remove());
  if (cats.length === 0) {
    if (ph) ph.style.display = '';
  } else {
    if (ph) ph.style.display = 'none';
    cats.forEach(cat => {
      const pill = document.createElement('div');
      pill.className = 'tag-pill';
      pill.innerHTML = `${esc(cat)} <span class="tag-pill-x" onclick="removeEpCat(event,'${taskId}','${esc(cat)}')">✕</span>`;
      sel.insertBefore(pill, ph);
    });
  }
  _refreshEpCatDd(taskId);
}
function _refreshEpCatDd(taskId, query) {
  const wrap = document.getElementById(`ep-cat-list-${taskId}`);
  if (!wrap) return;
  const q = (query || '').trim().toLowerCase();
  const selected = _epCatState[taskId] || [];
  const allCats = [...new Set([...settings.categories, ...tasks.flatMap(t => (t.category||'').split(',').map(s=>s.trim()).filter(Boolean))])].sort();
  const list = allCats.filter(c => !q || c.toLowerCase().includes(q));

  wrap.innerHTML = list.length
    ? list.map(cat => {
        const isSel = selected.includes(cat);
        return `<div class="tag-option ${isSel?'selected':''}" onclick="toggleEpCat(event,'${taskId}','${esc(cat)}')">
          <div class="tag-check">${isSel?'✓':''}</div>${esc(cat)}
        </div>`;
      }).join('')
    : '<div style="padding:8px 12px;font-size:12px;color:var(--text3)">카테고리 없음</div>';
}
function toggleEpCatDropdown(e, taskId) {
  if (e) e.stopPropagation();
  const dd = document.getElementById(`ep-cat-dropdown-${taskId}`);
  if (!dd) return;
  const isOpen = dd.classList.contains('open');
  dd.classList.toggle('open');
  if (!isOpen) {
    const si = document.getElementById(`ep-cat-search-${taskId}`);
    if (si) { si.value = ''; si.focus(); }
    _refreshEpCatDd(taskId, '');
  }
  // Close other dropdowns
  document.querySelectorAll('.tag-dropdown.open').forEach(el => {
    if (el !== dd) el.classList.remove('open');
  });
}
function filterEpCats(taskId, q) {
  _refreshEpCatDd(taskId, q);
}
function toggleEpCat(e, taskId, cat) {
  if (e) e.stopPropagation();
  if (!_epCatState[taskId]) _epCatState[taskId] = [];
  const idx = _epCatState[taskId].indexOf(cat);
  if (idx >= 0) _epCatState[taskId].splice(idx, 1);
  else _epCatState[taskId].push(cat);
  renderEpCatMulti(taskId);
}
function addEpCat(e, taskId, cat) {
  if (e) e.stopPropagation();
  const c = cat.trim();
  if (!c) return;
  if (!_epCatState[taskId]) _epCatState[taskId] = [];
  if (!_epCatState[taskId].includes(c)) {
    _epCatState[taskId].push(c);
    renderEpCatMulti(taskId);
  }
}
function removeEpCat(e, taskId, cat) {
  if (e) e.stopPropagation();
  if (_epCatState[taskId]) {
    _epCatState[taskId] = _epCatState[taskId].filter(c => c !== cat);
    renderEpCatMulti(taskId);
  }
}

function renderEpLinkedTaskMulti(taskId) {
  const sel = document.getElementById(`ep-linked-multi-selected-${taskId}`);
  const ph  = document.getElementById(`ep-linked-placeholder-${taskId}`);
  const linked = _epLinkedState[taskId] || [];
  if (!sel) return;
  sel.querySelectorAll('.tag-pill').forEach(el => el.remove());
  if (linked.length === 0) {
    if (ph) ph.style.display = '';
  } else {
    if (ph) ph.style.display = 'none';
    linked.forEach(tid => {
      const t = tasks.find(x => x.id === tid);
      if (!t) return;
      const pill = document.createElement('div');
      pill.className = 'tag-pill';
      pill.innerHTML = `${esc(t.title)} <span class="tag-pill-x" onclick="removeEpLinkedTask(event,'${taskId}','${esc(tid)}')">✕</span>`;
      sel.insertBefore(pill, ph);
    });
  }
}
function _refreshEpLinkedTaskList(taskId, query) {
  const wrap = document.getElementById(`ep-linked-task-list-${taskId}`);
  if (!wrap) return;
  const q = (query || '').trim().toLowerCase();
  const linked = _epLinkedState[taskId] || [];
  const list = tasks.filter(t =>
    t.id !== taskId &&
    !t.linkedSourceType &&
    t.status !== 'archived' &&
    (!q || t.title.toLowerCase().includes(q) || (t.category||'').toLowerCase().includes(q))
  );
  const stMap = {};
  (settings.statuses || []).forEach(s => { stMap[s.key] = s.label; });
  wrap.innerHTML = list.length
    ? list.map(t => {
        const isSel = linked.includes(t.id);
        const meta = [t.category, stMap[t.status] || t.status].filter(Boolean).join(' · ');
        return `<div class="tag-option ${isSel?'selected':''}" onclick="toggleEpLinkedTask(event,'${taskId}','${esc(t.id)}')">
          <div class="tag-check">${isSel?'✓':''}</div>
          <div style="overflow:hidden">
            <div style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.title)}</div>
            ${meta?`<div style="font-size:11px;color:var(--text3);margin-top:1px">${esc(meta)}</div>`:''}
          </div>
        </div>`;
      }).join('')
    : '<div style="padding:8px 12px;font-size:12px;color:var(--text3)">업무 없음</div>';
}
function toggleEpLinkedDropdown(e, taskId) {
  if (e) e.stopPropagation();
  const dd = document.getElementById(`ep-linked-dropdown-${taskId}`);
  if (!dd) return;
  const isOpen = dd.classList.contains('open');
  dd.classList.toggle('open');
  if (!isOpen) {
    const si = document.getElementById(`ep-linked-search-${taskId}`);
    if (si) { si.value = ''; si.focus(); }
    _refreshEpLinkedTaskList(taskId, '');
  }
  // Close other dropdowns
  document.querySelectorAll('.tag-dropdown.open').forEach(el => {
    if (el !== dd) el.classList.remove('open');
  });
}
function filterEpLinkedTasks(taskId, q) {
  _refreshEpLinkedTaskList(taskId, q);
}
function toggleEpLinkedTask(e, taskId, targetId) {
  if (e) e.stopPropagation();
  if (!_epLinkedState[taskId]) _epLinkedState[taskId] = [];
  const idx = _epLinkedState[taskId].indexOf(targetId);
  if (idx >= 0) _epLinkedState[taskId].splice(idx, 1);
  else _epLinkedState[taskId].push(targetId);
  renderEpLinkedTaskMulti(taskId);
  const si = document.getElementById(`ep-linked-search-${taskId}`);
  _refreshEpLinkedTaskList(taskId, si ? si.value : '');
}
function removeEpLinkedTask(e, taskId, targetId) {
  if (e) e.stopPropagation();
  if (_epLinkedState[taskId]) {
    _epLinkedState[taskId] = _epLinkedState[taskId].filter(id => id !== targetId);
    renderEpLinkedTaskMulti(taskId);
  }
}

// ── TASK LINK ─────────────────────────────────────────
function buildLinkOptions(t, query){
  const linked = t.linkedTaskIds || [];
  let candidates = tasks.filter(x => x.id !== t.id && !linked.includes(x.id) && !x.linkedSourceType);
  if(query) {
    const q = query.toLowerCase();
    candidates = candidates.filter(x => x.id.toLowerCase().includes(q) || x.title.toLowerCase().includes(q));
  }
  // ID 기준 정렬
  candidates.sort((a, b) => a.id.localeCompare(b.id, undefined, {numeric:true}));
  if(!candidates.length) return '<option value="">연결 가능한 업무 없음</option>';
  return '<option value="">업무 선택...</option>' + candidates.map(x => `<option value="${esc(x.id)}">[${esc(x.id)}] ${esc(x.title)}</option>`).join('');
}
function filterLinkOptions(taskId){
  const searchEl = document.getElementById('ep-link-search-' + taskId);
  const sel = document.getElementById('ep-link-sel-' + taskId);
  if(!searchEl || !sel) return;
  const t = tasks.find(x => x.id === taskId); if(!t) return;
  sel.innerHTML = buildLinkOptions(t, searchEl.value);
}
function buildLinkList(t){
  const linked = t.linkedTaskIds || [];
  if(!linked.length) return '<span class="link-empty">연결된 업무 없음</span>';
  return linked.map(lid => {
    const x = tasks.find(tt => tt.id === lid); if(!x) return '';
    const st = settings.statuses.find(s => s.key === x.status) || { label: x.status, color: 'var(--text3)' };
    return `<div class="link-item"><span class="link-item-id">${esc(x.id)}</span><span class="link-item-title" onclick="jumpToLinkedTask('${esc(x.id)}')" title="${esc(x.title)}">${esc(x.title)}</span><span class="link-item-badge" style="color:${st.color};border-color:${st.color}40">${esc(st.label)}</span><button class="link-item-rm" onclick="removeTaskLink('${esc(t.id)}','${esc(lid)}')" title="연결 해제">×</button></div>`;
  }).join('');
}
function addTaskLink(fromId){
  const sel = document.getElementById('ep-link-sel-' + fromId); if(!sel) return;
  const toId = sel.value; if(!toId){ toast('연결할 업무를 선택하세요'); return; }
  const from = tasks.find(t => t.id === fromId), to = tasks.find(t => t.id === toId);
  if(!from || !to) return;
  if(!from.linkedTaskIds) from.linkedTaskIds = []; if(!to.linkedTaskIds) to.linkedTaskIds = [];
  if(from.linkedTaskIds.includes(toId)){ toast('이미 연결된 업무입니다'); return; }
  from.linkedTaskIds.push(toId); to.linkedTaskIds.push(fromId);
  save(); const listEl = document.getElementById('ep-link-list-' + fromId); if(listEl) listEl.innerHTML = buildLinkList(from); sel.innerHTML = buildLinkOptions(from); toast('연결 완료');
}
function removeTaskLink(fromId, toId){
  const from = tasks.find(t => t.id === fromId), to = tasks.find(t => t.id === toId);
  if(from) from.linkedTaskIds = (from.linkedTaskIds || []).filter(id => id !== toId);
  if(to) to.linkedTaskIds = (to.linkedTaskIds || []).filter(id => id !== fromId);
  save(); const listEl = document.getElementById('ep-link-list-' + fromId); if(listEl) listEl.innerHTML = buildLinkList(from); const selEl = document.getElementById('ep-link-sel-' + fromId); if(selEl) selEl.innerHTML = buildLinkOptions(from); toast('연결 해제');
}

// ── TASK CONTACT LINK ─────────────────────────────────
function buildContactOptions(t){
  const linked = t.assigneeIds || [];
  const candidates = contacts.filter(c => !linked.includes(c.id));
  if(!candidates.length) return '<option value="">추가 가능한 연락처 없음</option>';
  return '<option value="">연락처 선택...</option>' + candidates.map(c => { const typeLabel = c.type==='main'?'정':c.type==='sub'?'부':''; const phone = c.officePhone || c.mobilePhone || ''; const parts = [c.company, c.name, c.title, typeLabel, phone, c.email].filter(Boolean); return `<option value="${esc(c.id)}">${esc(parts.join(' · '))}</option>`; }).join('');
}
function buildContactList(t){
  const linked = t.assigneeIds || [];
  if(!linked.length) return '<span class="link-empty">연결된 연락처 없음</span>';
  const rows = linked.map(cid => {
    const c = contacts.find(x => x.id === cid); if(!c) return '';
    const catBadges = (c.categories||[]).length
      ? (c.categories||[]).map(cat=>`<span class="tag">${esc(cat)}</span>`).join(' ')
      : '<span class="tag">미분류</span>';
    const roleBadges = (c.categoryRoles||[]).length
      ? c.categoryRoles.map(r=>`<span class="ct-type-badge ${r.role==='main'?'ct-type-main':'ct-type-sub'}">${esc(r.category)} ${r.role==='main'?'정':'부'}</span>`).join(' ')
      : (c.type==='main'?'<span class="ct-type-badge ct-type-main">정</span>':'<span class="ct-type-badge ct-type-sub">부</span>');
    return `<tr>
      <td>${esc(c.company||'')}</td>
      <td style="font-weight:500">${esc(c.name||'')}</td>
      <td>${esc(c.title||'')}</td>
      <td>${catBadges}</td>
      <td>${roleBadges}</td>
      <td style="font-family:var(--mono);font-size:11px">${esc(c.officePhone||'—')}</td>
      <td style="font-family:var(--mono);font-size:11px">${esc(c.mobilePhone||'—')}</td>
      <td style="font-size:11px;color:var(--text2)">${esc(c.email||'')}</td>
      <td style="font-size:11px;color:var(--text2);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.memo||'')}</td>
      <td class="cg-rm"><button class="link-item-rm" onclick="removeTaskContact('${esc(t.id)}','${esc(cid)}')" title="연결 해제">×</button></td>
    </tr>`;
  }).join('');
  return `<table class="contact-grid"><thead><tr><th>업체명</th><th>이름</th><th>직책</th><th>카테고리</th><th>정·부</th><th>회사번호</th><th>H.P</th><th>이메일</th><th>메모</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}
function addTaskContact(taskId){
  const sel = document.getElementById('ep-contact-sel-' + taskId); if(!sel) return;
  const cid = sel.value; if(!cid){ toast('연락처를 선택하세요'); return; }
  const t = tasks.find(x => x.id === taskId); if(!t) return;
  if(!t.assigneeIds) t.assigneeIds = [];
  if(t.assigneeIds.includes(cid)){ toast('이미 연결된 연락처입니다'); return; }
  t.assigneeIds.push(cid); save();
  const listEl = document.getElementById('ep-contact-list-' + taskId); if(listEl) listEl.innerHTML = buildContactList(t); sel.innerHTML = buildContactOptions(t); toast('연락처 연결됨');
}
function removeTaskContact(taskId, cid){
  const t = tasks.find(x => x.id === taskId); if(!t) return;
  t.assigneeIds = (t.assigneeIds || []).filter(id => id !== cid);
  save(); const listEl = document.getElementById('ep-contact-list-' + taskId); if(listEl) listEl.innerHTML = buildContactList(t); const selEl = document.getElementById('ep-contact-sel-' + taskId); if(selEl) selEl.innerHTML = buildContactOptions(t); toast('연결 해제');
}

function jumpToLinkedTask(targetId){ switchView('ledger'); setTimeout(() => { expandedId = targetId; renderLedger(); const row = document.getElementById('exp-row-' + targetId); if(row) row.scrollIntoView({behavior:'smooth', block:'center'}); }, 80); }
function jumpToLedger(taskId) {
  // 필터 초기화 후 리스트 모드로 이동
  mselState.status.clear(); mselState.priority.clear(); mselState.cat.clear();
  const searchEl = document.getElementById('ledger-search'); if (searchEl) searchEl.value = '';
  ledgerMode = 'list';
  switchView('ledger');
  setTimeout(() => {
    expandedId = taskId;
    renderLedger();
    const row = document.getElementById('exp-row-' + taskId);
    if (row) row.scrollIntoView({behavior:'smooth', block:'center'});
  }, 100);
}

/******************************************************************************
FUNCTION    : exportCSV
DESCRIPTION : 현재 필터된 업무 목록을 CSV 파일로 내보내기
PARAMETERS  : 없음
RETURNED    : 없음 (파일 다운로드)
******************************************************************************/
function exportCSV() {
  /* 현재 필터 상태 그대로 적용 */
  let list = tasks.filter(t => !t.linkedSourceType);
  const search  = (document.getElementById('ledger-search')?.value || '').trim().toLowerCase();
  const tag     = (document.getElementById('ledger-tag')?.value   || '').trim().toLowerCase();
  const selSt   = mselState.status;
  const selPri  = mselState.priority;
  const selCat  = mselState.cat;

  if (search)    list = list.filter(t => t.title.toLowerCase().includes(search) || (t.memo||'').toLowerCase().includes(search));
  if (selSt.size)  list = list.filter(t => selSt.has(t.status));
  if (selPri.size) list = list.filter(t => selPri.has(t.priority));
  if (selCat.size && ledgerMode !== 'group') list = list.filter(t => selCat.has(t.category));
  if (tag)       list = list.filter(t => t.tags.some(tg => tg.toLowerCase().includes(tag)));

  list = _applyLedgerSort(list);

  const headers = ['제목','카테고리','우선순위','상태','태그','시작일','마감일','완료일','메모'];

  /* CSV 셀 이스케이프: 쉼표·줄바꿈·큰따옴표 포함 시 큰따옴표로 감싸기 */
  const esc_csv = v => {
    const s = (v == null ? '' : String(v));
    return (s.includes(',') || s.includes('\n') || s.includes('"'))
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  };

  const rows = list.map(t => [
    t.title,
    t.category   || '',
    priLabel(t.priority   || ''),
    statusLabel(t.status  || ''),
    (t.tags || []).join(' / '),
    t.startDate  || '',
    t.dueDate    || '',
    t.completedAt ? t.completedAt.slice(0,10) : '',
    (t.memo      || '').replace(/\n/g, ' '),
  ].map(esc_csv).join(','));

  const csv     = '\uFEFF' + [headers.join(','), ...rows].join('\n'); /* BOM: 엑셀 한글 깨짐 방지 */
  const blob    = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const link    = document.createElement('a');
  link.href     = url;
  link.download = `taskflow_${today()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast(`CSV 내보내기 완료 (${list.length}건)`);
}

/******************************************************************************
FUNCTION    : copyMemo
DESCRIPTION : 인라인 확장 패널의 메모를 클립보드에 복사
PARAMETERS  : string id - 업무 ID
RETURNED    : 없음
******************************************************************************/
function copyMemo(id) {
  const ta = document.getElementById('ep-memo-' + id);
  const text = ta ? ta.value.trim() : '';
  if (!text) { toast('메모가 비어 있습니다'); return; }
  navigator.clipboard.writeText(text)
    .then(() => toast('메모 복사 완료'))
    .catch(() => {
      /* clipboard API 실패 시 폴백 */
      ta.select();
      document.execCommand('copy');
      toast('메모 복사 완료');
    });
}

document.addEventListener('click', e => { if (!e.target.closest('.msel-wrap')) { ['status','priority','cat'].forEach(t => { const dd = document.getElementById('msel-' + t + '-dd'); if (dd) dd.classList.remove('open'); }); } });
