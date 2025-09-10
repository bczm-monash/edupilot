(function () {
  const headerEl = document.getElementById('lessonHeader');
  // Detail rows
  const rowPrereq = document.getElementById('rowPrereq');
  const rowCreator = document.getElementById('rowCreator');
  const rowEst = document.getElementById('rowEst');
  const rowCredit = document.getElementById('rowCredit');
  const rowModified = document.getElementById('rowModified');
  const rowCreated = document.getElementById('rowCreated');
  // Values
  const valPrereq = document.getElementById('valPrereq');
  const valCreator = document.getElementById('valCreator');
  const valEst = document.getElementById('valEst');
  const valCredit = document.getElementById('valCredit');
  const valModified = document.getElementById('valModified');
  const valCreated = document.getElementById('valCreated');
  // Sections
  const descEl = document.getElementById('lessonDesc');
  const objEl = document.getElementById('lessonObjective');
  const editBtn = document.getElementById('editBtn');

  function getQueryId() {
    const p = new URLSearchParams(window.location.search);
    return p.get('id') || '';
  }

  function setHeader(id, title) {
    const idPart = id ? String(id) : '';
    const titlePart = title ? String(title) : 'Lesson';
    headerEl.textContent = idPart ? `${idPart} - ${titlePart}` : titlePart;
  }

  function fmtDate(v) {
    if (!v) return '';
    try {
      const d = typeof v === 'string' || typeof v === 'number' ? new Date(v) : v;
      if (isNaN(d.getTime())) return String(v);
      return d.toLocaleString();
    } catch (e) {
      return String(v);
    }
  }

  async function fetchLessonById(id) {
    if (!window.supabase) return { data: null, error: new Error('Supabase not initialized') };
    let res = await window.supabase.from('lesson').select('*').eq('id', id).maybeSingle();
    if (res.data || !res.error) return res;
    res = await window.supabase.from('lesson').select('*').eq('lesson_id', id).maybeSingle();
    return res;
  }

  async function resolveCreator(users_id) {
    if (!users_id || !window.supabase) return '';
    const { data, error } = await window.supabase
      .from('users')
      .select('users_fname, users_lname')
      .eq('users_id', users_id)
      .maybeSingle();
    if (error || !data) return '';
    return [data.users_fname, data.users_lname].filter(Boolean).join(' ');
  }

  function showRow(rowEl, valEl, value) {
    if (!rowEl || !valEl) return;
    if (value === null || value === undefined || value === '') {
      rowEl.style.display = 'none';
    } else {
      valEl.textContent = String(value);
      rowEl.style.display = '';
    }
  }

  async function load() {
    const queryId = getQueryId();
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        const target = queryId
          ? `/EduPilot/html/teacher/editLesson.html?id=${encodeURIComponent(queryId)}`
          : `/EduPilot/html/teacher/editLesson.html`;
        window.location.href = target;
      });
    }
    if (!queryId) {
      setHeader('', 'Lesson');
      return;
    }

    try {
      const { data, error } = await fetchLessonById(queryId);
      if (error) {
        console.error('Failed to fetch lesson', error);
        setHeader(queryId, 'Lesson');
        return;
      }

      const titleVal = data?.title || data?.lesson_title || data?.name || data?.lesson_desc || 'Lesson';
      const idVal = data?.lesson_id || data?.id || queryId;
      setHeader(idVal, titleVal);
      // ensure Edit button uses canonical id
      if (editBtn) {
        editBtn.onclick = () => {
          const target = `/EduPilot/html/teacher/editLesson.html?id=${encodeURIComponent(idVal)}`;
          window.location.href = target;
        };
      }

      // Details
      const prereq = data?.lesson_prereq ?? '';
      const est = data?.lesson_estimated_hours ?? data?.lesson_est_hrs ?? '';
      const credit = data?.lesson_credit_pts ?? '';
      const modified = data?.lesson_modified ? fmtDate(data?.lesson_modified) : '';
      const created = data?.lesson_date_created ? fmtDate(data?.lesson_date_created) : '';

      // Resolve creator name
      const creatorName = await resolveCreator(data?.users_id || data?.user_id);

      // Resolve prerequisite display as "id - title"
      if (prereq !== '' && prereq !== null && prereq !== undefined && window.supabase) {
        try {
          const { data: pre, error: preErr } = await window.supabase
            .from('lesson')
            .select('lesson_id, lesson_title')
            .eq('lesson_id', prereq)
            .maybeSingle();
          if (!preErr && pre) {
            const title = pre.lesson_title ?? '';
            showRow(rowPrereq, valPrereq, `${pre.lesson_id} - ${title}`);
          } else {
            showRow(rowPrereq, valPrereq, prereq);
          }
        } catch (_) {
          showRow(rowPrereq, valPrereq, prereq);
        }
      } else {
        showRow(rowPrereq, valPrereq, '');
      }
      showRow(rowCreator, valCreator, creatorName);
      showRow(rowEst, valEst, est);
      showRow(rowCredit, valCredit, credit);
      showRow(rowModified, valModified, modified);
      showRow(rowCreated, valCreated, created);

      // Sections
      if (descEl) descEl.textContent = data?.lesson_desc || '';
      if (objEl) objEl.textContent = data?.lesson_objective || '';
    } catch (e) {
      console.error('Unexpected error', e);
      setHeader(queryId, 'Lesson');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
