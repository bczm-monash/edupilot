
(function () {
  const listEl = document.getElementById('classroomList');
  const openUnenrollOverlayBtn = document.getElementById('openUnenrollOverlay');
  const viewAvailableBtn = document.getElementById('viewAvailableBtn');
  const unenrollOverlayEl = document.getElementById('unenrollOverlay');
  const unenrollOverlayBodyEl = document.getElementById('unenrollOverlayBody');
  const unenrollSelectAllEl = document.getElementById('unenrollSelectAll');
  const confirmUnenrollBtn = document.getElementById('confirmUnenroll');
  const cancelUnenrollBtn = document.getElementById('cancelUnenroll');

  let supabaseClient = null;
  let currentUserId = '';
  let enrolledClassroomIds = new Set();
  let cachedEnrolledClassrooms = [];

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

  function makeCard(classroom, courseTitleMap) {
    const li = document.createElement('li');
    li.className = 'classroom-card';
    li.dataset.id = classroom.classroom_id ?? '';
    li.tabIndex = 0;
    li.setAttribute('role', 'button');

    const content = document.createElement('div');
    content.className = 'card-content';

    // Header: classroom_id - classroom_title
    const titleEl = document.createElement('div');
    titleEl.className = 'classroom-title';
    titleEl.textContent = `${classroom.classroom_id ?? '-'} - ${classroom.classroom_title || 'Untitled classroom'}`;

    // Course details: Course: course_id - course_title
    let courseTitle = '';
    if (classroom.course_id && courseTitleMap && courseTitleMap[classroom.course_id]) {
      courseTitle = courseTitleMap[classroom.course_id];
    }
    const courseEl = document.createElement('div');
    courseEl.className = 'classroom-meta';
    courseEl.textContent = classroom.course_id
      ? `Course: ${classroom.course_id} - ${courseTitle || 'Untitled course'}`
      : 'Course: -';

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

    const stringIds = ids.map((id) => String(id).trim()).filter(Boolean);

    const { data, error } = await client
      .from('classroom')
      .select('classroom_id, classroom_title, classroom_start_date, classroom_end_date, course_id')
      .in('classroom_id', stringIds)
      .order('classroom_id', { ascending: true });

    if (error) {
      console.error('Failed to load classrooms:', error);
      return [];
    }

    return Array.isArray(data) ? data : [];
  }

  function renderClassrooms(classrooms, courseTitleMap) {
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!classrooms.length) {
      renderEmpty('You are not enrolled in any classrooms yet.');
      return;
    }

    const frag = document.createDocumentFragment();
    classrooms.forEach((room) => frag.appendChild(makeCard(room, courseTitleMap)));
    listEl.appendChild(frag);
  }

  function buildUnenrollOverlayList() {
    if (!unenrollOverlayBodyEl) return;
    unenrollOverlayBodyEl.innerHTML = '';

    if (!cachedEnrolledClassrooms.length) {
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'No enrolled classrooms to display.';
      unenrollOverlayBodyEl.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    cachedEnrolledClassrooms.forEach((room) => {
      const id = room.classroom_id;
      if (!id) return;
      const row = document.createElement('div');
      row.className = 'list-row';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'row-chk';
      checkbox.dataset.id = id;

      const label = document.createElement('label');
      label.style.flex = '1';
      label.textContent = `${id} - ${room.classroom_title || 'Untitled classroom'}`;

      row.appendChild(checkbox);
      row.appendChild(label);
      frag.appendChild(row);
    });

    unenrollOverlayBodyEl.appendChild(frag);
    if (unenrollSelectAllEl) unenrollSelectAllEl.checked = false;
  }

  function openUnenrollOverlay() {
    if (!unenrollOverlayEl) return;
    buildUnenrollOverlayList();
    unenrollOverlayEl.style.display = 'flex';
  }

  function closeUnenrollOverlay() {
    if (!unenrollOverlayEl) return;
    unenrollOverlayEl.style.display = 'none';
    if (unenrollSelectAllEl) unenrollSelectAllEl.checked = false;
  }

  function getSelectedClassroomIds() {
    if (!unenrollOverlayBodyEl) return [];
    return Array.from(unenrollOverlayBodyEl.querySelectorAll('input.row-chk:checked'))
      .map((chk) => chk.dataset.id)
      .filter(Boolean);
  }

  async function unenrollSelectedClassrooms(selectedIds) {
    if (!selectedIds.length) {
      alert('Please select at least one classroom to unenroll.');
      return;
    }

    const client = await ensureSupabaseReady();
    if (!client) {
      alert('Supabase not initialized.');
      return;
    }

    if (!currentUserId) {
      alert('Unable to identify current user. Please log in again.');
      return;
    }

    const normalized = selectedIds.map((id) => String(id));

    const { error } = await client
      .from('classmate')
      .delete()
      .eq('users_id', currentUserId)
      .in('classroom_id', normalized);

    if (error) {
      console.error('Failed to unenroll classrooms:', error);
      alert('Failed to unenroll selected classrooms. Please try again.');
      return;
    }

    const nextSet = new Set(enrolledClassroomIds);
    normalized.forEach((id) => nextSet.delete(id));
    enrolledClassroomIds = nextSet;
    closeUnenrollOverlay();
    alert('Selected classrooms have been unenrolled.');
    await loadClassrooms();
  }

  function attachUnenrollOverlayEvents() {
    if (unenrollSelectAllEl && unenrollOverlayBodyEl) {
      unenrollSelectAllEl.addEventListener('change', () => {
        const checked = unenrollSelectAllEl.checked;
        unenrollOverlayBodyEl.querySelectorAll('input.row-chk').forEach((chk) => {
          chk.checked = checked;
        });
      });
    }

    if (cancelUnenrollBtn) {
      cancelUnenrollBtn.addEventListener('click', closeUnenrollOverlay);
    }

    if (unenrollOverlayEl) {
      unenrollOverlayEl.addEventListener('click', (event) => {
        if (event.target === unenrollOverlayEl) closeUnenrollOverlay();
      });
    }

    if (confirmUnenrollBtn) {
      confirmUnenrollBtn.addEventListener('click', async () => {
        const selected = getSelectedClassroomIds();
        await unenrollSelectedClassrooms(selected);
      });
    }

    if (openUnenrollOverlayBtn) {
      openUnenrollOverlayBtn.addEventListener('click', () => {
        buildUnenrollOverlayList();
        openUnenrollOverlay();
      });
    }
  }

  async function loadClassrooms() {
    const user = await getCurrentUser();
    if (!user) {
      renderEmpty('Please log in to view your classrooms.');
      return;
    }

    currentUserId = user.id;

    const classroomIds = await fetchClassroomIdsForUser(user.id);
    enrolledClassroomIds = new Set(classroomIds);

    if (openUnenrollOverlayBtn) {
      openUnenrollOverlayBtn.disabled = classroomIds.length === 0;
      openUnenrollOverlayBtn.style.opacity = classroomIds.length === 0 ? '0.6' : '1';
    }

    if (!classroomIds.length) {
      renderEmpty('You are not enrolled in any classrooms yet.');
      return;
    }

    // Fetch all courses and build a map: course_id -> course_title
    let courseTitleMap = {};
    const client = await ensureSupabaseReady();
    if (client) {
      const { data: courses, error: courseError } = await client
        .from('course')
        .select('course_id, course_title');
      if (!courseError && Array.isArray(courses)) {
        courses.forEach((course) => {
          if (course.course_id) courseTitleMap[course.course_id] = course.course_title || '';
        });
      }
    }

    const classrooms = await fetchClassroomsByIds(classroomIds);
    cachedEnrolledClassrooms = classrooms;
    renderClassrooms(classrooms, courseTitleMap);
  }

  function attachAvailableClassroomsEvent() {
    if (viewAvailableBtn) {
      viewAvailableBtn.addEventListener('click', function (e) {
        e.preventDefault();
        window.location.href = '/EduPilot/html/student/sClassroom_available.html';
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      attachUnenrollOverlayEvents();
      attachAvailableClassroomsEvent();
      loadClassrooms();
    });
  } else {
    attachUnenrollOverlayEvents();
    attachAvailableClassroomsEvent();
    loadClassrooms();
  }
})();
