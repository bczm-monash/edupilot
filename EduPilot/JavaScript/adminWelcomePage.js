(function () {
  const GREETING_EL = document.getElementById('greeting');
  const MOTIVATION_EL = document.getElementById('motivation');
  const STUDENT_COUNT_EL = document.getElementById('studentCount');
  const INSTRUCTOR_COUNT_EL = document.getElementById('instructorCount');
  const COURSE_COUNT_EL = document.getElementById('courseCount');
  const CLASSROOM_COUNT_EL = document.getElementById('classroomCount');
  const SUMMARY_EL = document.getElementById('systemSummary');
  const HIGHLIGHTS_EL = document.getElementById('systemHighlights');
  const BTN_STUDENTS = document.getElementById('manageStudentsBtn');
  const BTN_INSTRUCTORS = document.getElementById('manageInstructorsBtn');
  const BTN_REPORTS = document.getElementById('viewReportsBtn');
  const BTN_DASHBOARD = document.getElementById('openDashboardBtn');

  const QUOTES = [
    '“Leadership is unlocking people’s potential to become better.” — Bill Bradley',
    '“The best way to predict the future is to create it.” — Peter Drucker',
    '“Quality is not an act, it is a habit.” — Aristotle',
    '“Efficiency is doing better what is already being done.” — Peter Drucker',
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

  function formatName(profile) {
    if (!profile) return 'Admin';
    const parts = [profile.users_fname, profile.users_lname].filter(Boolean);
    if (parts.length) return parts.join(' ');
    return 'Admin';
  }

  function setupButtons() {
    BTN_STUDENTS?.addEventListener('click', toAdminStudentList);
    BTN_INSTRUCTORS?.addEventListener('click', toAdminInstructorList);
    BTN_REPORTS?.addEventListener('click', toAdminReports);
    BTN_DASHBOARD?.addEventListener('click', () => {
      window.location.href = '/EduPilot/html/admin/adminpage.html';
    });
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

  function setStat(el, value) {
    if (!el) return;
    el.textContent = Number.isFinite(value) ? value : '0';
  }

  function normaliseStatus(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  function buildHighlight(label, value, helper) {
    const li = document.createElement('li');

    const info = document.createElement('div');
    info.className = 'overview-info';

    const title = document.createElement('span');
    title.textContent = label;
    const meta = document.createElement('span');
    meta.className = 'muted';
    meta.textContent = helper;

    info.appendChild(title);
    info.appendChild(meta);

    const strong = document.createElement('span');
    strong.className = 'overview-value';
    strong.textContent = value;

    li.appendChild(info);
    li.appendChild(strong);
    return li;
  }

  async function init() {
    const supabase = await waitForSupabase();
    if (!supabase) {
      updateGreeting(null);
      return;
    }

    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth?.user) {
        toLogin();
        return;
      }

      const adminId = auth.user.id;
      let profile = null;

      try {
        const { data, error } = await supabase
          .from('users')
          .select('users_fname, users_lname, users_role')
          .eq('users_id', adminId)
          .maybeSingle();

        if (!error) {
          profile = data;
          if (data && data.users_role && data.users_role.toLowerCase() !== 'admin') {
            console.warn('Current user is not flagged as admin.');
          }
        }
      } catch (err) {
        console.warn('Failed to load admin profile:', err);
      }

      updateGreeting(profile);
      setupButtons();

      const [
        usersRes,
        coursesRes,
        classroomsRes,
        lessonsRes,
        enrolmentsRes,
        unitsRes,
      ] = await Promise.all([
        supabase.from('users').select('users_id, users_role'),
        supabase.from('course').select('course_id, course_status, course_modified'),
        supabase.from('classroom').select('classroom_id, classroom_status'),
        supabase.from('lesson').select('lesson_id'),
        supabase.from('enrolment').select('user_id'),
        supabase.from('units').select('course_id, lesson_id'),
      ]);

      const queryErrors = [
        usersRes.error,
        coursesRes.error,
        classroomsRes.error,
        lessonsRes.error,
        enrolmentsRes.error,
        unitsRes.error,
      ].filter(Boolean);

      if (queryErrors.length) {
        throw new Error(queryErrors.map((err) => err.message).join('; '));
      }

      const userRows = Array.isArray(usersRes.data) ? usersRes.data : [];
      const studentCount = userRows.filter((row) => normaliseStatus(row.users_role) === 'student').length;
      const instructorCount = userRows.filter((row) => normaliseStatus(row.users_role) === 'teacher').length;

      const courseRows = Array.isArray(coursesRes.data) ? coursesRes.data : [];
      const classroomRows = Array.isArray(classroomsRes.data) ? classroomsRes.data : [];
      const lessonRows = Array.isArray(lessonsRes.data) ? lessonsRes.data : [];
      const enrolmentRows = Array.isArray(enrolmentsRes.data) ? enrolmentsRes.data : [];
      const unitRows = Array.isArray(unitsRes.data) ? unitsRes.data : [];

      const activeCourses = courseRows.filter(
        (row) => !['archived', 'inactive'].includes(normaliseStatus(row.course_status))
      );
      const activeClassrooms = classroomRows.filter(
        (row) => !['archived', 'completed', 'inactive'].includes(normaliseStatus(row.classroom_status))
      );

      const enrolmentLearners = new Set(enrolmentRows.map((row) => row.user_id).filter(Boolean));
      const lessonsPerCourse = (() => {
        if (!courseRows.length) return 0;
        const counter = new Map();
        unitRows.forEach((row) => {
          if (!row?.course_id) return;
          counter.set(row.course_id, (counter.get(row.course_id) || 0) + 1);
        });
        const total = Array.from(counter.values()).reduce((acc, val) => acc + val, 0);
        return counter.size ? total / counter.size : 0;
      })();

      setStat(STUDENT_COUNT_EL, studentCount);
      setStat(INSTRUCTOR_COUNT_EL, instructorCount);
      setStat(COURSE_COUNT_EL, courseRows.length);
      setStat(CLASSROOM_COUNT_EL, classroomRows.length);

      if (SUMMARY_EL) {
        SUMMARY_EL.textContent = `${activeCourses.length} active courses • ${activeClassrooms.length} active classrooms • ${enrolmentLearners.size} learners enrolled`;
      }

      if (HIGHLIGHTS_EL) {
        HIGHLIGHTS_EL.innerHTML = '';
        HIGHLIGHTS_EL.appendChild(
          buildHighlight('Total lessons', lessonRows.length, 'Across all courses')
        );
        HIGHLIGHTS_EL.appendChild(
          buildHighlight('Average lessons per course', lessonsPerCourse.toFixed(1), 'Based on linked units')
        );
        HIGHLIGHTS_EL.appendChild(
          buildHighlight('Unique enrolled learners', enrolmentLearners.size, 'From classroom enrolments')
        );
        HIGHLIGHTS_EL.appendChild(
          buildHighlight('Active classrooms', activeClassrooms.length, 'Currently running cohorts')
        );
      }

    } catch (err) {
      console.error('Failed to load admin welcome data:', err);
      setStat(STUDENT_COUNT_EL, 0);
      setStat(INSTRUCTOR_COUNT_EL, 0);
      setStat(COURSE_COUNT_EL, 0);
      setStat(CLASSROOM_COUNT_EL, 0);
      if (SUMMARY_EL) SUMMARY_EL.textContent = 'Unable to load summary.';
      if (HIGHLIGHTS_EL) {
        HIGHLIGHTS_EL.innerHTML = '';
        const fallback = document.createElement('li');
        fallback.textContent = 'Unable to load system highlights.';
        HIGHLIGHTS_EL.appendChild(fallback);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
