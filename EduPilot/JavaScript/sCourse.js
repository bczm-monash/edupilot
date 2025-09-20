(function () {
  const listEl = document.getElementById('CourseList') || document.getElementById('courseList');
  const debugEl = document.getElementById('debugCourses');

  function renderEmpty(message) {
    if (!listEl) return;
    listEl.innerHTML = '';
    const li = document.createElement('li');
    li.textContent = message || 'No courses enrolled yet.';
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

    const credit = document.createElement('div');
    credit.className = 'course-meta';
    if (course.course_credit_points !== undefined && course.course_credit_points !== null) {
      const creditVal = Number(course.course_credit_points);
      credit.textContent = `Credit Points: ${Number.isFinite(creditVal) ? creditVal : course.course_credit_points}`;
    }

    const teacherMeta = document.createElement('div');
    teacherMeta.className = 'course-meta';
    if (course.owner_name) {
      teacherMeta.textContent = `Teacher: ${course.owner_name}`;
    }

    const open = () => {
      if (course.course_id) {
        window.location.href = `/EduPilot/html/student/sCourse_content.html?id=${encodeURIComponent(course.course_id)}`;
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
    if (credit.textContent) li.appendChild(credit);
    if (teacherMeta.textContent) li.appendChild(teacherMeta);
    return li;
  }

  async function ensureSupabaseReady(retry = 0) {
    if (window.supabase) return window.supabase;
    if (retry > 5) return null;
    await new Promise((resolve) => setTimeout(resolve, 150 * (retry + 1)));
    return ensureSupabaseReady(retry + 1);
  }

  async function getCurrentUser() {
    const supabase = await ensureSupabaseReady();
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return null;
    return data.user;
  }

  async function fetchEnrolledCourseIds(userId) {
    const supabase = await ensureSupabaseReady();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('users')
      .select('users_courses')
      .eq('users_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Failed to load enrolled course ids:', error);
      return [];
    }

    const list = data?.users_courses;
    if (!Array.isArray(list)) return [];
    return list
      .map((item) => {
        if (item && typeof item === 'object') {
          return item.course_id || item.id || item;
        }
        return item;
      })
      .map((id) => String(id))
      .filter(Boolean);
  }

  async function fetchCoursesByIds(courseIds) {
    const supabase = await ensureSupabaseReady();
    if (!supabase || !courseIds.length) return [];

    const { data, error } = await supabase
      .from('course')
      .select('course_id, course_title, course_credit_points, users_id, course_status')
      .in('course_id', courseIds);

    if (error) {
      console.error('Failed to load courses for user:', error);
      return [];
    }

    return (Array.isArray(data) ? data : []).filter((course) => course.course_status === 'published');
  }

  async function resolveTeacherNames(courses) {
    const fetchNames = typeof window.fetchUserDisplayNames === 'function'
      ? window.fetchUserDisplayNames
      : null;

    if (!fetchNames) return;

    const ids = courses
      .map((course) => course.users_id)
      .filter(Boolean)
      .map((id) => String(id));

    if (!ids.length) return;

    const unique = Array.from(new Set(ids));
    try {
      const names = await fetchNames(unique);
      courses.forEach((course) => {
        const key = course.users_id ? String(course.users_id) : '';
        if (key && names.has(key)) {
          course.owner_name = names.get(key);
        }
      });
    } catch (err) {
      console.warn('Failed to resolve teacher display names:', err);
    }
  }

  async function load() {
    const user = await getCurrentUser();
    if (!user) {
      renderEmpty('Please log in to view your courses.');
      return;
    }

    const courseIds = await fetchEnrolledCourseIds(user.id);

    if (debugEl) {
      debugEl.textContent = `Enrolled course IDs: ${courseIds.length ? courseIds.join(', ') : '(none)'}`;
    }
    if (!courseIds.length) {
      renderEmpty('You are not enrolled in any courses yet.');
      return;
    }

    const courses = await fetchCoursesByIds(courseIds);
    if (!courses.length) {
      renderEmpty('You are not enrolled in any published courses.');
      return;
    }

    await resolveTeacherNames(courses);

    const frag = document.createDocumentFragment();
    courses.forEach((course) => frag.appendChild(makeCard(course)));
    listEl.innerHTML = '';
    listEl.appendChild(frag);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
