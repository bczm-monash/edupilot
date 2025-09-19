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

  async function loadCourses() {
    const select = document.getElementById('courseSelect');
    if (!window.supabase || !select) return;

    select.innerHTML = '';
    const { data, error } = await window.supabase
      .from('course')
      .select('course_id, course_desc')
      .order('course_id', { ascending: true });

    if (error) {
      console.error('Failed to load courses:', error);
      return;
    }

    (data || []).forEach((row) => {
      const opt = document.createElement('option');
      opt.value = row.course_id;
      opt.textContent = `${row.course_id} - ${row.course_desc}`;
      select.appendChild(opt);
    });
  }

  async function loadStudentsForCourse(courseId) {
    const studentSelect = document.getElementById('studentSelect');
    if (!window.supabase || !studentSelect) return;

    studentSelect.innerHTML = '';

    if (!courseId) return;

    const { data, error } = await window.supabase
      .from('enrolment')
      .select('user_id, users(users_fname, users_lname, users_email)')
      .eq('course_id', courseId);

    if (error) {
      console.error('Failed to load students:', error);
      return;
    }

    (data || []).forEach((row) => {
      const opt = document.createElement('option');
      opt.value = row.user_id;
      opt.textContent = `${row.users.users_fname} ${row.users.users_lname} (${row.users.users_email})`;
      studentSelect.appendChild(opt);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('createClassroomForm');
    const idEl = document.getElementById('classroomId');
    const nameEl = document.getElementById('classroomName');
    const courseEl = document.getElementById('courseSelect');
    const startEl = document.getElementById('startDate');
    const durationEl = document.getElementById('durationHours');
    const studentSelect = document.getElementById('studentSelect');

    loadCourses();

    if (!form) return;

    // auto-load students when course changes
    if (courseEl) {
      courseEl.addEventListener('change', () => {
        loadStudentsForCourse(courseEl.value);
      });
    }

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

      const classroom_id = parseInt(idEl.value, 10);
      const classroom_name = nameEl.value.trim();
      const course_id = courseEl.value;
      const start_date = startEl.value;
      const duration_hours = parseInt(durationEl.value, 10) || 0;

      const end_date = (() => {
        if (!start_date || !duration_hours) return null;
        const start = new Date(start_date);
        start.setHours(start.getHours() + duration_hours);
        return start.toISOString();
      })();

      const selectedStudents = Array.from(studentSelect.options)
        .filter((o) => o.selected)
        .map((o) => o.value);

      if (!classroom_id || !classroom_name || !course_id || !start_date) {
        alert('Please fill in all required fields.');
        return;
      }

      const nowIso = nowIsoUtcPlus8();
      const payload = {
        classroom_id,
        users_id: user.id,
        course_id,
        classroom_name,
        classroom_start: start_date,
        classroom_duration: duration_hours,
        classroom_end: end_date,
        classroom_created: nowIso,
        classroom_modified: nowIso,
      };

      try {
        const { error } = await window.supabase
          .from('classroom')
          .insert([payload]);

        if (error) {
          alert(`Create classroom failed: ${error.message}`);
          return;
        }

        // insert selected students into classmate table
        if (selectedStudents.length > 0) {
          const classmatesPayload = selectedStudents.map((sid) => ({
            users_id: sid,
            classroom_id,
          }));

          const { error: cmError } = await window.supabase
            .from('classmate')
            .insert(classmatesPayload);

          if (cmError) {
            console.error('Failed to add classmates:', cmError);
          }
        }

        alert('Classroom created successfully.');
        if (typeof toClassroom === 'function') toClassroom();
      } catch (err) {
        alert(`Unexpected error: ${err.message || err}`);
      }
    });
  });
})();
