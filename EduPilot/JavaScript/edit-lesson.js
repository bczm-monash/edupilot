(function () {
  const form = document.getElementById('editLessonForm');
  const idEl = document.getElementById('lessonId');
  const titleEl = document.getElementById('title');
  const descEl = document.getElementById('description');
  const objectiveEl = document.getElementById('objective');
  const prereqEl = document.getElementById('prerequisite');
  const creditEl = document.getElementById('creditPoints');
  const estEl = document.getElementById('estimatedHours');

  let fetchedRow = null;

  async function waitForSupabase(maxWaitMs = 3000) {
    const start = Date.now();
    while (!window.supabase && Date.now() - start < maxWaitMs) {
      await new Promise(r => setTimeout(r, 50));
    }
    return !!window.supabase;
  }

  function getQueryId() {
    const p = new URLSearchParams(window.location.search);
    const v = p.get('id');
    return (v == null ? '' : String(v)).trim();
  }

  async function fetchLessonById(id) {
    if (!window.supabase) return { data: null, error: new Error('Supabase not initialized') };
    const idNum = !isNaN(Number(id)) ? Number(id) : null;
    let res;
    if (idNum !== null) {
      res = await window.supabase
        .from('lesson')
        .select('lesson_id, lesson_title, lesson_desc, lesson_objective, lesson_prereq, lesson_credit_pts, lesson_estimated_hours, lesson_est_hrs, lesson_date_created, lesson_modified, users_id, id')
        .eq('lesson_id', idNum)
        .maybeSingle();
      if (res?.data) {
        console.debug('[EditLesson] Matched by numeric lesson_id', idNum);
        return res;
      }
    }
    res = await window.supabase
      .from('lesson')
      .select('lesson_id, lesson_title, lesson_desc, lesson_objective, lesson_prereq, lesson_credit_pts, lesson_estimated_hours, lesson_est_hrs, lesson_date_created, lesson_modified, users_id, id')
      .eq('lesson_id', id)
      .maybeSingle();
    if (res?.data) {
      console.debug('[EditLesson] Matched by string lesson_id', id);
      return res;
    }
    res = await window.supabase
      .from('lesson')
      .select('lesson_id, lesson_title, lesson_desc, lesson_objective, lesson_prereq, lesson_credit_pts, lesson_estimated_hours, lesson_est_hrs, lesson_date_created, lesson_modified, users_id, id')
      .eq('id', id)
      .maybeSingle();
    if (res?.data) {
      console.debug('[EditLesson] Matched by fallback id column', id);
      return res;
    }
    console.warn('[EditLesson] No match for id', id, 'numeric', idNum);
    return res;
  }

  async function populatePrereqOptions(currentId, selectedPrereq) {
    if (!window.supabase || !prereqEl) return;
    try {
      const { data, error } = await window.supabase
        .from('lesson')
        .select('lesson_id, lesson_title')
        .order('lesson_id', { ascending: true });
      if (error) { console.warn('Prereq fetch error', error); return; }
      prereqEl.innerHTML = '';
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = 'None';
      prereqEl.appendChild(empty);
      (data || []).forEach(row => {
        const opt = document.createElement('option');
        opt.value = row.lesson_id;
        const title = row.lesson_title ?? '';
        opt.textContent = `${row.lesson_id} - ${title}`.trim();
        // Avoid self-reference
        if (String(row.lesson_id) === String(currentId)) {
          opt.disabled = true;
        }
        prereqEl.appendChild(opt);
      });
      if (selectedPrereq !== null && selectedPrereq !== undefined && selectedPrereq !== '') {
        prereqEl.value = String(selectedPrereq);
      } else {
        prereqEl.value = '';
      }
    } catch (e) {
      console.warn('Failed to populate prerequisites', e);
    }
  }

  function fillForm(data) {
    if (!data) return;
    fetchedRow = data;
    if (idEl) idEl.value = data.lesson_id ?? data.id ?? '';
    if (titleEl) titleEl.value = data.lesson_title ?? data.title ?? data.name ?? '';
    if (descEl) descEl.value = data.lesson_desc ?? '';
    if (objectiveEl) objectiveEl.value = data.lesson_objective ?? '';
    if (creditEl) creditEl.value = data.lesson_credit_pts ?? '';
    const estVal = data.lesson_estimated_hours ?? data.lesson_est_hrs ?? '';
    if (estEl) estEl.value = estVal;
  }

  async function load() {
    const id = getQueryId();
    if (!id) { alert('Missing lesson id.'); return; }

    // Show the incoming id immediately for user feedback
    if (idEl) idEl.value = id;

    // Ensure supabase client is ready
    await waitForSupabase();
    const { data, error } = await fetchLessonById(id);
    if (error || !data) {
      console.error('EditLesson: fetch failed', { id, error });
      alert('Lesson not found for id: ' + id);
      return;
    }
    fillForm(data);
    await populatePrereqOptions(data.lesson_id ?? data.id, data.lesson_prereq ?? '');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!window.supabase) { alert('Supabase not initialized.'); return; }
    if (!fetchedRow) { alert('Nothing to update.'); return; }

    const original_id = fetchedRow.lesson_id ?? fetchedRow.id;
    const lesson_id = (idEl?.value || '').trim();
    const lesson_title = (titleEl?.value || '').trim();
    const lesson_desc = (descEl?.value || '').trim();
    const lesson_objective = (objectiveEl?.value || '').trim();
    const lesson_prereq = prereqEl?.value ? Number(prereqEl.value) : null;
    const credit_pts = creditEl?.value !== '' ? Number(creditEl.value) : null;
    const est_hours_val = estEl?.value !== '' ? Number(estEl.value) : null;

    if (!lesson_title || !lesson_desc) { alert('Title and description are required.'); return; }

    const nowIso = new Date().toISOString();
    const updates = {
      lesson_title,
      lesson_desc,
      lesson_objective,
      lesson_prereq,
      lesson_credit_pts: credit_pts,
      lesson_modified: nowIso,
    };

    // Include potential primary key change
    if (lesson_id !== '' && String(lesson_id) !== String(original_id)) {
      updates.lesson_id = isNaN(Number(lesson_id)) ? lesson_id : Number(lesson_id);
    }

    // Pick the right estimated hours column based on fetched row shape
    if (Object.prototype.hasOwnProperty.call(fetchedRow, 'lesson_est_hrs')) {
      updates.lesson_est_hrs = est_hours_val;
    } else {
      updates.lesson_estimated_hours = est_hours_val;
    }

    try {
      // Update by original id to ensure row match even if id was edited
      const matchVal = isNaN(Number(original_id)) ? original_id : Number(original_id);
      let q = window.supabase.from('lesson').update(updates).eq('lesson_id', matchVal);
      let { error } = await q;
      if (error) {
        // fallback to id column if schema differs
        const r = await window.supabase.from('lesson').update(updates).eq('id', matchVal);
        error = r.error;
      }
      if (error) {
        console.error('Failed to update lesson', error);
        alert('Failed to save changes.');
        return;
      }
      alert('Lesson updated.');
      // Return to lesson content view
      const redirectId = (updates.lesson_id ?? lesson_id);
      window.location.href = `/EduPilot/html/teacher/lesson_content.html?id=${encodeURIComponent(redirectId)}`;
    } catch (err) {
      console.error('Unexpected update error', err);
      alert('Failed to save changes.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      load();
      form?.addEventListener('submit', handleSubmit);
    });
  } else {
    load();
    form?.addEventListener('submit', handleSubmit);
  }
})();
