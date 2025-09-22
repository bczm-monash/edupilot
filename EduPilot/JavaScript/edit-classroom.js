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

  async function populateForm(client, classroomId) {
    const idNumber = Number(classroomId);
    const idText = String(classroomId);

    const [{ data: classroom, error: classroomError }] = await Promise.all([
      client
        .from('classroom')
        .select('classroom_id, classroom_title, classroom_start_date, classroom_end_date, course_id, users_id')
        .eq('classroom_id', idNumber)
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
      .eq('classroom_id', idNumber);

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

      const classroom_id = Number(idEl?.value || classroomId);
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
        users_id: user.id,
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
            .eq('classroom_id', String(classroom_id))
            .in('lesson_id', lessonsToRemove);
          if (error) throw error;
        }

        if (lessonsToAdd.length) {
          const payload = lessonsToAdd.map((lessonId) => ({
            classroom_id: String(classroom_id),
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
            classroom_id,
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialise);
  } else {
    initialise();
  }
})();
