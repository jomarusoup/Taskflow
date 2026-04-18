/**
 * contacts.js - 연락처 관리 및 렌더링
 */

let editingContactId = null;
let contactSort = { col: 'name', dir: 1 };

const CONTACT_COLS = [
  { key:'company',     label:'업체명' },
  { key:'name',        label:'이름' },
  { key:'title',       label:'직책' },
  { key:'category',    label:'카테고리' },
  { key:'type',        label:'정/부' },
  { key:'officePhone', label:'회사번호' },
  { key:'mobilePhone', label:'H.P' },
  { key:'email',       label:'이메일' },
  { key:'memo',        label:'메모' },
];

function contactLabel(c) {
  const phone = c.officePhone || c.mobilePhone || '';
  const phoneLabel = c.officePhone ? c.officePhone : (c.mobilePhone ? c.mobilePhone : '');
  const parts = [c.name, c.title].filter(Boolean);
  return phoneLabel ? parts.join(' ') + ` (${phoneLabel})` : parts.join(' ');
}

function renderContacts() {
  const search = (document.getElementById('contact-search')?.value || '').trim().toLowerCase();
  const bc = document.getElementById('badge-contacts');
  if (bc) bc.textContent = contacts.length;

  const thead = document.getElementById('contact-thead');
  const tbody = document.getElementById('contact-tbody');
  if (!tbody) return;

  // 헤더
  if (thead) {
    thead.innerHTML = '<tr>' + CONTACT_COLS.map(col => {
      const sorted = contactSort.col === col.key;
      const icon = sorted ? (contactSort.dir === 1 ? ' ▲' : ' ▼') : ' ⇅';
      return `<th class="${sorted?'sorted':''}" onclick="sortContacts('${col.key}')">${col.label}<span style="font-size:9px;color:${sorted?'var(--amber)':'var(--text3)'}">${icon}</span></th>`;
    }).join('') + '<th style="width:60px"></th></tr>';
  }

  // 필터 + 정렬
  let list = [...contacts];
  if (search) list = list.filter(c =>
    (c.name||'').toLowerCase().includes(search) ||
    (c.company||'').toLowerCase().includes(search) ||
    (c.title||'').toLowerCase().includes(search) ||
    (c.email||'').toLowerCase().includes(search) ||
    (c.officePhone||'').includes(search) ||
    (c.mobilePhone||'').includes(search)
  );
  list.sort((a,b) => {
    const getV = (x) => contactSort.col === 'category'
      ? (x.categories||[]).join(',').toLowerCase()
      : (x[contactSort.col]||'').toLowerCase();
    const av = getV(a), bv = getV(b);
    if (av !== bv) return av < bv ? -contactSort.dir : contactSort.dir;
    // 같은 정렬값이면 정(main) → 부(sub) 순으로 2차 정렬
    const roleOf = x => {
      const roles = (x.categoryRoles||[]).map(r=>r.role);
      if (roles.includes('main')) return 0;
      if (roles.includes('sub')) return 1;
      return x.type === 'main' ? 0 : 1;
    };
    return roleOf(a) - roleOf(b);
  });

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="${CONTACT_COLS.length+1}" class="contact-empty">연락처가 없습니다 — ＋ 추가 버튼으로 등록하세요</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(c => `
    <tr>
      <td>${esc(c.company||'')}</td>
      <td style="font-weight:500">${esc(c.name)}</td>
      <td>${esc(c.title||'')}</td>
      <td>${(c.categories||[]).length?(c.categories.map(cat=>`<span class="tag">${esc(cat)}</span>`).join(' ')):'<span class="tag">미분류</span>'}</td>
      <td>${(c.categoryRoles||[]).length
        ? c.categoryRoles.map(r=>`<span class="ct-type-badge ${r.role==='main'?'ct-type-main':'ct-type-sub'}">${esc(r.category)} ${r.role==='main'?'정':'부'}</span>`).join(' ')
        : (c.type==='main'?'<span class="ct-type-badge ct-type-main">정</span>':'<span class="ct-type-badge ct-type-sub">부</span>')
      }</td>
      <td style="font-family:var(--mono);font-size:11px">${esc(c.officePhone||'—')}</td>
      <td style="font-family:var(--mono);font-size:11px">${esc(c.mobilePhone||'—')}</td>
      <td style="font-size:11px;color:var(--text2)">${esc(c.email||'')}</td>
      <td style="font-size:11px;color:var(--text2);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.memo||'')}</td>
      <td><div class="ct-actions">
        <button class="btn btn-ghost btn-sm btn-icon" onclick="openContactModal('${esc(c.id)}')">✎</button>
        <button class="btn btn-danger btn-sm btn-icon" onclick="deleteContact('${esc(c.id)}')">✕</button>
      </div></td>
    </tr>`).join('');
}

function sortContacts(col) {
  if (contactSort.col === col) contactSort.dir *= -1;
  else { contactSort.col = col; contactSort.dir = 1; }
  renderContacts();
}

