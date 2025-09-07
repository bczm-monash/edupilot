// Create Lesson page logic: loads prerequisites and inserts lesson to Supabase
(function () {
  async function ensureAuth() {
    if (!window.supabase) return { user: null };
    const { data, error } = await window.supabase.auth.getUser();
    if (error || !data?.user) return { user: null };
    return { user: data.user };
  }

  async function loadPrerequisites() {
    const select = document.getElementById('prerequisite');
    if (!window.supabase || !select) return;

    // Reset options and add default 'None'
    select.innerHTML = '';
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'None';
    select.appendChild(none);

    const { data, error } = await window.supabase
      .from('lesson')
      .select('lesson_id, lesson_desc')
      .order('lesson_id', { ascending: true });

    if (error) {
      console.error('Failed to load prerequisites:', error);
      return;
    }

    (data || []).forEach((row) => {
      const opt = document.createElement('option');
      opt.value = row.lesson_id;
      opt.textContent = `${row.lesson_id} — ${row.lesson_desc ?? ''}`.trim();
      select.appendChild(opt);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('createLessonForm');
    const idEl = document.getElementById('lessonId');
    const titleEl = document.getElementById('title');
    const descEl = document.getElementById('description');
    const prereqEl = document.getElementById('prerequisite');
    const creditEl = document.getElementById('creditPoints');

    // Populate prerequisite dropdown from DB
    loadPrerequisites();

    // We do not expose the user id in the form; we read it from auth during submit.

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

        const lesson_id = idEl.value.trim();
        const lesson_desc = descEl.value.trim();
        const lesson_title = titleEl ? titleEl.value.trim() : '';
        const lesson_prereq = prereqEl.value ? prereqEl.value : null;
        const users_id = user.id;
        const nowIso = new Date().toISOString();
        const credit_pts = (function() {
          if (!creditEl) return null;
          const v = creditEl.value;
          if (v === '' || v === null || typeof v === 'undefined') return null;
          const n = parseInt(v, 10);
          return Number.isNaN(n) ? null : n;
        })();

        if (!lesson_id || !lesson_desc) {
          alert('Please fill in Lesson ID and Description.');
          return;
        }

        console.log(users_id);
        const payload = {
          lesson_id,
          lesson_title,
          lesson_desc,
          lesson_credit_pts: credit_pts,
          lesson_prereq,
          users_id,
          lesson_date_created: nowIso,
          lesson_modified: nowIso,
        };


        try {
          const { data, error } = await window.supabase
            .from('lesson')
            .insert([payload])
            .select();

          if (error) {
            alert(`Create failed: ${error.message}`);
            return;
          }

          alert('Lesson created successfully.');
          if (typeof toLesson === 'function') toLesson();
        } catch (err) {
          alert(`Unexpected error: ${err.message || err}`);
        }
      });
    }
  });
})();
