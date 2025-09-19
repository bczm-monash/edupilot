(function () {
  async function ensureAuth() {
    if (!window.supabase) return { user: null };
    const { data, error } = await window.supabase.auth.getUser();
    if (error || !data?.user) return { user: null };
    return { user: data.user };
  }

  function nowIsoUtcPlus8() {
    const now = new Date();
    const plus8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const iso = plus8.toISOString();
    return iso.slice(0, 19) + '+08:00';
  }

  const lessonCredits = {};

  async function loadLessonsForCourseSelect() {
    const select = document.getElementById('courseLessons');
    if (!window.supabase || !select) return;

    select.innerHTML = '';
    const { data, error } = await window.supabase
      .from('lesson')
      .select('lesson_id, lesson_title, lesson_credit_pts')
      .order('lesson_id', { ascending: true });

    if (error) {
      console.error('Failed to load lessons for course select:', error);
      return;
    }

    (data || []).forEach((row) => {
      lessonCredits[row.lesson_id] = (row.lesson_credit_pts == null) ? 0 : Number(row.lesson_credit_pts);
      const opt = document.createElement('option');
      opt.value = row.lesson_id;
      const title = row.lesson_title ?? '';
      const cp = (row.lesson_credit_pts == null) ? '' : ` (CP: ${row.lesson_credit_pts})`;
      opt.textContent = `${row.lesson_id} - ${title}${cp}`.trim();
      select.appendChild(opt);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const courseForm = document.getElementById('createCourseForm');
    const courseIdEl = document.getElementById('courseId');
    const courseTitleEl = document.getElementById('courseTitle');
    const courseDescEl = document.getElementById('courseDescription');
    const courseLessonsEl = document.getElementById('courseLessons');
    const courseCreditEl = document.getElementById('courseCreditPoints');
    const courseEstimatedHoursEl = document.getElementById('courseEstimatedHours');

    const courseStatusEl = document.getElementById('courseStatus');
    const courseTotalCreditPointsEl = document.getElementById('courseTotalCreditPoints');

    loadLessonsForCourseSelect();

    if (!courseForm) return;

    courseForm.addEventListener('submit', async (e) => {
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

      const course_id = courseIdEl ? courseIdEl.value.trim() : '';
      const course_title = courseTitleEl ? courseTitleEl.value.trim() : '';
      const course_desc = courseDescEl ? courseDescEl.value.trim() : '';

      let selectedLessons = [];
      if (courseLessonsEl) {
        const opts = Array.from(courseLessonsEl.options || []);
        selectedLessons = opts.filter(o => o.selected).map(o => o.value);
      }

      const computedTotalCreditPoints = selectedLessons.reduce((sum, lid) => {
        const v = lessonCredits[lid];
        return sum + (typeof v === 'number' ? v : 0);
      }, 0);

      if (courseTotalCreditPointsEl) {
        courseTotalCreditPointsEl.value = computedTotalCreditPoints;
      }

      const users_id = user.id;
      const nowIso = nowIsoUtcPlus8();

      const course_credit_pts = (function() {
        if (!courseCreditEl) return null;
        const v = courseCreditEl.value;
        if (v === '' || v === null || typeof v === 'undefined') return null;
        const n = parseInt(v, 10);
        return Number.isNaN(n) ? null : n;
      })();

      const course_estimated_hours = (function() {
        if (!courseEstimatedHoursEl) return null;
        const v = courseEstimatedHoursEl.value;
        if (v === '' || v === null || typeof v === 'undefined') return null;
        const n = parseInt(v, 10);
        return Number.isNaN(n) ? null : n;
      })();

      if (!course_id || !course_title) {
        alert('Please fill in Course ID and Course Title.');
        return;
      }

      const status = (courseStatusEl && courseStatusEl.value) ? String(courseStatusEl.value).trim() : 'draft'; 
      const allowedStatuses = ['draft', 'published', 'archived']; 
      const course_status = allowedStatuses.includes(status) ? status : 'draft';

      const payload = {
        course_id,
        course_title,
        course_desc,
        course_lessons: selectedLessons,
        course_credit_pts,
        course_total_credit_pts: computedTotalCreditPoints,
        course_est_hrs: course_estimated_hours,
        users_id,
        course_date_created: nowIso,
        course_modified: nowIso,
        course_status,
      };

      try {
        const { error } = await window.supabase
          .from('course')
          .insert([payload]);

        if (error) {
          const msg = String(error.message || '');
          const details = String(error.details || '');
          const isUniqueViolation =
            error.code === '23505' ||
            /duplicate key|unique constraint|already exists/i.test(msg) ||
            /course_pk|unique/i.test(details);

          if (isUniqueViolation) {
            alert('A course with this Course ID already exists. Please choose a different Course ID.');
          } else {
            alert(`Create course failed: ${error.message}`);
          }
          return;
        }

        alert('Course created successfully.');
        if (typeof toCourse === 'function') toCourse();
      } catch (err) {
        alert(`Unexpected error: ${err.message || err}`);
      }
    });
  });
})();
