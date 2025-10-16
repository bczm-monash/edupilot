(function () {
  function ensureSupabase() {
    return new Promise((resolve) => {
      if (window.supabase) {
        resolve(window.supabase);
        return;
      }
      document.addEventListener('supabase-ready', (event) => {
        resolve(event.detail?.supabase || window.supabase);
      }, { once: true });
    });
  }

  async function ensureAuth(client) {
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) return { user: null };
    return { user: data.user };
  }

  function getClassroomId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id')?.trim() || '';
  }

  function parseDateValue(value) {
    if (!value) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;

    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const isoDate = new Date(trimmed);
      return Number.isNaN(isoDate.getTime()) ? null : isoDate;
    }

    const match = trimmed.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{4})$/);
    if (match) {
      const [, d, m, y] = match;
      const parsed = new Date(Number(y), Number(m) - 1, Number(d));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }

  function dateToIso(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatStorageDate(isoValue) {
    if (!isoValue) return '';
    const parts = String(isoValue).split('-');
    if (parts.length !== 3) return isoValue;
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }

  function normaliseListValue(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((id) => String(id).trim()).filter(Boolean);
    return String(value)
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }

  async function applyCourseSelection(selectEl, courseId, courseTitle) {
    if (!selectEl || !courseId) return;

    let option = Array.from(selectEl.options).find((opt) => opt.value === courseId);
    if (!option) {
      option = document.createElement('option');
      option.value = courseId;
      option.textContent = courseTitle || courseId;
      selectEl.appendChild(option);
    }

    selectEl.value = courseId;
    selectEl.dataset.currentValue = courseId;
    selectEl.dispatchEvent(new Event('change'));
  }

  function setDateInputs(startIso, endIso) {
    const startEl = document.getElementById('start');
    const endEl = document.getElementById('Duration');
    if (startEl) {
      startEl.value = startIso || '';
      startEl.dispatchEvent(new Event('change'));
    }
    if (endEl) {
      endEl.value = endIso || '';
      endEl.dispatchEvent(new Event('change'));
    }
  }

  function syncPickers() {
    document.dispatchEvent(new CustomEvent('classroom-picker-sync'));
  }

  // Ownership change functionality
  let instructors = [];
  let selectedOwnerId = null;

  async function fetchInstructors(client) {
    const { data: users, error } = await client
      .from('users')
      .select('users_id, users_title, users_fname, users_lname, users_email, users_role')
      .order('users_fname', { ascending: true });

    if (error) throw error;

    return (users || [])
      .filter(user => {
        const role = (user?.users_role || '').toLowerCase();
        return role === 'teacher' || role === 'instructor';
      })
      .map(user => ({
        id: user.users_id,
        name: [user.users_title, user.users_fname, user.users_lname]
          .filter(Boolean)
          .join(' '),
        email: user.users_email || '',
      }));
  }

  function renderOwnershipOverlay() {
    const overlayBody = document.getElementById('ownershipOverlayBody');
    if (!overlayBody) return;

    overlayBody.innerHTML = '';

    if (!instructors.length) {
      overlayBody.innerHTML = '<div class="muted">No instructors available.</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    instructors.forEach(inst => {
      const row = document.createElement('div');
      row.className = 'list-row';

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'ownerSelection';
      radio.value = inst.id;
      radio.className = 'rowRadio';

      const label = document.createElement('span');
      label.textContent = `${inst.name} (${inst.email})`;

      row.appendChild(radio);
      row.appendChild(label);
      fragment.appendChild(row);
    });

    overlayBody.appendChild(fragment);
  }

  function showOwnershipOverlay() {
    const overlay = document.getElementById('ownershipOverlay');
    if (overlay) {
      overlay.style.display = 'flex';
      renderOwnershipOverlay();
    }
  }

  function hideOwnershipOverlay() {
    const overlay = document.getElementById('ownershipOverlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  async function applyOwnershipChange(client, classroomId, userId) {
    if (!selectedOwnerId) {
      alert('Please select an owner.');
      return;
    }

    try {
      // Check if current user is the owner
      const { data: classroom, error: fetchError } = await client
        .from('classroom')
        .select('users_id')
        .eq('classroom_id', classroomId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!classroom) throw new Error('Classroom not found');
      if (classroom.users_id !== userId) {
        alert('Only the current owner can transfer ownership.');
        return;
      }

      const { error } = await client
        .from('classroom')
        .update({ users_id: selectedOwnerId })
        .eq('classroom_id', classroomId);

      if (error) throw error;

      alert('Ownership updated successfully.');
      hideOwnershipOverlay();
    } catch (error) {
      console.error('Failed to update ownership:', error);
      alert('Failed to update ownership.');
    }
  }

  async function populateForm(client, classroomId) {
    const idText = String(classroomId);

    const [{ data: classroom, error: classroomError }] = await Promise.all([
      client
        .from('classroom')
        .select('classroom_id, classroom_title, classroom_start_date, classroom_end_date, course_id, users_id')
        .eq('classroom_id', idText)
        .maybeSingle(),
    ]);

    if (classroomError) throw classroomError;
    if (!classroom) throw new Error('Classroom not found');

    const lessonsPromise = client
      .from('classroom_lesson')
      .select('lesson_id')
      .eq('classroom_id', idText);

    const studentsPromise = client
      .from('classmate')
      .select('users_id')
      .eq('classroom_id', idText);

    const [lessonRes, studentRes] = await Promise.all([lessonsPromise, studentsPromise]);

    if (lessonRes.error) throw lessonRes.error;
    if (studentRes.error) throw studentRes.error;

    const lessonIds = (lessonRes.data || []).map((row) => row.lesson_id).filter(Boolean);
    const studentIds = (studentRes.data || []).map((row) => row.users_id).filter(Boolean);

    const idEl = document.getElementById('ClassroomID');
    const nameEl = document.getElementById('ClassroomName');
    const courseEl = document.getElementById('courseID');
    const lessonsHiddenEl = document.getElementById('classroomLessons');
    const studentsHiddenEl = document.getElementById('classroomStudents');

    if (idEl) idEl.value = classroom.classroom_id ?? '';
    if (nameEl) nameEl.value = classroom.classroom_title || '';

    const startDate = parseDateValue(classroom.classroom_start_date);
    const endDate = parseDateValue(classroom.classroom_end_date);
    const startIso = dateToIso(startDate);
    const endIso = dateToIso(endDate);
    setDateInputs(startIso, endIso);

    const courseTitle = classroom.course_id || '';
    await applyCourseSelection(courseEl, classroom.course_id || '', courseTitle);

    if (lessonsHiddenEl) lessonsHiddenEl.value = lessonIds.join(',');
    if (studentsHiddenEl) studentsHiddenEl.value = studentIds.join(',');

    syncPickers();

    // Fetch instructors for ownership change
    try {
      instructors = await fetchInstructors(client);
    } catch (error) {
      console.error('Failed to fetch instructors:', error);
    }

    return {
      classroom,
      lessonIds,
      studentIds,
    };
  }

  async function initialise() {
    const classroomId = getClassroomId();
    if (!classroomId) {
      alert('Missing classroom ID.');
      toTClassroom?.();
      return;
    }

    const client = await ensureSupabase();

    let initialLessonIds = [];
    let initialStudentIds = [];

    try {
      const result = await populateForm(client, classroomId);
      initialLessonIds = result.lessonIds;
      initialStudentIds = result.studentIds;
    } catch (error) {
      console.error('Failed to load classroom for editing:', error);
      alert('Unable to load classroom details.');
      toTClassroom?.();
      return;
    }

    const form = document.getElementById('editClassroomForm');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const { user } = await ensureAuth(client);
      if (!user) {
        alert('Please log in first.');
        if (typeof toLogin === 'function') toLogin();
        return;
      }

      const idEl = document.getElementById('ClassroomID');
      const nameEl = document.getElementById('ClassroomName');
      const courseEl = document.getElementById('courseID');
      const lessonsHiddenEl = document.getElementById('classroomLessons');
      const studentsHiddenEl = document.getElementById('classroomStudents');
      const startEl = document.getElementById('start');
      const endEl = document.getElementById('Duration');

  const classroom_id = (idEl?.value || classroomId || '').trim();
      const classroom_title = (nameEl?.value || '').trim();
      const course_id = courseEl?.value || '';
      const startIso = startEl?.value || '';
      const endIso = endEl?.value || '';

      const lessonIds = normaliseListValue(lessonsHiddenEl?.value || '');
      const studentIds = normaliseListValue(studentsHiddenEl?.value || '');

      if (!classroom_id || !classroom_title) {
        alert('Classroom ID and name are required.');
        return;
      }

      if (!course_id) {
        alert('Please select a course.');
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

      const classroom_start_date = formatStorageDate(startIso);
      const classroom_end_date = formatStorageDate(endIso);

      const updatePayload = {
        classroom_title,
        course_id,
        classroom_start_date,
        classroom_end_date,
      };

      const lessonSetInitial = new Set(initialLessonIds);
      const lessonSetCurrent = new Set(lessonIds);
      const lessonsToAdd = lessonIds.filter((id) => !lessonSetInitial.has(id));
      const lessonsToRemove = initialLessonIds.filter((id) => !lessonSetCurrent.has(id));

      const studentSetInitial = new Set(initialStudentIds);
      const studentSetCurrent = new Set(studentIds);
      const studentsToAdd = studentIds.filter((id) => !studentSetInitial.has(id));
      const studentsToRemove = initialStudentIds.filter((id) => !studentSetCurrent.has(id));

      try {
        const { error: updateError } = await client
          .from('classroom')
          .update(updatePayload)
          .eq('classroom_id', classroom_id);

        if (updateError) throw updateError;

        if (lessonsToRemove.length) {
          const { error } = await client
            .from('classroom_lesson')
            .delete()
            .eq('classroom_id', classroom_id)
            .in('lesson_id', lessonsToRemove);
          if (error) throw error;
        }

        if (lessonsToAdd.length) {
          const payload = lessonsToAdd.map((lessonId) => ({
            classroom_id: classroom_id,
            lesson_id: lessonId,
          }));
          const { error } = await client
            .from('classroom_lesson')
            .insert(payload);
          if (error) throw error;
        }

        if (studentsToRemove.length) {
          const { error } = await client
            .from('classmate')
            .delete()
            .eq('classroom_id', classroom_id)
            .in('users_id', studentsToRemove);
          if (error) throw error;
        }

        if (studentsToAdd.length) {
          const payload = studentsToAdd.map((studentId) => ({
            classroom_id: classroom_id,
            users_id: studentId,
          }));
          const { error } = await client
            .from('classmate')
            .insert(payload);
          if (error) throw error;
        }

  alert('Classroom updated successfully.');
  window.location.href = `/EduPilot/html/teacher/classroom_content.html?id=${encodeURIComponent(classroom_id)}`;
      } catch (error) {
        console.error('Failed to update classroom:', error);
        alert(error?.message || 'Failed to update classroom.');
      }
    });
  }

  // Ownership change event listeners
  const changeOwnershipBtn = document.getElementById('changeOwnershipBtn');
  const closeOwnershipOverlayBtn = document.getElementById('closeOwnershipOverlay');
  const cancelOwnershipSelectionBtn = document.getElementById('cancelOwnershipSelection');
  const applyOwnershipSelectionBtn = document.getElementById('applyOwnershipSelection');

  changeOwnershipBtn?.addEventListener('click', () => {
    selectedOwnerId = null;
    showOwnershipOverlay();
  });

  closeOwnershipOverlayBtn?.addEventListener('click', hideOwnershipOverlay);
  cancelOwnershipSelectionBtn?.addEventListener('click', hideOwnershipOverlay);

  applyOwnershipSelectionBtn?.addEventListener('click', async () => {
    const selectedRadio = document.querySelector('input[name="ownerSelection"]:checked');
    if (selectedRadio) {
      selectedOwnerId = selectedRadio.value;
      const classroomId = getClassroomId();
      const client = await ensureSupabase();
      const { user } = await ensureAuth(client);
      if (!user) {
        alert('Please log in first.');
        return;
      }
      await applyOwnershipChange(client, classroomId, user.id);
    } else {
      alert('Please select an owner.');
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialise);
  } else {
    initialise();
  }
})();
