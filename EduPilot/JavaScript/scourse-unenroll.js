(function () {
  const listEl = document.getElementById('CourseList') || document.getElementById('courseList');
  const openOverlayBtn = document.getElementById('openEnrollOverlay');
  const overlayEl = document.getElementById('enrollOverlay');
  const overlayBodyEl = document.getElementById('enrollOverlayBody');
  const overlaySelectAllEl = document.getElementById('enrollSelectAll');
  const overlayConfirmBtn = document.getElementById('confirmEnroll');
  const overlayCancelBtn = document.getElementById('cancelEnroll');

  let courses = [];
  let userCourseIds = new Set();
  let currentUserId = '';

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
    const creditVal = course.course_credit_points;
    if (creditVal !== undefined && creditVal !== null) {
      const num = Number(creditVal);
      credit.textContent = `Credit Points: ${Number.isFinite(num) ? num : creditVal}`;
    }

    const teacherMeta = document.createElement('div');
    teacherMeta.className = 'course-meta';
    const teacherName = (course.owner_name || '').trim();
    if (teacherName) {
      teacherMeta.textContent = `Teacher: ${teacherName}`;
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

  async function loadUserCourses(userId) {
    const supabase = await ensureSupabaseReady();
    if (!supabase) return new Set();
    const { data, error } = await supabase
      .from('users')
      .select('users_courses')
      .eq('users_id', userId)
      .maybeSingle();
    if (error) {
      console.warn('Failed to load user courses:', error);
      return new Set();
    }
    const list = data?.users_courses;
    if (Array.isArray(list)) {
      return new Set(list.map((item) => (typeof item === 'object' ? String(item.course_id || item.id || '') : String(item || ''))).filter(Boolean));
    }
    return new Set();
  }

  async function fetchCourses() {
    const supabase = await ensureSupabaseReady();
    if (!supabase) throw new Error('Supabase not initialized');

    const { data, error } = await supabase
      .from('course')
      .select('course_id, course_title, course_credit_points, users_id, course_status')
      .eq('course_status', 'published')
      .order('course_title', { ascending: true });

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

  function renderCourses() {
    if (!listEl) return;
    if (!courses.length) {
      renderEmpty('No published courses available.');
      return;
    }

    const frag = document.createDocumentFragment();
    courses.forEach((course) => frag.appendChild(makeCard(course)));
    listEl.innerHTML = '';
    listEl.appendChild(frag);
  }

  function buildOverlayList() {
    if (!overlayBodyEl) return;
    overlayBodyEl.innerHTML = '';

    const available = courses.filter((course) => !userCourseIds.has(String(course.course_id)));

    if (!available.length) {
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'No additional courses available to enroll.';
      overlayBodyEl.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    available.forEach((course) => {
      const row = document.createElement('div');
      row.className = 'list-row';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'row-chk';
      checkbox.dataset.id = course.course_id;

      const label = document.createElement('label');
      label.style.flex = '1';
      const teacher = course.owner_name ? ` | Teacher: ${course.owner_name}` : '';
      label.textContent = `${course.course_id} - ${course.course_title || 'Untitled course'}${teacher}`;

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

  async function enrollSelectedCourses(selectedIds) {
    if (!selectedIds.length) {
      alert('Please select at least one course to enroll.');
      return;
    }

    const supabase = await ensureSupabaseReady();
    if (!supabase) {
      alert('Supabase not initialized.');
      return;
    }

    if (!currentUserId) {
      alert('User not identified. Please log in again.');
      return;
    }

    const nextSet = new Set(userCourseIds);
    selectedIds.forEach((id) => nextSet.add(String(id)));
    const nextArray = Array.from(nextSet);

    const { error } = await supabase
      .from('users')
      .update({ users_courses: nextArray })
      .eq('users_id', currentUserId);

    if (error) {
      console.error('Failed to enroll courses:', error);
      alert('Failed to enroll in selected courses. Please try again.');
      return;
    }

    userCourseIds = nextSet;
    closeOverlay();
    alert('Courses enrolled successfully.');
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
        await enrollSelectedCourses(selected);
      });
    }
  }

  async function load() {
    const supabase = await ensureSupabaseReady();
    if (!supabase) {
      renderEmpty('Supabase not initialized.');
      return;
    }

    const user = await getCurrentUser();
    if (!user) {
      alert('Please log in to manage courses.');
      renderEmpty('User not logged in.');
      return;
    }
    currentUserId = user.id;
    userCourseIds = await loadUserCourses(currentUserId);

    try {
      courses = await fetchCourses();
      await resolveTeacherNames(courses);
      renderCourses();
    } catch (err) {
      console.error('Failed to load published courses:', err);
      renderEmpty('Failed to load courses.');
    }
  }

  async function init() {
    attachOverlayEvents();

    if (openOverlayBtn) {
      openOverlayBtn.addEventListener('click', () => {
        buildOverlayList();
        openOverlay();
      });
    }

    await load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
