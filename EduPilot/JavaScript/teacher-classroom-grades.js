(function () {
  const supabaseClient = () => window.supabase;

  const params = new URLSearchParams(window.location.search);
  const classroomId = params.get('id')?.trim() || '';

  const backBtn = document.getElementById('backBtn');
  const titleEl = document.getElementById('classroomTitle');
  const metaEl = document.getElementById('classroomMeta');
  const progressTableBody = document.getElementById('progressTableBody');
  const lessonContainer = document.getElementById('lessonGradesContainer');

  const gradeOptions = ['Not Graded', 'Pass', 'Fail'];

  let lessons = [];
  let students = [];
  const gradeMap = new Map();

  function classForGrade(value) {
    switch ((value || '').toLowerCase()) {
      case 'pass':
        return 'pass';
      case 'fail':
        return 'fail';
      default:
        return 'pending';
    }
  }

  function normaliseGrade(value) {
    if (!value) return 'Not Graded';
    const normalised = value.trim().toLowerCase();
    if (normalised === 'pass') return 'Pass';
    if (normalised === 'fail') return 'Fail';
    return 'Not Graded';
  }

  function keyFor(studentId, lessonId) {
    return `${studentId}::${lessonId}`;
  }

  async function fetchClassroomDetails() {
    const supabase = supabaseClient();
    if (!supabase || !classroomId) return;

    const { data, error } = await supabase
      .from('classroom')
      .select(`
        classroom_id,
        classroom_title,
        classroom_start_date,
        classroom_end_date,
        course_id,
        course:course_id (course_title)
      `)
      .eq('classroom_id', classroomId)
      .maybeSingle();

    if (error) {
      console.error('Failed to load classroom details:', error);
      return;
    }

    if (titleEl) {
      titleEl.textContent = data?.classroom_title || 'Classroom Grades';
    }

    if (metaEl) {
      const parts = [];
      if (data?.course) {
        parts.push(`Course: ${data.course.course_title || data.course_id}`);
      } else if (data?.course_id) {
        parts.push(`Course: ${data.course_id}`);
      }
      if (data?.classroom_start_date) {
        const start = new Date(data.classroom_start_date);
        parts.push(`Start: ${start.toLocaleDateString()}`);
      }
      if (data?.classroom_end_date) {
        const end = new Date(data.classroom_end_date);
        parts.push(`End: ${end.toLocaleDateString()}`);
      }
      metaEl.textContent = parts.join(' • ');
    }
  }

  async function fetchLessons() {
    const supabase = supabaseClient();
    if (!supabase || !classroomId) return [];

    const { data: links, error: linkError } = await supabase
      .from('classroom_lesson')
      .select('lesson_id')
      .eq('classroom_id', classroomId)
      .order('lesson_id', { ascending: true });

    if (linkError) {
      console.error('Failed to load classroom lessons:', linkError);
      return [];
    }

    const lessonIds = (links || []).map((row) => row.lesson_id).filter(Boolean);
    if (!lessonIds.length) return [];

    const { data: lessonsData, error: lessonsError } = await supabase
      .from('lesson')
      .select('lesson_id, lesson_title')
      .in('lesson_id', lessonIds);

    if (lessonsError) {
      console.error('Failed to load lesson details:', lessonsError);
      return [];
    }

    const byId = new Map((lessonsData || []).map((row) => [row.lesson_id, row]));
    return lessonIds.map((id) => byId.get(id)).filter(Boolean);
  }

  async function fetchStudents() {
    const supabase = supabaseClient();
    if (!supabase || !classroomId) return [];

    const { data: classmates, error: classmateError } = await supabase
      .from('classmate')
      .select('users_id')
      .eq('classroom_id', classroomId)
      .order('users_id', { ascending: true });

    if (classmateError) {
      console.error('Failed to load classroom students:', classmateError);
      return [];
    }

    const userIds = (classmates || []).map((row) => row.users_id).filter(Boolean);
    if (!userIds.length) return [];

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('users_id, users_fname, users_lname, users_email')
      .in('users_id', userIds);

    if (usersError) {
      console.error('Failed to load student details:', usersError);
      return [];
    }

    const infoById = new Map((users || []).map((row) => [row.users_id, row]));

    return userIds.map((id) => {
      const user = infoById.get(id) || {};
      const name = [user.users_fname, user.users_lname].filter(Boolean).join(' ').trim();
      return {
        id,
        name: name || user.users_email || id || 'Student',
        email: user.users_email || '',
      };
    });
  }

  async function fetchGrades() {
    const supabase = supabaseClient();
    if (!supabase || !classroomId) return;

    const { data, error } = await supabase
      .from('grades')
      .select('*')
      .eq('classroom_id', classroomId);

    if (error) {
      console.error('Failed to load grades:', error);
      return;
    }

    gradeMap.clear();
    (data || []).forEach((row) => {
      const grade = normaliseGrade(row.grade);
      gradeMap.set(keyFor(row.users_id, row.lesson_id), grade);
    });
  }

  function getGrade(studentId, lessonId) {
    return gradeMap.get(keyFor(studentId, lessonId)) || 'Not Graded';
  }

  function renderOverallProgress() {
    if (!progressTableBody) return;

    progressTableBody.innerHTML = '';

    if (!students.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.className = 'muted';
      cell.colSpan = 3;
      cell.textContent = 'No students enrolled yet.';
      row.appendChild(cell);
      progressTableBody.appendChild(row);
      return;
    }

    if (!lessons.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.className = 'muted';
      cell.colSpan = 3;
      cell.textContent = 'No lessons linked to this classroom yet.';
      row.appendChild(cell);
      progressTableBody.appendChild(row);
      return;
    }

    students.forEach((student) => {
      const row = document.createElement('tr');
      const passCount = lessons.reduce((count, lesson) => {
        return count + (getGrade(student.id, lesson.lesson_id) === 'Pass' ? 1 : 0);
      }, 0);
      const total = lessons.length;
      const percent = total ? Math.round((passCount / total) * 100) : 0;

      const nameCell = document.createElement('td');
      nameCell.textContent = student.name;

      const progressCell = document.createElement('td');
      progressCell.textContent = `${passCount}/${total} lessons`;

      const percentCell = document.createElement('td');
      percentCell.textContent = `${percent}%`;

      row.appendChild(nameCell);
      row.appendChild(progressCell);
      row.appendChild(percentCell);
      progressTableBody.appendChild(row);
    });
  }

  function createGradeRow(student, lesson) {
    const row = document.createElement('tr');
    row.className = 'lesson-grade-row';

    const nameCell = document.createElement('td');
    nameCell.textContent = student.name;

    const gradeCell = document.createElement('td');
    const select = document.createElement('select');
    select.className = 'grade-select';
    select.dataset.studentId = student.id;
    select.dataset.lessonId = lesson.lesson_id;

    gradeOptions.forEach((option) => {
      const opt = document.createElement('option');
      opt.value = option;
      opt.textContent = option;
      select.appendChild(opt);
    });

    const currentGrade = getGrade(student.id, lesson.lesson_id);
    select.value = currentGrade;
    select.dataset.prev = currentGrade;

    const status = document.createElement('span');
    status.className = `grade-status ${classForGrade(currentGrade)}`;
    status.textContent = currentGrade;

    select.addEventListener('change', async (event) => {
      const value = event.target.value;
      const prev = event.target.dataset.prev || 'Not Graded';
      const studentId = event.target.dataset.studentId;
      const lessonId = event.target.dataset.lessonId;
      event.target.disabled = true;

      try {
        await saveGrade(studentId, lessonId, value);
        event.target.dataset.prev = value;
        status.className = `grade-status ${classForGrade(value)}`;
        status.textContent = value;
        renderOverallProgress();
      } catch (err) {
        console.error('Failed to save grade:', err);
        alert('Failed to save grade. Please try again.');
        event.target.value = prev;
      } finally {
        event.target.disabled = false;
      }
    });

    gradeCell.appendChild(select);
    gradeCell.appendChild(status);

    row.appendChild(nameCell);
    row.appendChild(gradeCell);
    return row;
  }

  function renderLessonSections() {
    if (!lessonContainer) return;

    lessonContainer.innerHTML = '';

    if (!lessons.length) {
      const card = document.createElement('div');
      card.className = 'grades-card';
      card.innerHTML = '<h3>Lessons</h3><p class="muted">No lessons linked to this classroom yet.</p>';
      lessonContainer.appendChild(card);
      return;
    }

    if (!students.length) {
      const card = document.createElement('div');
      card.className = 'grades-card';
      card.innerHTML = '<h3>Lessons</h3><p class="muted">No students enrolled yet.</p>';
      lessonContainer.appendChild(card);
      return;
    }

    lessons.forEach((lesson) => {
      const card = document.createElement('div');
      card.className = 'lesson-grade-card';

      const heading = document.createElement('h4');
      heading.textContent = lesson.lesson_title || `Lesson ${lesson.lesson_id}`;
      card.appendChild(heading);

      const table = document.createElement('table');
      table.className = 'lesson-grade-list';

      const tbody = document.createElement('tbody');
      students.forEach((student) => {
        tbody.appendChild(createGradeRow(student, lesson));
      });

      table.appendChild(tbody);
      card.appendChild(table);
      lessonContainer.appendChild(card);
    });
  }

  async function saveGrade(studentId, lessonId, grade) {
    const supabase = supabaseClient();
    if (!supabase || !classroomId) throw new Error('Supabase not ready.');

    const normalised = normaliseGrade(grade);
    const payload = {
      users_id: studentId,
      classroom_id: classroomId,
      lesson_id: lessonId,
      grade: normalised,
      marked_as_done: normalised === 'Pass' ? 'Yes' : (normalised === 'Fail' ? 'No' : null),
    };

    const { error } = await supabase
      .from('grades')
      .upsert(payload, { onConflict: 'users_id,classroom_id,lesson_id' });

    if (error) {
      throw error;
    }

    gradeMap.set(keyFor(studentId, lessonId), normalised);
  }

  async function initialise() {
    if (!classroomId) {
      alert('Missing classroom ID.');
      return;
    }

    if (backBtn) {
      backBtn.addEventListener('click', () => {
        const url = `/EduPilot/html/teacher/classroom_content.html?id=${encodeURIComponent(classroomId)}`;
        window.location.href = url;
      });
    }

    await fetchClassroomDetails();
    lessons = await fetchLessons();
    students = await fetchStudents();
    await fetchGrades();

    renderOverallProgress();
    renderLessonSections();
  }

  function bootstrap() {
    if (supabaseClient()) {
      initialise();
    } else {
      document.addEventListener('supabase-ready', initialise, { once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
