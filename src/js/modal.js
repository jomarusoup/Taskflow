/**
 * modal.js - 공용 입력 모달 및 담당자 선택 로직
 */

// ── MODAL ─────────────────────────────────────────────
function openModal(id = null, defaultStatus = 'todo') {
  editingId = id;
  // populate dropdowns from settings
  populateModalDropdowns();
  const modalTitle = document.getElementById('modal-title');
  const modalDeleteBtn = document.getElementById('modal-delete-btn');
  if (modalTitle) modalTitle.textContent = id ? '업무 수정' : '업무 추가';
  if (modalDeleteBtn) modalDeleteBtn.style.display = id ? '' : 'none';

  if (id) {
    const t = tasks.find(x => x.id === id); if (!t) return;
    document.getElementById('f-title').value     = t.title;
    document.getElementById('f-cat').value       = t.category;
    document.getElementById('f-priority').value  = t.priority;
    document.getElementById('f-status').value    = t.status;
    document.getElementById('f-start').value     = t.startDate || '';
    document.getElementById('f-due').value       = t.dueDate   || '';
    selectedTags = [...(t.tags || [])];
    _populateAssignee(t.category, t.assigneeIds || []);
  } else {
    document.getElementById('f-title').value    = '';
    document.getElementById('f-cat').value      = '';
    document.getElementById('f-priority').value = 'medium';
    document.getElementById('f-status').value   = defaultStatus;
    document.getElementById('f-start').value    = '';
    document.getElementById('f-due').value      = '';
    selectedTags = [];
    _populateAssignee('', []);
  }
  renderTagMulti();
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.add('open');
  const titleInp = document.getElementById('f-title');
  if (titleInp) setTimeout(() => titleInp.focus(), 50);
}

function populateModalDropdowns() {
  // Category
  const catEl = document.getElementById('f-cat');
  if (catEl) catEl.innerHTML = '<option value="">— 없음 —</option>' +
    settings.categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');

  // Priority
  const priEl = document.getElementById('f-priority');
  if (priEl) priEl.innerHTML = settings.priorities.map(p => `<option value="${esc(p.key)}">${esc(p.label)}</option>`).join('');

  // Status
  const stEl = document.getElementById('f-status');
  if (stEl) stEl.innerHTML = settings.statuses.map(s => `<option value="${esc(s.key)}">${esc(s.label)}</option>`).join('');

  // populate assignee dropdown (카테고리 연동)
  _populateAssignee('', []);
  const catElModal = document.getElementById('f-cat');
  if (catElModal) {
    catElModal.onchange = () => { selectedAssignees = []; renderAssigneeMulti(catElModal.value); };
  }

  // Tag dropdown options
  const dd = document.getElementById('tag-dropdown');
  if (dd) dd.innerHTML = settings.tags.map(tag => `
    <div class="tag-option ${selectedTags.includes(tag)?'selected':''}" onclick="toggleTag(event,'${esc(tag)}')">
      <div class="tag-check">${selectedTags.includes(tag)?'✓':''}</div>
      ${esc(tag)}
    </div>`).join('');
}

