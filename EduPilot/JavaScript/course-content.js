(function () {
  const client = () => window.supabase;

  const removeOverlay = document.getElementById('editOverlay');
  const removeOverlayBody = document.getElementById('deleteOverlayBody');
  const removeSelectAllChk = document.getElementById('deleteSelectAll');
  const removeConfirmBtn = document.getElementById('deleteSelected');
  const removeCloseBtn = document.getElementById('closeOverlay');

  const addOverlay = document.getElementById('editOverlay2');
  const addOverlayBody = document.getElementById('addOverlayBody');
  const addSelectAllChk = document.getElementById('addSelectAll');
  const addConfirmBtn = document.getElementById('addSelected');
  const addCloseBtn = document.getElementById('closeOverlay2');

  const openAddBtn = document.getElementById('openAddLessons');
  const openRemoveBtn = document.getElementById('openRemoveLessons');
  const editCourseBtn = document.getElementById('editCourseBtn');

  let courseId = '';
  let currentCourse = null;
  let currentLessons = [];
  let currentLessonIds = new Set();
  const lessonInfoStore = new Map();
  let allLessonsCache = null;
  let addOverlayData = new Map();
  let removeOverlayData = new Map();

  function getCourseId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id')?.trim() || '';
  }

  function titleCase(value) {
    if (!value) return '';
    const str = String(value).trim();
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function assignText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text ?? '';
  }

  function normaliseCredit(course) {
    const candidates = [
      course.course_credit_points,
      course.course_total_credit_pts,
      course.course_credit_pts,
    ];
    for (const value of candidates) {
      if (value === null || value === undefined || value === '') continue;
      const num = Number(value);
      if (!Number.isNaN(num)) return num;
    }
    return undefined;
  }

  function parseLessonIds(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(String).map((id) => id.trim()).filter(Boolean);
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map(String).map((id) => id.trim()).filter(Boolean);
        }
      } catch (err) {
        // fall through to splitting by comma
      }
      return raw
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    }
    return [];
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
    if (lesson.owner_name) owner.textContent = `Owner: ${lesson.owner_name}`;

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

    const desc = document.createElement('div');
    desc.className = 'lesson-desc';
    if (lesson.lesson_desc) {
      desc.textContent = lesson.lesson_desc;
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
    if (desc.textContent) li.appendChild(desc);

    return li;
  }

  function renderLessons(lessons) {
    const listEl = document.getElementById('lessonList');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!lessons || !lessons.length) {
      const li = document.createElement('li');
      li.textContent = 'No lessons linked to this course yet.';
      li.style.listStyle = 'none';
      li.style.margin = '12px';
      listEl.appendChild(li);
      return;
    }

    const frag = document.createDocumentFragment();
    lessons.forEach((lesson) => frag.appendChild(makeLessonCard(lesson)));
    listEl.appendChild(frag);

    currentLessons = Array.isArray(lessons) ? lessons : [];
    currentLessonIds = new Set(currentLessons.map((lesson) => lesson.lesson_id).filter(Boolean));
    currentLessons.forEach((lesson) => {
      if (lesson && lesson.lesson_id) {
        lessonInfoStore.set(lesson.lesson_id, lesson);
      }
    });
  }

  async function enrichLessonOwners(lessons) {
    const ids = Array.from(new Set(
      lessons.map((lesson) => lesson.users_id).filter(Boolean)
    ));
    if (!ids.length) return lessons;

    try {
      const { data, error } = await client()
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
    } catch (err) {
      console.warn('Failed to resolve lesson owner names:', err);
    }
    return lessons;
  }

  async function fetchLessonsForCourse(courseId, lessonIds) {
    const supabase = client();
    if (!supabase) return [];

    let ids = Array.isArray(lessonIds) ? [...lessonIds] : [];

    if (!ids.length) {
      try {
        const { data, error } = await supabase
          .from('units')
          .select('lesson_id')
          .eq('course_id', courseId);
        if (!error && Array.isArray(data)) {
          ids = data.map((row) => row.lesson_id).filter(Boolean);
        }
      } catch (err) {
        console.warn('Failed to load units for course:', err);
      }
    }

    const uniqueIds = Array.from(new Set(ids));
    if (!uniqueIds.length) return [];

    try {
      const { data, error } = await supabase
        .from('lesson')
        .select('*')
        .in('lesson_id', uniqueIds);
      if (error) throw error;
      const lessons = Array.isArray(data) ? data : [];
      const lessonsById = new Map(lessons.map((lesson) => [lesson.lesson_id, lesson]));
      const ordered = uniqueIds
        .map((id) => lessonsById.get(id))
        .filter(Boolean);
      await enrichLessonOwners(ordered);
      return ordered;
    } catch (err) {
      console.error('Failed to load lessons for course:', err);
      return [];
    }
  }

  function renderCourseDetails(course) {
    const ownerName = course.owner_name || '';
    const credit = normaliseCredit(course);

    assignText('valStatus', titleCase(course.course_status) || 'Draft');
    assignText('valCourseID', course.course_id || '-');
    assignText('valTit', course.course_title || 'Untitled course');
    assignText('valCreator', ownerName || '-');
    assignText('valCredit', credit !== undefined ? String(credit) : '-');
    assignText('valModified', formatDate(course.course_modified) || '-');
    assignText('valCreated', formatDate(course.course_date_created) || '-');

    const descEl = document.getElementById('lessonDesc');
    if (descEl) {
      descEl.textContent = course.course_desc || 'No description provided yet.';
    }

    currentCourse = course;
  }

  async function fetchCourse(courseId) {
    const supabase = client();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('course')
      .select('*, users:users_id (users_fname, users_lname)')
      .eq('course_id', courseId)
      .limit(1);
    if (error) {
      console.error('Failed to load course:', error);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;

    if (row.users && typeof row.users === 'object') {
      const fname = row.users.users_fname || '';
      const lname = row.users.users_lname || '';
      const combined = [fname, lname].filter(Boolean).join(' ');
      if (combined) row.owner_name = combined;
    }

    return row;
  }

  function openOverlay(overlay) {
    if (overlay) overlay.style.display = 'flex';
  }

  function closeOverlay(overlay) {
    if (overlay) overlay.style.display = 'none';
  }

  function setAllCheckboxes(container, checked) {
    if (!container) return;
    container.querySelectorAll('input.row-chk').forEach((chk) => {
      chk.checked = checked;
    });
  }

  function syncSelectAllState(container, selectAllCheckbox) {
    if (!container || !selectAllCheckbox) return;
    const checkboxes = Array.from(container.querySelectorAll('input.row-chk'));
    if (!checkboxes.length) {
      selectAllCheckbox.checked = false;
      return;
    }
    const allChecked = checkboxes.every((chk) => chk.checked);
    selectAllCheckbox.checked = allChecked;
  }

  function createOverlayRow(lesson) {
    const row = document.createElement('div');
    row.className = 'list-row';

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'row-chk';
    chk.dataset.id = lesson.lesson_id;

    const label = document.createElement('label');
    label.style.flex = '1';
    const title = lesson.lesson_title || 'Untitled lesson';
    const creditRaw = lesson.lesson_credit_pts ?? lesson.credit_points ?? lesson.credit ?? 0;
    const credit = Number(creditRaw);
    const creditDisplay = Number.isNaN(credit) ? 0 : credit;
    label.textContent = `${lesson.lesson_id} - ${title} (CP: ${creditDisplay})`;

    row.appendChild(chk);
    row.appendChild(label);
    return row;
  }

  function renderDeleteOverlay() {
    if (!removeOverlayBody) return;
    removeOverlayBody.innerHTML = '';
    if (!currentLessons.length) {
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'No lessons linked to this course.';
      removeOverlayBody.appendChild(empty);
      return;
    }
    removeOverlayData = new Map();
    const frag = document.createDocumentFragment();
    currentLessons.forEach((lesson) => {
      if (!lesson.lesson_id) return;
      removeOverlayData.set(lesson.lesson_id, lesson);
      frag.appendChild(createOverlayRow(lesson));
    });
    removeOverlayBody.appendChild(frag);
    if (removeSelectAllChk) removeSelectAllChk.checked = false;
  }

  async function fetchAllLessons() {
    if (allLessonsCache) return allLessonsCache;
    const supabase = client();
    if (!supabase) {
      throw new Error('Supabase not initialized.');
    }
    const { data, error } = await supabase
      .from('lesson')
      .select('*')
      .order('lesson_id', { ascending: true })
      .limit(500);
    if (error) throw error;
    const lessons = Array.isArray(data) ? data : [];
    await enrichLessonOwners(lessons);
    lessons.forEach((lesson) => {
      if (lesson && lesson.lesson_id) {
        lessonInfoStore.set(lesson.lesson_id, lesson);
      }
    });
    allLessonsCache = lessons;
    return lessons;
  }

  async function renderAddOverlay() {
    if (!addOverlayBody) return;
    addOverlayBody.innerHTML = '<div class="muted">Loading lessons...</div>';
    try {
      const lessons = await fetchAllLessons();
      const filtered = lessons.filter((lesson) => lesson.lesson_id && !currentLessonIds.has(lesson.lesson_id));
      addOverlayBody.innerHTML = '';
      if (!filtered.length) {
        const empty = document.createElement('div');
        empty.className = 'muted';
        empty.textContent = 'All lessons are already linked to this course.';
        addOverlayBody.appendChild(empty);
        addOverlayData = new Map();
        return;
      }
      addOverlayData = new Map();
      const frag = document.createDocumentFragment();
      filtered.forEach((lesson) => {
        addOverlayData.set(lesson.lesson_id, lesson);
        frag.appendChild(createOverlayRow(lesson));
      });
      addOverlayBody.appendChild(frag);
      if (addSelectAllChk) addSelectAllChk.checked = false;
    } catch (err) {
      console.error('Failed to load lessons for add overlay:', err);
      addOverlayBody.innerHTML = '';
      const errorEl = document.createElement('div');
      errorEl.className = 'muted';
      errorEl.textContent = 'Failed to load lessons. Please try again.';
      addOverlayBody.appendChild(errorEl);
    }
  }

  function getSelectedIds(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll('input.row-chk:checked'))
      .map((chk) => chk.dataset.id)
      .filter(Boolean);
  }

  async function ensureLessonDetails(ids) {
    const missing = ids.filter((id) => id && !lessonInfoStore.has(id));
    if (!missing.length) return;
    const supabase = client();
    if (!supabase) return;
    const { data, error } = await supabase
      .from('lesson')
      .select('*')
      .in('lesson_id', missing);
    if (error) {
      console.warn('Failed to fetch lesson details for totals:', error);
      return;
    }
    const list = Array.isArray(data) ? data : [];
    await enrichLessonOwners(list);
    list.forEach((lesson) => {
      if (lesson && lesson.lesson_id) {
        lessonInfoStore.set(lesson.lesson_id, lesson);
      }
    });
  }

  async function persistLessonChanges({ addIds = [], removeIds = [] }) {
    const supabase = client();
    if (!supabase || !courseId) {
      throw new Error('Supabase not initialized.');
    }

    const addList = Array.from(addIds || []).map((id) => String(id).trim()).filter(Boolean);
    const removeList = Array.from(removeIds || []).map((id) => String(id).trim()).filter(Boolean);

    const nextIdsSet = new Set(Array.from(currentLessonIds).map((id) => String(id).trim()).filter(Boolean));
    addList.forEach((id) => nextIdsSet.add(id));
    removeList.forEach((id) => nextIdsSet.delete(id));
    const nextIds = Array.from(nextIdsSet);

    await ensureLessonDetails([...nextIds, ...addList]);

    let totalCredit = 0;
    let totalHours = 0;
    nextIds.forEach((id) => {
      const info = lessonInfoStore.get(id);
      if (!info) return;
      const creditVal = Number(info.lesson_credit_pts ?? info.credit_points ?? info.credit ?? 0);
      if (!Number.isNaN(creditVal)) totalCredit += creditVal;
      const hoursVal = Number(info.lesson_est_hrs ?? info.lesson_estimated_hours ?? info.estimated_hours ?? 0);
      if (!Number.isNaN(hoursVal)) totalHours += hoursVal;
    });

    const updatePayload = {};

    if (currentCourse && Object.prototype.hasOwnProperty.call(currentCourse, 'course_lessons')) {
      updatePayload.course_lessons = nextIds;
    }

    if (currentCourse && Object.prototype.hasOwnProperty.call(currentCourse, 'course_total_credit_pts')) {
      updatePayload.course_total_credit_pts = totalCredit;
    }

    if (currentCourse && Object.prototype.hasOwnProperty.call(currentCourse, 'course_credit_points')) {
      updatePayload.course_credit_points = totalCredit;
    }

    if (currentCourse && Object.prototype.hasOwnProperty.call(currentCourse, 'course_credit_pts')) {
      updatePayload.course_credit_pts = totalCredit;
    }

    const hasCourseEstHrs = currentCourse && Object.prototype.hasOwnProperty.call(currentCourse, 'course_est_hrs');
    const hasCourseEstimatedHours = currentCourse && Object.prototype.hasOwnProperty.call(currentCourse, 'course_estimated_hours');

    if (!Number.isNaN(totalHours)) {
      if (hasCourseEstHrs) {
        updatePayload.course_est_hrs = totalHours;
      }
      if (hasCourseEstimatedHours) {
        updatePayload.course_estimated_hours = totalHours;
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      console.warn('No matching course fields found to update statistics. Skipping course summary update.');
    } else {
      const { error: courseError } = await supabase
        .from('course')
        .update(updatePayload)
        .eq('course_id', courseId);
      if (courseError) throw courseError;
    }

    if (addList.length) {
      const payload = addList.map((id) => ({ course_id: courseId, lesson_id: id }));
      const { error: addError } = await supabase
        .from('units')
        .upsert(payload, { onConflict: 'lesson_id,course_id' });
      if (addError) throw addError;
    }

    if (removeList.length) {
      const { error: delError } = await supabase
        .from('units')
        .delete()
        .eq('course_id', courseId)
        .in('lesson_id', removeList);
      if (delError) throw delError;
    }

    await refreshCourseState();
  }

  async function refreshCourseState() {
    if (!courseId) return;
    const refreshedCourse = await fetchCourse(courseId);
    if (!refreshedCourse) return;
    renderCourseDetails(refreshedCourse);
    const lessonIds = parseLessonIds(refreshedCourse.course_lessons);
    const lessons = await fetchLessonsForCourse(courseId, lessonIds);
    renderLessons(lessons);
  }

  async function init() {
    init._retries = init._retries || 0;
    const cid = getCourseId();
    if (!cid) {
      alert('Course ID is missing.');
      return;
    }

    courseId = cid;

    if (!client()) {
      if (init._retries < 5) {
        init._retries += 1;
        setTimeout(init, 200);
        return;
      }
      alert('Supabase not initialized.');
      return;
    }

    try {
      const course = await fetchCourse(courseId);
      if (!course) {
        alert('Failed to load course details.');
        return;
      }

      renderCourseDetails(course);

      if (editCourseBtn) {
        editCourseBtn.onclick = () => {
          const url = `/EduPilot/html/teacher/edit_tCourse.html?id=${encodeURIComponent(courseId)}`;
          window.location.href = url;
        };
      }

      const lessonIds = parseLessonIds(course.course_lessons);
      const lessons = await fetchLessonsForCourse(courseId, lessonIds);
      renderLessons(lessons);
    } catch (err) {
      console.error('Unexpected error loading course content:', err);
      alert('Unexpected error loading course content.');
    }
  }

  if (removeSelectAllChk && removeOverlayBody) {
    removeSelectAllChk.addEventListener('change', () => {
      setAllCheckboxes(removeOverlayBody, removeSelectAllChk.checked);
    });
    removeOverlayBody.addEventListener('change', (event) => {
      if (event.target && event.target.classList.contains('row-chk')) {
        syncSelectAllState(removeOverlayBody, removeSelectAllChk);
      }
    });
  }

  if (addSelectAllChk && addOverlayBody) {
    addSelectAllChk.addEventListener('change', () => {
      setAllCheckboxes(addOverlayBody, addSelectAllChk.checked);
    });
    addOverlayBody.addEventListener('change', (event) => {
      if (event.target && event.target.classList.contains('row-chk')) {
        syncSelectAllState(addOverlayBody, addSelectAllChk);
      }
    });
  }

  if (removeCloseBtn) {
    removeCloseBtn.addEventListener('click', () => closeOverlay(removeOverlay));
  }

  if (addCloseBtn) {
    addCloseBtn.addEventListener('click', () => closeOverlay(addOverlay));
  }

  if (openRemoveBtn) {
    openRemoveBtn.addEventListener('click', (event) => {
      event.preventDefault();
      if (!currentLessons.length) {
        alert('No lessons to remove from this course.');
        return;
      }
      renderDeleteOverlay();
      openOverlay(removeOverlay);
    });
  }

  if (openAddBtn) {
    openAddBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      await renderAddOverlay();
      openOverlay(addOverlay);
    });
  }

  if (removeConfirmBtn) {
    removeConfirmBtn.addEventListener('click', async () => {
      const ids = getSelectedIds(removeOverlayBody);
      if (!ids.length) {
        alert('Please select at least one lesson to remove.');
        return;
      }
      const confirmDelete = window.confirm('Remove selected lessons from this course?');
      if (!confirmDelete) return;
      try {
        await persistLessonChanges({ removeIds: ids });
        closeOverlay(removeOverlay);
        alert('Selected lessons removed from the course.');
      } catch (err) {
        console.error('Failed to remove lessons:', err);
        alert('Failed to remove lessons. Please try again.');
      }
    });
  }

  if (addConfirmBtn) {
    addConfirmBtn.addEventListener('click', async () => {
      const ids = getSelectedIds(addOverlayBody);
      const newIds = ids.filter((id) => id && !currentLessonIds.has(id));
      if (!newIds.length) {
        alert('Please select at least one new lesson to add.');
        return;
      }
      try {
        await persistLessonChanges({ addIds: newIds });
        closeOverlay(addOverlay);
        alert('Selected lessons added to the course.');
      } catch (err) {
        console.error('Failed to add lessons:', err);
        alert('Failed to add lessons. Please try again.');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
