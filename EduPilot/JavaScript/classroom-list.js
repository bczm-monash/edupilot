(function () {
  const listEl = document.getElementById('classroomList');
  const overlayEl = document.getElementById('editOverlay');
  const overlayBodyEl = document.getElementById('overlayBody');
  const selectAllChkEl = document.getElementById('selectAllChk');
  const deleteBtnEl = document.getElementById('deleteSelected');
  const closeOverlayBtnEl = document.getElementById('closeOverlay');
  const editToggleBtnEl = document.getElementById('editToggle');
  const adminMode = typeof isAdminModeActive === 'function' && isAdminModeActive();
  let currentUserId = null;

  function renderEmpty(message) {
    if (!listEl) return;
    listEl.innerHTML = '';
    const li = document.createElement('li');
    li.textContent = message || 'No classrooms found.';
    li.style.listStyle = 'none';
    li.style.margin = '12px';
    listEl.appendChild(li);
  }

  function normaliseDate(dateText) {
    if (!dateText) return '';
    const parts = dateText.split(/[-/]/);
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
    // Expects dd/mm/yyyy
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const [dd, mm, yyyy] = parts.map((p) => parseInt(p, 10));
    if (isNaN(dd) || isNaN(mm) || isNaN(yyyy)) return null;
    return new Date(yyyy, mm - 1, dd);
  }

  function parseDateValue(raw) {
    if (!raw) return null;
    const direct = new Date(raw);
    if (!Number.isNaN(direct.getTime())) return direct;
    const trimmed = String(raw).trim();
    if (!trimmed) return null;
    const dateOnly = trimmed.includes('T') ? trimmed.split('T')[0] : trimmed;
    const parts = dateOnly.split(/[-/]/);
    if (parts.length === 3) {
      const [a, b, c] = parts;
      if (a.length === 4) {
        return parseDateDMY(`${c}/${b}/${a}`);
      }
      if (c.length === 4) {
        return parseDateDMY(`${a}/${b}/${c}`);
      }
    }
    return null;
  }

  function normaliseStatus(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  async function archiveExpiredClassrooms(rows, client) {
    if (!Array.isArray(rows) || !rows.length || !client) return rows;
    const now = new Date();
    const idsToArchive = [];
    const idsToActivate = [];

    rows.forEach((row) => {
      if (!row || !row.classroom_id) return;
      const endDate = parseDateValue(row.classroom_end_date);
      const status = normaliseStatus(row.classroom_status);

      if (endDate && endDate < now) {
        if (status !== 'archived') {
          idsToArchive.push(row.classroom_id);
          row.classroom_status = 'archived';
        } else {
          row.classroom_status = 'archived';
        }
      } else if (endDate && endDate >= now) {
        if (status === 'archived') {
          idsToActivate.push(row.classroom_id);
          row.classroom_status = 'active';
        }
      } else if (!endDate && status === 'archived') {
        idsToActivate.push(row.classroom_id);
        row.classroom_status = 'active';
      }
    });

    if (idsToArchive.length) {
      try {
        const { error } = await client
          .from('classroom')
          .update({ classroom_status: 'archived' })
          .in('classroom_id', idsToArchive);
        if (error) {
          console.error('Failed to auto-archive classrooms:', error);
        }
      } catch (err) {
        console.error('Unexpected error auto-archiving classrooms:', err);
      }
    }

    if (idsToActivate.length) {
      try {
        const { error } = await client
          .from('classroom')
          .update({ classroom_status: 'active' })
          .in('classroom_id', idsToActivate);
        if (error) {
          console.error('Failed to reactivate classrooms:', error);
        }
      } catch (err) {
        console.error('Unexpected error reactivating classrooms:', err);
      }
    }
    return rows;
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

    // Get course title from map
    let courseTitle = '';
    if (classroom.course_id && courseTitleMap[classroom.course_id]) {
      courseTitle = courseTitleMap[classroom.course_id];
    }

    // ID
    const metaId = document.createElement('div');
    metaId.className = 'classroom-meta';
    metaId.textContent = `ID: ${classroom.classroom_id || '-'}`;

    // Title
    const title = document.createElement('div');
    title.className = 'classroom-title';
    title.textContent = classroom.classroom_title || 'Untitled classroom';

    // Course details: Course: course_id - course_title
    const course = document.createElement('div');
    course.className = 'classroom-meta';
    course.textContent = classroom.course_id
      ? `Course: ${classroom.course_id} - ${courseTitle || 'Untitled course'}`
      : 'Course: -';

    // Start
    const start = document.createElement('div');
    start.className = 'classroom-meta';
    start.textContent = classroom.classroom_start_date ? `Start: ${normaliseDate(classroom.classroom_start_date)}` : '';

    // End
    const end = document.createElement('div');
    end.className = 'classroom-meta';
    end.textContent = classroom.classroom_end_date ? `End: ${normaliseDate(classroom.classroom_end_date)}` : '';

    // Duration
    const duration = document.createElement('div');
    duration.className = 'classroom-meta';
    duration.textContent = (classroom.classroom_start_date && classroom.classroom_end_date)
      ? `Duration: ${getDuration(classroom.classroom_start_date, classroom.classroom_end_date)}`
      : '';

    content.appendChild(metaId);
    content.appendChild(title);
    if (course.textContent) content.appendChild(course);
    if (start.textContent) content.appendChild(start);
    if (end.textContent) content.appendChild(end);
    if (duration.textContent) content.appendChild(duration);

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

  async function fetchClassrooms() {
    const client = window.supabase;
    if (!client) {
      renderEmpty('Supabase not initialized.');
      return [];
    }

    if (!adminMode) {
      try {
        const { data: auth, error: authError } = await client.auth.getUser();
        if (authError || !auth?.user) {
          renderEmpty('Please log in to view classrooms.');
          return [];
        }
        currentUserId = auth.user.id;
      } catch (err) {
        console.error('Failed to resolve current user:', err);
        renderEmpty('Unable to load classrooms.');
        return [];
      }
    }

    let query = client
      .from('classroom')
      .select('*')
      .order('classroom_id', { ascending: true })
      .limit(200);

    if (!adminMode && currentUserId) {
      query = query.eq('users_id', currentUserId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching classrooms:', error);
      renderEmpty('Failed to load classrooms.');
      return [];
    }

    let rows = Array.isArray(data) ? data : [];
    rows = await archiveExpiredClassrooms(rows, client);
    return rows.filter((row) => normaliseStatus(row.classroom_status) !== 'archived');
  }

  function getRenderedClassrooms() {
    if (!listEl) return [];
    return Array.from(listEl.querySelectorAll('li.classroom-card')).map((card) => ({
      id: card.dataset.id || '',
      title: (card.querySelector('.classroom-title')?.textContent || 'Classroom').trim(),
    }));
  }

  function buildOverlayList() {
    if (!overlayBodyEl) return;

    overlayBodyEl.innerHTML = '';
    const classrooms = getRenderedClassrooms();

    if (!classrooms.length) {
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'No classrooms available.';
      overlayBodyEl.appendChild(empty);
      if (selectAllChkEl) selectAllChkEl.checked = false;
      return;
    }

    const frag = document.createDocumentFragment();
    classrooms.forEach((room) => {
      const row = document.createElement('div');
      row.className = 'list-row';

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'row-chk';
      chk.dataset.id = room.id;

      const label = document.createElement('label');
      label.textContent = room.title;
      label.style.flex = '1';

      row.appendChild(chk);
      row.appendChild(label);
      frag.appendChild(row);
    });

    overlayBodyEl.appendChild(frag);
    if (selectAllChkEl) selectAllChkEl.checked = false;
  }

  function openOverlay() {
    buildOverlayList();
    if (overlayEl) overlayEl.style.display = 'flex';
  }

  function closeOverlay() {
    if (overlayEl) overlayEl.style.display = 'none';
  }

  function selectedOverlayIds() {
    if (!overlayBodyEl) return [];
    return Array.from(overlayBodyEl.querySelectorAll('input.row-chk:checked'))
      .map((chk) => chk.dataset.id)
      .filter(Boolean);
  }

  async function deleteClassrooms(ids) {
    const supabase = window.supabase;
    if (!supabase) {
      alert('Supabase not initialized.');
      return;
    }

    const classroomIdsText = ids.map((id) => String(id));

    try {
      if (classroomIdsText.length) {
        const { error: lessonError } = await supabase
          .from('classroom_lesson')
          .delete()
          .in('classroom_id', classroomIdsText);
        if (lessonError) throw lessonError;

        const { error: studentError } = await supabase
          .from('classmate')
          .delete()
          .in('classroom_id', classroomIdsText);
        if (studentError) throw studentError;

        const { error: classroomError } = await supabase
          .from('classroom')
          .delete()
          .in('classroom_id', classroomIdsText);
        if (classroomError) throw classroomError;
      }

      alert('Selected classrooms deleted.');
      closeOverlay();
      await loadClassrooms(true);
    } catch (error) {
      console.error('Failed to delete classrooms:', error);
      alert('Failed to delete classrooms.');
    }
  }

  async function loadClassrooms(skipOverlayRebuild = false) {
    if (!listEl) return;
    listEl.innerHTML = '';

    try {
      const classrooms = await fetchClassrooms();
      if (!classrooms.length) {
        renderEmpty('No classrooms found.');
        return;
      }

      // Fetch all courses and build a map: course_id -> course_title
      const client = window.supabase;
      let courseTitleMap = {};
      if (client) {
        let courseQuery = client
          .from('course')
          .select('course_id, course_title');
        if (!adminMode && currentUserId) {
          courseQuery = courseQuery.eq('users_id', currentUserId);
        }
        const { data: courses, error: courseError } = await courseQuery;
        if (!courseError && Array.isArray(courses)) {
          courses.forEach((course) => {
            if (course.course_id) courseTitleMap[course.course_id] = course.course_title || '';
          });
        }
      }

      const frag = document.createDocumentFragment();
      classrooms.forEach((room) => {
        frag.appendChild(makeCard(room, courseTitleMap));
      });
      listEl.appendChild(frag);

      if (!skipOverlayRebuild) buildOverlayList();
    } catch (error) {
      console.error('Failed to load classrooms:', error);
      renderEmpty('Failed to load classrooms.');
    }
  }

  if (editToggleBtnEl) {
    editToggleBtnEl.addEventListener('click', openOverlay);
    window.toEditClassroom = openOverlay;
  }

  if (closeOverlayBtnEl) {
    closeOverlayBtnEl.addEventListener('click', closeOverlay);
  }

  if (selectAllChkEl && overlayBodyEl) {
    selectAllChkEl.addEventListener('change', () => {
      const checks = overlayBodyEl.querySelectorAll('input.row-chk');
      checks.forEach((chk) => { chk.checked = selectAllChkEl.checked; });
    });
  }

  if (deleteBtnEl) {
    deleteBtnEl.addEventListener('click', async () => {
      const ids = selectedOverlayIds();
      if (!ids.length) {
        alert('Please select at least one classroom to delete.');
        return;
      }
      const confirmed = window.confirm('Delete selected classrooms?');
      if (!confirmed) return;
      await deleteClassrooms(ids);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadClassrooms);
  } else {
    loadClassrooms();
  }
})();
