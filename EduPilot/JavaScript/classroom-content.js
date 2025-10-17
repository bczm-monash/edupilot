(function () {
  const supabaseClient = () => window.supabase;

  const removeOverlay = document.getElementById('editOverlay');
  const removeOverlayBody = document.getElementById('overlayBody');
  const removeSelectAllChk = document.getElementById('selectAllChk');
  const removeConfirmBtn = document.getElementById('deleteSelected');
  const removeCloseBtn = document.getElementById('closeOverlay');

  const addOverlay = document.getElementById('editOverlay2');
  const addOverlayBody = document.getElementById('addOverlayBody');
  const addSelectAllChk = document.getElementById('addSelectAll');
  const addConfirmBtn = document.getElementById('addSelected');
  const addCloseBtn = document.getElementById('closeOverlay2');

  const openAddBtn = document.getElementById('openAddLessons');
  const openRemoveBtn = document.getElementById('openRemoveLessons');
  const gradesBtn = document.getElementById('openGrades');
  const editClassroomBtn = document.getElementById('editClassroomBtn');
  const headerTitleEl = document.getElementById('classroomHeader');

  let classroomId = '';
  let classroomIdText = '';
  let currentClassroom = null;
  let currentLessons = [];
  let currentLessonIds = new Set();
  const availableLessonsCache = new Map();

  function getClassroomId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id')?.trim() || '';
  }

  function assignText(id, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text ?? '';
  }

  function parseDateValue(value) {
    if (!value) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;

    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const date = new Date(trimmed);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const match = trimmed.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{4})$/);
    if (match) {
      const [, d, m, y] = match;
      const date = new Date(Number(y), Number(m) - 1, Number(d));
      return Number.isNaN(date.getTime()) ? null : date;
    }

    return null;
  }

  function computeDurationDays(start, end) {
    const startDate = parseDateValue(start);
    const endDate = parseDateValue(end);
    if (!startDate || !endDate) return '';
    const diff = endDate.getTime() - startDate.getTime();
    if (!Number.isFinite(diff) || diff < 0) return '';
    const days = Math.floor(diff / (24 * 60 * 60 * 1000)) + 1;
    return days > 0 ? String(days) : '';
  }

  function formatDateText(value) {
    const date = parseDateValue(value);
    if (!date) return value || '';
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function renderStudentList(students) {
    const listEl = document.getElementById('studentList');
    if (!listEl) return;

    listEl.innerHTML = '';

    if (!Array.isArray(students) || !students.length) {
      const li = document.createElement('li');
      li.textContent = 'No students enrolled yet.';
      listEl.appendChild(li);
      return;
    }

    students.forEach((row) => {
      const user = row.users || {};
      const parts = [user.users_fname, user.users_lname].filter(Boolean);
      const name = parts.length ? parts.join(' ') : (user.users_email || row.users_id || 'Student');
      const email = user.users_email ? ` (${user.users_email})` : '';

      const li = document.createElement('li');
      li.textContent = `${name}${email}`;
      listEl.appendChild(li);
    });
  }

  function makeLessonCard(lesson) {
    const li = document.createElement('li');
    li.className = 'lesson-card';
    li.dataset.id = lesson.lesson_id || '';
    li.tabIndex = 0;
    li.setAttribute('role', 'button');

    const title = document.createElement('div');
    title.className = 'lesson-title';
    title.textContent = lesson.lesson_title || 'Untitled lesson';

    const metaId = document.createElement('div');
    metaId.className = 'lesson-meta';
    metaId.textContent = `ID: ${lesson.lesson_id || '-'}`;

    const owner = document.createElement('div');
    owner.className = 'lesson-meta';
    if (lesson.owner_name) owner.textContent = `Instructor: ${lesson.owner_name}`;

    const credit = document.createElement('div');
    credit.className = 'lesson-meta';
    if (lesson.lesson_credit_pts !== undefined && lesson.lesson_credit_pts !== null) {
      credit.textContent = `Credit Points: ${lesson.lesson_credit_pts}`;
    }

    const est = document.createElement('div');
    est.className = 'lesson-meta';
    if (lesson.lesson_est_hrs !== undefined && lesson.lesson_est_hrs !== null) {
      est.textContent = `Estimated Hours: ${lesson.lesson_est_hrs}`;
    }

    const open = () => {
      if (!lesson.lesson_id) return;
      const url = `/EduPilot/html/teacher/lesson_content.html?id=${encodeURIComponent(lesson.lesson_id)}`;
      window.location.href = url;
    };

    li.addEventListener('click', open);
    li.addEventListener('keypress', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });

    li.appendChild(title);
    li.appendChild(metaId);
    if (owner.textContent) li.appendChild(owner);
    if (credit.textContent) li.appendChild(credit);
    if (est.textContent) li.appendChild(est);
    return li;
  }

  function renderLessons(lessons) {
    const listEl = document.getElementById('lessonList');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!Array.isArray(lessons) || !lessons.length) {
      const li = document.createElement('li');
      li.textContent = 'No lessons linked to this classroom yet.';
      li.style.listStyle = 'none';
      li.style.margin = '12px';
      listEl.appendChild(li);
      currentLessons = [];
      currentLessonIds = new Set();
      return;
    }

    const frag = document.createDocumentFragment();
    lessons.forEach((lesson) => frag.appendChild(makeLessonCard(lesson)));
    listEl.appendChild(frag);

    currentLessons = lessons;
    currentLessonIds = new Set(lessons.map((lesson) => lesson.lesson_id).filter(Boolean));
  }

  async function enrichLessonOwners(lessons) {
    const supabase = supabaseClient();
    if (!supabase) return lessons;

    const ids = Array.from(new Set(
      lessons.map((lesson) => lesson.users_id).filter(Boolean)
    ));
    if (!ids.length) return lessons;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('users_id, users_fname, users_lname')
        .in('users_id', ids);
      if (error) throw error;
      const nameById = new Map(
        (data || []).map((u) => [u.users_id, [u.users_fname, u.users_lname].filter(Boolean).join(' ')])
      );
      lessons.forEach((lesson) => {
        const name = nameById.get(lesson.users_id);
        if (name) lesson.owner_name = name;
      });
    } catch (error) {
      console.warn('Failed to resolve lesson owners:', error);
    }
    return lessons;
  }

  async function loadClassroomDetails() {
    const supabase = supabaseClient();
    if (!supabase || !classroomId) return;

    try {
      const { data, error } = await supabase
        .from('classroom')
        .select(`
          classroom_id,
          classroom_title,
          classroom_start_date,
          classroom_end_date,
          course_id,
          users_id,
          users:users_id (users_fname, users_lname),
          course:course_id (course_title)
        `)
        .eq('classroom_id', classroomId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      currentClassroom = data || null;

      if (!currentClassroom) {
        assignText('valTitle', 'Classroom not found');
        return;
      }

      const courseLabel = currentClassroom.course?.course_title
        ? `${currentClassroom.course_id} - ${currentClassroom.course.course_title}`
        : (currentClassroom.course_id || '-');

      const instructorName = (() => {
        const user = currentClassroom.users;
        if (!user) return currentClassroom.users_id || '-';
        const parts = [user.users_fname, user.users_lname].filter(Boolean);
        return parts.length ? parts.join(' ') : (currentClassroom.users_id || '-');
      })();

      const durationText = computeDurationDays(
        currentClassroom.classroom_start_date,
        currentClassroom.classroom_end_date,
      );

      assignText('valTitle', currentClassroom.classroom_title || 'Untitled classroom');
      assignText('valId', currentClassroom.classroom_id ?? '-');
      assignText('valCourse', courseLabel);
      assignText('valInstructor', instructorName);
      assignText('valDuration', durationText || '-');
      assignText('valStart', formatDateText(currentClassroom.classroom_start_date));
      assignText('valEnd', formatDateText(currentClassroom.classroom_end_date));

      if (headerTitleEl) {
        const title = currentClassroom.classroom_title ? `${currentClassroom.classroom_title}` : 'Classroom';
        headerTitleEl.textContent = title;
      }

      if (gradesBtn) {
        gradesBtn.onclick = () => {
          const url = `/EduPilot/html/teacher/classroom_grades.html?id=${encodeURIComponent(classroomId)}`;
          window.location.href = url;
        };
      }
    } catch (error) {
      console.error('Failed to load classroom details:', error);
      assignText('valTitle', 'Failed to load classroom');
    }
  }

  async function loadStudents() {
    const supabase = supabaseClient();
    if (!supabase || !classroomId) return;

    try {
      const { data, error } = await supabase
        .from('classmate')
        .select('users_id, users:users_id (users_fname, users_lname, users_email)')
        .eq('classroom_id', classroomId);

      if (error) throw error;

      renderStudentList(data || []);
    } catch (error) {
      console.error('Failed to load students for classroom:', error);
      const listEl = document.getElementById('studentList');
      if (listEl) {
        listEl.innerHTML = '';
        const li = document.createElement('li');
        li.textContent = 'Unable to load students.';
        listEl.appendChild(li);
      }
    }
  }

  async function loadLessons() {
    const supabase = supabaseClient();
    if (!supabase || !classroomId) return;

    try {
      const { data: links, error: linkError } = await supabase
        .from('classroom_lesson')
        .select('lesson_id')
        .eq('classroom_id', classroomIdText);

      if (linkError) throw linkError;

      const lessonIds = Array.isArray(links)
        ? links.map((row) => row.lesson_id).filter(Boolean)
        : [];

      if (!lessonIds.length) {
        renderLessons([]);
        return;
      }

      const { data: lessonRows, error: lessonsError } = await supabase
        .from('lesson')
        .select('lesson_id, lesson_title, lesson_credit_pts, lesson_est_hrs, lesson_desc, users_id')
        .in('lesson_id', lessonIds);

      if (lessonsError) throw lessonsError;

      const byId = new Map(
        (lessonRows || []).map((lesson) => [lesson.lesson_id, lesson])
      );

      const lessons = lessonIds
        .map((id) => byId.get(id))
        .filter(Boolean);

      await enrichLessonOwners(lessons);
      renderLessons(lessons);
    } catch (error) {
      console.error('Failed to load classroom lessons:', error);
      renderLessons([]);
    }
  }

  function closeOverlay(element) {
    if (!element) return;
    element.style.display = 'none';
  }

  function openOverlay(element) {
    if (!element) return;
    element.style.display = 'flex';
  }

  function buildRemoveOverlay() {
    if (!removeOverlayBody) return;
    removeOverlayBody.innerHTML = '';

    if (!currentLessons.length) {
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'No lessons linked to this classroom.';
      removeOverlayBody.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    currentLessons.forEach((lesson) => {
      const row = document.createElement('div');
      row.className = 'list-row';

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'row-chk';
      chk.dataset.lessonId = lesson.lesson_id;

      const label = document.createElement('label');
      label.textContent = lesson.lesson_title || lesson.lesson_id;
      label.style.flex = '1';

      row.appendChild(chk);
      row.appendChild(label);
      frag.appendChild(row);
    });

    removeOverlayBody.appendChild(frag);
    if (removeSelectAllChk) removeSelectAllChk.checked = false;
  }

  async function fetchAvailableLessons() {
    const courseId = currentClassroom?.course_id;
    if (!courseId) return [];

    if (availableLessonsCache.has(courseId)) {
      return availableLessonsCache.get(courseId);
    }

    const supabase = supabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('units')
      .select('lesson_id, lesson:lesson_id (lesson_id, lesson_title, lesson_credit_pts, lesson_est_hrs, lesson_desc, users_id)')
      .eq('course_id', courseId);

    if (error) {
      console.error('Failed to load lessons list:', error);
      return [];
    }

    const lessons = (data || [])
      .map((row) => row.lesson)
      .filter((lesson) => lesson && lesson.lesson_id);

    await enrichLessonOwners(lessons);
    availableLessonsCache.set(courseId, lessons);
    return lessons;
  }

  async function buildAddOverlay() {
    if (!addOverlayBody) return;
    addOverlayBody.innerHTML = '';

    const allLessons = await fetchAvailableLessons();
    const available = allLessons.filter((lesson) => !currentLessonIds.has(lesson.lesson_id));

    if (!available.length) {
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'No additional lessons available to add.';
      addOverlayBody.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    available.forEach((lesson) => {
      const row = document.createElement('div');
      row.className = 'list-row';

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'row-chk';
      chk.dataset.lessonId = lesson.lesson_id;

      const label = document.createElement('label');
      label.textContent = lesson.lesson_title || lesson.lesson_id;
      label.style.flex = '1';

      row.appendChild(chk);
      row.appendChild(label);
      frag.appendChild(row);
    });

    addOverlayBody.appendChild(frag);
    if (addSelectAllChk) addSelectAllChk.checked = false;
  }

  function selectedLessonIdsFrom(container) {
    return Array.from(container.querySelectorAll('input.row-chk:checked'))
      .map((chk) => chk.dataset.lessonId)
      .filter(Boolean);
  }

  async function removeSelectedLessons() {
    const supabase = supabaseClient();
    if (!supabase || !removeOverlayBody) return;

    const ids = selectedLessonIdsFrom(removeOverlayBody);
    if (!ids.length) {
      alert('Please select at least one lesson to remove.');
      return;
    }

    try {
      const { error } = await supabase
        .from('classroom_lesson')
        .delete()
        .eq('classroom_id', classroomIdText)
        .in('lesson_id', ids);

      if (error) throw error;

      await loadLessons();
      if (currentClassroom?.course_id) {
        availableLessonsCache.delete(currentClassroom.course_id);
      }
      closeOverlay(removeOverlay);
    } catch (error) {
      console.error('Failed to remove lessons:', error);
      alert('Failed to remove lessons.');
    }
  }

  async function addSelectedLessons() {
    const supabase = supabaseClient();
    if (!supabase || !addOverlayBody) return;

    const ids = selectedLessonIdsFrom(addOverlayBody);
    if (!ids.length) {
      alert('Please select at least one lesson to add.');
      return;
    }

    const payload = ids.map((lessonId) => ({
      classroom_id: classroomIdText,
      lesson_id: lessonId,
    }));

    try {
      const { error } = await supabase
        .from('classroom_lesson')
        .insert(payload);

      if (error) throw error;

      await loadLessons();
      if (currentClassroom?.course_id) {
        availableLessonsCache.delete(currentClassroom.course_id);
      }
      closeOverlay(addOverlay);
    } catch (error) {
      console.error('Failed to add lessons:', error);
      alert('Failed to add lessons.');
    }
  }

  function bindEvents() {
    if (openRemoveBtn && removeOverlay) {
      openRemoveBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        buildRemoveOverlay();
        openOverlay(removeOverlay);
      });
    }

    if (removeCloseBtn) {
      removeCloseBtn.addEventListener('click', () => closeOverlay(removeOverlay));
    }

    if (removeSelectAllChk && removeOverlayBody) {
      removeSelectAllChk.addEventListener('change', () => {
        const chks = removeOverlayBody.querySelectorAll('input.row-chk');
        chks.forEach((chk) => { chk.checked = removeSelectAllChk.checked; });
      });
    }

    if (removeConfirmBtn) {
      removeConfirmBtn.addEventListener('click', removeSelectedLessons);
    }

    if (openAddBtn && addOverlay) {
      openAddBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        await buildAddOverlay();
        openOverlay(addOverlay);
      });
    }

    if (addCloseBtn) {
      addCloseBtn.addEventListener('click', () => closeOverlay(addOverlay));
    }

    if (addSelectAllChk && addOverlayBody) {
      addSelectAllChk.addEventListener('change', () => {
        const chks = addOverlayBody.querySelectorAll('input.row-chk');
        chks.forEach((chk) => { chk.checked = addSelectAllChk.checked; });
      });
    }

    if (addConfirmBtn) {
      addConfirmBtn.addEventListener('click', addSelectedLessons);
    }

    if (editClassroomBtn) {
      editClassroomBtn.addEventListener('click', () => {
        if (!classroomId) return;
        const url = `/EduPilot/html/teacher/edit_tClassroom.html?id=${encodeURIComponent(classroomId)}`;
        window.location.href = url;
      });
    }
  }

  async function initialise() {
    classroomId = getClassroomId();
    if (!classroomId) {
      alert('Missing classroom ID in URL.');
      return;
    }

    classroomIdText = String(classroomId);

    await loadClassroomDetails();
    await loadStudents();
    await loadLessons();
    bindEvents();
  }

  function bootstrap() {
    if (supabaseClient()) {
      initialise();
    } else {
      document.addEventListener('supabase-ready', initialise, { once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
