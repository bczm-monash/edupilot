(function () {
  const lessonListEl = document.getElementById('lessonList');
  const studentListEl = document.getElementById('studentList');
  const headerTitleEl = document.getElementById('classroomHeader');

  let supabaseClient = null;
  let classroomId = '';

  function normaliseDate(dateText) {
    if (!dateText) return '';
    const parts = String(dateText).split(/[-/]/);
    if (parts.length === 3) {
      const [a, b, c] = parts;
      if (a.length === 4) return `${c.padStart(2, '0')}/${b.padStart(2, '0')}/${a}`;
      if (c.length === 4) return `${a.padStart(2, '0')}/${b.padStart(2, '0')}/${c}`;
    }
    return dateText;
  }

  function ensureSupabaseReady(retry = 0) {
    return new Promise((resolve) => {
      if (window.supabase) {
        resolve(window.supabase);
        return;
      }
      if (retry > 6) {
        resolve(null);
        return;
      }
      setTimeout(() => {
        ensureSupabaseReady(retry + 1).then(resolve);
      }, 150 * (retry + 1));
    });
  }

  function assignText(id, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text ?? '';
  }

  function computeDurationDays(start, end) {
    if (!start || !end) return '';
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return '';
    const diff = endDate.getTime() - startDate.getTime();
    if (!Number.isFinite(diff) || diff < 0) return '';
    const days = Math.floor(diff / (24 * 60 * 60 * 1000)) + 1;
    return days > 0 ? String(days) : '';
  }

  function renderLessons(lessons) {
    if (!lessonListEl) return;
    lessonListEl.innerHTML = '';

    if (!Array.isArray(lessons) || !lessons.length) {
      const li = document.createElement('li');
      li.textContent = 'No lessons linked to this classroom yet.';
      li.style.listStyle = 'none';
      li.style.margin = '12px';
      lessonListEl.appendChild(li);
      return;
    }

    const frag = document.createDocumentFragment();
    lessons.forEach((lesson) => {
      const li = document.createElement('li');
      li.className = 'lesson-card';
      li.dataset.id = lesson.lesson_id || '';

      const title = document.createElement('div');
      title.className = 'lesson-title';
      title.textContent = lesson.lesson_title || 'Untitled lesson';

      const metaId = document.createElement('div');
      metaId.className = 'lesson-meta';
      metaId.textContent = `ID: ${lesson.lesson_id || '-'}`;

      const metaOwner = document.createElement('div');
      metaOwner.className = 'lesson-meta';
      if (lesson.owner_name) metaOwner.textContent = `Owner: ${lesson.owner_name}`;

      const metaCredit = document.createElement('div');
      metaCredit.className = 'lesson-meta';
      if (lesson.lesson_credit_pts !== undefined && lesson.lesson_credit_pts !== null) {
        metaCredit.textContent = `Credit Points: ${lesson.lesson_credit_pts}`;
      }

      const metaDesc = document.createElement('div');
      metaDesc.className = 'lesson-desc';
      if (lesson.lesson_desc) metaDesc.textContent = lesson.lesson_desc;

      li.appendChild(title);
      li.appendChild(metaId);
      if (metaOwner.textContent) li.appendChild(metaOwner);
      if (metaCredit.textContent) li.appendChild(metaCredit);
      if (metaDesc.textContent) li.appendChild(metaDesc);

      li.addEventListener('click', () => {
        if (!lesson.lesson_id) return;
        const url = `/EduPilot/html/student/sLesson_content.html?id=${encodeURIComponent(lesson.lesson_id)}`;
        window.location.href = url;
      });

      frag.appendChild(li);
    });

    lessonListEl.appendChild(frag);
  }

  function renderStudents(students) {
    if (!studentListEl) return;
    studentListEl.innerHTML = '';

    if (!Array.isArray(students) || !students.length) {
      const li = document.createElement('li');
      li.textContent = 'No other students enrolled yet.';
      studentListEl.appendChild(li);
      return;
    }

    students.forEach((row) => {
      const user = row.users || {};
      const parts = [user.users_fname, user.users_lname].filter(Boolean);
      const name = parts.length ? parts.join(' ') : (user.users_email || row.users_id || 'Student');
      const email = user.users_email ? ` (${user.users_email})` : '';

      const li = document.createElement('li');
      li.textContent = `${name}${email}`;
      studentListEl.appendChild(li);
    });
  }

  async function fetchClassroomDetails() {
    const { data, error } = await supabaseClient
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
      .eq('classroom_id', Number(classroomId))
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async function fetchLessons() {
    const { data, error } = await supabaseClient
      .from('classroom_lesson')
      .select('lesson_id, lesson:lesson_id (lesson_id, lesson_title, lesson_credit_pts, lesson_desc, users_id)')
      .eq('classroom_id', String(classroomId));

    if (error) throw error;

    return (data || [])
      .map((row) => row.lesson || {})
      .filter((lesson) => lesson.lesson_id);
  }

  async function enrichLessonOwners(lessons) {
    const ids = Array.from(new Set(
      lessons.map((lesson) => lesson.users_id).filter(Boolean)
    ));
    if (!ids.length) return lessons;

    const { data, error } = await supabaseClient
      .from('users')
      .select('users_id, users_fname, users_lname')
      .in('users_id', ids);

    if (error) return lessons;

    const nameById = new Map((data || []).map((user) => [user.users_id, [user.users_fname, user.users_lname].filter(Boolean).join(' ')]));
    lessons.forEach((lesson) => {
      const name = nameById.get(lesson.users_id);
      if (name) lesson.owner_name = name;
    });

    return lessons;
  }

  async function fetchStudents() {
    const { data, error } = await supabaseClient
      .from('classmate')
      .select('users_id, users:users_id (users_fname, users_lname, users_email)')
      .eq('classroom_id', Number(classroomId));

    if (error) throw error;
    return data || [];
  }

  function ensureStudentAccess(record) {
    if (!record) return false;
    const courseId = record.course_id;
    if (!courseId) return true;
    // optional: enforce that student is enrolled in parent course
    return true;
  }

  async function initialise() {
    classroomId = new URLSearchParams(window.location.search).get('id')?.trim() || '';
    if (!classroomId) {
      alert('Missing classroom ID.');
      toSClassroom?.();
      return;
    }

    supabaseClient = await ensureSupabaseReady();
    if (!supabaseClient) {
      alert('Supabase client not ready. Please refresh.');
      return;
    }

    try {
      const record = await fetchClassroomDetails();
      if (!ensureStudentAccess(record)) {
        alert('You do not have access to this classroom.');
        toSClassroom?.();
        return;
      }

      const instructorName = (() => {
        const user = record?.users;
        if (!user) return record?.users_id || '-';
        const parts = [user.users_fname, user.users_lname].filter(Boolean);
        return parts.length ? parts.join(' ') : (record?.users_id || '-');
      })();

      const title = record?.classroom_title || 'Classroom';
      // if (headerTitleEl) headerTitleEl.textContent = title;

      assignText('valClassName', title);
      assignText('valClassID', record?.classroom_id ?? '-');
      assignText('valInstructor', instructorName);
      assignText('valStart', normaliseDate(record?.classroom_start_date));
      assignText('valEnd', normaliseDate(record?.classroom_end_date));
      assignText('valCourseID', record?.course_id ?? '-');
      assignText('valModified', record?.classroom_modified ?? '-');
      assignText('valCreated', record?.classroom_created ?? '-');

      const lessons = await fetchLessons();
      await enrichLessonOwners(lessons);
      renderLessons(lessons);

      const students = await fetchStudents();
      renderStudents(students);
    } catch (error) {
      console.error('Failed to load classroom content:', error);
      alert('Failed to load classroom.');
      toSClassroom?.();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialise);
  } else {
    initialise();
  }
})();
