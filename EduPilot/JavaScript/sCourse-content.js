(function () {
  const listEl = document.getElementById('lessonList');
  const headerEl = document.getElementById('courseHeader');
  const backBtn = document.getElementById('backBtn');

  function renderEmpty(message) {
    if (!listEl) return;
    listEl.innerHTML = '';
    const li = document.createElement('li');
    li.textContent = message || 'No lessons available.';
    li.style.listStyle = 'none';
    li.style.margin = '12px';
    listEl.appendChild(li);
  }

  const rowStatus = document.getElementById('rowStatus');
  const rowCourseID = document.getElementById('rowCourseID');
  const rowTitle = document.getElementById('rowTit');
  const rowCreator = document.getElementById('rowCreator');
  const rowCredit = document.getElementById('rowCredit');
  const rowModified = document.getElementById('rowModified');
  const rowCreated = document.getElementById('rowCreated');

  const valStatus = document.getElementById('valStatus');
  const valCourseID = document.getElementById('valCourseID');
  const valTitle = document.getElementById('valTit');
  const valCreator = document.getElementById('valCreator');
  const valCredit = document.getElementById('valCredit');
  const valModified = document.getElementById('valModified');
  const valCreated = document.getElementById('valCreated');

  const descEl = document.getElementById('lessonDesc');

  function assignText(el, text) {
    if (el) el.textContent = text ?? '';
  }

  function showRow(rowEl, valEl, text) {
    if (!rowEl || !valEl) return;
    if (text === null || text === undefined || String(text).trim() === '') {
      rowEl.style.display = 'none';
      valEl.textContent = '';
    } else {
      rowEl.style.display = '';
      valEl.textContent = String(text);
    }
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

  function normaliseLessonIds(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map((id) => String(id).trim()).filter(Boolean);
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((id) => String(id).trim()).filter(Boolean);
        }
      } catch (_) {
        // fall through
      }
      return raw
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    }
    return [];
  }

  function renderLessonCards(lessons) {
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!lessons.length) {
      const li = document.createElement('li');
      li.textContent = 'No lessons available for this course yet.';
      li.style.listStyle = 'none';
      li.style.margin = '12px';
      listEl.appendChild(li);
      return;
    }

    const frag = document.createDocumentFragment();
    lessons.forEach((lesson) => {
      const li = document.createElement('li');
      li.className = 'lesson-card';
      const lessonId = lesson.lesson_id || '';

      const title = document.createElement('div');
      title.className = 'lesson-title';
      title.textContent = `${lessonId} - ${lesson.lesson_title || 'Untitled lesson'}`.trim();

      const credit = document.createElement('div');
      credit.className = 'lesson-meta';
      const creditVal = lesson.lesson_credit_pts;
      if (creditVal !== undefined && creditVal !== null) {
        credit.textContent = `Credit Points: ${creditVal}`;
      }

      const hours = document.createElement('div');
      hours.className = 'lesson-meta';
      const hoursVal = lesson.lesson_est_hrs;
      if (hoursVal !== undefined && hoursVal !== null) {
        hours.textContent = `Estimated Hours: ${hoursVal}`;
      }

      const desc = document.createElement('div');
      desc.className = 'lesson-desc';
      if (lesson.lesson_desc) {
        desc.textContent = lesson.lesson_desc;
      }

      li.appendChild(title);
      if (credit.textContent) li.appendChild(credit);
      if (hours.textContent) li.appendChild(hours);
      if (desc.textContent) li.appendChild(desc);

      if (lessonId) {
        li.tabIndex = 0;
        li.setAttribute('role', 'button');
        const open = () => {
          window.location.href = `/EduPilot/html/student/sLesson_content.html?id=${encodeURIComponent(lessonId)}`;
        };
        li.addEventListener('click', open);
        li.addEventListener('keypress', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            open();
          }
        });
      }

      frag.appendChild(li);
    });

    listEl.appendChild(frag);
  }

  async function ensureSupabaseReady(retry = 0) {
    if (window.supabase) return window.supabase;
    if (retry > 5) return null;
    await new Promise((resolve) => setTimeout(resolve, 150 * (retry + 1)));
    return ensureSupabaseReady(retry + 1);
  }

  async function fetchCourse(courseId) {
    const supabase = await ensureSupabaseReady();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('course')
      .select('course_id, users_id, course_title, course_desc, course_date_created, course_modified, course_credit_points, course_status')
      .eq('course_id', courseId)
      .maybeSingle();

    if (error) {
      console.error('Failed to load course:', error);
      return null;
    }
    return data || null;
  }

  async function fetchLessonsForCourse(courseId, lessonIds) {
    const supabase = await ensureSupabaseReady();
    if (!supabase) return [];

    let ids = Array.isArray(lessonIds) ? [...lessonIds] : [];

    if (!ids.length) {
      const { data, error } = await supabase
        .from('units')
        .select('lesson_id')
        .eq('course_id', courseId);
      if (!error && Array.isArray(data)) {
        ids = data.map((row) => row.lesson_id).filter(Boolean);
      }
    }

    const uniqueIds = Array.from(new Set(ids));
    if (!uniqueIds.length) return [];

    const { data, error } = await supabase
      .from('lesson')
      .select('lesson_id, lesson_title, lesson_desc, lesson_credit_pts, lesson_est_hrs')
      .in('lesson_id', uniqueIds);

    if (error) {
      console.error('Failed to load lessons for course:', error);
      return [];
    }

    const lessons = Array.isArray(data) ? data : [];
    const lessonMap = new Map(lessons.map((lesson) => [lesson.lesson_id, lesson]));
    return uniqueIds
      .map((id) => lessonMap.get(id))
      .filter(Boolean);
  }

  async function init() {
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          toSCourse();
        }
      });
    }

    const params = new URLSearchParams(window.location.search);
    const courseId = params.get('id');
    if (!courseId) {
      alert('Course ID was not provided.');
      toSCourse();
      return;
    }

    const course = await fetchCourse(courseId);
    if (!course) {
      renderEmpty('Unable to load course details.');
      return;
    }

    let teacherName = '';
    if (course.users_id && typeof window.fetchUserDisplayName === 'function') {
      try {
        teacherName = await window.fetchUserDisplayName(course.users_id);
      } catch (err) {
        console.warn('Failed to resolve teacher name:', err);
      }
    }

    const status = course.course_status ? String(course.course_status) : '';
    const statusDisplay = status ? status.charAt(0).toUpperCase() + status.slice(1) : '';

    if (headerEl) {
      const idPart = course.course_id || '';
      const titlePart = course.course_title || 'Course';
      headerEl.textContent = idPart ? `${idPart} - ${titlePart}` : titlePart;
    }

    showRow(rowStatus, valStatus, statusDisplay);
    showRow(rowCourseID, valCourseID, course.course_id || '-');
    showRow(rowTitle, valTitle, course.course_title || '-');
    showRow(rowCreator, valCreator, teacherName || '-');

    const creditDisplay = course.course_credit_points;
    showRow(rowCredit, valCredit, (creditDisplay !== undefined && creditDisplay !== null) ? creditDisplay : '');
    showRow(rowModified, valModified, formatDate(course.course_modified));
    showRow(rowCreated, valCreated, formatDate(course.course_date_created));

    if (descEl) {
      descEl.textContent = course.course_desc || 'No description provided.';
    }

    const lessons = await fetchLessonsForCourse(course.course_id, []);
    renderLessonCards(lessons);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
