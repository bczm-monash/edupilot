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
    return Intl.NumberFormat(undefined, options).format(value);
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

  function normalise(value) {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase();
  }

  function average(values) {
    if (!Array.isArray(values) || !values.length) return 0;
    const sum = values.reduce((acc, val) => acc + (Number.isFinite(val) ? val : 0), 0);
    return values.length ? sum / values.length : 0;
  }

  async function loadTeacherReports() {
    try {
      toggleStatus('Loading reports…', false);
      const supabase = await waitForSupabase();
      const { data: userPayload, error: authError } = await supabase.auth.getUser();
      if (authError || !userPayload?.user) {
        throw new Error('Please sign in to view your reports.');
      }

      const teacherId = userPayload.user.id;

      const [
        { data: courses, error: coursesError },
        { data: lessons, error: lessonsError },
        { data: classrooms, error: classroomsError },
      ] = await Promise.all([
        supabase.from('course').select('course_id, course_status').eq('users_id', teacherId),
        supabase.from('lesson').select('lesson_id, lesson_credit_pts').eq('users_id', teacherId),
        supabase.from('classroom').select('classroom_id, classroom_status').eq('users_id', teacherId),
      ]);

      if (coursesError || lessonsError || classroomsError) {
        throw new Error(
          [
            coursesError?.message,
            lessonsError?.message,
            classroomsError?.message,
          ].filter(Boolean).join('; ')
        );
      }

      const courseList = Array.isArray(courses) ? courses : [];
      const lessonList = Array.isArray(lessons) ? lessons : [];
      const classroomList = Array.isArray(classrooms) ? classrooms : [];

      const courseIds = courseList.map((row) => row.course_id).filter(Boolean);
      const lessonIds = lessonList.map((row) => row.lesson_id).filter(Boolean);
      const classroomIds = classroomList.map((row) => row.classroom_id).filter(Boolean);

      const [
        enrolmentsResult,
        unitsResult,
        classmatesResult,
      ] = await Promise.all([
        courseIds.length
          ? supabase.from('enrolment').select('user_id, course_id').in('course_id', courseIds)
          : Promise.resolve({ data: [], error: null }),
        courseIds.length && lessonIds.length
          ? supabase
              .from('units')
              .select('lesson_id, course_id')
              .in('course_id', courseIds)
              .in('lesson_id', lessonIds)
          : Promise.resolve({ data: [], error: null }),
        classroomIds.length
          ? supabase.from('classmate').select('classroom_id, users_id').in('classroom_id', classroomIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (enrolmentsResult.error || unitsResult.error || classmatesResult.error) {
        throw new Error(
          [
            enrolmentsResult.error?.message,
            unitsResult.error?.message,
            classmatesResult.error?.message,
          ].filter(Boolean).join('; ')
        );
      }

      const enrolments = Array.isArray(enrolmentsResult.data) ? enrolmentsResult.data : [];
      const units = Array.isArray(unitsResult.data) ? unitsResult.data : [];
      const classmates = Array.isArray(classmatesResult.data) ? classmatesResult.data : [];

      // Course metrics
      const uniqueStudents = new Set(enrolments.map((row) => row.user_id).filter(Boolean));
      setMetric('teacher-course-total-students', uniqueStudents.size);

      const activeStatuses = new Set(['active', 'published']);
      const archivedStatuses = new Set(['archived']);
      let activeCourses = 0;
      let archivedCourses = 0;
      courseList.forEach((row) => {
        const status = normalise(row.course_status);
        if (activeStatuses.has(status)) activeCourses += 1;
        if (archivedStatuses.has(status)) archivedCourses += 1;
      });
      setMetric('teacher-course-active', activeCourses);
      setMetric('teacher-course-archived', archivedCourses);

      const lessonCredits = lessonList
        .map((row) => Number(row.lesson_credit_pts))
        .filter((val) => Number.isFinite(val) && val > 0);
      setMetric('teacher-course-avg-credit', average(lessonCredits).toFixed(1));

      // Classroom metrics
      setMetric('teacher-classroom-total', classroomList.length);
      const ongoingStatuses = new Set(['ongoing', 'in progress', 'active']);
      const completedStatuses = new Set(['completed', 'done', 'finished']);

      let ongoing = 0;
      let completed = 0;
      classroomList.forEach((row) => {
        const status = normalise(row.classroom_status);
        if (ongoingStatuses.has(status)) ongoing += 1;
        if (completedStatuses.has(status)) completed += 1;
      });
      setMetric('teacher-classroom-ongoing', ongoing);
      setMetric('teacher-classroom-completed', completed);

      const avgStudentsPerClassroom = (() => {
        if (!classroomList.length) return 0;
        const counts = new Map();
        classmates.forEach((row) => {
          if (!row.classroom_id) return;
          counts.set(row.classroom_id, (counts.get(row.classroom_id) || 0) + 1);
        });
        const total = Array.from(counts.values()).reduce((acc, val) => acc + val, 0);
        return total / classroomList.length;
      })();
      setMetric('teacher-classroom-avg-students', avgStudentsPerClassroom.toFixed(1));

      // Lesson metrics
      setMetric('teacher-lesson-total', lessonList.length);
      const assignedLessonIds = new Set(units.map((row) => row.lesson_id).filter(Boolean));
      const assigned = lessonList.filter((row) => assignedLessonIds.has(row.lesson_id)).length;
      setMetric('teacher-lesson-assigned', assigned);
      setMetric('teacher-lesson-unassigned', Math.max(lessonList.length - assigned, 0));
      setMetric('teacher-lesson-avg-credit', average(lessonCredits).toFixed(1));

      toggleStatus('Reports loaded', true);
    } catch (err) {
      console.error('Failed to load teacher reports:', err);
      toggleStatus(err.message || 'Failed to load reports.', false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadTeacherReports);
  } else {
    loadTeacherReports();
  }
})();
