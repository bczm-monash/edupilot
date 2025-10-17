(function () {
  const listEl = document.getElementById('classroomList');
  const adminMode = typeof isAdminModeActive === 'function' && isAdminModeActive();
  let currentUserId = null;

  function renderEmpty(message) {
    if (!listEl) return;
    listEl.innerHTML = '';
    const li = document.createElement('li');
    li.textContent = message || 'No archived classrooms found.';
    li.style.listStyle = 'none';
    li.style.margin = '12px';
    listEl.appendChild(li);
  }

  function normaliseDate(dateText) {
    if (!dateText) return '';
    const parts = String(dateText).split(/[-/]/);
    if (parts.length === 3) {
      const [a, b, c] = parts;
      if (a.length === 4) {
        return `${c.padStart(2, '0')}/${b.padStart(2, '0')}/${a}`;
      }
      if (c.length === 4) {
        return `${a.padStart(2, '0')}/${b.padStart(2, '0')}/${c}`;
      }
    }
    return dateText;
  }

  function parseDateDMY(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const [dd, mm, yyyy] = parts.map((p) => parseInt(p, 10));
    if (Number.isNaN(dd) || Number.isNaN(mm) || Number.isNaN(yyyy)) return null;
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
    li.className = 'classroom-card';
    li.dataset.id = classroom.classroom_id || '';
    li.tabIndex = 0;
    li.setAttribute('role', 'button');

    const content = document.createElement('div');
    content.className = 'card-content';

    const metaId = document.createElement('div');
    metaId.className = 'classroom-meta';
    metaId.textContent = `ID: ${classroom.classroom_id || '-'}`;

    const title = document.createElement('div');
    title.className = 'classroom-title';
    title.textContent = classroom.classroom_title || 'Untitled classroom';

    const course = document.createElement('div');
    course.className = 'classroom-meta';
    const courseLabel = classroom.course_id
      ? `Course: ${classroom.course_id} - ${courseTitleMap.get(classroom.course_id) || 'Untitled course'}`
      : '';
    course.textContent = courseLabel;

    const start = document.createElement('div');
    start.className = 'classroom-meta';
    start.textContent = classroom.classroom_start_date
      ? `Start: ${normaliseDate(classroom.classroom_start_date)}`
      : '';

    const end = document.createElement('div');
    end.className = 'classroom-meta';
    end.textContent = classroom.classroom_end_date
      ? `End: ${normaliseDate(classroom.classroom_end_date)}`
      : '';

    const duration = document.createElement('div');
    duration.className = 'classroom-meta';
    duration.textContent = (classroom.classroom_start_date && classroom.classroom_end_date)
      ? `Duration: ${getDuration(normaliseDate(classroom.classroom_start_date), normaliseDate(classroom.classroom_end_date))}`
      : '';

    const status = document.createElement('div');
    status.className = 'classroom-meta';
    status.textContent = 'Status: Archived';

    content.appendChild(metaId);
    content.appendChild(title);
    if (course.textContent) content.appendChild(course);
    if (start.textContent) content.appendChild(start);
    if (end.textContent) content.appendChild(end);
    if (duration.textContent) content.appendChild(duration);
    content.appendChild(status);

    function open() {
      if (!classroom.classroom_id) return;
      const url = `/EduPilot/html/teacher/classroom_content.html?id=${encodeURIComponent(classroom.classroom_id)}`;
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
    if (window.supabase) return window.supabase;
    if (retry > 5) return null;
    await new Promise((resolve) => setTimeout(resolve, 150 * (retry + 1)));
    return ensureSupabaseReady(retry + 1);
  }

  async function fetchArchivedClassrooms() {
    const supabase = await ensureSupabaseReady();
    if (!supabase) throw new Error('Supabase not initialized.');

    if (!adminMode) {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth?.user) {
        throw new Error('Please log in to view archived classrooms.');
      }
      currentUserId = auth.user.id;
    }

    const statusFilter = ['archived', 'Archived', 'ARCHIVED'];
    let query = supabase
      .from('classroom')
      .select('classroom_id, classroom_title, classroom_start_date, classroom_end_date, course_id, users_id, classroom_status')
      .in('classroom_status', statusFilter)
      .order('classroom_end_date', { ascending: false });

    if (!adminMode && currentUserId) {
      query = query.eq('users_id', currentUserId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async function buildCourseTitleMap(courseIds) {
    const supabase = await ensureSupabaseReady();
    if (!supabase || !courseIds.length) return new Map();

    const uniqueIds = Array.from(new Set(courseIds.filter(Boolean)));
    if (!uniqueIds.length) return new Map();

    let query = supabase
      .from('course')
      .select('course_id, course_title')
      .in('course_id', uniqueIds);

    if (!adminMode && currentUserId) {
      query = query.eq('users_id', currentUserId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Failed to load course titles for archived classrooms:', error);
      return new Map();
    }

    const map = new Map();
    (data || []).forEach((row) => {
      if (row.course_id) {
        map.set(row.course_id, row.course_title || '');
      }
    });
    return map;
  }

  async function load() {
    try {
      const classrooms = await fetchArchivedClassrooms();
      if (!classrooms.length) {
        renderEmpty('No archived classrooms found.');
        return;
      }

      const courseIds = classrooms
        .map((room) => room.course_id)
        .filter(Boolean);
      const courseTitleMap = await buildCourseTitleMap(courseIds);

      listEl.innerHTML = '';
      const frag = document.createDocumentFragment();
      classrooms.forEach((room) => {
        frag.appendChild(makeCard(room, courseTitleMap));
      });
      listEl.appendChild(frag);
    } catch (err) {
      console.error('Failed to load archived classrooms:', err);
      renderEmpty(err?.message ? String(err.message) : 'Failed to load archived classrooms.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
