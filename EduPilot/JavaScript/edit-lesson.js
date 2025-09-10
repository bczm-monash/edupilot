(function () {
  async function ensureAuth() {
    if (!window.supabase) return { user: null };
    const { data, error } = await window.supabase.auth.getUser();
    if (error || !data?.user) return { user: null };
    return { user: data.user };
  }

  function getQueryId() {
    const p = new URLSearchParams(window.location.search);
    return p.get('id') || '';
  }

  async function fetchLessonById(id) {
    if (!window.supabase) return { data: null, error: new Error('Supabase not initialized') };
    let res = await window.supabase.from('lesson').select('*').eq('id', id).maybeSingle();
    if (res?.data || !res?.error) return res;
    res = await window.supabase.from('lesson').select('*').eq('lesson_id', id).maybeSingle();
    return res;
  }

  async function loadPrerequisites(currentId, selectedPrereq) {
    const select = document.getElementById('prerequisite');
    if (!window.supabase || !select) return;

    select.innerHTML = '';
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'None';
    select.appendChild(none);

    const { data, error } = await window.supabase
      .from('lesson')
      .select('lesson_id, lesson_title')
      .order('lesson_id', { ascending: true });

    if (error) {
      console.error('Failed to load prerequisites:', error);
      return;
    }

    (data || []).forEach((row) => {
      const opt = document.createElement('option');
      opt.value = row.lesson_id;
      const title = row.lesson_title ?? '';
      opt.textContent = `${row.lesson_id} - ${title}`.trim();
      select.appendChild(opt);
    });

    if (selectedPrereq !== null && selectedPrereq !== undefined && selectedPrereq !== '') {
      select.value = selectedPrereq;
    } else {
      select.value = '';
    }
  }

  function parseIntOrNull(v) {
    if (v === '' || v === null || typeof v === 'undefined') return null;
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  }

  async function load() {
    function nowIsoUtcPlus8() {
      const now = new Date();
      const plus8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      const iso = plus8.toISOString();
      return iso.slice(0, 19) + '+08:00';
    }

    const form = document.getElementById('editLessonForm');
    const idEl = document.getElementById('lessonId');
    const titleEl = document.getElementById('title');
    const descEl = document.getElementById('description');
    const objectiveEl = document.getElementById('objective');
    const prereqEl = document.getElementById('prerequisite');
    const creditEl = document.getElementById('creditPoints');
    const estimatedHoursEl = document.getElementById('estimatedHours');

    const queryId = getQueryId();
    if (!queryId) {
      alert('Missing lesson id. Returning to lessons.');
      if (typeof toLesson === 'function') toLesson();
      return;
    }

    // Load current lesson
    try {
      const { data, error } = await fetchLessonById(queryId);
      if (error || !data) {
        alert('Failed to load lesson.');
        if (typeof toLesson === 'function') toLesson();
        return;
      }

      const idVal = data.lesson_id || data.id || queryId;
      if (idEl) idEl.value = idVal;
      if (titleEl) titleEl.value = data.lesson_title || '';
      if (descEl) descEl.value = data.lesson_desc || '';
      if (objectiveEl) objectiveEl.value = data.lesson_objective || '';
      if (creditEl) creditEl.value = data.lesson_credit_pts ?? '';
      if (estimatedHoursEl) {
        const hrs = data.lesson_estimated_hours ?? data.lesson_est_hrs;
        estimatedHoursEl.value = hrs ?? '';
      }

      await loadPrerequisites(idVal, data.lesson_prereq ?? '');

      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();

          if (!window.supabase) {
            alert('Supabase not initialized.');
            return;
          }

          const { user } = await ensureAuth();
          if (!user) {
            alert('Please log in first.');
            if (typeof toLogin === 'function') toLogin();
            return;
          }

          const payload = {
            lesson_title: titleEl ? titleEl.value.trim() : '',
            lesson_desc: descEl ? descEl.value.trim() : '',
            lesson_objective: objectiveEl ? objectiveEl.value.trim() : '',
            lesson_prereq: prereqEl && prereqEl.value !== '' ? prereqEl.value : null,
            lesson_credit_pts: parseIntOrNull(creditEl ? creditEl.value : null),
            lesson_est_hrs: parseIntOrNull(estimatedHoursEl ? estimatedHoursEl.value : null),
            lesson_modified: nowIsoUtcPlus8(),
          };

          if (!payload.lesson_desc) {
            alert('Description is required.');
            return;
          }

          try {
            const { data: updData, error: updErr } = await window.supabase
              .from('lesson')
              .update(payload)
              .eq('lesson_id', idVal)
              .select();

            if (updErr) {
              alert(`Update failed: ${updErr.message}`);
              return;
            }

            alert('Lesson updated successfully.');
            // Go back to the content page for this lesson
            window.location.href = `/EduPilot/html/teacher/lesson_content.html?id=${encodeURIComponent(idVal)}`;
          } catch (err) {
            alert(`Unexpected error: ${err.message || err}`);
          }
        });
      }
    } catch (e) {
      console.error('Unexpected error loading lesson:', e);
      alert('Unexpected error loading lesson.');
      if (typeof toLesson === 'function') toLesson();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
