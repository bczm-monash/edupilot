(function () {
  const listEl = document.getElementById('classroomList');
  const openOverlayBtn = document.getElementById('openEnrollOverlay');
  const viewAvailableBtn = document.getElementById('viewAvailableBtn');
  const overlayEl = document.getElementById('editOverlay');
  const overlayBodyEl = document.getElementById('overlayBody');
  const overlaySelectAllEl = document.getElementById('selectAllChk');
  const overlayConfirmBtn = document.getElementById('addSelected');
  const overlayCancelBtn = document.getElementById('closeOverlay');

  let supabaseClient = null;
  let currentUserId = '';
  let enrolledClassroomIds = new Set();
  let cachedEnrolledClassrooms = [];
  let availableClassrooms = [];

  function renderEmpty(message) {
    if (!listEl) return;
    listEl.innerHTML = '';
    const li = document.createElement('li');
    li.textContent = message;
    li.style.listStyle = 'none';
    li.style.margin = '12px';
    listEl.appendChild(li);
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
    li.tabIndex = 0;
    li.setAttribute('role', 'button');

    const content = document.createElement('div');
    content.className = 'card-content';

    const titleEl = document.createElement('div');
    titleEl.className = 'classroom-title';
    titleEl.textContent = classroom.classroom_title || 'Untitled classroom';

    const idEl = document.createElement('div');
    idEl.className = 'classroom-meta';
    idEl.textContent = `ID: ${classroom.classroom_id ?? '-'}`;

    const courseEl = document.createElement('div');
    courseEl.className = 'classroom-meta';
    if (classroom.course_id) courseEl.textContent = `Course: ${classroom.course_id}`;

    const startEl = document.createElement('div');
    startEl.className = 'classroom-meta';
    if (classroom.classroom_start_date) {
      startEl.textContent = `Start: ${normaliseDate(classroom.classroom_start_date)}`;
    }

    const endEl = document.createElement('div');
    endEl.className = 'classroom-meta';
    if (classroom.classroom_end_date) {
      endEl.textContent = `End: ${normaliseDate(classroom.classroom_end_date)}`;
    }

    content.appendChild(titleEl);
    content.appendChild(idEl);
    if (courseEl.textContent) content.appendChild(courseEl);
    if (startEl.textContent) content.appendChild(startEl);
    if (endEl.textContent) content.appendChild(endEl);

    function open() {
      if (!classroom.classroom_id) return;
      const url = `/EduPilot/html/student/sClassroom_content.html?id=${encodeURIComponent(classroom.classroom_id)}`;
      window.location.href = url;
    }

    li.addEventListener('click', open);
    li.addEventListener('keypress', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });

    li.appendChild(content);
    return li;
  }

  async function ensureSupabaseReady(retry = 0) {
    if (supabaseClient || window.supabase) {
      supabaseClient = window.supabase || supabaseClient;
      return supabaseClient;
    }
    if (retry > 6) return null;
    await new Promise((resolve) => setTimeout(resolve, 150 * (retry + 1)));
    return ensureSupabaseReady(retry + 1);
  }

  async function getCurrentUser() {
    const client = await ensureSupabaseReady();
    if (!client) return null;
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) return null;
    return data.user;
  }

  async function fetchClassroomIdsForUser(userId) {
    const client = await ensureSupabaseReady();
    if (!client) return [];

    const { data, error } = await client
      .from('classmate')
      .select('classroom_id')
      .eq('users_id', userId);

    if (error) {
      console.error('Failed to load classroom memberships:', error);
      return [];
    }

    return (data || [])
      .map((row) => row.classroom_id)
      .filter((id) => id !== null && id !== undefined);
  }

  async function fetchClassroomsByIds(ids) {
    const client = await ensureSupabaseReady();
    if (!client || !ids.length) return [];

    const numericIds = ids.map((id) => Number(id)).filter((n) => Number.isFinite(n));

    const { data, error } = await client
      .from('classroom')
      .select('classroom_id, classroom_title, classroom_start_date, classroom_end_date, course_id')
      .in('classroom_id', numericIds)
      .order('classroom_id', { ascending: true });

    if (error) {
      console.error('Failed to load classrooms:', error);
      return [];
    }

    return Array.isArray(data) ? data : [];
  }

  async function fetchAvailableClassrooms() {
    const client = await ensureSupabaseReady();
    if (!client) return [];

    const { data, error } = await client
      .from('classroom')
      .select('classroom_id, classroom_title, classroom_start_date, classroom_end_date, course_id')
      .order('classroom_id', { ascending: true })
      .limit(200);

    if (error) {
      console.error('Failed to load available classrooms:', error);
      return [];
    }

    const available = (data || []).filter((room) => !enrolledClassroomIds.has(String(room.classroom_id)));
    return available;
  }

  function resolveTeacherNames() {
    // placeholder for future enhancement using fetchUserDisplayNames
  }

  function renderClassrooms(classrooms) {
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!classrooms.length) {
      renderEmpty('You are not enrolled in any classrooms yet.');
      return;
    }

    const frag = document.createDocumentFragment();
    classrooms.forEach((room) => frag.appendChild(makeCard(room)));
    listEl.appendChild(frag);
  }

  function buildOverlayList() {
    if (!overlayBodyEl) return;
    overlayBodyEl.innerHTML = '';

    if (!availableClassrooms.length) {
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'No additional classrooms available.';
      overlayBodyEl.appendChild(empty);
      if (overlaySelectAllEl) overlaySelectAllEl.checked = false;
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
      const title = room.classroom_title || 'Classroom';
      label.textContent = room.course_id ? `${title} (${room.course_id})` : title;
      label.style.flex = '1';

      row.appendChild(chk);
      row.appendChild(label);
      frag.appendChild(row);
    });

    overlayBodyEl.appendChild(frag);
    if (overlaySelectAllEl) overlaySelectAllEl.checked = false;
  }

  function openOverlay() {
    if (!overlayEl) return;
    buildOverlayList();
    overlayEl.style.display = 'flex';
  }

  function closeOverlay() {
    if (!overlayEl) return;
    overlayEl.style.display = 'none';
  }

  function overlaySelectedIds() {
    if (!overlayBodyEl) return [];
    return Array.from(overlayBodyEl.querySelectorAll('input.row-chk:checked'))
      .map((chk) => chk.dataset.id)
      .filter(Boolean);
  }

  async function handleEnrollSelection() {
    const ids = overlaySelectedIds();
    if (!ids.length) {
      alert('Please select at least one classroom to enroll.');
      return;
    }

    const client = await ensureSupabaseReady();
    if (!client || !currentUserId) {
      alert('Supabase not ready.');
      return;
    }

    const payload = ids.map((id) => {
      const numeric = Number(id);
      return {
        classroom_id: Number.isFinite(numeric) ? numeric : id,
        users_id: currentUserId,
      };
    });

    try {
      const { error } = await client
        .from('classmate')
        .insert(payload);

      if (error) throw error;

      ids.forEach((id) => enrolledClassroomIds.add(String(id)));
      availableClassrooms = availableClassrooms.filter((room) => !ids.includes(String(room.classroom_id)));

      await loadClassrooms(true);
      closeOverlay();
    } catch (error) {
      console.error('Failed to enroll classrooms:', error);
      alert('Failed to enroll classrooms.');
    }
  }

  async function loadClassrooms(skipOverlayRefresh = false) {
    const user = await getCurrentUser();
    if (!user) {
      renderEmpty('Please log in to view classrooms.');
      return;
    }

    currentUserId = user.id;

    const ids = await fetchClassroomIdsForUser(user.id);
    enrolledClassroomIds = new Set(ids.map((id) => String(id)));

    const classrooms = await fetchClassroomsByIds(ids);
    cachedEnrolledClassrooms = classrooms;
    renderClassrooms(classrooms);

    if (!skipOverlayRefresh) {
      availableClassrooms = await fetchAvailableClassrooms();
      buildOverlayList();
    }

    if (openOverlayBtn) {
      const hasAvailable = availableClassrooms.length > 0;
      openOverlayBtn.disabled = !hasAvailable;
      openOverlayBtn.style.opacity = hasAvailable ? '1' : '0.6';
    }
  }

  function bindEvents() {
    if (viewAvailableBtn) {
      viewAvailableBtn.addEventListener('click', (event) => {
        event.preventDefault();
        if (typeof toAvailableClassrooms === 'function') {
          toAvailableClassrooms();
        }
      });
    }

    if (openOverlayBtn) {
      openOverlayBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        availableClassrooms = await fetchAvailableClassrooms();
        buildOverlayList();
        openOverlay();
      });
    }

    if (overlayCancelBtn) overlayCancelBtn.addEventListener('click', closeOverlay);
    if (overlayEl) {
      overlayEl.addEventListener('click', (event) => {
        if (event.target === overlayEl) closeOverlay();
      });
    }

    if (overlaySelectAllEl && overlayBodyEl) {
      overlaySelectAllEl.addEventListener('change', () => {
        const rows = overlayBodyEl.querySelectorAll('input.row-chk');
        rows.forEach((chk) => { chk.checked = overlaySelectAllEl.checked; });
      });
    }

    if (overlayConfirmBtn) overlayConfirmBtn.addEventListener('click', handleEnrollSelection);
  }

  async function init() {
    bindEvents();
    await loadClassrooms();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
