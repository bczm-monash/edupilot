(function () {
  const COURSE_SELECT_ID = 'courseID';

  const pickers = [];

  function supabaseClient() {
    return window.supabase || null;
  }

  function normaliseId(value) {
    if (value === null || typeof value === 'undefined') return '';
    return String(value).trim();
  }

  function createPicker(config) {
    const {
      displayId,
      hiddenId,
      overlayId,
      overlayBodyId,
      openButtonId,
      applyButtonId,
      cancelButtonId,
      closeButtonId,
      emptyCourseMessage,
      emptyItemsMessage,
      loadingMessage,
      requiredMessage,
      fetchItems,
      rowClassName,
    } = config;

    const state = {
      displayEl: null,
      hiddenEl: null,
      overlayEl: null,
      overlayBodyEl: null,
      openButtonEl: null,
      applyButtonEl: null,
      cancelButtonEl: null,
      closeButtonEl: null,
      currentCourseId: '',
      isLoading: false,
      loadError: '',
      items: [],
      metadataById: {},
      selectedIds: [],
      pendingSelection: new Set(),
    };

    function setValidity() {
      if (!state.hiddenEl) return;
      const hasSelection = state.selectedIds.length > 0;
      state.hiddenEl.setCustomValidity(hasSelection ? '' : requiredMessage || '');
    }

    function syncSelectionFromHidden() {
      if (!state.hiddenEl) return;
      const value = state.hiddenEl.value || '';
      state.selectedIds = value
        .split(',')
        .map((id) => normaliseId(id))
        .filter(Boolean);
      state.pendingSelection = new Set(state.selectedIds);
      renderDisplay();
    }

    function renderDisplay() {
      if (!state.displayEl || !state.hiddenEl) return;

      const lines = state.selectedIds.map((id) => {
        const meta = state.metadataById[id];
        if (!meta) return id;
        return meta.textValue || `${id} - ${meta.title}`;
      });

      state.displayEl.value = lines.join('\n');
      state.hiddenEl.value = state.selectedIds.join(',');
      setValidity();
    }

    function renderOverlay() {
      if (!state.overlayBodyEl) return;

      state.overlayBodyEl.innerHTML = '';

      if (!state.currentCourseId) {
        appendMessage(emptyCourseMessage);
        return;
      }

      if (state.isLoading) {
        appendMessage(loadingMessage);
        return;
      }

      if (state.loadError) {
        appendMessage(state.loadError);
        return;
      }

      if (!state.items.length) {
        appendMessage(emptyItemsMessage);
        return;
      }

      const fragment = document.createDocumentFragment();

      state.items.forEach((item) => {
        const label = document.createElement('label');
        label.className = rowClassName;
        label.setAttribute('data-item-id', item.id);

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = item.id;
        checkbox.checked = state.pendingSelection.has(item.id);
        checkbox.className = `${rowClassName}-checkbox`;

        const content = document.createElement('div');

        const titleEl = document.createElement('strong');
        titleEl.textContent = item.title || 'Untitled';

        const metaEl = document.createElement('span');
        metaEl.textContent = item.subtitle || item.id;

        content.appendChild(titleEl);
        content.appendChild(metaEl);

        label.appendChild(checkbox);
        label.appendChild(content);

        fragment.appendChild(label);
      });

      state.overlayBodyEl.appendChild(fragment);
    }

    function appendMessage(text) {
      const message = document.createElement('div');
      message.className = 'muted';
      message.textContent = text;
      state.overlayBodyEl.appendChild(message);
    }

    function showOverlay() {
      if (!state.overlayEl) return;
      state.overlayEl.style.display = 'flex';
    }

    function hideOverlay() {
      if (!state.overlayEl) return;
      state.overlayEl.style.display = 'none';
    }

    function resetPendingSelection() {
      state.pendingSelection = new Set(state.selectedIds);
    }

    function updateOpenButtonState() {
      if (!state.openButtonEl) return;
      const hasCourse = Boolean(state.currentCourseId);
      state.openButtonEl.disabled = !hasCourse || state.isLoading;
      if (!hasCourse) {
        state.openButtonEl.title = 'Select a course first';
      } else if (state.isLoading) {
        state.openButtonEl.title = 'Loading data...';
      } else if (state.loadError) {
        state.openButtonEl.title = state.loadError;
      } else if (!state.items.length) {
        state.openButtonEl.title = emptyItemsMessage;
      } else {
        state.openButtonEl.removeAttribute('title');
      }
    }

    async function loadItems(courseId) {
      const client = supabaseClient();
      if (!client) {
        state.loadError = 'Supabase not ready yet. Please try again.';
        state.items = [];
        state.metadataById = {};
        state.selectedIds = [];
        resetPendingSelection();
        renderDisplay();
        renderOverlay();
        updateOpenButtonState();
        return;
      }

      state.isLoading = true;
      state.loadError = '';
      state.items = [];
      state.metadataById = {};
      resetPendingSelection();
      renderOverlay();
      updateOpenButtonState();

      try {
        const items = await fetchItems(client, courseId);
        state.items = Array.isArray(items) ? items : [];
        state.metadataById = {};
        state.items.forEach((item) => {
          state.metadataById[item.id] = item;
        });

        const availableIds = new Set(state.items.map((item) => item.id));
        state.selectedIds = state.selectedIds.filter((id) => availableIds.has(id));
        resetPendingSelection();
        renderDisplay();
      } catch (error) {
        console.error('Failed to load picker data:', error);
        state.loadError = 'Failed to load data. Please try again.';
        state.items = [];
        state.metadataById = {};
        state.selectedIds = [];
        resetPendingSelection();
        renderDisplay();
      } finally {
        state.isLoading = false;
        renderOverlay();
        updateOpenButtonState();
      }
    }

    function handleCourseChange(newCourseId) {
      if (newCourseId === state.currentCourseId) return;
      state.currentCourseId = newCourseId;

      if (!state.currentCourseId) {
        state.items = [];
        state.metadataById = {};
        state.selectedIds = [];
        resetPendingSelection();
        renderDisplay();
        renderOverlay();
        updateOpenButtonState();
        return;
      }

      state.selectedIds = [];
      resetPendingSelection();
      renderDisplay();
      loadItems(state.currentCourseId);
    }

    function attachEvents() {
      if (state.openButtonEl) {
        state.openButtonEl.addEventListener('click', () => {
          if (!state.currentCourseId) {
            updateOpenButtonState();
            return;
          }

          resetPendingSelection();
          renderOverlay();
          showOverlay();
        });
      }

      if (state.applyButtonEl) {
        state.applyButtonEl.addEventListener('click', () => {
          state.selectedIds = Array.from(state.pendingSelection);
          renderDisplay();
          hideOverlay();
        });
      }

      const cancelOverlay = () => {
        resetPendingSelection();
        hideOverlay();
      };

      if (state.cancelButtonEl) state.cancelButtonEl.addEventListener('click', cancelOverlay);
      if (state.closeButtonEl) state.closeButtonEl.addEventListener('click', cancelOverlay);
      if (state.overlayEl) {
        state.overlayEl.addEventListener('click', (event) => {
          if (event.target === state.overlayEl) cancelOverlay();
        });
      }

      if (state.overlayBodyEl) {
        state.overlayBodyEl.addEventListener('change', (event) => {
          const target = event.target;
          if (!target || target.type !== 'checkbox') return;
          const id = normaliseId(target.value);
          if (!id) return;
          if (target.checked) {
            state.pendingSelection.add(id);
          } else {
            state.pendingSelection.delete(id);
          }
        });
      }
    }

    function initElements() {
      state.displayEl = document.getElementById(displayId);
      state.hiddenEl = document.getElementById(hiddenId);
      state.overlayEl = document.getElementById(overlayId);
      state.overlayBodyEl = document.getElementById(overlayBodyId);
      state.openButtonEl = document.getElementById(openButtonId);
      state.applyButtonEl = document.getElementById(applyButtonId);
      state.cancelButtonEl = document.getElementById(cancelButtonId);
      state.closeButtonEl = document.getElementById(closeButtonId);

      if (!state.displayEl || !state.hiddenEl) return false;

      const initialValue = normaliseId(state.hiddenEl.value);
      if (initialValue) {
        state.selectedIds = initialValue
          .split(',')
          .map((id) => normaliseId(id))
          .filter(Boolean);
        state.pendingSelection = new Set(state.selectedIds);
      }

      renderDisplay();
      attachEvents();
      updateOpenButtonState();
      return true;
    }

    function onSupabaseReady(courseId) {
      if (!courseId) return;
      loadItems(courseId);
    }

    return {
      init: initElements,
      handleCourseChange,
      onSupabaseReady,
      renderDisplay,
      syncSelectionFromHidden,
      setCurrentCourse(courseId) {
        state.currentCourseId = courseId;
        updateOpenButtonState();
        if (courseId) loadItems(courseId);
      },
    };
  }

  function createLessonPicker() {
    return createPicker({
      displayId: 'classroomLessonsDisplay',
      hiddenId: 'classroomLessons',
      overlayId: 'classroomLessonOverlay',
      overlayBodyId: 'classroomLessonOverlayBody',
      openButtonId: 'openClassroomLessonOverlay',
      applyButtonId: 'applyClassroomLessonSelection',
      cancelButtonId: 'cancelClassroomLessonSelection',
      closeButtonId: 'closeClassroomLessonOverlay',
      emptyCourseMessage: 'Select a course to view lessons.',
      emptyItemsMessage: 'No lessons linked to this course.',
      loadingMessage: 'Loading lessons...',
      requiredMessage: 'Please select at least one lesson.',
      rowClassName: 'lesson-row',
      fetchItems: async (client, courseId) => {
        const { data: unitRows, error: unitsError } = await client
          .from('units')
          .select('lesson_id')
          .eq('course_id', courseId);

        if (unitsError) throw unitsError;

        const lessonIds = (unitRows || [])
          .map((row) => normaliseId(row.lesson_id))
          .filter(Boolean);

        if (!lessonIds.length) return [];

        const { data: lessonRows, error: lessonsError } = await client
          .from('lesson')
          .select('lesson_id, lesson_title, lesson_credit_pts')
          .in('lesson_id', lessonIds);

        if (lessonsError) throw lessonsError;

        const lessonById = new Map();
        (lessonRows || []).forEach((row) => {
          const id = normaliseId(row.lesson_id);
          if (id) lessonById.set(id, row);
        });

        return lessonIds
          .map((id) => lessonById.get(id))
          .filter(Boolean)
          .map((lesson) => {
            const credit = Number(lesson.lesson_credit_pts);
            const subtitle = Number.isFinite(credit)
              ? `ID: ${lesson.lesson_id} | Credit Points: ${credit}`
              : `ID: ${lesson.lesson_id}`;
            return {
              id: normaliseId(lesson.lesson_id),
              title: lesson.lesson_title || 'Untitled lesson',
              subtitle,
              textValue: lesson.lesson_title
                ? `${lesson.lesson_id} - ${lesson.lesson_title}`
                : lesson.lesson_id,
            };
          });
      },
    });
  }

  function createStudentPicker() {
    return createPicker({
      displayId: 'classroomStudentsDisplay',
      hiddenId: 'classroomStudents',
      overlayId: 'classroomStudentOverlay',
      overlayBodyId: 'classroomStudentOverlayBody',
      openButtonId: 'openClassroomStudentOverlay',
      applyButtonId: 'applyClassroomStudentSelection',
      cancelButtonId: 'cancelClassroomStudentSelection',
      closeButtonId: 'closeClassroomStudentOverlay',
      emptyCourseMessage: 'Select a course to view enrolled students.',
      emptyItemsMessage: 'No students enrolled in this course.',
      loadingMessage: 'Loading students...',
      requiredMessage: '',
      rowClassName: 'student-row',
      fetchItems: async (client, courseId) => {
        const { data, error } = await client
          .from('enrolment')
          .select('user_id, users(users_fname, users_lname, users_email)')
          .eq('course_id', courseId);

        if (error) throw error;

        const items = Array.isArray(data) ? data : [];
        const uniqueMap = new Map();

        items.forEach((row) => {
          const id = normaliseId(row.user_id);
          if (!id) return;
          const user = row.users || {};
          const nameParts = [user.users_fname, user.users_lname].filter(Boolean);
          const name = nameParts.join(' ') || user.users_email || id;
          const email = normaliseId(user.users_email);
          const title = name;
          const subtitle = email ? `ID: ${id} | Email: ${email}` : `ID: ${id}`;
          const textValue = email ? `${name} (${email})` : `${name}`;
          uniqueMap.set(id, {
            id,
            title,
            subtitle,
            textValue,
          });
        });

        return Array.from(uniqueMap.values());
      },
    });
  }

  function init() {
    const courseSelect = document.getElementById(COURSE_SELECT_ID);
    if (!courseSelect) return;

    const lessonPicker = createLessonPicker();
    const studentPicker = createStudentPicker();

    const pickersToInit = [lessonPicker, studentPicker];
    pickersToInit.forEach((picker) => {
      if (picker.init()) pickers.push(picker);
    });

    const currentCourseId = normaliseId(courseSelect.value);
    pickers.forEach((picker) => picker.handleCourseChange(currentCourseId));

    courseSelect.addEventListener('change', () => {
      const newCourseId = normaliseId(courseSelect.value);
      pickers.forEach((picker) => picker.handleCourseChange(newCourseId));
    });
  }

  function onSupabaseReady() {
    const courseSelect = document.getElementById(COURSE_SELECT_ID);
    if (!courseSelect) return;
    const courseId = normaliseId(courseSelect.value);
    pickers.forEach((picker) => picker.onSupabaseReady(courseId));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('supabase-ready', onSupabaseReady);

  document.addEventListener('classroom-picker-sync', () => {
    pickers.forEach((picker) => {
      if (typeof picker.syncSelectionFromHidden === 'function') {
        picker.syncSelectionFromHidden();
      }
    });
  });
})();
