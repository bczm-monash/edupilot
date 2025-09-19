(function () {
  const client = () => window.supabase;

  function getCourseId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id')?.trim() || '';
  }

  function titleCase(value) {
    if (!value) return '';
    const str = String(value).trim();
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function assignText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text ?? '';
  }

  function normaliseCredit(course) {
    const candidates = [
      course.course_total_credit_pts,
      course.course_credit_pts,
      course.course_credit_points,
    ];
    for (const value of candidates) {
      if (value === null || value === undefined || value === '') continue;
      const num = Number(value);
      if (!Number.isNaN(num)) return num;
    }
    return undefined;
  }

  function parseLessonIds(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(String).map((id) => id.trim()).filter(Boolean);
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map(String).map((id) => id.trim()).filter(Boolean);
        }
      } catch (err) {
        // fall through to splitting by comma
      }
      return raw
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    }
    return [];
  }

  function makeLessonCard(lesson) {
    const li = document.createElement('li');
    li.className = 'lesson-card';
    li.dataset.id = lesson.lesson_id || '';
    li.tabIndex = 0;
    li.setAttribute('role', 'button');

    const title = document.createElement('div');
    title.className = 'lesson-title';
    title.textContent = lesson.lesson_title || 'Untitled lesson';

    const metaId = document.createElement('div');
    metaId.className = 'lesson-meta';
    metaId.textContent = `ID: ${lesson.lesson_id || '-'}`;

    const owner = document.createElement('div');
    owner.className = 'lesson-meta';
    if (lesson.owner_name) owner.textContent = `Owner: ${lesson.owner_name}`;

    const credit = document.createElement('div');
    credit.className = 'lesson-meta';
    if (lesson.lesson_credit_pts !== undefined && lesson.lesson_credit_pts !== null) {
      credit.textContent = `Credit Points: ${lesson.lesson_credit_pts}`;
    }

    const est = document.createElement('div');
    est.className = 'lesson-meta';
    if (lesson.lesson_est_hrs !== undefined && lesson.lesson_est_hrs !== null) {
      est.textContent = `Estimated Hours: ${lesson.lesson_est_hrs}`;
    }

    const desc = document.createElement('div');
    desc.className = 'lesson-desc';
    if (lesson.lesson_desc) {
      desc.textContent = lesson.lesson_desc;
    }

    const open = () => {
      if (!lesson.lesson_id) return;
      const url = `/EduPilot/html/teacher/lesson_content.html?id=${encodeURIComponent(lesson.lesson_id)}`;
      window.location.href = url;
    };

    li.addEventListener('click', open);
    li.addEventListener('keypress', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });

    li.appendChild(title);
    li.appendChild(metaId);
    if (owner.textContent) li.appendChild(owner);
    if (credit.textContent) li.appendChild(credit);
    if (est.textContent) li.appendChild(est);
    if (desc.textContent) li.appendChild(desc);

    return li;
  }

  function renderLessons(lessons) {
    const listEl = document.getElementById('lessonList');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!lessons || !lessons.length) {
      const li = document.createElement('li');
      li.textContent = 'No lessons linked to this course yet.';
      li.style.listStyle = 'none';
      li.style.margin = '12px';
      listEl.appendChild(li);
      return;
    }

    const frag = document.createDocumentFragment();
    lessons.forEach((lesson) => frag.appendChild(makeLessonCard(lesson)));
    listEl.appendChild(frag);
  }

  async function enrichLessonOwners(lessons) {
    const ids = Array.from(new Set(
      lessons.map((lesson) => lesson.users_id).filter(Boolean)
    ));
    if (!ids.length) return lessons;

    try {
      const { data, error } = await client()
        .from('users')
        .select('users_id, users_fname, users_lname')
        .in('users_id', ids);
      if (error) throw error;
      const nameById = new Map(
        (data || []).map((u) => [u.users_id, [u.users_fname, u.users_lname].filter(Boolean).join(' ')])
      );
      lessons.forEach((lesson) => {
        const name = nameById.get(lesson.users_id);
        if (name) lesson.owner_name = name;
      });
    } catch (err) {
      console.warn('Failed to resolve lesson owner names:', err);
    }
    return lessons;
  }

  async function fetchLessonsForCourse(courseId, lessonIds) {
    const supabase = client();
    if (!supabase) return [];

    let ids = Array.isArray(lessonIds) ? [...lessonIds] : [];

    if (!ids.length) {
      try {
        const { data, error } = await supabase
          .from('units')
          .select('lesson_id')
          .eq('course_id', courseId);
        if (!error && Array.isArray(data)) {
          ids = data.map((row) => row.lesson_id).filter(Boolean);
        }
      } catch (err) {
        console.warn('Failed to load units for course:', err);
      }
    }

    const uniqueIds = Array.from(new Set(ids));
    if (!uniqueIds.length) return [];

    try {
      const { data, error } = await supabase
        .from('lesson')
        .select('*')
        .in('lesson_id', uniqueIds);
      if (error) throw error;
      const lessons = Array.isArray(data) ? data : [];
      const lessonsById = new Map(lessons.map((lesson) => [lesson.lesson_id, lesson]));
      const ordered = uniqueIds
        .map((id) => lessonsById.get(id))
        .filter(Boolean);
      await enrichLessonOwners(ordered);
      return ordered;
    } catch (err) {
      console.error('Failed to load lessons for course:', err);
      return [];
    }
  }

  function renderCourseDetails(course) {
    const ownerName = course.owner_name || '';
    const credit = normaliseCredit(course);

    assignText('valStatus', titleCase(course.course_status) || 'Draft');
    assignText('valCourseID', course.course_id || '-');
    assignText('valTit', course.course_title || 'Untitled course');
    assignText('valCreator', ownerName || '-');
    assignText('valCredit', credit !== undefined ? String(credit) : '-');
    assignText('valModified', formatDate(course.course_modified) || '-');
    assignText('valCreated', formatDate(course.course_date_created) || '-');

    const descEl = document.getElementById('lessonDesc');
    if (descEl) {
      descEl.textContent = course.course_desc || 'No description provided yet.';
    }
  }

  async function fetchCourse(courseId) {
    const supabase = client();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('course')
      .select('*, users:users_id (users_fname, users_lname)')
      .eq('course_id', courseId)
      .limit(1);
    if (error) {
      console.error('Failed to load course:', error);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;

    if (row.users && typeof row.users === 'object') {
      const fname = row.users.users_fname || '';
      const lname = row.users.users_lname || '';
      const combined = [fname, lname].filter(Boolean).join(' ');
      if (combined) row.owner_name = combined;
    }

    return row;
  }

  async function init() {
    init._retries = init._retries || 0;
    const courseId = getCourseId();
    if (!courseId) {
      alert('Course ID is missing.');
      return;
    }

    if (!client()) {
      if (init._retries < 5) {
        init._retries += 1;
        setTimeout(init, 200);
        return;
      }
      alert('Supabase not initialized.');
      return;
    }

    try {
      const course = await fetchCourse(courseId);
      if (!course) {
        alert('Failed to load course details.');
        return;
      }

      renderCourseDetails(course);

      const lessonIds = parseLessonIds(course.course_lessons);
      const lessons = await fetchLessonsForCourse(courseId, lessonIds);
      renderLessons(lessons);
    } catch (err) {
      console.error('Unexpected error loading course content:', err);
      alert('Unexpected error loading course content.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