// Tag multi-select
function renderTagMulti() {
  const sel = document.getElementById('tag-multi-selected');
  const ph  = document.getElementById('tag-placeholder');
  if (!sel) return;
  if (selectedTags.length === 0) {
    if (ph) ph.style.display = '';
    // remove pills
    sel.querySelectorAll('.tag-pill').forEach(el => el.remove());
  } else {
    if (ph) ph.style.display = 'none';
    sel.querySelectorAll('.tag-pill').forEach(el => el.remove());
    selectedTags.forEach(tag => {
      const pill = document.createElement('div');
      pill.className = 'tag-pill';
      pill.innerHTML = `${esc(tag)} <span class="tag-pill-x" onclick="removeTag(event,'${esc(tag)}')">✕</span>`;
      sel.insertBefore(pill, ph);
    });
  }
  // update dropdown
  document.querySelectorAll('#tag-dropdown .tag-option').forEach(el => {
    const tag = el.textContent.trim();
    const isSel = selectedTags.includes(tag);
    el.classList.toggle('selected', isSel);
    const check = el.querySelector('.tag-check');
    if (check) check.textContent = isSel ? '✓' : '';
  });
}
function toggleTagDropdown(e) {
  const dd = document.getElementById('tag-dropdown');
  if (!dd) return;
  // re-render options
  dd.innerHTML = settings.tags.map(tag => `
    <div class="tag-option ${selectedTags.includes(tag)?'selected':''}" onclick="toggleTag(event,'${esc(tag)}')">
      <div class="tag-check">${selectedTags.includes(tag)?'✓':''}</div>
      ${esc(tag)}
    </div>`).join('');
  dd.classList.toggle('open');
}
function toggleTag(e, tag) {
  if (e) e.stopPropagation();
  const idx = selectedTags.indexOf(tag);
  if (idx >= 0) selectedTags.splice(idx, 1); else selectedTags.push(tag);
  renderTagMulti();
  // refresh dropdown
  const dd = document.getElementById('tag-dropdown');
  if (dd) dd.innerHTML = settings.tags.map(t => `
    <div class="tag-option ${selectedTags.includes(t)?'selected':''}" onclick="toggleTag(event,'${esc(t)}')">
      <div class="tag-check">${selectedTags.includes(t)?'✓':''}</div>
      ${esc(t)}
    </div>`).join('');
}
function removeTag(e, tag) {
  if (e) e.stopPropagation();
  selectedTags = selectedTags.filter(t => t !== tag);
  renderTagMulti();
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.remove('open');
  editingId = null;
}
function closeModalOnBg(e) { if (e.target === document.getElementById('modal-overlay')) closeModal(); }

function saveTask() {
  const titleEl = document.getElementById('f-title');
  const title = titleEl ? titleEl.value.trim() : '';
  if (!title) { if (titleEl) titleEl.focus(); return; }
  const data = {
    title, category: document.getElementById('f-cat').value,
    tags: [...selectedTags],
    priority: document.getElementById('f-priority').value,
    status:   document.getElementById('f-status').value,
    startDate:  document.getElementById('f-start').value || null,
    dueDate:    document.getElementById('f-due').value   || null,
    assigneeIds: [...selectedAssignees],
  };
  if (editingId) { updateTask(editingId, data); toast('수정 완료'); }
  else           { createTask(data);            toast('업무 추가 완료'); }
  closeModal(); renderAll();
}

function deleteCurrentTask() {
  if (!editingId || !confirm('이 업무를 삭제하시겠습니까?')) return;
  deleteTask(editingId); closeModal(); renderAll(); toast('삭제됨');
}

// ── ASSIGNEE SELECTION ────────────────────────────────
function _populateAssignee(cat, currentIds = []) {
  if (!Array.isArray(currentIds)) currentIds = currentIds ? [currentIds] : [];
  selectedAssignees = [...currentIds];
  renderAssigneeMulti(cat);
}
function _assigneeLabel(c) {
  const phone = c.officePhone || c.mobilePhone || '';
  return [c.name, c.title].filter(Boolean).join(' ') + (phone ? ` (${phone})` : '');
}
function renderAssigneeMulti(cat) {
  const sel = document.getElementById('assignee-multi-selected');
  const ph  = document.getElementById('assignee-placeholder');
  if (!sel) return;
  ph.style.display = selectedAssignees.length ? 'none' : '';
  sel.querySelectorAll('.tag-pill').forEach(el => el.remove());
  selectedAssignees.forEach(id => {
    const c = contacts.find(x => x.id === id);
    if (!c) return;
    const pill = document.createElement('div');
    pill.className = 'tag-pill';
    pill.innerHTML = `${esc(c.name)} <span class="tag-pill-x" onclick="removeAssignee(event,'${esc(id)}')">✕</span>`;
    sel.insertBefore(pill, ph);
  });
  _refreshAssigneeDd(cat);
}
function _refreshAssigneeDd(cat) {
  const dd = document.getElementById('assignee-dropdown');
  if (!dd) return;
  const c2 = cat !== undefined ? cat : (document.getElementById('f-cat')?.value || '');
  const list = c2 ? contacts.filter(c => (c.categories||[]).includes(c2)) : contacts;
  dd.innerHTML = list.length
    ? list.map(c => {
        const isSel = selectedAssignees.includes(c.id);
        const roles = (c.categoryRoles||[]);
        const roleStr = c2
          ? (()=>{ const r=roles.find(r=>r.category===c2); return r?(r.role==='main'?' · 정':' · 부'):''; })()
          : (roles.length ? ' · ' + roles.map(r=>`${esc(r.category)} ${r.role==='main'?'정':'부'}`).join(', ') : '');
        return `<div class="tag-option ${isSel?'selected':''}" onclick="toggleAssignee(event,'${esc(c.id)}')">
          <div class="tag-check">${isSel?'✓':''}</div>${esc(_assigneeLabel(c))}${roleStr}
        </div>`;
      }).join('')
    : '<div style="padding:8px 12px;font-size:12px;color:var(--text3)">담당자 없음</div>';
}
function toggleAssigneeDropdown(e) {
  const dd = document.getElementById('assignee-dropdown');
  if (!dd) return;
  _refreshAssigneeDd();
  dd.classList.toggle('open');
}
function toggleAssignee(e, id) {
  if (e) e.stopPropagation();
  const idx = selectedAssignees.indexOf(id);
  if (idx >= 0) selectedAssignees.splice(idx, 1); else selectedAssignees.push(id);
  renderAssigneeMulti();
  _refreshAssigneeDd();
}
function removeAssignee(e, id) {
  if (e) e.stopPropagation();
  selectedAssignees = selectedAssignees.filter(x => x !== id);
  renderAssigneeMulti();
}

