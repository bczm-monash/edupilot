(function () {
  const listEl = document.getElementById('CourseList') || document.getElementById('courseList');

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
    if (meta.textContent) li.appendChild(meta);
    return li;
  }

  const openOverlayBtn = document.getElementById('openUnenrollOverlay');
  const overlayEl = document.getElementById('unenrollOverlay');
  const overlayBodyEl = document.getElementById('unenrollOverlayBody');
  const overlaySelectAllEl = document.getElementById('unenrollSelectAll');
  const overlayConfirmBtn = document.getElementById('confirmUnenroll');
  const overlayCancelBtn = document.getElementById('cancelUnenroll');

  let currentUserId = '';
  let enrolledCourseIds = new Set();
  let cachedCourses = [];

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

    let list = data?.users_courses;

    if (!Array.isArray(list)) {
      if (typeof list === 'string') {
        try {
          const parsed = JSON.parse(list);
          if (Array.isArray(parsed)) {
            list = parsed;
          } else if (parsed) {
            list = [parsed];
          }
        } catch (_) {
          list = list
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item) => item.replace(/^["']|["']$/g, ''));
        }
      } else if (list && typeof list === 'object') {
        list = [list];
      } else {
        list = [];
      }
    }

    return list
      .map((item) => {
        if (typeof item === 'string') return item.replace(/^["']|["']$/g, '');
        if (item && typeof item === 'object') {
          return item.course_id || item.id || '';
        }
        return '';
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

    const courses = Array.isArray(data) ? data : [];
    return courses.filter((course) => course.course_status === 'published');
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

    currentUserId = user.id;

    const courseIds = await fetchEnrolledCourseIds(user.id);
    enrolledCourseIds = new Set(courseIds);

    if (openOverlayBtn) {
      openOverlayBtn.disabled = courseIds.length === 0;
      openOverlayBtn.style.opacity = courseIds.length === 0 ? '0.6' : '1';
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
    cachedCourses = courses;
    const frag = document.createDocumentFragment();
    courses.forEach((course) => frag.appendChild(makeCard(course)));
    listEl.innerHTML = '';
    listEl.appendChild(frag);
  }

  function buildOverlayList() {
    if (!overlayBodyEl) return;
    overlayBodyEl.innerHTML = '';

    if (!cachedCourses.length) {
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'No enrolled courses to display.';
      overlayBodyEl.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    cachedCourses.forEach((course) => {
      const id = course.course_id;
      if (!id) return;
      const row = document.createElement('div');
      row.className = 'list-row';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'row-chk';
      checkbox.dataset.id = id;

      const label = document.createElement('label');
      label.style.flex = '1';
      const teacher = course.owner_name ? ` | Teacher: ${course.owner_name}` : '';
      label.textContent = `${id} - ${course.course_title || 'Untitled course'}${teacher}`;

      row.appendChild(checkbox);
      row.appendChild(label);
      frag.appendChild(row);
    });

    overlayBodyEl.appendChild(frag);
    if (overlaySelectAllEl) overlaySelectAllEl.checked = false;
  }

  function openOverlay() {
    if (!overlayEl) return;
    overlayEl.style.display = 'flex';
  }

  function closeOverlay() {
    if (!overlayEl) return;
    overlayEl.style.display = 'none';
    if (overlaySelectAllEl) overlaySelectAllEl.checked = false;
  }

  function getSelectedCourseIds() {
    if (!overlayBodyEl) return [];
    return Array.from(overlayBodyEl.querySelectorAll('input.row-chk:checked'))
      .map((chk) => chk.dataset.id)
      .filter(Boolean);
  }

  async function unenrollSelectedCourses(selectedIds) {
    if (!selectedIds.length) {
      alert('Please select at least one course to unenroll.');
      return;
    }

    const supabase = await ensureSupabaseReady();
    if (!supabase) {
      alert('Supabase not initialized.');
      return;
    }

    if (!currentUserId) {
      alert('Unable to identify current user. Please log in again.');
      return;
    }

    const nextSet = new Set(enrolledCourseIds);
    selectedIds.forEach((id) => nextSet.delete(String(id)));
    const nextArray = Array.from(nextSet);
    const payload = JSON.stringify(nextArray);

    const { error } = await supabase
      .from('users')
      .update({ users_courses: payload })
      .eq('users_id', currentUserId);

    if (error) {
      console.error('Failed to unenroll courses:', error);
      alert('Failed to unenroll selected courses. Please try again.');
      return;
    }

    enrolledCourseIds = nextSet;
    closeOverlay();
    alert('Selected courses have been unenrolled.');
    await load();
  }

  function attachOverlayEvents() {
    if (overlaySelectAllEl && overlayBodyEl) {
      overlaySelectAllEl.addEventListener('change', () => {
        const checked = overlaySelectAllEl.checked;
        overlayBodyEl.querySelectorAll('input.row-chk').forEach((chk) => {
          chk.checked = checked;
        });
      });
    }

    if (overlayCancelBtn) {
      overlayCancelBtn.addEventListener('click', closeOverlay);
    }

    if (overlayEl) {
      overlayEl.addEventListener('click', (event) => {
        if (event.target === overlayEl) closeOverlay();
      });
    }

    if (overlayConfirmBtn) {
      overlayConfirmBtn.addEventListener('click', async () => {
        const selected = getSelectedCourseIds();
        await unenrollSelectedCourses(selected);
      });
    }

    if (openOverlayBtn) {
      openOverlayBtn.addEventListener('click', () => {
        buildOverlayList();
        openOverlay();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      attachOverlayEvents();
      load();
    });
  } else {
    attachOverlayEvents();
    load();
  }
})();
