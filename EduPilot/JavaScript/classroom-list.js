(function () {
  const listEl = document.getElementById('classroomList');
  const overlayEl = document.getElementById('editOverlay');
  const overlayBodyEl = document.getElementById('overlayBody');
  const selectAllChkEl = document.getElementById('selectAllChk');
  const deleteBtnEl = document.getElementById('deleteSelected');
  const closeOverlayBtnEl = document.getElementById('closeOverlay');
  const editToggleBtnEl = document.getElementById('editToggle');

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

  function makeCard(classroom) {
    const li = document.createElement('li');
    li.className = 'classroom-card';
    li.dataset.id = classroom.classroom_id || '';
    li.tabIndex = 0;
    li.setAttribute('role', 'button');

    const content = document.createElement('div');
    content.className = 'card-content';

    // Title: id - title
    const title = document.createElement('div');
    title.className = 'classroom-title';
    title.textContent = `${classroom.classroom_id || '-'} - ${classroom.classroom_title || 'Untitled classroom'}`;

    // Course
    const course = document.createElement('div');
    course.className = 'classroom-meta';
    course.textContent = classroom.course_id ? `Course: ${classroom.course_id}` : '';

    // Start
    const start = document.createElement('div');
    start.className = 'classroom-meta';
    start.textContent = classroom.classroom_start_date ? `Start: ${normaliseDate(classroom.classroom_start_date)}` : '';

    // End
    const end = document.createElement('div');
    end.className = 'classroom-meta';
    end.textContent = classroom.classroom_end_date ? `End: ${normaliseDate(classroom.classroom_end_date)}` : '';


    content.appendChild(title);
    if (start.textContent) content.appendChild(start);
    if (end.textContent) content.appendChild(end);
    if (course.textContent) content.appendChild(course);

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

    const { data, error } = await client
      .from('classroom')
      .select('*')
      .order('classroom_id', { ascending: true })
      .limit(100);

    if (error) {
      console.error('Error fetching classrooms:', error);
      renderEmpty('Failed to load classrooms.');
      return [];
    }

    return Array.isArray(data) ? data : [];
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

      const frag = document.createDocumentFragment();
      classrooms.forEach((room) => {
        frag.appendChild(makeCard(room));
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
