(function () {
  const enrolledBtn = document.getElementById('enrollSelectedBtn');
  const listEl = document.getElementById('availableClassroomList');
  const overlayEl = document.getElementById('enrollOverlay');
  const overlayBodyEl = document.getElementById('availableOverlayBody');
  const selectAllEl = document.getElementById('availableSelectAll');
  const confirmBtn = document.getElementById('confirmAvailableEnroll');
  const cancelBtn = document.getElementById('cancelAvailableEnroll');

  let supabaseClient = null;
  let currentUserId = '';
  let availableClassrooms = [];

  function ensureSupabaseReady(retry = 0) {
    return new Promise((resolve) => {
      if (window.supabase) {
        supabaseClient = window.supabase;
        resolve(window.supabase);
        return;
      }
      if (retry > 6) {
        resolve(null);
        return;
      }
      setTimeout(() => {
        ensureSupabaseReady(retry + 1).then(resolve);
      }, 150 * (retry + 1));
    });
  }

  async function getCurrentUser() {
    const client = await ensureSupabaseReady();
    if (!client) return null;
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) return null;
    return data.user;
  }

  async function fetchEnrolledIds(userId) {
    const client = supabaseClient;
    if (!client) return [];

    const { data, error } = await client
      .from('classmate')
      .select('classroom_id')
      .eq('users_id', userId);

    if (error) {
      console.error('Failed to load enrolled classroom ids:', error);
      return [];
    }

    return (data || [])
      .map((row) => row.classroom_id)
      .filter((id) => id !== null && id !== undefined)
      .map((id) => Number(id));
  }

  async function fetchAvailableClassrooms(excludedIds) {
    const client = supabaseClient;
    if (!client) return [];

    let query = client
      .from('classroom')
      .select('classroom_id, classroom_title, classroom_start_date, classroom_end_date, course_id')
      .order('classroom_id', { ascending: true })
      .limit(200);

    if (excludedIds.length) {
      query = query.not('classroom_id', 'in', `(${excludedIds.join(',')})`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to load available classrooms:', error);
      return [];
    }

    return Array.isArray(data) ? data : [];
  }

  function normaliseDate(dateText) {
    if (!dateText) return '';
    const parts = String(dateText).split(/[-/]/);
    if (parts.length === 3) {
      const [a, b, c] = parts;
      if (a.length === 4) return `${c.padStart(2, '0')}/${b.padStart(2, '0')}/${a}`;
      if (c.length === 4) return `${a.padStart(2, '0')}/${b.padStart(2, '0')}/${c}`;
    }
    return dateText;
  }

function makeCard(classroom) {
  const li = document.createElement('li');
  li.className = 'classroom-card';
  li.dataset.id = classroom.classroom_id ?? '';

  const content = document.createElement('div');
  content.className = 'card-content';

  const title = document.createElement('div');
  title.className = 'classroom-title';
  title.textContent = classroom.classroom_title || 'Untitled classroom';

  const metaId = document.createElement('div');
  metaId.className = 'classroom-meta';
  metaId.textContent = `ID: ${classroom.classroom_id ?? '-'}`;

  const metaCourse = document.createElement('div');
  metaCourse.className = 'classroom-meta';
  if (classroom.course_id) metaCourse.textContent = `Course: ${classroom.course_id}`;

  const metaStart = document.createElement('div');
  metaStart.className = 'classroom-meta';
  if (classroom.classroom_start_date) metaStart.textContent = `Start: ${normaliseDate(classroom.classroom_start_date)}`;

  const metaEnd = document.createElement('div');
  metaEnd.className = 'classroom-meta';
  if (classroom.classroom_end_date) metaEnd.textContent = `End: ${normaliseDate(classroom.classroom_end_date)}`;

  content.appendChild(title);
  content.appendChild(metaId);
  if (metaCourse.textContent) content.appendChild(metaCourse);
  if (metaStart.textContent) content.appendChild(metaStart);
  if (metaEnd.textContent) content.appendChild(metaEnd);

  li.appendChild(content);
  return li;
}

  function renderAvailableClassrooms() {
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!availableClassrooms.length) {
      const li = document.createElement('li');
      li.textContent = 'No available classrooms to join.';
      li.style.listStyle = 'none';
      li.style.margin = '12px';
      listEl.appendChild(li);
      return;
    }

    const frag = document.createDocumentFragment();
    availableClassrooms.forEach((room) => {
      frag.appendChild(makeCard(room));
    });
    listEl.appendChild(frag);
  }

  function buildOverlayList() {
    if (!overlayBodyEl) return;
    overlayBodyEl.innerHTML = '';

    if (!availableClassrooms.length) {
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'No available classrooms to enroll.';
      overlayBodyEl.appendChild(empty);
      if (selectAllEl) selectAllEl.checked = false;
      return;
    }

    const frag = document.createDocumentFragment();
    availableClassrooms.forEach((room) => {
      const row = document.createElement('div');
      row.className = 'list-row';

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'row-chk';
      chk.dataset.id = String(room.classroom_id);

      const label = document.createElement('label');
      label.textContent = room.classroom_title || room.classroom_id;
      label.style.flex = '1';

      row.appendChild(chk);
      row.appendChild(label);
      frag.appendChild(row);
    });

    overlayBodyEl.appendChild(frag);
    if (selectAllEl) selectAllEl.checked = false;
  }

  function openOverlay() {
    if (overlayEl) overlayEl.style.display = 'flex';
  }

  function closeOverlay() {
    if (overlayEl) overlayEl.style.display = 'none';
  }

  function overlaySelectedIds() {
    if (!overlayBodyEl) return [];
    return Array.from(overlayBodyEl.querySelectorAll('input.row-chk:checked'))
      .map((chk) => chk.dataset.id)
      .filter(Boolean);
  }

  async function enrollSelected(ids) {
    const client = supabaseClient;
    if (!client || !currentUserId) {
      alert('Supabase not initialised.');
      return;
    }

    if (!ids.length) {
      alert('Please select at least one classroom to enroll.');
      return;
    }

    const payload = ids.map((id) => ({
      classroom_id: Number(id),
      users_id: currentUserId,
    }));

    try {
      const { error } = await client
        .from('classmate')
        .insert(payload);

      if (error) throw error;

      availableClassrooms = availableClassrooms.filter((room) => !ids.includes(String(room.classroom_id)));
      renderAvailableClassrooms();
      buildOverlayList();

      if (enrolledBtn) {
        const hasAvailable = availableClassrooms.length > 0;
        enrolledBtn.disabled = !hasAvailable;
        enrolledBtn.style.opacity = hasAvailable ? '1' : '0.6';
      }

      closeOverlay();
    } catch (error) {
      console.error('Failed to enroll classrooms:', error);
      alert('Failed to enroll classrooms.');
    }
  }

  async function initialise() {
    supabaseClient = await ensureSupabaseReady();
    if (!supabaseClient) {
      renderEmpty('Supabase client not ready. Please refresh.');
      return;
    }

    const user = await getCurrentUser();
    if (!user) {
      renderEmpty('Please log in to view available classrooms.');
      return;
    }

    currentUserId = user.id;
    const enrolledIds = await fetchEnrolledIds(user.id);
    availableClassrooms = await fetchAvailableClassrooms(enrolledIds);

    renderAvailableClassrooms();
    buildOverlayList();

    if (enrolledBtn) {
      enrolledBtn.disabled = !availableClassrooms.length;
      enrolledBtn.style.opacity = availableClassrooms.length ? '1' : '0.6';
      enrolledBtn.addEventListener('click', async () => {
        if (!availableClassrooms.length) return;
        buildOverlayList();
        openOverlay();
      });
    }

    if (selectAllEl && overlayBodyEl) {
      selectAllEl.addEventListener('change', () => {
        const rows = overlayBodyEl.querySelectorAll('input.row-chk');
        rows.forEach((chk) => { chk.checked = selectAllEl.checked; });
      });
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        const ids = overlaySelectedIds();
        enrollSelected(ids);
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeOverlay);
    }

    if (overlayEl) {
      overlayEl.addEventListener('click', (event) => {
        if (event.target === overlayEl) closeOverlay();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialise);
  } else {
    initialise();
  }
})();
