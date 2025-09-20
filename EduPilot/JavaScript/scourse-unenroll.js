(function () {
  const listEl = document.getElementById('CourseList') || document.getElementById('courseList');

  function renderEmpty(message) {
    if (!listEl) return;
    listEl.innerHTML = '';
    const li = document.createElement('li');
    li.textContent = message || 'No courses available.';
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
    const creditVal = course.course_credit_points ?? course.course_total_credit_pts ?? course.course_credit_pts;
    if (creditVal !== undefined && creditVal !== null) {
      const num = Number(creditVal);
      credit.textContent = `Credit Points: ${Number.isFinite(num) ? num : creditVal}`;
    }

    const teacherMeta = document.createElement('div');
    teacherMeta.className = 'course-meta';
    const teacherId = course.users_id || course.user_id || course.teacher;
    if (course.owner_name) {
      teacherMeta.textContent = `Teacher: ${course.owner_name}`;
    } else if (teacherId) {
      teacherMeta.textContent = `Teacher ID: ${teacherId}`;
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

  async function loadCourses() {
    if (!listEl) return;

    if (!window.supabase) {
      renderEmpty('Supabase not initialized.');
      return;
    }

    const { data, error } = await window.supabase
      .from('course')
      .select('*')
      .eq('course_status', 'published')
      .order('course_title', { ascending: true });

    if (error) {
      console.error('Failed to load published courses:', error);
      renderEmpty('Failed to load courses.');
      return;
    }

    const courses = Array.isArray(data) ? data : [];
    if (!courses.length) {
      renderEmpty('No published courses available.');
      return;
    }

    const fetchNames = typeof window.fetchUserDisplayNames === 'function'
      ? window.fetchUserDisplayNames
      : null;

    if (fetchNames) {
      const ids = courses
        .map((course) => course.users_id)
        .filter(Boolean)
        .map((id) => String(id));
      if (ids.length) {
        try {
          const uniqueIds = Array.from(new Set(ids));
          const names = await fetchNames(uniqueIds);
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
    }

    const frag = document.createDocumentFragment();
    courses.forEach((course) => frag.appendChild(makeCard(course)));
    listEl.innerHTML = '';
    listEl.appendChild(frag);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadCourses);
  } else {
    loadCourses();
  }
})();
