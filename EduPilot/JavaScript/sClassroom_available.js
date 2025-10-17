(function () {
  const openOverlayBtn = document.getElementById('openEnrollOverlay');
  const listEl = document.getElementById('CourseList') || document.getElementById('availableClassroomList');
  const overlayEl = document.getElementById('enrollOverlay');
  const overlayBodyEl = document.getElementById('availableOverlayBody');
  const selectAllEl = document.getElementById('availableSelectAll');
  const confirmBtn = document.getElementById('confirmAvailableEnroll');
  const cancelBtn = document.getElementById('cancelAvailableEnroll');

  let supabaseClient = null;
  let currentUserId = '';
  let availableClassrooms = [];
  let courseTitleMap = {};
  let enrolledCourseIds = new Set();

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
      .map((id) => String(id).trim());
  }

  async function fetchAvailableClassrooms(excludedIds) {
    const client = supabaseClient;
    if (!client) return [];

    let query = client
      .from('classroom')
      .select('classroom_id, classroom_title, classroom_start_date, classroom_end_date, course_id, users_id')
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

  async function fetchEnrolledCourseIds(userId) {
    const client = supabaseClient;
    if (!client) return [];

    const { data, error } = await client
      .from('enrolment')
      .select('course_id')
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to load enrolled course ids:', error);
      return [];
    }

    return (data || [])
      .map((row) => (row?.course_id ? String(row.course_id) : ''))
      .filter(Boolean);
  }

  async function resolveTeacherNames(items) {
    const fetchNames = typeof window.fetchUserDisplayNames === 'function'
      ? window.fetchUserDisplayNames
      : null;

    if (!fetchNames) return;

    const ids = items
      .map((cls) => cls.users_id)
      .filter(Boolean)
      .map((id) => String(id));

    if (!ids.length) return;

    const unique = Array.from(new Set(ids));
    try {
      const names = await fetchNames(unique);
      items.forEach((cls) => {
        const key = cls.users_id ? String(cls.users_id) : '';
        if (key && names.has(key)) {
          cls.instructor_name = names.get(key);
        }
      });
    } catch (err) {
      console.warn('Failed to resolve instructor names:', err);
    }
  }

  async function fetchCourseTitles() {
    const client = supabaseClient;
    if (!client) return {};

    const { data, error } = await client
      .from('course')
      .select('course_id, course_title');

    if (error) {
      console.error('Failed to load course titles:', error);
      return {};
    }

    const courseTitleMap = {};
    if (Array.isArray(data)) {
      data.forEach((course) => {
        if (course.course_id) {
          courseTitleMap[course.course_id] = course.course_title || 'Untitled course';
        }
      });
    }
    return courseTitleMap;
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

  function parseDateDMY(dateStr) {
    // Expects dd/mm/yyyy
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const [dd, mm, yyyy] = parts.map((p) => parseInt(p, 10));
    if (isNaN(dd) || isNaN(mm) || isNaN(yyyy)) return null;
    return new Date(yyyy, mm - 1, dd);
  }

  function getDuration(startText, endText) {
    const startDate = parseDateDMY(startText);
    const endDate = parseDateDMY(endText);
    if (!startDate || !endDate) return '';
    const diffMs = endDate - startDate;
    if (diffMs < 0) return '';
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  }

  function makeCard(classroom, courseTitleMap) {
    const li = document.createElement('li');
    li.className = 'course-card';
    li.dataset.id = classroom.classroom_id ?? '';
    li.tabIndex = 0;
    li.setAttribute('role', 'button');

    // ID
    const metaId = document.createElement('div');
    metaId.className = 'course-meta';
    metaId.textContent = `ID: ${classroom.classroom_id ?? '-'}`;

    // Title
    const title = document.createElement('div');
    title.className = 'course-title';
    title.textContent = classroom.classroom_title || 'Untitled classroom';

    // Course
    const courseMeta = document.createElement('div');
    courseMeta.className = 'course-meta';
    let courseTitle = '';
    if (classroom.course_id && courseTitleMap && courseTitleMap[classroom.course_id]) {
      courseTitle = courseTitleMap[classroom.course_id];
    }
    courseMeta.textContent = classroom.course_id
      ? `Course: ${classroom.course_id} - ${courseTitle || 'Untitled course'}`
      : 'Course: -';

    // Start
    const startMeta = document.createElement('div');
    startMeta.className = 'course-meta';
    if (classroom.classroom_start_date) {
      startMeta.textContent = `Start: ${normaliseDate(classroom.classroom_start_date)}`;
    }

    // End
    const endMeta = document.createElement('div');
    endMeta.className = 'course-meta';
    if (classroom.classroom_end_date) {
      endMeta.textContent = `End: ${normaliseDate(classroom.classroom_end_date)}`;
    }

    // Duration
    const durationMeta = document.createElement('div');
    durationMeta.className = 'course-meta';
    durationMeta.textContent = (classroom.classroom_start_date && classroom.classroom_end_date)
      ? `Duration: ${getDuration(classroom.classroom_start_date, classroom.classroom_end_date)}`
      : '';

    li.appendChild(metaId);
    li.appendChild(title);
    if (courseMeta.textContent) li.appendChild(courseMeta);
    if (startMeta.textContent) li.appendChild(startMeta);
    if (endMeta.textContent) li.appendChild(endMeta);
    if (durationMeta.textContent) li.appendChild(durationMeta);

    const open = () => {
      if (!classroom.classroom_id) return;
      const url = `/EduPilot/html/student/sClassroom_content.html?id=${encodeURIComponent(classroom.classroom_id)}`;
      window.location.href = url;
    };

    li.addEventListener('click', open);
    li.addEventListener('keypress', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });

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
      frag.appendChild(makeCard(room, courseTitleMap));
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
      label.style.flex = '1';
      label.textContent = `${room.classroom_id} - ${room.classroom_title} | Instructor: ${room.instructor_name || 'Unknown'}`;

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
      classroom_id: String(id).trim(),
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

      if (openOverlayBtn) {
        const hasAvailable = availableClassrooms.length > 0;
        openOverlayBtn.disabled = !hasAvailable;
        openOverlayBtn.style.opacity = hasAvailable ? '1' : '0.6';
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
    const courseIds = await fetchEnrolledCourseIds(user.id);
    enrolledCourseIds = new Set(courseIds);

    availableClassrooms = await fetchAvailableClassrooms(enrolledIds);
    const filtered = availableClassrooms.filter((room) => {
      const courseId = room.course_id ? String(room.course_id) : '';
      if (!courseId) return false;
      return enrolledCourseIds.has(courseId);
    });
    availableClassrooms = filtered;
    await resolveTeacherNames(availableClassrooms);
    courseTitleMap = await fetchCourseTitles();

    renderAvailableClassrooms();
    buildOverlayList();

    if (openOverlayBtn) {
      openOverlayBtn.disabled = !availableClassrooms.length;
      openOverlayBtn.style.opacity = availableClassrooms.length ? '1' : '0.6';
      openOverlayBtn.addEventListener('click', (event) => {
        event.preventDefault();
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
