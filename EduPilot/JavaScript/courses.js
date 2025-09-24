(function () {
  const listEl = document.getElementById('CourseList') || document.getElementById('courseList');

  function renderEmpty(message) {
    if (!listEl) return;
    listEl.innerHTML = '';
    const li = document.createElement('li');
    li.textContent = message || 'No courses found.';
    li.style.listStyle = 'none';
    li.style.margin = '12px';
    listEl.appendChild(li);
  }

  function normaliseCredit(course) {
    const fields = [
      course.course_credit_points,
      course.course_total_credit_pts,
      course.course_credit_pts,
    ];
    for (const value of fields) {
      if (value !== null && value !== undefined && value !== '') {
        const num = Number(value);
        if (!Number.isNaN(num)) return num;
      }
    }
    return undefined;
  }

  function makeCard(course) {
    const li = document.createElement('li');
    li.className = 'course-card';
    li.dataset.id = course.course_id || '';
    li.tabIndex = 0;
    li.setAttribute('role', 'button');

    const content = document.createElement('div');
    content.className = 'card-content';

    const title = document.createElement('div');
    title.className = 'course-title';
    const idPart = course.course_id || '';
    const titlePart = course.course_title || 'Untitled course';
    title.textContent = idPart ? `${idPart} - ${titlePart}` : titlePart;

    const owner = document.createElement('div');
    owner.className = 'course-meta';
    const ownerName = course.owner_name || '';
    if (ownerName) owner.textContent = `Owner: ${ownerName}`;

    const credit = document.createElement('div');
    credit.className = 'course-meta';
    const creditVal = normaliseCredit(course);
    if (creditVal !== undefined) credit.textContent = `Credit Points: ${creditVal}`;

    content.appendChild(title);
    if (ownerName) content.appendChild(owner);
    if (credit.textContent) content.appendChild(credit);

    function open() {
      if (course.course_id) {
        const url = `/EduPilot/html/teacher/course_content.html?id=${encodeURIComponent(course.course_id)}`;
        window.location.href = url;
      }
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

  async function fetchCourses() {
    const client = window.supabase;
    if (!client) {
      renderEmpty('Supabase not initialized.');
      return [];
    }

    let { data: course, error } = await client
      .from('course')
      .select('*')
      .order('course_id', { ascending: true })
      .limit(100);

    if (error) {
      console.error('Error fetching courses:', error);
      renderEmpty('Failed to load courses.');
      return [];
    }

    const courses = Array.isArray(course) ? course : [];

    const userIds = Array.from(new Set(
      courses.map(item => item.users_id).filter(Boolean)
    ));

    if (userIds.length) {
      try {
        let { data: users, error: userErr } = await client
          .from('users')
          .select('users_id, users_fname, users_lname')
          .in('users_id', userIds);

        if (!userErr && Array.isArray(users)) {
          const nameById = new Map(
            users.map(u => [u.users_id, [u.users_fname, u.users_lname].filter(Boolean).join(' ')])
          );
          courses.forEach(item => {
            const name = nameById.get(item.users_id);
            if (name) item.owner_name = name;
          });
        }
      } catch (err) {
        console.warn('Failed to resolve course owner names:', err);
      }
    }

    return courses;
  }

  async function loadCourses() {
    if (!listEl) return;
    listEl.innerHTML = '';

    try {
      const courses = await fetchCourses();
      if (!courses.length) {
        renderEmpty('No courses found.');
        return;
      }

      const frag = document.createDocumentFragment();
      courses.forEach(course => frag.appendChild(makeCard(course)));
      listEl.appendChild(frag);
    } catch (error) {
      console.error('Failed loading courses:', error);
      renderEmpty('Failed to load courses.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadCourses);
  } else {
    loadCourses();
  }
})();

(function () {
  const overlay = document.getElementById('editOverlay');
  const overlayBody = document.getElementById('overlayBody');
  const selectAllChk = document.getElementById('selectAllChk');
  const editToggle = document.getElementById('editToggle');
  const deleteBtn = document.getElementById('deleteSelected');

  if (!overlay || !overlayBody) return;

  function getRenderedCourses() {
    const list = document.getElementById('CourseList') || document.getElementById('courseList');
    if (!list) return [];
    const items = Array.from(list.querySelectorAll('li.course-card'));
    return items.map(li => ({
      id: li.dataset.id || '',
      title: (li.querySelector('.course-title')?.textContent || 'Course').trim(),
    }));
  }

  function buildOverlayList() {
    overlayBody.innerHTML = '';
    const courses = getRenderedCourses();
    if (!courses.length) {
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'No courses available.';
      overlayBody.appendChild(empty);
      return;
    }
    const frag = document.createDocumentFragment();
    courses.forEach(course => {
      const row = document.createElement('div');
      row.className = 'list-row';
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'row-chk';
      chk.dataset.id = course.id;
      const label = document.createElement('label');
      label.textContent = course.title;
      label.style.flex = '1';
      row.appendChild(chk);
      row.appendChild(label);
      frag.appendChild(row);
    });
    overlayBody.appendChild(frag);
    if (selectAllChk) selectAllChk.checked = false;
  }

  function openOverlay() {
    buildOverlayList();
    overlay.style.display = 'flex';
  }

  function closeOverlay() {
    overlay.style.display = 'none';
  }

  function selectedIds() {
    return Array.from(overlayBody.querySelectorAll('input.row-chk:checked'))
      .map(c => c.dataset.id)
      .filter(Boolean);
  }

  async function deleteCourses(ids) {
    if (!window.supabase) {
      alert('Supabase not initialized.');
      return;
    }
    try {
      // First, delete related records from units table
      const { error: unitsError } = await window.supabase
        .from('units')
        .delete()
        .in('course_id', ids);
      if (unitsError) throw unitsError;

      // Then, delete the courses
      const { error } = await window.supabase
        .from('course')
        .delete()
        .in('course_id', ids);
      if (error) throw error;
      alert('Selected courses deleted.');
      if (typeof window.location.reload === 'function') {
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to delete courses', error);
      alert('Failed to delete courses.');
    }
  }

  if (editToggle) editToggle.addEventListener('click', openOverlay);
  const closeBtn = document.getElementById('closeOverlay');
  if (closeBtn) closeBtn.addEventListener('click', closeOverlay);

  if (selectAllChk) {
    selectAllChk.addEventListener('change', () => {
      const chks = overlayBody.querySelectorAll('input.row-chk');
      chks.forEach(chk => { chk.checked = selectAllChk.checked; });
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const ids = selectedIds();
      if (!ids.length) {
        alert('Please select at least one course to delete.');
        return;
      }
      const confirmDelete = window.confirm('Delete selected courses?');
      if (!confirmDelete) return;
      await deleteCourses(ids);
    });
  }
})();
