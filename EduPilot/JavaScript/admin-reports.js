(function () {
  const statusEl = document.querySelector('[data-metric="reports-status"]');
  const metricMap = new Map();

  document.querySelectorAll('[data-metric]').forEach((el) => {
    const key = el.getAttribute('data-metric');
    if (key && key !== 'reports-status') {
      metricMap.set(key, el);
    }
  });

  function formatNumber(value, options = {}) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '0';
    }
    const formatter = Intl.NumberFormat(undefined, options);
    return formatter.format(value);
  }

  function setMetric(key, value, options) {
    const el = metricMap.get(key);
    if (!el) return;
    el.textContent = typeof value === 'string' ? value : formatNumber(value, options);
  }

  function toggleStatus(message, hidden) {
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.hidden = hidden;
  }

  function waitForSupabase(timeoutMs = 6000) {
    if (window.supabase) return Promise.resolve(window.supabase);
    return new Promise((resolve, reject) => {
      const onReady = (event) => {
        cleanup();
        resolve(event?.detail?.supabase || window.supabase);
      };
      const cleanup = () => {
        document.removeEventListener('supabase-ready', onReady);
        if (timer) clearTimeout(timer);
      };
      document.addEventListener('supabase-ready', onReady, { once: true });
      const timer = timeoutMs
        ? setTimeout(() => {
            cleanup();
            reject(new Error('Supabase client not available.'));
          }, timeoutMs)
        : null;
    });
  }

  function normaliseStatus(value) {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase();
  }

  function average(nums) {
    if (!Array.isArray(nums) || !nums.length) return 0;
    const sum = nums.reduce((acc, val) => acc + (Number.isFinite(val) ? val : 0), 0);
    return nums.length ? sum / nums.length : 0;
  }

  async function loadReports() {
    try {
      toggleStatus('Loading reports…', false);
      const supabase = await waitForSupabase();

      const [
        { data: users, error: usersError },
        { data: courses, error: coursesError },
        { data: lessons, error: lessonsError },
        { data: classrooms, error: classroomsError },
        { data: classmates, error: classmatesError },
        { data: units, error: unitsError },
      ] = await Promise.all([
        supabase.from('users').select('users_id, users_role'),
        supabase.from('course').select('course_id, course_status'),
        supabase.from('lesson').select('lesson_id, lesson_credit_pts'),
        supabase.from('classroom').select('classroom_id, classroom_status'),
        supabase.from('classmate').select('classroom_id'),
        supabase.from('units').select('lesson_id'),
      ]);

      const errors = [
        usersError,
        coursesError,
        lessonsError,
        classroomsError,
        classmatesError,
        unitsError,
      ].filter(Boolean);

      if (errors.length) {
        throw new Error(errors.map((err) => err.message || String(err)).join('; '));
      }

      const userList = Array.isArray(users) ? users : [];
      const courseList = Array.isArray(courses) ? courses : [];
      const lessonList = Array.isArray(lessons) ? lessons : [];
      const classroomList = Array.isArray(classrooms) ? classrooms : [];
      const classmateList = Array.isArray(classmates) ? classmates : [];
      const unitList = Array.isArray(units) ? units : [];

      // Course metrics
      setMetric('course-total-users', userList.length);
      const courseStatuses = courseList.map((row) => normaliseStatus(row.course_status));
      const activeStatuses = new Set(['active', 'published']);
      const draftStatuses = new Set(['draft']);
      const archivedStatuses = new Set(['archived']);

      const activeCourses = courseStatuses.filter((s) => activeStatuses.has(s)).length;
      const draftCourses = courseStatuses.filter((s) => draftStatuses.has(s)).length;
      const archivedCourses = courseStatuses.filter((s) => archivedStatuses.has(s)).length;

      setMetric('course-active', activeCourses);
      setMetric('course-draft', draftCourses);
      setMetric('course-archived', archivedCourses);

      const lessonCredits = lessonList
        .map((row) => Number(row.lesson_credit_pts))
        .filter((val) => Number.isFinite(val) && val > 0);
      setMetric('course-avg-credit', average(lessonCredits).toFixed(1));

      // Classroom metrics
      setMetric('classroom-total', classroomList.length);
      const ongoingStatuses = new Set(['ongoing', 'in progress', 'active']);
      const completedStatuses = new Set(['completed', 'done', 'finished']);
      const classroomStatusList = classroomList.map((row) => normaliseStatus(row.classroom_status));

      const ongoingCount = classroomStatusList.filter((s) => ongoingStatuses.has(s)).length;
      const completedCount = classroomStatusList.filter((s) => completedStatuses.has(s)).length;

      setMetric('classroom-ongoing', ongoingCount);
      setMetric('classroom-completed', completedCount);

      const studentsPerClassroom = (() => {
        if (!classroomList.length) return 0;
        const counts = new Map();
        classmateList.forEach((row) => {
          const id = row.classroom_id;
          if (!id) return;
          counts.set(id, (counts.get(id) || 0) + 1);
        });
        const total = Array.from(counts.values()).reduce((acc, val) => acc + val, 0);
        return total / classroomList.length;
      })();
      setMetric('classroom-avg-students', studentsPerClassroom.toFixed(1));

      // Lesson metrics
      setMetric('lesson-total', lessonList.length);
      const assignedLessonIds = new Set(
        unitList
          .map((row) => row.lesson_id)
          .filter(Boolean)
      );
      const assignedCount = lessonList.filter((row) => assignedLessonIds.has(row.lesson_id)).length;
      setMetric('lesson-assigned', assignedCount);
      setMetric('lesson-unassigned', Math.max(lessonList.length - assignedCount, 0));
      setMetric('lesson-avg-credit', average(lessonCredits).toFixed(1));

      // System metrics
      const instructors = userList.filter((row) => {
        const role = normaliseStatus(row.users_role);
        return role === 'teacher' || role === 'instructor';
      }).length;
      const students = userList.filter((row) => normaliseStatus(row.users_role) === 'student').length;

      setMetric('system-instructors', instructors);
      setMetric('system-students', students);
      setMetric('system-lessons', lessonList.length);
      setMetric('system-courses', courseList.length);
      setMetric('system-classrooms', classroomList.length);

      toggleStatus('Reports loaded', true);
    } catch (err) {
      console.error('Failed to load admin reports:', err);
      toggleStatus('Failed to load reports. Please refresh to try again.', false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadReports);
  } else {
    loadReports();
  }
})();
