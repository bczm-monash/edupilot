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

  function normalizeArray(input) {
    if (!input) return [];
    if (Array.isArray(input)) return input.map((id) => String(id).trim()).filter(Boolean);
    if (typeof input === 'string') {
      try {
        const parsed = JSON.parse(input);
        if (Array.isArray(parsed)) {
          return parsed.map((id) => String(id).trim()).filter(Boolean);
        }
      } catch (_) {
        // fall through
      }
      return input.split(',').map((id) => id.trim()).filter(Boolean);
    }
    return [];
  }

  const lessonCredits = {};
  const lessonMetadata = {};
  let allLessons = [];
  let selectedLessonIds = [];
  let pendingLessonSelection = new Set();
  let initialLessonIds = [];
  let loadedCourseId = '';
  let courseRecord = null;

  let selectedLessonsDisplayEl = null;
  let courseLessonsHiddenEl = null;
  let courseCreditEl = null;
  let courseTotalCreditPointsEl = null;
  let lessonOverlayEl = null;
  let lessonOverlayBodyEl = null;

  function renderSelectedLessons() {
    const displayValue = selectedLessonIds.map((id) => {
      const meta = lessonMetadata[id] || {};
      const titlePart = meta.lesson_title ? ` - ${meta.lesson_title}` : '';
      return `${id}${titlePart}`;
    }).join('\n');

    if (selectedLessonsDisplayEl) {
      selectedLessonsDisplayEl.value = displayValue;
    }

    if (courseLessonsHiddenEl) {
      courseLessonsHiddenEl.value = selectedLessonIds.join(',');
    }

    const totalCredits = selectedLessonIds.reduce((sum, id) => {
      const credit = lessonCredits[id];
      return sum + (typeof credit === 'number' && Number.isFinite(credit) ? credit : 0);
    }, 0);

    if (courseCreditEl) {
      courseCreditEl.value = totalCredits;
    }

    if (courseTotalCreditPointsEl) {
      courseTotalCreditPointsEl.value = totalCredits;
    }
  }

  function renderLessonOverlayList() {
    if (!lessonOverlayBodyEl) return;

    lessonOverlayBodyEl.innerHTML = '';

    if (!allLessons.length) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'muted';
      emptyEl.textContent = 'No lessons available.';
      lessonOverlayBodyEl.appendChild(emptyEl);
      return;
    }

    allLessons.forEach((lesson) => {
      const label = document.createElement('label');
      label.className = 'lesson-row';
      label.setAttribute('data-lesson-id', lesson.lesson_id);

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = lesson.lesson_id;
      checkbox.checked = pendingLessonSelection.has(lesson.lesson_id);
      checkbox.className = 'lesson-checkbox';

      const content = document.createElement('div');
      const titleEl = document.createElement('strong');
      titleEl.textContent = lesson.lesson_title || 'Untitled lesson';

      const metaEl = document.createElement('span');
      const credit = lesson.lesson_credit_pts == null ? 0 : Number(lesson.lesson_credit_pts);
      metaEl.textContent = `ID: ${lesson.lesson_id} | Credit Points: ${Number.isFinite(credit) ? credit : 0}`;

      content.appendChild(titleEl);
      content.appendChild(metaEl);

      label.appendChild(checkbox);
      label.appendChild(content);

      lessonOverlayBodyEl.appendChild(label);
    });
  }

  function showLessonOverlay() {
    if (lessonOverlayEl) {
      lessonOverlayEl.style.display = 'flex';
    }
  }

  function hideLessonOverlay() {
    if (lessonOverlayEl) {
      lessonOverlayEl.style.display = 'none';
    }
  }

  async function loadLessonsForSelection() {
    if (!window.supabase) {
      console.warn('Supabase not initialised; lesson list skipped.');
      return;
    }

    const { data, error } = await window.supabase
      .from('lesson')
      .select('lesson_id, lesson_title, lesson_credit_pts, lesson_est_hrs')
      .order('lesson_id', { ascending: true });

    if (error) {
      console.error('Failed to load lessons for selection:', error);
      if (lessonOverlayBodyEl) {
        lessonOverlayBodyEl.innerHTML = '';
        const errEl = document.createElement('div');
        errEl.className = 'muted';
        errEl.textContent = 'Failed to load lessons. Please try again.';
        lessonOverlayBodyEl.appendChild(errEl);
      }
      return;
    }

    allLessons = Array.isArray(data) ? data : [];
    allLessons.forEach((row) => {
      const credit = row.lesson_credit_pts == null ? 0 : Number(row.lesson_credit_pts);
      lessonCredits[row.lesson_id] = Number.isFinite(credit) ? credit : 0;
      lessonMetadata[row.lesson_id] = row;
    });

    pendingLessonSelection = new Set(selectedLessonIds);
    renderLessonOverlayList();
    renderSelectedLessons();
  }

  async function fetchCourseRecord(courseId) {
    if (!window.supabase) return null;
    const { data, error } = await window.supabase
      .from('course')
      .select('*')
      .eq('course_id', courseId)
      .limit(1);
    if (error) {
      console.error('Failed to fetch course for editing:', error);
      return null;
    }
    const record = Array.isArray(data) ? data[0] : data;
    return record || null;
  }

  async function fetchCourseLessonIds(courseId) {
    if (!window.supabase) return [];
    const { data, error } = await window.supabase
      .from('units')
      .select('lesson_id')
      .eq('course_id', courseId);
    if (error) {
      console.warn('Failed to fetch lessons from units:', error);
      return [];
    }
    return (data || []).map((row) => row.lesson_id).filter(Boolean);
  }

  async function ensureLessonDetails(ids) {
    const missing = ids.filter((id) => id && !lessonMetadata[id]);
    if (!missing.length || !window.supabase) return;
    const { data, error } = await window.supabase
      .from('lesson')
      .select('lesson_id, lesson_title, lesson_credit_pts, lesson_est_hrs')
      .in('lesson_id', missing);
    if (error) {
      console.warn('Failed to fetch missing lesson metadata:', error);
      return;
    }
    (data || []).forEach((row) => {
      const credit = row.lesson_credit_pts == null ? 0 : Number(row.lesson_credit_pts);
      lessonCredits[row.lesson_id] = Number.isFinite(credit) ? credit : 0;
      lessonMetadata[row.lesson_id] = row;
    });
  }

  function computeEstimatedHours(ids) {
    return ids.reduce((sum, id) => {
      const meta = lessonMetadata[id];
      if (!meta) return sum;
      const hours = meta.lesson_est_hrs ?? meta.lesson_estimated_hours;
      const numeric = Number(hours);
      return sum + (Number.isFinite(numeric) ? numeric : 0);
    }, 0);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const courseForm = document.getElementById('editCourseForm');
    const courseIdEl = document.getElementById('courseId');
    const courseTitleEl = document.getElementById('courseTitle');
    const courseDescEl = document.getElementById('courseDescription');
    courseLessonsHiddenEl = document.getElementById('courseLessons');
    selectedLessonsDisplayEl = document.getElementById('selectedLessonsDisplay');
    courseCreditEl = document.getElementById('courseCreditPoints');
    const courseEstimatedHoursEl = document.getElementById('courseEstimatedHours');

    const courseStatusEl = document.getElementById('courseStatus');
    courseTotalCreditPointsEl = document.getElementById('courseTotalCreditPoints');

    lessonOverlayEl = document.getElementById('lessonOverlay');
    lessonOverlayBodyEl = document.getElementById('lessonOverlayBody');
    const openLessonOverlayBtn = document.getElementById('openLessonOverlay');
    const applyLessonSelectionBtn = document.getElementById('applyLessonSelection');
    const cancelLessonSelectionBtn = document.getElementById('cancelLessonSelection');
    const closeLessonOverlayBtn = document.getElementById('closeLessonOverlay');

    const params = new URLSearchParams(window.location.search);
    const courseIdParam = params.get('id');

    if (!courseIdParam) {
      alert('Missing course id.');
      window.location.href = '/EduPilot/html/teacher/tCourse.html';
      return;
    }

    if (courseIdEl) {
      courseIdEl.value = courseIdParam;
    }

    const closeOverlay = () => {
      pendingLessonSelection = new Set(selectedLessonIds);
      hideLessonOverlay();
    };

    if (lessonOverlayBodyEl) {
      lessonOverlayBodyEl.addEventListener('change', (event) => {
        const target = event.target;
        if (!target || target.type !== 'checkbox') return;
        const lessonId = target.value;
        if (!lessonId) return;
        if (target.checked) {
          pendingLessonSelection.add(lessonId);
        } else {
          pendingLessonSelection.delete(lessonId);
        }
      });
    }

    if (openLessonOverlayBtn) {
      openLessonOverlayBtn.addEventListener('click', async () => {
        pendingLessonSelection = new Set(selectedLessonIds);
        if (!allLessons.length) await loadLessonsForSelection();
        renderLessonOverlayList();
        showLessonOverlay();
      });
    }

    if (applyLessonSelectionBtn) {
      applyLessonSelectionBtn.addEventListener('click', () => {
        selectedLessonIds = Array.from(pendingLessonSelection);
        renderSelectedLessons();
        hideLessonOverlay();
      });
    }

    if (cancelLessonSelectionBtn) {
      cancelLessonSelectionBtn.addEventListener('click', closeOverlay);
    }

    if (closeLessonOverlayBtn) {
      closeLessonOverlayBtn.addEventListener('click', closeOverlay);
    }

    if (lessonOverlayEl) {
      lessonOverlayEl.addEventListener('click', (event) => {
        if (event.target === lessonOverlayEl) closeOverlay();
      });
    }

    async function loadCourseDetails() {
      if (!window.supabase) {
        setTimeout(loadCourseDetails, 200);
        return;
      }

      const course = await fetchCourseRecord(courseIdParam);
      if (!course) {
        alert('Unable to load course details.');
        window.location.href = '/EduPilot/html/teacher/tCourse.html';
        return;
      }

      courseRecord = course;
      loadedCourseId = course.course_id;

      if (courseTitleEl) courseTitleEl.value = course.course_title || '';
      if (courseDescEl) courseDescEl.value = course.course_desc || '';

      const statusVal = (course.course_status || '').toLowerCase();
      if (courseStatusEl) {
        const allowed = ['draft', 'published', 'archived'];
        courseStatusEl.value = allowed.includes(statusVal) ? statusVal : 'draft';
      }

      const creditVal = course.course_credit_points ?? course.course_total_credit_pts ?? course.course_credit_pts;
      if (courseCreditEl && typeof creditVal !== 'undefined' && creditVal !== null) {
        const num = Number(creditVal);
        courseCreditEl.value = Number.isFinite(num) ? num : 0;
      }
      if (courseTotalCreditPointsEl) {
        courseTotalCreditPointsEl.value = courseCreditEl ? courseCreditEl.value : (creditVal ?? 0);
      }

      let lessonIds = normalizeArray(course.course_lessons);
      if (!lessonIds.length) {
        lessonIds = await fetchCourseLessonIds(courseIdParam);
      }
      initialLessonIds = Array.from(new Set(lessonIds));
      selectedLessonIds = Array.from(initialLessonIds);
      pendingLessonSelection = new Set(selectedLessonIds);

      await loadLessonsForSelection();
      await ensureLessonDetails(selectedLessonIds);
      renderSelectedLessons();
    }

    loadCourseDetails();

    if (!courseForm) return;

    courseForm.addEventListener('submit', async (event) => {
      event.preventDefault();

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

      const course_id = courseIdEl ? courseIdEl.value.trim() : '';
      const course_title = courseTitleEl ? courseTitleEl.value.trim() : '';
      const course_desc = courseDescEl ? courseDescEl.value.trim() : '';

      if (!course_id || !course_title) {
        alert('Course ID and Course Title are required.');
        return;
      }

      const statusRaw = courseStatusEl ? String(courseStatusEl.value || '').trim().toLowerCase() : 'draft';
      const allowedStatuses = ['draft', 'published', 'archived'];
      const course_status = allowedStatuses.includes(statusRaw) ? statusRaw : 'draft';

      const selectedLessons = Array.from(selectedLessonIds);
      await ensureLessonDetails(selectedLessons);

      const computedTotalCreditPoints = selectedLessons.reduce((sum, lid) => {
        const v = lessonCredits[lid];
        return sum + (typeof v === 'number' ? v : 0);
      }, 0);

      if (courseTotalCreditPointsEl) {
        courseTotalCreditPointsEl.value = computedTotalCreditPoints;
      }
      if (courseCreditEl) {
        courseCreditEl.value = computedTotalCreditPoints;
      }

      const course_credit_points = (function () {
        if (!courseCreditEl) return computedTotalCreditPoints;
        const v = courseCreditEl.value;
        if (v === '' || v === null || typeof v === 'undefined') return computedTotalCreditPoints;
        const n = parseInt(v, 10);
        return Number.isNaN(n) ? computedTotalCreditPoints : n;
      })();

      const course_estimated_hours = (function () {
        const totalHours = computeEstimatedHours(selectedLessons);
        return Number.isFinite(totalHours) ? totalHours : null;
      })();

      const nowIso = nowIsoUtcPlus8();

      const payload = {
        course_title,
        course_desc,
        course_lessons: selectedLessons,
        course_credit_points: computedTotalCreditPoints,
        course_status,
        course_modified: nowIso,
      };

      if (!Object.prototype.hasOwnProperty.call(payload, 'course_credit_points') &&
          courseRecord && Object.prototype.hasOwnProperty.call(courseRecord, 'course_credit_points')) {
        payload.course_credit_points = computedTotalCreditPoints;
      }
      if (courseRecord && Object.prototype.hasOwnProperty.call(courseRecord, 'course_estimated_hours')) {
        payload.course_estimated_hours = course_estimated_hours;
      }

      const initialSet = new Set(initialLessonIds);
      const currentSet = new Set(selectedLessons);
      const lessonsToAdd = selectedLessons.filter((lid) => !initialSet.has(lid));
      const lessonsToRemove = initialLessonIds.filter((lid) => !currentSet.has(lid));

      try {
        const { error } = await window.supabase
          .from('course')
          .update(payload)
          .eq('course_id', loadedCourseId || course_id);

        if (error) {
          console.error('Update course failed:', error);
          alert(`Update course failed: ${error.message}`);
          return;
        }

        if (lessonsToAdd.length) {
          const insertPayload = lessonsToAdd.map((lessonId) => ({
            course_id: course_id,
            lesson_id: lessonId,
          }));
          const { error: addError } = await window.supabase
            .from('units')
            .upsert(insertPayload, { onConflict: 'lesson_id,course_id' });
          if (addError) {
            console.error('Failed to link lessons to course:', addError);
            alert('Lessons added to course could not be saved.');
            return;
          }
        }

        if (lessonsToRemove.length) {
          const { error: removeError } = await window.supabase
            .from('units')
            .delete()
            .eq('course_id', course_id)
            .in('lesson_id', lessonsToRemove);
          if (removeError) {
            console.error('Failed to unlink lessons from course:', removeError);
            alert('Some lessons could not be removed from the course.');
            return;
          }
        }

        alert('Course updated successfully.');
        window.location.href = `/EduPilot/html/teacher/course_content.html?id=${encodeURIComponent(course_id)}`;
      } catch (err) {
        console.error('Unexpected error updating course:', err);
        alert('Unexpected error while updating the course.');
      }
    });
  });
})();
