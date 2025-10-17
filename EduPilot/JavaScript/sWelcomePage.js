(function () {
  const HERO_GREETING = document.getElementById('greeting');
  const MOTIVATION_EL = document.getElementById('motivation');
  const COURSE_COUNT_EL = document.getElementById('courseCount');
  const CLASSROOM_COUNT_EL = document.getElementById('classroomCount');
  const LESSON_COUNT_EL = document.getElementById('lessonCount');
  const PROGRESS_LABEL_EL = document.getElementById('progressLabel');
  const PROGRESS_FILL_EL = document.getElementById('progressFill');
  const UPCOMING_LIST_EL = document.getElementById('upcomingList');
  const BTN_COURSES = document.getElementById('goToCourses');
  const BTN_CLASSROOMS = document.getElementById('goToClassrooms');

  const QUOTES = [
    '“Learning is a process, not an event.” — Elliott Masie',
    '“Education is the passport to the future.” — Malcolm X',
    '“The beautiful thing about learning is that no one can take it away from you.” — B.B. King',
    '“Success is the sum of small efforts, repeated day in and day out.” — Robert Collier',
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
    if (!user) return 'Learner';
    const { users_fname, users_lname } = user;
    const parts = [users_fname, users_lname].filter(Boolean);
    if (parts.length) return parts.join(' ');
    return 'Learner';
  }

  function parseDate(value) {
    if (!value) return null;
    try {
      const direct = new Date(value);
      if (!Number.isNaN(direct.getTime())) return direct;
    } catch (err) {
      /* fallthrough */
    }
    const str = String(value).trim();
    if (!str) return null;
    const match = str.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{4})$/);
    if (match) {
      const [, d, m, y] = match.map(Number);
      const parsed = new Date(y, m - 1, d);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return null;
  }

  function formatDate(value) {
    const date = parseDate(value);
    if (!date) return String(value || '');
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function updateGreeting(profile) {
    if (HERO_GREETING) {
      const name = formatName(profile);
      const greeting = new Intl.DateTimeFormat(undefined, { hour: 'numeric', hour12: false }).format(new Date());
      const hour = Number(greeting);
      const salutation = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
      HERO_GREETING.textContent = `${salutation}, ${name}`;
    }
    if (MOTIVATION_EL) {
      MOTIVATION_EL.textContent = randomQuote();
    }
  }

  function updateStats({ courses = 0, classrooms = 0, lessons = 0 }) {
    if (COURSE_COUNT_EL) COURSE_COUNT_EL.textContent = courses;
    if (CLASSROOM_COUNT_EL) CLASSROOM_COUNT_EL.textContent = classrooms;
    if (LESSON_COUNT_EL) LESSON_COUNT_EL.textContent = lessons;
  }

  function updateProgress({ passed = 0, total = 0 }) {
    if (PROGRESS_LABEL_EL) {
      PROGRESS_LABEL_EL.textContent = `${passed} of ${total} lessons completed`;
    }
    if (PROGRESS_FILL_EL) {
      const percent = total ? Math.round((passed / total) * 100) : 0;
      PROGRESS_FILL_EL.style.width = `${percent}%`;
    }
  }

  function updateUpcoming(upcoming) {
    if (!UPCOMING_LIST_EL) return;
    UPCOMING_LIST_EL.innerHTML = '';

    if (!upcoming.length) {
      const li = document.createElement('li');
      li.className = 'muted';
      li.textContent = 'No upcoming sessions. Explore courses to keep learning!';
      UPCOMING_LIST_EL.appendChild(li);
      return;
    }

    upcoming.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'upcoming-item';

      const title = document.createElement('span');
      title.textContent = item.classroom_title || item.classroom_id || 'Classroom';

      const meta = document.createElement('span');
      meta.className = 'upcoming-meta';
      const dateText = formatDate(item.classroom_start_date);
      const courseText = item.course_title ? `${item.course_title}` : item.course_id || '';
      meta.textContent = [dateText, courseText].filter(Boolean).join(' • ');

      li.appendChild(title);
      li.appendChild(meta);
      UPCOMING_LIST_EL.appendChild(li);
    });
  }

  function setupButtons() {
    if (BTN_COURSES) BTN_COURSES.addEventListener('click', toSCourse);
    if (BTN_CLASSROOMS) BTN_CLASSROOMS.addEventListener('click', toSClassroom);
  }

  function normaliseGrade(value) {
    if (!value) return 'Not Graded';
    const norm = String(value).trim().toLowerCase();
    if (norm === 'pass') return 'Pass';
    if (norm === 'fail') return 'Fail';
    return 'Not Graded';
  }

  async function init() {
    const supabase = await waitForSupabase();
    if (!supabase) {
      updateGreeting(null);
      updateStats({ courses: 0, classrooms: 0, lessons: 0 });
      updateProgress({ passed: 0, total: 0 });
      updateUpcoming([]);
      return;
    }

    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth?.user) {
        toLogin();
        return;
      }

      const userId = auth.user.id;

      let profile = null;
      try {
        const { data, error } = await supabase
          .from('users')
          .select('users_fname, users_lname')
          .eq('users_id', userId)
          .maybeSingle();
        if (!error) profile = data;
      } catch (err) {
        console.warn('Failed to load profile', err);
      }

      updateGreeting(profile);
      setupButtons();

      const [courseRes, classroomRes] = await Promise.all([
        supabase
          .from('enrolment')
          .select('course_id')
          .eq('user_id', userId),
        supabase
          .from('classmate')
          .select('classroom_id')
          .eq('users_id', userId),
      ]);

      const courseIds = Array.from(
        new Set(
          (Array.isArray(courseRes?.data) ? courseRes.data : [])
            .map((row) => row.course_id)
            .filter(Boolean)
        )
      );

      const classroomIds = Array.from(
        new Set(
          (Array.isArray(classroomRes?.data) ? classroomRes.data : [])
            .map((row) => row.classroom_id)
            .filter(Boolean)
        )
      );

      let courseDetails = [];
      if (courseIds.length) {
        const { data, error } = await supabase
          .from('course')
          .select('course_id, course_title, course_status')
          .in('course_id', courseIds);
        if (!error && Array.isArray(data)) {
          courseDetails = data;
        }
      }

      let classroomDetails = [];
      if (classroomIds.length) {
        const { data, error } = await supabase
          .from('classroom')
          .select('classroom_id, classroom_title, classroom_start_date, classroom_end_date, course_id')
          .in('classroom_id', classroomIds);
        if (!error && Array.isArray(data)) {
          classroomDetails = data;
        }
      }

      const courseTitleMap = new Map(
        courseDetails.map((row) => [row.course_id, row.course_title || row.course_id])
      );

      let lessonLinks = [];
      if (classroomIds.length) {
        const { data, error } = await supabase
          .from('classroom_lesson')
          .select('lesson_id, classroom_id')
          .in('classroom_id', classroomIds);
        if (!error && Array.isArray(data)) {
          lessonLinks = data;
        }
      }

      const uniqueLessonIds = Array.from(
        new Set(lessonLinks.map((row) => row.lesson_id).filter(Boolean))
      );

      let grades = [];
      if (classroomIds.length) {
        const { data, error } = await supabase
          .from('grades')
          .select('lesson_id, grade')
          .eq('users_id', userId)
          .in('classroom_id', classroomIds);
        if (!error && Array.isArray(data)) {
          grades = data;
        }
      }

      const gradeByLesson = new Map();
      grades.forEach((row) => {
        if (!row || !row.lesson_id) return;
      const grade = normaliseGrade(row.grade);
      if (!gradeByLesson.has(row.lesson_id) || grade.toLowerCase() === 'pass') {
        gradeByLesson.set(row.lesson_id, grade);
      }
    });

    const passedCount = uniqueLessonIds.reduce((count, id) => {
      const grade = gradeByLesson.get(id);
      return count + (grade && grade.toLowerCase() === 'pass' ? 1 : 0);
    }, 0);

      updateStats({
        courses: courseIds.length,
        classrooms: classroomIds.length,
        lessons: uniqueLessonIds.length,
      });
      updateProgress({ passed: passedCount, total: uniqueLessonIds.length });

      const now = Date.now();
      const upcoming = classroomDetails
        .map((room) => ({
          ...room,
          course_title: courseTitleMap.get(room.course_id),
          startDate: parseDate(room.classroom_start_date),
        }))
        .filter((room) => room.startDate)
        .sort((a, b) => a.startDate - b.startDate);

      const future = upcoming.filter((room) => room.startDate.getTime() >= now);
      updateUpcoming((future.length ? future : upcoming).slice(0, 3));
    } catch (err) {
      console.error('Failed to load welcome page data', err);
      updateStats({ courses: 0, classrooms: 0, lessons: 0 });
      updateProgress({ passed: 0, total: 0 });
      updateUpcoming([]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
