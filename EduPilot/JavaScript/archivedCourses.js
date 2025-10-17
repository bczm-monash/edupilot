(function () {
  const listEl = document.getElementById('CourseList') || document.getElementById('courseList');

  function renderEmpty(message) {
    if (!listEl) return;
    listEl.innerHTML = '';
    const li = document.createElement('li');
    li.textContent = message || 'No archived courses found.';
    li.style.listStyle = 'none';
    li.style.margin = '12px';
    listEl.appendChild(li);
  }

  function makeCard(course) {
    const li = document.createElement('li');
    li.className = 'course-card';
    li.dataset.id = course.course_id || '';
    li.tabIndex = 0;
    li.setAttribute('role', 'button');

    const title = document.createElement('div');
    title.className = 'course-title';
    const idPart = course.course_id || '';
    const titlePart = course.course_title || 'Untitled course';
    title.textContent = idPart ? `${idPart} - ${titlePart}` : titlePart;

    const meta = document.createElement('div');
    meta.className = 'course-meta';
    const teacherName = (course.owner_name || '').trim();
    const creditVal = course.course_credit_points;

    if (teacherName && creditVal !== undefined && creditVal !== null) {
      meta.textContent = `Teacher: ${teacherName} | Credit Points: ${creditVal}`;
    } else if (teacherName) {
      meta.textContent = `Teacher: ${teacherName}`;
    } else if (creditVal !== undefined && creditVal !== null) {
      meta.textContent = `Credit Points: ${creditVal}`;
    }

    const statusEl = document.createElement('div');
    statusEl.className = 'course-meta';
    statusEl.textContent = `Status: ${course.course_status || 'archived'}`;

    const open = () => {
      if (course.course_id) {
        window.location.href = `/EduPilot/html/teacher/course_content.html?id=${encodeURIComponent(course.course_id)}`;
      }
    };

    li.addEventListener('click', open);
    li.addEventListener('keypress', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });

    li.appendChild(title);
    if (meta.textContent) li.appendChild(meta);
    li.appendChild(statusEl);

    return li;
  }

  async function ensureSupabaseReady(retry = 0) {
    if (window.supabase) return window.supabase;
    if (retry > 5) return null;
    await new Promise((resolve) => setTimeout(resolve, 150 * (retry + 1)));
    return ensureSupabaseReady(retry + 1);
  }

  async function fetchArchivedCourses() {
    const supabase = await ensureSupabaseReady();
    if (!supabase) throw new Error('Supabase not initialized');

    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error('Failed to resolve current user:', authError);
    }
    const currentUser = auth?.user || null;
    const adminMode = typeof isAdminModeActive === 'function' && isAdminModeActive();

    if (!currentUser && !adminMode) {
      throw new Error('Please log in to view archived courses.');
    }

    const statusFilter = ['archived', 'Archived', 'ARCHIVED'];

    let query = supabase
      .from('course')
      .select('course_id, course_title, course_credit_points, users_id, course_status')
      .in('course_status', statusFilter)
      .order('course_title', { ascending: true });

    if (!adminMode && currentUser) {
      query = query.eq('users_id', currentUser.id);
    }

    const { data, error } = await query;

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async function resolveTeacherNames(items) {
    const fetchNames = typeof window.fetchUserDisplayNames === 'function'
      ? window.fetchUserDisplayNames
      : null;

    if (!fetchNames) return;

    const ids = items
      .map((course) => course.users_id)
      .filter(Boolean)
      .map((id) => String(id));

    if (!ids.length) return;

    const uniqueIds = Array.from(new Set(ids));
    try {
      const names = await fetchNames(uniqueIds);
      items.forEach((course) => {
        const key = course.users_id ? String(course.users_id) : '';
        if (key && names.has(key)) {
          course.owner_name = names.get(key);
        }
      });
    } catch (err) {
      console.warn('Failed to resolve teacher display names:', err);
    }
  }

  function renderCourses(courses) {
    if (!listEl) return;
    if (!courses.length) {
      renderEmpty('No archived courses found.');
      return;
    }

    const frag = document.createDocumentFragment();
    courses.forEach((course) => frag.appendChild(makeCard(course)));
    listEl.innerHTML = '';
    listEl.appendChild(frag);
  }

  async function load() {
    const supabase = await ensureSupabaseReady();
    if (!supabase) {
      renderEmpty('Supabase not initialized.');
      return;
    }

    try {
      const courses = await fetchArchivedCourses();
      await resolveTeacherNames(courses);
      renderCourses(courses);
    } catch (err) {
      console.error('Failed to load archived courses:', err);
      renderEmpty(err?.message ? String(err.message) : 'Failed to load archived courses.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
