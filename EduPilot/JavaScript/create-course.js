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

  const lessonCredits = {};
  const lessonMetadata = {};
  let allLessons = [];
  let selectedLessonIds = [];
  let pendingLessonSelection = new Set();
  let isLessonFetchInProgress = false;
  let lessonsLoadError = '';

  let selectedLessonsDisplayEl = null;
  let courseLessonsHiddenEl = null;
  let courseCreditEl = null;
  let courseTotalCreditPointsEl = null;
  let lessonOverlayEl = null;
  let lessonOverlayBodyEl = null;

  function renderSelectedLessons() {
    const availableIds = selectedLessonIds.filter((id) => Boolean(lessonMetadata[id]));
    if (availableIds.length !== selectedLessonIds.length) {
      selectedLessonIds = availableIds;
    }

    const textValue = selectedLessonIds.map((id) => {
      const meta = lessonMetadata[id] || {};
      const titlePart = meta.lesson_title ? ` - ${meta.lesson_title}` : '';
      return `${id}${titlePart}`;
    }).join('\n');

    if (selectedLessonsDisplayEl) {
      selectedLessonsDisplayEl.value = textValue;
    }

    if (courseLessonsHiddenEl) {
      courseLessonsHiddenEl.value = selectedLessonIds.join(',');
    }

    const totalCredits = selectedLessonIds.reduce((sum, lessonId) => {
      const value = lessonCredits[lessonId];
      return sum + (typeof value === 'number' && Number.isFinite(value) ? value : 0);
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

    if (lessonsLoadError) {
      const errorEl = document.createElement('div');
      errorEl.className = 'muted';
      errorEl.textContent = lessonsLoadError;
      lessonOverlayBodyEl.appendChild(errorEl);
      return;
    }

    if (isLessonFetchInProgress) {
      const loadingEl = document.createElement('div');
      loadingEl.className = 'muted';
      loadingEl.textContent = 'Loading lessons...';
      lessonOverlayBodyEl.appendChild(loadingEl);
      return;
    }

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
    if (!lessonOverlayEl) return;
    lessonOverlayEl.style.display = 'flex';
  }

  function hideLessonOverlay() {
    if (!lessonOverlayEl) return;
    lessonOverlayEl.style.display = 'none';
  }

  async function loadLessonsForSelection(retryAttempt = 0) {
    if (!isLessonFetchInProgress) {
      isLessonFetchInProgress = true;
      lessonsLoadError = '';
      renderLessonOverlayList();
    }

    if (!window.supabase) {
      if (retryAttempt < 3) {
        setTimeout(() => loadLessonsForSelection(retryAttempt + 1), 500 * (retryAttempt + 1));
      } else {
        isLessonFetchInProgress = false;
        lessonsLoadError = 'Unable to load lessons. Please refresh and try again.';
        renderLessonOverlayList();
      }
      return;
    }

    const { data, error } = await window.supabase
      .from('lesson')
      .select('lesson_id, lesson_title, lesson_credit_pts')
      .order('lesson_id', { ascending: true });

    if (error) {
      console.error('Failed to load lessons for course select:', error);
      isLessonFetchInProgress = false;
      lessonsLoadError = 'Failed to load lessons. Please try again.';
      renderLessonOverlayList();
      return;
    }

    isLessonFetchInProgress = false;
    lessonsLoadError = '';
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

  document.addEventListener('DOMContentLoaded', () => {
    const courseForm = document.getElementById('createCourseForm');
    const courseIdEl = document.getElementById('courseId') || document.getElementById('lessonId');
    const courseTitleEl = document.getElementById('courseTitle') || document.getElementById('title');
    const courseDescEl = document.getElementById('courseDescription') || document.getElementById('description');
    courseLessonsHiddenEl = document.getElementById('courseLessons');
    selectedLessonsDisplayEl = document.getElementById('selectedLessonsDisplay');
    courseCreditEl = document.getElementById('courseCreditPoints') || document.getElementById('initialCreditPoints');
    const courseEstimatedHoursEl = document.getElementById('courseEstimatedHours');

    const courseStatusEl = document.getElementById('courseStatus') || document.getElementById('status');
    courseTotalCreditPointsEl = document.getElementById('courseTotalCreditPoints');

    lessonOverlayEl = document.getElementById('lessonOverlay');
    lessonOverlayBodyEl = document.getElementById('lessonOverlayBody');
    const openLessonOverlayBtn = document.getElementById('openLessonOverlay');
    const applyLessonSelectionBtn = document.getElementById('applyLessonSelection');
    const cancelLessonSelectionBtn = document.getElementById('cancelLessonSelection');
    const closeLessonOverlayBtn = document.getElementById('closeLessonOverlay');

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

    const closeOverlay = () => {
      pendingLessonSelection = new Set(selectedLessonIds);
      hideLessonOverlay();
    };

    if (openLessonOverlayBtn) {
      openLessonOverlayBtn.addEventListener('click', () => {
        pendingLessonSelection = new Set(selectedLessonIds);
        const shouldReloadLessons = !isLessonFetchInProgress && (lessonsLoadError !== '' || !allLessons.length);
        if (shouldReloadLessons) {
          loadLessonsForSelection();
        }
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
        if (event.target === lessonOverlayEl) {
          closeOverlay();
        }
      });
    }

    if (courseLessonsHiddenEl && typeof courseLessonsHiddenEl.value === 'string' && courseLessonsHiddenEl.value.trim() !== '') {
      selectedLessonIds = courseLessonsHiddenEl.value.split(',').map((id) => id.trim()).filter(Boolean);
      pendingLessonSelection = new Set(selectedLessonIds);
    }

    loadLessonsForSelection();
    renderSelectedLessons();

    if (!courseForm) return;

    courseForm.addEventListener('submit', async (e) => {
      e.preventDefault();

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

      const selectedLessons = Array.from(selectedLessonIds);

      const computedTotalCreditPoints = selectedLessons.reduce((sum, lid) => {
        const v = lessonCredits[lid];
        return sum + (typeof v === 'number' ? v : 0);
      }, 0);

      if (courseTotalCreditPointsEl) {
        courseTotalCreditPointsEl.value = computedTotalCreditPoints;
      }

      const users_id = user.id;
      const nowIso = nowIsoUtcPlus8();

      const course_credit_points = (function() {
        if (!courseCreditEl) return computedTotalCreditPoints;
        const v = courseCreditEl.value;
        if (v === '' || v === null || typeof v === 'undefined') return computedTotalCreditPoints;
        const n = parseInt(v, 10);
        return Number.isNaN(n) ? computedTotalCreditPoints : n;
      })();

      const course_estimated_hours = (function() {
        if (!courseEstimatedHoursEl) return null;
        const v = courseEstimatedHoursEl.value;
        if (v === '' || v === null || typeof v === 'undefined') return null;
        const n = parseInt(v, 10);
        return Number.isNaN(n) ? null : n;
      })();

      if (!course_id || !course_title) {
        alert('Please fill in Course ID and Course Title.');
        return;
      }

      const status = (courseStatusEl && courseStatusEl.value) ? String(courseStatusEl.value).trim() : 'draft'; 
      const allowedStatuses = ['draft', 'published', 'archived']; 
      const course_status = allowedStatuses.includes(status) ? status : 'draft';

      const payload = {
        course_id,
        course_title,
        course_desc,
        course_credit_points: computedTotalCreditPoints,
        users_id,
        course_date_created: nowIso,
        course_modified: nowIso,
        course_status: course_status,
      };

      try {
        const { error } = await window.supabase
          .from('course')
          .insert([payload]);

        if (error) {
          const msg = String(error.message || '');
          const details = String(error.details || '');
          const isUniqueViolation =
            error.code === '23505' ||
            /duplicate key|unique constraint|already exists/i.test(msg) ||
            /course_pk|unique/i.test(details);

          if (isUniqueViolation) {
            alert('A course with this Course ID already exists. Please choose a different Course ID.');
          } else {
            alert(`Create course failed: ${error.message}`);
          }
          return;
        }

        if (selectedLessons.length) {
          const unitsPayload = selectedLessons.map((lessonId) => ({
            course_id,
            lesson_id: lessonId,
          }));

          const { error: unitsError } = await window.supabase
            .from('units')
            .insert(unitsPayload);

          if (unitsError) {
            console.error('Failed to link lessons in units table:', unitsError);
            alert('Course created, but failed to link lessons.');
            return;
          }
        }

        alert('Course created successfully.');
        if (typeof toTCourse === 'function') {
          toTCourse();
        } else {
          window.location.href = '/EduPilot/html/teacher/tCourse.html';
        }
      } catch (err) {
        alert(`Unexpected error: ${err.message || err}`);
      }
    });
  });
})();