function openContactModal(id = null) {
  editingContactId = id;
  const c = id ? contacts.find(x => x.id === id) : null;
  selectedContactCats = c ? [...(c.categories || (c.category ? [c.category] : []))] : [];
  contactCategoryRoles = {};
  if (c?.categoryRoles) c.categoryRoles.forEach(r => { contactCategoryRoles[r.category] = r.role; });
  else selectedContactCats.forEach(cat => { contactCategoryRoles[cat] = c?.type || 'main'; });

  const overlay = document.createElement('div');
  overlay.className = 'contact-modal-overlay';
  overlay.id = 'contact-modal-overlay';
  overlay.onclick = e => { if(e.target===overlay) closeContactModal(); };
  overlay.innerHTML = `
    <div class="contact-modal">
      <div class="modal-header">
        <div class="modal-title">${c ? '연락처 수정' : '연락처 추가'}</div>
        <button class="modal-close" onclick="closeContactModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="field-row">
          <div class="field"><div class="field-label">이름 *</div><input class="field-input" id="cm-name" value="${esc(c?.name||'')}" placeholder="이름"></div>
          <div class="field"><div class="field-label">직책</div><input class="field-input" id="cm-title" value="${esc(c?.title||'')}" placeholder="직책"></div>
        </div>
        <div class="field-row">
          <div class="field"><div class="field-label">업체명</div><input class="field-input" id="cm-company" value="${esc(c?.company||'')}" placeholder="회사명"></div>
          <div class="field">
            <div class="field-label">카테고리</div>
            <div class="tag-multi" id="cm-cat-multi" onclick="toggleContactCatDd(event)">
              <div class="tag-multi-selected" id="cm-cat-selected">
                <span class="tag-placeholder" id="cm-cat-placeholder">카테고리 선택...</span>
              </div>
              <div class="tag-dropdown" id="cm-cat-dd"></div>
            </div>
          </div>
        </div>
        <div id="cm-roles-section"></div>
        <div class="field"><div class="field-label">이메일</div><input class="field-input" id="cm-email" value="${esc(c?.email||'')}" placeholder="email@example.com"></div>
        <div class="field-row">
          <div class="field"><div class="field-label">회사번호</div><input class="field-input" id="cm-office" value="${esc(c?.officePhone||'')}" placeholder="02-0000-0000"></div>
          <div class="field"><div class="field-label">H.P</div><input class="field-input" id="cm-mobile" value="${esc(c?.mobilePhone||'')}" placeholder="010-0000-0000"></div>
        </div>
        <div class="field"><div class="field-label">메모</div><textarea class="field-input" id="cm-memo" rows="2" style="resize:vertical">${esc(c?.memo||'')}</textarea></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" onclick="closeContactModal()">취소</button>
        ${c ? `<button class="btn btn-danger btn-sm" onclick="deleteContact('${esc(c.id)}');closeContactModal()">삭제</button>` : ''}
        <button class="btn btn-primary" onclick="saveContact()">저장</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(() => {
    const nameInp = document.getElementById('cm-name');
    if (nameInp) nameInp.focus();
    renderContactCatMulti();
  }, 50);
}

function renderContactCatMulti() {
  const sel = document.getElementById('cm-cat-selected');
  const ph  = document.getElementById('cm-cat-placeholder');
  if (!sel) return;
  ph.style.display = selectedContactCats.length ? 'none' : '';
  sel.querySelectorAll('.tag-pill').forEach(el => el.remove());
  selectedContactCats.forEach(cat => {
    const pill = document.createElement('div');
    pill.className = 'tag-pill';
    pill.innerHTML = `${esc(cat)} <span class="tag-pill-x" onclick="removeContactCat(event,'${esc(cat)}')">✕</span>`;
    sel.insertBefore(pill, ph);
  });
  const dd = document.getElementById('cm-cat-dd');
  if (dd) dd.innerHTML = settings.categories.map(cat => {
    const isSel = selectedContactCats.includes(cat);
    return `<div class="tag-option ${isSel?'selected':''}" onclick="toggleContactCat(event,'${esc(cat)}')">
      <div class="tag-check">${isSel?'✓':''}</div>${esc(cat)}
    </div>`;
  }).join('') || '<div style="padding:8px 12px;font-size:12px;color:var(--text3)">카테고리 없음</div>';
  // 카테고리별 정/부 섹션 렌더
  const rs = document.getElementById('cm-roles-section');
  if (!rs) return;
  if (!selectedContactCats.length) { rs.innerHTML = ''; return; }
  rs.innerHTML = `<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px">` +
    selectedContactCats.map(cat => {
      const role = contactCategoryRoles[cat] || 'main';
      return `<div style="display:flex;align-items:center;gap:8px;font-size:12px">
        <span class="tag" style="min-width:60px;text-align:center">${esc(cat)}</span>
        <div style="display:flex;gap:4px">
          <button type="button" class="role-btn${role==='main'?' role-btn-active':''}" onclick="setContactRole('${esc(cat)}','main')">정</button>
          <button type="button" class="role-btn${role==='sub'?' role-btn-active':''}" onclick="setContactRole('${esc(cat)}','sub')">부</button>
        </div>
      </div>`;
    }).join('') + `</div>`;
}
function toggleContactCatDd(e) {
  const dd = document.getElementById('cm-cat-dd');
  if (!dd) return;
  renderContactCatMulti();
  dd.classList.toggle('open');
}
function toggleContactCat(e, cat) {
  if (e) e.stopPropagation();
  const idx = selectedContactCats.indexOf(cat);
  if (idx >= 0) {
    selectedContactCats.splice(idx, 1);
    delete contactCategoryRoles[cat];
  } else {
    selectedContactCats.push(cat);
    if (!contactCategoryRoles[cat]) contactCategoryRoles[cat] = 'main';
  }
  renderContactCatMulti();
}
function removeContactCat(e, cat) {
  if (e) e.stopPropagation();
  selectedContactCats = selectedContactCats.filter(x => x !== cat);
  delete contactCategoryRoles[cat];
  renderContactCatMulti();
}
function setContactRole(cat, role) {
  contactCategoryRoles[cat] = role;
  // 해당 카테고리 버튼 하이라이트 즉시 갱신
  const rs = document.getElementById('cm-roles-section');
  if (!rs) return;
  rs.querySelectorAll(`button.role-btn`).forEach(btn => {
    const parentCat = btn.closest('div[style]')?.querySelector('.tag')?.textContent;
    if (parentCat !== cat) return;
    btn.classList.toggle('role-btn-active', btn.textContent === (role === 'main' ? '정' : '부'));
  });
}

