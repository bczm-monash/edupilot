(function () {
  const GREETING_EL = document.getElementById('greeting');
  const MOTIVATION_EL = document.getElementById('motivation');
  const COURSE_COUNT_EL = document.getElementById('courseCount');
  const CLASSROOM_COUNT_EL = document.getElementById('classroomCount');
  const STUDENT_COUNT_EL = document.getElementById('studentCount');
  const BTN_BROWSE_COURSES = document.getElementById('browseCoursesBtn');
  const BTN_VIEW_CLASSROOMS = document.getElementById('viewClassroomsBtn');

  const QUOTES = [
    '“The art of teaching is the art of assisting discovery.” — Mark Van Doren',
    '“It is the supreme art of the teacher to awaken joy in creative expression and knowledge.” — Albert Einstein',
    '“Teaching kids to count is fine, but teaching them what counts is best.” — Bob Talbert',
    '“Education is not the filling of a pail, but the lighting of a fire.” — W.B. Yeats',
  ];

  function randomQuote() {
    return QUOTES[Math.floor(Math.random() * QUOTES.length)];
  }

  function waitForSupabase(retry = 0) {
    if (window.supabase) return Promise.resolve(window.supabase);
    if (retry > 6) return Promise.resolve(null);
    return new Promise((resolve) => {
      setTimeout(() => {
        waitForSupabase(retry + 1).then(resolve);
      }, 150 * (retry + 1));
    });
  }

  function formatName(user) {
    if (!user) return 'Instructor';
    const parts = [user.users_fname, user.users_lname].filter(Boolean);
    if (parts.length) return parts.join(' ');
    return 'Instructor';
  }

  function setupButtons() {
    if (BTN_BROWSE_COURSES) {
      BTN_BROWSE_COURSES.addEventListener('click', () => {
        window.location.href = '/EduPilot/html/teacher/tCourse.html';
      });
    }
    if (BTN_VIEW_CLASSROOMS) {
      BTN_VIEW_CLASSROOMS.addEventListener('click', () => {
        window.location.href = '/EduPilot/html/teacher/tClassroom.html';
      });
    }
  }

  function updateGreeting(profile) {
    if (GREETING_EL) {
      const name = formatName(profile);
      const hour = new Date().getHours();
      const salutation = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
      GREETING_EL.textContent = `${salutation}, ${name}`;
    }
    if (MOTIVATION_EL) {
      MOTIVATION_EL.textContent = randomQuote();
    }
  }

  function updateStats({ courses = 0, classrooms = 0, students = 0 }) {
    if (COURSE_COUNT_EL) COURSE_COUNT_EL.textContent = courses;
    if (CLASSROOM_COUNT_EL) CLASSROOM_COUNT_EL.textContent = classrooms;
    if (STUDENT_COUNT_EL) STUDENT_COUNT_EL.textContent = students;
  }

  async function init() {
    const supabase = await waitForSupabase();
    if (!supabase) {
      updateGreeting(null);
      updateStats({});
      return;
    }

    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth?.user) {
        toLogin();
        return;
      }

      const teacherId = auth.user.id;

      let profile = null;
      try {
        const { data, error } = await supabase
          .from('users')
          .select('users_fname, users_lname')
          .eq('users_id', teacherId)
          .maybeSingle();
        if (!error) profile = data;
      } catch (err) {
        console.warn('Failed to load profile', err);
      }

      updateGreeting(profile);
      setupButtons();

      const [courseRes, classroomRes] = await Promise.all([
        supabase
          .from('course')
          .select('course_id, course_status')
          .eq('users_id', teacherId),
        supabase
          .from('classroom')
          .select('classroom_id, classroom_status')
          .eq('users_id', teacherId),
      ]);

      const courses = Array.isArray(courseRes?.data) ? courseRes.data : [];
      const classrooms = Array.isArray(classroomRes?.data) ? classroomRes.data : [];

      let students = [];
      if (classrooms.length) {
        const classroomIds = classrooms.map((room) => room.classroom_id).filter(Boolean);
        const { data: classmates } = await supabase
          .from('classmate')
          .select('users_id')
          .in('classroom_id', classroomIds);
        if (Array.isArray(classmates)) {
          const uniqueStudents = new Set(classmates.map((row) => row.users_id).filter(Boolean));
          students = Array.from(uniqueStudents);
        }
      }

      const activeCourses = courses.filter((course) => (course.course_status || '').toLowerCase() !== 'archived');
      const activeClassrooms = classrooms.filter((room) => (room.classroom_status || '').toLowerCase() !== 'archived');

      updateStats({
        courses: activeCourses.length,
        classrooms: activeClassrooms.length,
        students: students.length,
      });
    } catch (err) {
      console.error('Failed to load teacher welcome data', err);
      updateStats({});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
