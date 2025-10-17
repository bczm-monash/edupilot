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

    const metaId = document.createElement('div');
    metaId.className = 'course-meta';
    metaId.textContent = `ID: ${course.course_id || '-'}`;

    const title = document.createElement('div');
    title.className = 'course-title';
    title.textContent = course.course_title || 'Untitled course';

    const owner = document.createElement('div');
    owner.className = 'course-meta';
    const teacherName = (course.owner_name || '').trim();
    if (teacherName) owner.textContent = `Instructor: ${teacherName}`;

    const credit = document.createElement('div');
    credit.className = 'course-meta';
    const creditVal = course.course_credit_points;
    if (creditVal !== undefined && creditVal !== null) credit.textContent = `Credit Points: ${creditVal}`;

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

    li.appendChild(metaId);
    li.appendChild(title);
    if (owner.textContent) li.appendChild(owner);
    if (credit.textContent) li.appendChild(credit);
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
  let lockedCourseIds = new Set();

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
      .from('enrolment')
      .select('course_id')
      .eq('user_id', userId);

    if (error) {
      console.warn('Failed to load enrolled course ids:', error);
      return [];
    }

    return (Array.isArray(data) ? data : [])
      .map((row) => (row?.course_id ? String(row.course_id) : ''))
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

    lockedCourseIds = new Set();
    if (courses.length) {
      try {
        const supabase = await ensureSupabaseReady();
        const { data: classroomLinks, error: classroomError } = await supabase
          .from('classroom')
          .select('classroom_id, course_id')
          .in('course_id', courseIds);

        if (!classroomError && Array.isArray(classroomLinks) && classroomLinks.length) {
          const classroomIds = classroomLinks.map((row) => row.classroom_id).filter(Boolean);
          if (classroomIds.length) {
            const { data: memberships, error: membershipError } = await supabase
              .from('classmate')
              .select('classroom_id')
              .eq('users_id', currentUserId)
              .in('classroom_id', classroomIds);

            if (!membershipError && Array.isArray(memberships)) {
              const enrolledClassroomIds = new Set(memberships.map((row) => row.classroom_id).filter(Boolean));
              classroomLinks.forEach((link) => {
                if (enrolledClassroomIds.has(link.classroom_id) && link.course_id) {
                  lockedCourseIds.add(String(link.course_id));
                }
              });
            }
          }
        }
      } catch (err) {
        console.warn('Failed to determine locked courses:', err);
      }
    }

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
      const teacher = course.owner_name ? ` | Instructor: ${course.owner_name}` : '';
      const locked = lockedCourseIds.has(id);
      label.textContent = `${id} - ${course.course_title || 'Untitled course'}${teacher}${locked ? ' (Enrolled in classroom)' : ''}`;
      if (locked) {
        checkbox.disabled = true;
        row.classList.add('disabled-row');
      }

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

    const normalized = selectedIds.map((id) => String(id));

    const actionable = normalized.filter((id) => !lockedCourseIds.has(id));
    const blocked = normalized.filter((id) => lockedCourseIds.has(id));

    if (blocked.length) {
      alert(`You are enrolled in classrooms for the following courses and cannot unenroll: ${blocked.join(', ')}`);
    }

    if (!actionable.length) {
      return;
    }

    const { error } = await supabase
      .from('enrolment')
      .delete()
      .eq('user_id', currentUserId)
      .in('course_id', actionable);

    if (error) {
      console.error('Failed to unenroll courses:', error);
      alert('Failed to unenroll selected courses. Please try again.');
      return;
    }

    const nextSet = new Set(enrolledCourseIds);
    actionable.forEach((id) => nextSet.delete(id));
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
          if (chk.disabled) return;
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
