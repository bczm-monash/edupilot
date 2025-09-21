(function () {
  function formatDisplayDate(isoDate) {
    if (!isoDate || typeof isoDate !== 'string') return '';
    const [year, month, day] = isoDate.split('-');
    if (!year || !month || !day) return '';
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }

  function parseLessonIds(value) {
    if (!value) return [];
    return value
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }

  function parseStudentIds(value) {
    if (!value) return [];
    return value
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }

  async function ensureAuth() {
    if (!window.supabase) return { user: null };
    const { data, error } = await window.supabase.auth.getUser();
    if (error || !data?.user) return { user: null };
    return { user: data.user };
  }

  async function handleCreateFormSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const classroomIdEl = document.getElementById('ClassroomID');
    const classroomNameEl = document.getElementById('ClassroomName');
    const startEl = document.getElementById('start');
    const endEl = document.getElementById('Duration');
    const courseEl = document.getElementById('courseID');
    const lessonsEl = document.getElementById('classroomLessons');
    const studentsEl = document.getElementById('classroomStudents');

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

    const classroomId = parseInt(classroomIdEl?.value, 10);
    const classroomTitle = (classroomNameEl?.value || '').trim();
    const startIso = startEl?.value || '';
    const endIso = endEl?.value || '';
    const courseId = courseEl?.value || '';
    const lessonIds = parseLessonIds(lessonsEl?.value || '');
    const studentIds = parseStudentIds(studentsEl?.value || '');

    if (!Number.isInteger(classroomId)) {
      alert('Please provide a valid classroom ID.');
      classroomIdEl?.focus();
      return;
    }

    if (!classroomTitle) {
      alert('Please provide a classroom name.');
      classroomNameEl?.focus();
      return;
    }

    if (!courseId) {
      alert('Please choose a course.');
      courseEl?.focus();
      return;
    }

    if (!startIso || !endIso) {
      alert('Please choose start and end dates.');
      return;
    }

    if (!lessonIds.length) {
      alert('Please select at least one lesson.');
      return;
    }

    if (!studentIds.length) {
      alert('Please select at least one student.');
      return;
    }

    const classroomPayload = {
      classroom_id: classroomId,
      classroom_title: classroomTitle,
      users_id: user.id,
      course_id: courseId,
      classroom_start_date: formatDisplayDate(startIso),
      classroom_end_date: formatDisplayDate(endIso),
    };

    try {
      const { error: classroomError } = await window.supabase
        .from('classroom')
        .insert([classroomPayload]);

      if (classroomError) {
        const msg = classroomError.message || 'Failed to create classroom.';
        alert(msg);
        return;
      }

      const lessonPayload = lessonIds.map((lessonId) => ({
        classroom_id: String(classroomId),
        lesson_id: lessonId,
      }));

      if (lessonPayload.length) {
        const { error: lessonError } = await window.supabase
          .from('classroom_lesson')
          .insert(lessonPayload);

        if (lessonError) {
          console.error('Failed to link classroom lessons:', lessonError);
        }
      }

      const studentPayload = studentIds.map((studentId) => ({
        classroom_id: classroomId,
        users_id: studentId,
      }));

      if (studentPayload.length) {
        const { error: studentError } = await window.supabase
          .from('classmate')
          .insert(studentPayload);

        if (studentError) {
          console.error('Failed to add classmates:', studentError);
        }
      }

      alert('Classroom created successfully.');
      if (typeof toTClassroom === 'function') {
        toTClassroom();
      }
    } catch (error) {
      const message = error?.message || 'Unexpected error creating classroom.';
      alert(message);
    }
  }

  function init() {
    const form = document.getElementById('createCourseForm');
    const submitButton = form?.querySelector('button[type="submit"]');

    if (!form || !submitButton) return;

    if (/create classroom/i.test(submitButton.textContent || '')) {
      form.addEventListener('submit', handleCreateFormSubmit);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
