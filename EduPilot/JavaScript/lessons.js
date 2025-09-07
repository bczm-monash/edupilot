(function () {
  const listEl = document.getElementById('lessonList');

  function renderEmpty(message) {
    if (!listEl) return;
    listEl.innerHTML = '';
    const li = document.createElement('li');
    li.textContent = message || 'No lessons found.';
    li.style.listStyle = 'none';
    li.style.margin = '12px';
    listEl.appendChild(li);
  }

  function makeMeta(label, value) {
    const el = document.createElement('div');
    el.className = 'lesson-meta';
    el.textContent = `${label}: ${value}`;
    return el;
  }

  function makeCard(item) {
    const li = document.createElement('li');
    li.className = 'lesson-card';
    li.dataset.id = item.id || item.lesson_id || '';
    li.tabIndex = 0;
    li.setAttribute('role', 'button');

    // Resolve key fields
    const idVal = item.id || item.lesson_id || '';
    const titleVal = item.title || item.lesson_title || item.name || item.lesson_desc || 'Lesson';
    const ownerVal = item.owner_name || item.owner || item.user_id || item.users_id || '';
    const creditVal = item.lesson_credit_pts ?? item.credit_points ?? '';
    const estHoursVal = item.lesson_estimated_hours ?? item.lesson_est_hrs ?? item.estimated_hours ?? '';

    // Content
    const content = document.createElement('div');
    content.className = 'card-content';

    const idLine = document.createElement('div');
    idLine.className = 'lesson-meta';
    idLine.textContent = `ID: ${idVal}`;

    const title = document.createElement('div');
    title.className = 'lesson-title';
    title.textContent = titleVal;

    const owner = document.createElement('div');
    owner.className = 'lesson-meta';
    if (ownerVal) owner.textContent = `Owner: ${ownerVal}`;

    const credit = document.createElement('div');
    credit.className = 'lesson-meta';
    if (creditVal !== '' && creditVal !== null && creditVal !== undefined) {
      credit.textContent = `Credit Points: ${creditVal}`;
    }

    const est = document.createElement('div');
    est.className = 'lesson-meta';
    if (estHoursVal !== '' && estHoursVal !== null && estHoursVal !== undefined) {
      est.textContent = `Estimated Hours: ${estHoursVal}`;
    }

    content.appendChild(idLine);
    content.appendChild(title);
    if (ownerVal) content.appendChild(owner);
    if (credit.textContent) content.appendChild(credit);
    if (est.textContent) content.appendChild(est);

    function open() {
      if (idVal) {
        window.location.href = `/EduPilot/html/teacher/lesson_content.html?id=${encodeURIComponent(idVal)}`;
      }
    }
    li.addEventListener('click', open);
    li.addEventListener('keypress', (e) => { if (e.key === 'Enter' || e.key === ' ') open(); });

    li.appendChild(content);
    return li;
  }

  async function fetchLessons() {
    if (!window.supabase) {
      renderEmpty('Supabase not initialized.');
      return [];
    }

    const { data: lesson, error } = await window.supabase
      .from('lesson')
      .select('*')
      .limit(100);

    if (error) {
      console.error('Error fetching lessons:', error);
      renderEmpty('Failed to load lessons.');
      return [];
    }
    const items = Array.isArray(lesson) ? lesson : [];

    // Build owner names by looking up users table via users_id
    const userIds = Array.from(new Set(items
      .map(it => it.users_id || it.user_id)
      .filter(Boolean)));

    if (userIds.length) {
      try {
        const { data: users, error: userErr } = await window.supabase
          .from('users')
          .select('users_id, users_fname, users_lname')
          .in('users_id', userIds);
        if (!userErr && Array.isArray(users)) {
          const nameById = new Map(users.map(u => [u.users_id, [u.users_fname, u.users_lname].filter(Boolean).join(' ')]));
          items.forEach(it => {
            const key = it.users_id || it.user_id;
            if (key && nameById.has(key)) {
              it.owner_name = nameById.get(key);
            }
          });
        }
      } catch (e) {
        console.warn('Failed to resolve owner names', e);
      }
    }

    return items;
  }

  async function load() {
    if (!listEl) return;
    listEl.innerHTML = '';

    try {
      const items = await fetchLessons();
      if (!items || items.length === 0) {
        renderEmpty('No lessons found.');
        return;
      }

      const frag = document.createDocumentFragment();
      for (const it of items) frag.appendChild(makeCard(it));
      listEl.appendChild(frag);
    } catch (e) {
      console.error('Failed loading lessons', e);
      renderEmpty('Failed to load lessons.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();

(function () {
  const overlay = document.getElementById('editOverlay');
  const overlayBody = document.getElementById('overlayBody');
  const selectAllChk = document.getElementById('selectAllChk');
  const deleteBtn = document.getElementById('deleteSelected');
  const closeBtn = document.getElementById('closeOverlay');
  const editToggle = document.getElementById('editToggle');

  if (!overlay || !overlayBody) return;

  function getRenderedLessons() {
    const list = document.getElementById('lessonList');
    if (!list) return [];
    const items = Array.from(list.querySelectorAll('li.lesson-card'));
    return items.map(li => ({
      id: li.dataset.id || '',
      title: (li.querySelector('.lesson-title')?.textContent || 'Lesson').trim(),
    }));
  }

  function buildOverlayList() {
    overlayBody.innerHTML = '';
    const lessons = getRenderedLessons();
    if (!lessons.length) {
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'No lessons available.';
      overlayBody.appendChild(empty);
      return;
    }
    const frag = document.createDocumentFragment();
    lessons.forEach(ls => {
      const row = document.createElement('div');
      row.className = 'list-row';
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'row-chk';
      chk.dataset.id = ls.id;
      const label = document.createElement('label');
      label.textContent = ls.title;
      label.style.flex = '1';
      row.appendChild(chk);
      row.appendChild(label);
      frag.appendChild(row);
    });
    overlayBody.appendChild(frag);
    if (selectAllChk) selectAllChk.checked = false;
  }

  function openOverlay() {
    buildOverlayList();
    overlay.style.display = 'flex';
  }

  function closeOverlay() {
    overlay.style.display = 'none';
  }

  function selectedIds() {
    return Array.from(overlayBody.querySelectorAll('input.row-chk:checked'))
      .map(c => c.dataset.id)
      .filter(Boolean);
  }

  async function deleteFromSupabase(ids) {
    if (!window.supabase || !ids.length) return { ok: false, tried: false };
    try {
      const { error: e1 } = await window.supabase.from('lesson').delete().in('id', ids);
      if (!e1) return { ok: true, tried: true };
      const { error: e2 } = await window.supabase.from('lesson').delete().in('lesson_id', ids);
      if (!e2) return { ok: true, tried: true };
      console.warn('Delete failed by both id and lesson_id', e1, e2);
      return { ok: false, tried: true };
    } catch (err) {
      console.error('Supabase delete error', err);
      return { ok: false, tried: true };
    }
  }

  async function handleDeleteSelected() {
    const ids = selectedIds();
    if (!ids.length) { alert('Please select at least one lesson.'); return; }

    const list = document.getElementById('lessonList');
    ids.forEach(id => {
      const li = list?.querySelector(`li.lesson-card[data-id="${CSS.escape(id)}"]`);
      if (li) li.remove();
    });

    const result = await deleteFromSupabase(ids);
    if (result.tried) {
      alert(result.ok ? 'Deleted from database.' : 'Failed to delete from database.');
    }

    buildOverlayList();
  }

  editToggle?.addEventListener('click', openOverlay);
  closeBtn?.addEventListener('click', closeOverlay);
  overlay?.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });
  deleteBtn?.addEventListener('click', handleDeleteSelected);
  selectAllChk?.addEventListener('change', () => {
    const chks = overlayBody.querySelectorAll('input.row-chk');
    chks.forEach(c => c.checked = !!selectAllChk?.checked);
  });
})();
