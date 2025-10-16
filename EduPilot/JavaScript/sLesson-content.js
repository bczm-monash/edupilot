(function () {
  const headerEl = document.getElementById('lessonHeader');
  const backBtn = document.getElementById('backBtn');

  const rowPrereq = document.getElementById('rowPrereq');
  const rowCreator = document.getElementById('rowCreator');
  const rowEst = document.getElementById('rowEst');
  const rowCredit = document.getElementById('rowCredit');
  const rowModified = document.getElementById('rowModified');
  const rowCreated = document.getElementById('rowCreated');

  const valPrereq = document.getElementById('valPrereq');
  const valCreator = document.getElementById('valCreator');
  const valEst = document.getElementById('valEst');
  const valCredit = document.getElementById('valCredit');
  const valModified = document.getElementById('valModified');
  const valCreated = document.getElementById('valCreated');

  const descEl = document.getElementById('lessonDesc');
  const objEl = document.getElementById('lessonObjective');
  const readingCard = document.getElementById('readingCard');
  const assignmentCard = document.getElementById('assignmentCard');
  const readingEl = document.getElementById('lessonReading');
  const assignmentEl = document.getElementById('lessonAssignment');

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString();
  }

  function showRow(rowEl, valEl, value) {
    if (!rowEl || !valEl) return;
    if (value === null || value === undefined || value === '') {
      rowEl.style.display = 'none';
      valEl.textContent = '';
    } else {
      rowEl.style.display = '';
      valEl.textContent = String(value);
    }
  }

  function setSection(cardEl, textEl, value) {
    if (!cardEl || !textEl) return;
    const str = value === null || value === undefined ? '' : String(value);
    if (str.trim() === '') {
      cardEl.style.display = 'none';
      textEl.textContent = '';
    } else {
      cardEl.style.display = '';
      textEl.textContent = str;
    }
  }

  async function ensureSupabaseReady(retry = 0) {
    if (window.supabase) return window.supabase;
    if (retry > 5) return null;
    await new Promise((resolve) => setTimeout(resolve, 150 * (retry + 1)));
    return ensureSupabaseReady(retry + 1);
  }

  async function fetchLessonById(id) {
    const supabase = await ensureSupabaseReady();
    if (!supabase) return { data: null, error: new Error('Supabase not ready') };

    let res = await supabase
      .from('lesson')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (res.data || !res.error) return res;

    return supabase
      .from('lesson')
      .select('*')
      .eq('lesson_id', id)
      .maybeSingle();
  }

  async function Creator(users_id) {
    if (!users_id) return '';

    if (typeof window.fetchUserDisplayName === 'function') {
      try {
        const name = await window.fetchUserDisplayName(users_id);
        if (name) return name;
      } catch (err) {
        console.warn('Failed to resolve creator via helper:', err);
      }
    }

    const supabase = await ensureSupabaseReady();
    if (!supabase) return '';
    const { data, error } = await supabase
      .from('users')
      .select('users_fname, users_lname')
      .eq('users_id', users_id)
      .maybeSingle();
    if (error || !data) return '';
    return [data.users_fname, data.users_lname].filter(Boolean).join(' ');
  }

  function setHeader(id, title) {
    if (!headerEl) return;
    const idPart = id ? String(id) : '';
    const titlePart = title ? String(title) : 'Lesson';
    headerEl.textContent = idPart ? `${idPart} - ${titlePart}` : titlePart;
  }

  function getQueryId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || '';
  }

  async function init() {
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (window.history.length > 1) {
          window.history.back();
        } else if (typeof toSCourse === 'function') {
          toSCourse();
        } else {
          window.location.href = '/EduPilot/html/student/sCourse.html';
        }
      });
    }

    const lessonId = getQueryId();
    if (!lessonId) {
      alert('Lesson ID was not provided.');
      if (typeof toSCourse === 'function') toSCourse();
      return;
    }

    const { data, error } = await fetchLessonById(lessonId);
    if (error) {
      console.error('Failed to load lesson:', error);
      alert('Unable to load lesson details.');
      return;
    }
    const lesson = data;
    if (!lesson) {
      alert('Lesson not found.');
      return;
    }

    const displayId = lesson.lesson_id || lesson.id || lessonId;
    const titleVal = lesson.lesson_title || lesson.title || lesson.lesson_desc || 'Lesson';
    setHeader(displayId, titleVal);

    const creatorName = await Creator(lesson.users_id || lesson.user_id);

    showRow(rowPrereq, valPrereq, lesson.lesson_prereq || '');
    showRow(rowCreator, valCreator, creatorName || '-');
    showRow(rowEst, valEst, lesson.lesson_est_hrs ?? lesson.lesson_estimated_hours ?? '');
    showRow(rowCredit, valCredit, lesson.lesson_credit_pts ?? '');
    showRow(rowModified, valModified, formatDate(lesson.lesson_modified));
    showRow(rowCreated, valCreated, formatDate(lesson.lesson_date_created));

    if (descEl) descEl.textContent = lesson.lesson_desc || '';
    if (objEl) objEl.textContent = lesson.lesson_objective || '';
    setSection(readingCard, readingEl, lesson.lesson_reading_list);
    setSection(assignmentCard, assignmentEl, lesson.lesson_assignment_list);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