function closeContactModal() {
  const overlay = document.getElementById('contact-modal-overlay');
  if (overlay) overlay.remove();
  editingContactId = null;
}

function saveContact() {
  const nameEl = document.getElementById('cm-name');
  const name = nameEl ? nameEl.value.trim() : '';
  if (!name) { if (nameEl) nameEl.focus(); return; }
  const data = {
    name,
    title:       document.getElementById('cm-title').value.trim(),
    company:     document.getElementById('cm-company').value.trim(),
    categories:    [...selectedContactCats],
    categoryRoles: selectedContactCats.map(cat => ({category: cat, role: contactCategoryRoles[cat] || 'main'})),
    officePhone: document.getElementById('cm-office').value.trim(),
    mobilePhone: document.getElementById('cm-mobile').value.trim(),
    email:       document.getElementById('cm-email').value.trim(),
    memo:        document.getElementById('cm-memo').value.trim(),
  };
  if (editingContactId) {
    const c = contacts.find(x => x.id === editingContactId);
    if (c) Object.assign(c, data);
    toast('연락처 수정됨');
  } else {
    contacts.push({ id: 'c' + Date.now(), ...data });
    toast('연락처 추가됨');
  }
  saveContacts();
  closeContactModal();
  renderContacts();
  // 업무 모달 담당자 드롭다운 갱신
  if (document.getElementById('assignee-multi')) renderAssigneeMulti();
}

function deleteContact(id) {
  if (!confirm('연락처를 삭제하시겠습니까?')) return;
  contacts = contacts.filter(c => c.id !== id);
  // 연결된 업무 담당자 초기화
  tasks.forEach(t => { t.assigneeIds = (t.assigneeIds || []).filter(x => x !== id); });
  save(); saveContacts();
  renderContacts(); renderAll();
  toast('연락처 삭제됨');
}

/**
 * 연락처 목록을 Excel(CSV)로 내보내기
 */
function exportContactsCSV() {
  const search = (document.getElementById('contact-search')?.value || '').trim().toLowerCase();
  
  let list = [...contacts];
  if (search) list = list.filter(c =>
    (c.name||'').toLowerCase().includes(search) ||
    (c.company||'').toLowerCase().includes(search) ||
    (c.title||'').toLowerCase().includes(search) ||
    (c.email||'').toLowerCase().includes(search) ||
    (c.officePhone||'').includes(search) ||
    (c.mobilePhone||'').includes(search)
  );

  // 현재 정렬 상태 반영
  list.sort((a,b) => {
    const getV = (x) => contactSort.col === 'category'
      ? (x.categories||[]).join(',').toLowerCase()
      : (x[contactSort.col]||'').toLowerCase();
    const av = getV(a), bv = getV(b);
    return av < bv ? -contactSort.dir : av > bv ? contactSort.dir : 0;
  });

  if (!list.length) {
    toast('내보낼 연락처가 없습니다.');
    return;
  }

  const headers = CONTACT_COLS.map(c => c.label);
  const esc_csv = v => {
    const s = (v == null ? '' : String(v));
    return (s.includes(',') || s.includes('\n') || s.includes('"'))
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  };

  const rows = list.map(c => [
    c.company || '',
    c.name || '',
    c.title || '',
    (c.categories || []).join(' / '),
    (c.categoryRoles || []).map(r => `${r.category}(${r.role==='main'?'정':'부'})`).join(' / '),
    c.officePhone || '',
    c.mobilePhone || '',
    c.email || '',
    (c.memo || '').replace(/\n/g, ' '),
  ].map(esc_csv).join(','));

  const csv     = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob    = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const link    = document.createElement('a');
  link.href     = url;
  link.download = `taskflow_contacts_${today()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast(`연락처 CSV 내보내기 완료 (${list.length}건)`);
}