// ── RICH MODAL ────────────────────────────────────────
let _richModalTags = [];
function showRichModal({ title, data, extraTop = '', onSave, onDelete = null }) {
  const old = document.getElementById('rich-modal-overlay'); if (old) old.remove();
  _richModalTags = data ? [...(data.tags || [])] : [];

  const catOpts = '<option value="">없음</option>' +
    settings.categories.map(c=>`<option value="${esc(c)}" ${data?.category===c?'selected':''}>${esc(c)}</option>`).join('');
  const priOpts = settings.priorities.map(p=>`<option value="${esc(p.key)}" ${(data?.priority||'medium')===p.key?'selected':''}>${esc(p.label)}</option>`).join('');
  const stOpts  = settings.statuses.map(s=>`<option value="${esc(s.key)}" ${(data?.status||'todo')===s.key?'selected':''}>${esc(s.label)}</option>`).join('');
  const tagPillsHtml = () => _richModalTags.map(tg=>`<div class="tag-pill">${esc(tg)}<span class="tag-pill-x" onclick="richRemoveTag('${esc(tg)}')">✕</span></div>`).join('');
  const tagDdHtml = () => settings.tags.map(tg=>`
    <div class="tag-option ${_richModalTags.includes(tg)?'selected':''}" onclick="richToggleTag('${esc(tg)}')">
      <div class="tag-check">${_richModalTags.includes(tg)?'✓':''}</div>${esc(tg)}
    </div>`).join('');
  const delBtn = onDelete ? `<button class="btn btn-danger btn-sm" onclick="richModalDelete()" style="margin-right:auto">삭제</button>` : '';

  const overlay = document.createElement('div');
  overlay.id = 'rich-modal-overlay';
  overlay.className = 'modal-overlay open';
  overlay.innerHTML = `
    <div class="modal" style="width:540px">
      <div class="modal-head">
        <div class="modal-title">${esc(title)}</div>
        <button class="modal-close" onclick="closeRichModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="field"><div class="field-label">업무명 *</div>
          <input class="field-input" id="rm-title" value="${esc(data?.title||'')}" placeholder="업무 이름을 입력하세요">
        </div>
        ${extraTop}
        <div class="field-row">
          <div class="field"><div class="field-label">카테고리</div><select class="field-select" id="rm-cat">${catOpts}</select></div>
          <div class="field"><div class="field-label">우선순위</div><select class="field-select" id="rm-pri">${priOpts}</select></div>
        </div>
        <div class="field-row">
          <div class="field"><div class="field-label">상태</div><select class="field-select" id="rm-status">${stOpts}</select></div>
          <div class="field"><div class="field-label">태그</div>
            <div class="tag-multi" id="rich-tag-multi" onclick="richToggleTagDd(event)">
              <div class="tag-multi-selected" id="rich-tag-selected">
                ${_richModalTags.length ? tagPillsHtml() : '<span class="tag-placeholder">태그 선택...</span>'}
              </div>
              <div class="tag-dropdown" id="rich-tag-dd">${tagDdHtml()}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-foot">${delBtn}
        <button class="btn btn-ghost" onclick="closeRichModal()">취소</button>
        <button class="btn btn-primary" onclick="richModalSave()">저장</button>
      </div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeRichModal(); });
  document.body.appendChild(overlay);
  window._richOnSave   = onSave;   // 모달 콜백용 임시 전역 (단일 모달 인스턴스)
  window._richOnDelete = onDelete; // 모달 콜백용 임시 전역
  const titleInp = document.getElementById('rm-title');
  if (titleInp) setTimeout(() => titleInp.focus(), 50);
}
function richToggleTagDd(e) {
  const dd = document.getElementById('rich-tag-dd');
  if (!dd) return;
  dd.innerHTML = settings.tags.map(tg=>`
    <div class="tag-option ${_richModalTags.includes(tg)?'selected':''}" onclick="richToggleTag('${esc(tg)}')">
      <div class="tag-check">${_richModalTags.includes(tg)?'✓':''}</div>${esc(tg)}
    </div>`).join('');
  dd.classList.toggle('open');
}
function richToggleTag(tag) {
  const i = _richModalTags.indexOf(tag);
  if (i>=0) _richModalTags.splice(i,1); else _richModalTags.push(tag);
  const sel = document.getElementById('rich-tag-selected');
  const dd  = document.getElementById('rich-tag-dd');
  if (sel) sel.innerHTML = _richModalTags.length
    ? _richModalTags.map(tg=>`<div class="tag-pill">${esc(tg)}<span class="tag-pill-x" onclick="richRemoveTag('${esc(tg)}')">✕</span></div>`).join('')
    : '<span class="tag-placeholder">태그 선택...</span>';
  if (dd) dd.innerHTML = settings.tags.map(tg=>`
    <div class="tag-option ${_richModalTags.includes(tg)?'selected':''}" onclick="richToggleTag('${esc(tg)}')">
      <div class="tag-check">${_richModalTags.includes(tg)?'✓':''}</div>${esc(tg)}
    </div>`).join('');
}
function richRemoveTag(tag) {
  _richModalTags = _richModalTags.filter(t=>t!==tag);
  richToggleTag(tag); richToggleTag(tag); // refresh without toggling
  _richModalTags = _richModalTags.filter(t=>t!==tag);
  const sel = document.getElementById('rich-tag-selected');
  if (sel) sel.innerHTML = _richModalTags.length
    ? _richModalTags.map(tg=>`<div class="tag-pill">${esc(tg)}<span class="tag-pill-x" onclick="richRemoveTag('${esc(tg)}')">✕</span></div>`).join('')
    : '<span class="tag-placeholder">태그 선택...</span>';
}
function richModalSave() {
  const titleInp = document.getElementById('rm-title');
  const title = titleInp ? titleInp.value.trim() : '';
  if (!title) { toast('업무명을 입력하세요'); return; }
  const data = {
    title,
    category: document.getElementById('rm-cat').value,
    priority: document.getElementById('rm-pri').value,
    status:   document.getElementById('rm-status').value,
    tags:     [..._richModalTags],
  };
  if (window._richOnSave && window._richOnSave(data)) closeRichModal();
}
function richModalDelete() { closeRichModal(); if (window._richOnDelete) window._richOnDelete(); }
function closeRichModal() { const o=document.getElementById('rich-modal-overlay'); if(o)o.remove(); }

// ── OUTSIDE CLICK HANDLERS ────────────────────────────
document.addEventListener('click', e => {
  // tag dropdown
  const tagDd = document.getElementById('tag-dropdown');
  const tagMulti = document.getElementById('tag-multi');
  if (tagDd && tagMulti && !tagMulti.contains(e.target)) tagDd.classList.remove('open');

  // rich tag dropdown
  const richDd = document.getElementById('rich-tag-dd');
  const richWrap = document.getElementById('rich-tag-multi');
  if (richDd && richWrap && !richWrap.contains(e.target)) richDd.classList.remove('open');

  // assignee dropdown
  const assDd = document.getElementById('assignee-dropdown');
  const assMulti = document.getElementById('assignee-multi');
  if (assDd && assMulti && !assMulti.contains(e.target)) assDd.classList.remove('open');
});
