// list_students.js

const editBtn = document.getElementById('editToggle');
const overlay = document.getElementById('editOverlay');
const closeOverlayBtn = document.getElementById('closeOverlay');
const deleteBtn = document.getElementById('deleteSelected');
const selectAllChk = document.getElementById('selectAllChk');
const overlayBody = document.getElementById('overlayBody');
const studentListEl = document.getElementById('studentList');

let students = [];
let supabaseClient = null;
const context = (document.body?.dataset?.studentsContext || 'admin').toLowerCase();
const isAdminView = context === 'admin';
const isTeacherView = context === 'teacher';

const teacherState = {
  teacherId: null,
  courseIds: [],
  courseInfo: new Map(),
  classroomIds: [],
  classroomInfo: new Map(),
  studentDetails: new Map(),
};

function waitForSupabase(timeoutMs = 6000) {
  if (window.supabase) {
    return Promise.resolve(window.supabase);
  }

  return new Promise((resolve, reject) => {
    const onReady = (event) => {
      cleanup();
      resolve(event?.detail?.supabase || window.supabase);
    };

    const cleanup = () => {
      document.removeEventListener('supabase-ready', onReady);
      if (timer) {
        clearTimeout(timer);
      }
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

function renderMessage(message) {
  if (!studentListEl) return;
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = 3;
  cell.className = 'muted';
  cell.textContent = message;
  row.appendChild(cell);
  studentListEl.innerHTML = '';
  studentListEl.appendChild(row);
}

function formatName({ users_title, users_fname, users_lname, users_email }) {
  const parts = [users_title, users_fname, users_lname]
    .map(part => (typeof part === 'string' ? part.trim() : part))
    .filter(Boolean);
  if (parts.length) {
    return parts.join(' ');
  }
  return users_email || 'Unknown';
}

function renderStudents() {
  if (!studentListEl) return;

  studentListEl.innerHTML = '';
  if (!students.length) {
    renderMessage('No students found.');
    return;
  }

  const fragment = document.createDocumentFragment();

  students.forEach(stu => {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.textContent = stu.name;

    const emailTd = document.createElement('td');
    emailTd.textContent = stu.email || '—';

    const actionTd = document.createElement('td');
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'delete-btn';
    removeBtn.dataset.id = stu.id;
    removeBtn.textContent = isAdminView ? 'Remove' : 'Remove Access';
    if (isTeacherView) {
      const courses = Array.isArray(stu.courseNames) && stu.courseNames.length
        ? `Courses: ${stu.courseNames.join(', ')}`
        : 'Courses: None';
      const classrooms = Array.isArray(stu.classroomNames) && stu.classroomNames.length
        ? `Classrooms: ${stu.classroomNames.join(', ')}`
        : 'Classrooms: None';
      removeBtn.title = `${courses}\n${classrooms}`;
    }
    actionTd.appendChild(removeBtn);

    tr.appendChild(nameTd);
    tr.appendChild(emailTd);
    tr.appendChild(actionTd);

    fragment.appendChild(tr);
  });

  studentListEl.appendChild(fragment);

  if (editBtn) {
    const hasStudents = students.length > 0;
    editBtn.disabled = !hasStudents;
    editBtn.style.opacity = hasStudents ? '1' : '0.6';
  }
}

function renderOverlayList() {
  if (!overlayBody) return;

  overlayBody.innerHTML = '';

  if (!students.length) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'muted';
    emptyMsg.textContent = 'No students available.';
    overlayBody.appendChild(emptyMsg);
    return;
  }

  const fragment = document.createDocumentFragment();

  students.forEach(stu => {
    const row = document.createElement('div');
    row.className = 'list-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'rowChk';
    checkbox.dataset.id = stu.id;

    const label = document.createElement('span');
    const baseLabel = `${stu.name} (${stu.email || '—'})`;
    if (isTeacherView) {
      const info = [];
      if (Array.isArray(stu.courseNames) && stu.courseNames.length) {
        info.push(`Courses: ${stu.courseNames.join(', ')}`);
      }
      if (Array.isArray(stu.classroomNames) && stu.classroomNames.length) {
        info.push(`Classrooms: ${stu.classroomNames.join(', ')}`);
      }
      label.textContent = info.length ? `${baseLabel} – ${info.join(' | ')}` : baseLabel;
    } else {
      label.textContent = baseLabel;
    }

    row.appendChild(checkbox);
    row.appendChild(label);
    fragment.appendChild(row);
  });

  overlayBody.appendChild(fragment);
}

async function deleteStudentsFromDb(ids) {
  if (!supabaseClient) {
    throw new Error('Supabase client not available.');
  }

  if (!Array.isArray(ids) || !ids.length) {
    return;
  }

  if (isTeacherView) {
    const courseIds = teacherState.courseIds;
    const classroomIds = teacherState.classroomIds;

    if (courseIds.length) {
      const { error: enrolmentError } = await supabaseClient
        .from('enrolment')
        .delete()
        .in('user_id', ids)
        .in('course_id', courseIds);
      if (enrolmentError) {
        console.error('Failed to remove students from courses:', enrolmentError);
        throw enrolmentError;
      }
    }

    if (classroomIds.length) {
      const { error: classmateError } = await supabaseClient
        .from('classmate')
        .delete()
        .in('users_id', ids)
        .in('classroom_id', classroomIds);
      if (classmateError) {
        console.error('Failed to remove students from classrooms:', classmateError);
        throw classmateError;
      }
    }
    return;
  }

  // Unenroll from classrooms (delete from classmate table)
  const { error: classmateError } = await supabaseClient
    .from('classmate')
    .delete()
    .in('users_id', ids);

  if (classmateError) {
    console.error('Failed to unenroll students from classrooms:', classmateError);
    throw classmateError;
  }

  // Unenroll from courses (delete from enrolment table)
  const { error: enrolmentError } = await supabaseClient
    .from('enrolment')
    .delete()
    .in('user_id', ids);

  if (enrolmentError) {
    console.error('Failed to unenroll students from courses:', enrolmentError);
    throw enrolmentError;
  }

  // Delete from users table
  const { error } = await supabaseClient
    .from('users')
    .delete()
    .in('users_id', ids);

  if (error) {
    throw error;
  }
}

async function fetchStudentEnrollments(studentId) {
  if (!supabaseClient) {
    throw new Error('Supabase client not available.');
  }

  if (isTeacherView) {
    const detail = teacherState.studentDetails.get(studentId);
    if (!detail) {
      return { classrooms: [], courses: [] };
    }
    const classrooms = (detail.classroomIds || []).map((id) => ({
      classroom: { classroom_title: teacherState.classroomInfo.get(id) || id },
    }));
    const courses = (detail.courseIds || []).map((id) => ({
      course: { course_title: teacherState.courseInfo.get(id) || id },
    }));
    return { classrooms, courses };
  }

  // Fetch classrooms
  const { data: classrooms, error: classroomError } = await supabaseClient
    .from('classmate')
    .select('classroom_id, classroom!inner(classroom_title)')
    .eq('users_id', studentId);

  if (classroomError) {
    console.error('Failed to fetch classrooms:', classroomError);
    throw classroomError;
  }

  // Fetch courses
  const { data: courses, error: courseError } = await supabaseClient
    .from('enrolment')
    .select('course_id, course!inner(course_title)')
    .eq('user_id', studentId);

  if (courseError) {
    console.error('Failed to fetch courses:', courseError);
    throw courseError;
  }

  return {
    classrooms: classrooms || [],
    courses: courses || []
  };
}

async function fetchTeacherStudents() {
  const { data: authData, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !authData?.user) {
    throw authError || new Error('Please log in to continue.');
  }

  teacherState.teacherId = authData.user.id;

  const [
    { data: courseRows, error: courseError },
    { data: classroomRows, error: classroomError },
  ] = await Promise.all([
    supabaseClient
      .from('course')
      .select('course_id, course_title')
      .eq('users_id', teacherState.teacherId),
    supabaseClient
      .from('classroom')
      .select('classroom_id, classroom_title')
      .eq('users_id', teacherState.teacherId),
  ]);

  if (courseError || classroomError) {
    throw new Error(
      [courseError?.message, classroomError?.message].filter(Boolean).join('; ')
    );
  }

  teacherState.courseIds = Array.isArray(courseRows)
    ? courseRows.map((row) => row.course_id).filter(Boolean)
    : [];
  teacherState.classroomIds = Array.isArray(classroomRows)
    ? classroomRows.map((row) => row.classroom_id).filter(Boolean)
    : [];

  teacherState.courseInfo = new Map(
    (courseRows || [])
      .filter((row) => row.course_id)
      .map((row) => [row.course_id, row.course_title || row.course_id])
  );

  teacherState.classroomInfo = new Map(
    (classroomRows || [])
      .filter((row) => row.classroom_id)
      .map((row) => [row.classroom_id, row.classroom_title || row.classroom_id])
  );

  const [enrolmentRes, classmateRes] = await Promise.all([
    teacherState.courseIds.length
      ? supabaseClient
          .from('enrolment')
          .select('user_id, course_id')
          .in('course_id', teacherState.courseIds)
      : Promise.resolve({ data: [], error: null }),
    teacherState.classroomIds.length
      ? supabaseClient
          .from('classmate')
          .select('users_id, classroom_id')
          .in('classroom_id', teacherState.classroomIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (enrolmentRes.error || classmateRes.error) {
    throw new Error(
      [enrolmentRes.error?.message, classmateRes.error?.message].filter(Boolean).join('; ')
    );
  }

  const studentMap = new Map();

  (enrolmentRes.data || []).forEach((row) => {
    const userId = row.user_id;
    const courseId = row.course_id;
    if (!userId || !courseId) return;
    const entry = studentMap.get(userId) || { courseIds: new Set(), classroomIds: new Set() };
    entry.courseIds.add(courseId);
    studentMap.set(userId, entry);
  });

  (classmateRes.data || []).forEach((row) => {
    const userId = row.users_id;
    const classroomId = row.classroom_id;
    if (!userId || !classroomId) return;
    const entry = studentMap.get(userId) || { courseIds: new Set(), classroomIds: new Set() };
    entry.classroomIds.add(classroomId);
    studentMap.set(userId, entry);
  });

  if (!studentMap.size) {
    teacherState.studentDetails = new Map();
    return [];
  }

  const studentIds = Array.from(studentMap.keys());
  const { data: userRows, error: usersError } = await supabaseClient
    .from('users')
    .select('users_id, users_title, users_fname, users_lname, users_email')
    .in('users_id', studentIds);

  if (usersError) {
    throw usersError;
  }

  const list = Array.isArray(userRows) ? userRows : [];
  teacherState.studentDetails = new Map();

  const results = list.map((user) => {
    const entry = studentMap.get(user.users_id) || { courseIds: new Set(), classroomIds: new Set() };
    const courseIds = Array.from(entry.courseIds);
    const classroomIds = Array.from(entry.classroomIds);
    const courseNames = courseIds.map((id) => teacherState.courseInfo.get(id) || id);
    const classroomNames = classroomIds.map((id) => teacherState.classroomInfo.get(id) || id);

    teacherState.studentDetails.set(user.users_id, {
      courseIds,
      classroomIds,
    });

    return {
      id: user.users_id,
      name: formatName(user),
      email: user.users_email || '',
      courseNames,
      classroomNames,
    };
  });

  results.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return results;
}

async function removeStudent(id, { button } = {}) {
  if (!id) return;
  const index = students.findIndex(s => s.id === id);
  if (index === -1) return;

  const student = students[index];
  const originalLabel = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = 'Removing…';
  }

  try {
    // Fetch enrollments for confirmation
    const enrollments = await fetchStudentEnrollments(id);

    let confirmationMessage = `Are you sure you want to remove student "${student.name}"?\n\n`;

    if (enrollments.classrooms.length > 0) {
      const classroomNames = enrollments.classrooms.map(c => c.classroom.classroom_title).join(', ');
      confirmationMessage += `Enrolled Classrooms: ${classroomNames}\n`;
    } else {
      confirmationMessage += 'Enrolled Classrooms: None\n';
    }

    if (enrollments.courses.length > 0) {
      const courseNames = enrollments.courses.map(c => c.course.course_title).join(', ');
      confirmationMessage += `Enrolled Courses: ${courseNames}\n`;
    } else {
      confirmationMessage += 'Enrolled Courses: None\n';
    }

    confirmationMessage += isTeacherView
      ? '\nThis will remove the student from your classrooms and courses only.'
      : '\nThis will unenroll the student from all classrooms and courses.';

    if (!confirm(confirmationMessage)) {
      if (button) {
        button.disabled = false;
        button.textContent = originalLabel;
      }
      return;
    }

    await deleteStudentsFromDb([id]);
    if (isTeacherView) {
      teacherState.studentDetails.delete(id);
    }
    students.splice(index, 1);
    renderStudents();
    renderOverlayList();
  } catch (err) {
    console.error('Failed to delete student:', err);
    alert('Failed to delete student. Please try again.');
    if (button) {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }
}

async function fetchStudentsFromDb() {
  if (!supabaseClient) {
    throw new Error('Supabase client not available.');
  }

  if (isTeacherView) {
    return fetchTeacherStudents();
  }

  const { data: users, error } = await supabaseClient
    .from('users')
    .select('users_id, users_title, users_fname, users_lname, users_email, users_role')
    .order('users_fname', { ascending: true });

  if (error) {
    throw error;
  }

  const results = Array.isArray(users) ? users : [];

  return results
    .filter(user => {
      const role = (user?.users_role || '').toLowerCase();
      return role === 'student';
    })
    .map(user => ({
      id: user.users_id,
      name: formatName(user),
      email: user.users_email || '',
    }));
}

async function init() {
  renderMessage('Loading students…');

  try {
    supabaseClient = await waitForSupabase();
    students = await fetchStudentsFromDb();
    renderStudents();
    renderOverlayList();
  } catch (err) {
    console.error('Failed to load students:', err);
    renderMessage('Failed to load students.');
  }
}

editBtn?.addEventListener('click', () => {
  selectAllChk.checked = false;
  renderOverlayList();
  overlay.style.display = 'flex';
});

closeOverlayBtn?.addEventListener('click', () => {
  overlay.style.display = 'none';
});

selectAllChk?.addEventListener('change', (event) => {
  const checked = event.target.checked;
  document.querySelectorAll('.rowChk').forEach(chk => {
    chk.checked = checked;
  });
});

deleteBtn?.addEventListener('click', async () => {
  const selectedIds = Array.from(document.querySelectorAll('.rowChk:checked'))
    .map(chk => chk.dataset.id)
    .filter(Boolean);

  if (!selectedIds.length) {
    overlay.style.display = 'none';
    return;
  }

  const originalText = deleteBtn.textContent;
  deleteBtn.disabled = true;
  deleteBtn.textContent = isTeacherView ? 'Removing…' : 'Deleting…';

  try {
    // Fetch enrollments for confirmation
    const enrollmentPromises = selectedIds.map(async (id) => {
      try {
        const enrollments = await fetchStudentEnrollments(id);
        const student = students.find(s => s.id === id);
        return { id, name: student?.name || 'Unknown', enrollments };
      } catch (err) {
        console.error(`Failed to fetch enrollments for student ${id}:`, err);
        return { id, name: 'Unknown', enrollments: { classrooms: [], courses: [] } };
      }
    });

    const enrollmentDetails = await Promise.all(enrollmentPromises);

    let confirmationMessage = `Are you sure you want to remove the following ${selectedIds.length} student(s)?\n\n`;

    enrollmentDetails.forEach((detail, index) => {
      confirmationMessage += `${index + 1}. ${detail.name}\n`;
      if (detail.enrollments.classrooms.length > 0) {
        const classroomNames = detail.enrollments.classrooms.map(c => c.classroom.classroom_title).join(', ');
        confirmationMessage += `   Enrolled Classrooms: ${classroomNames}\n`;
      } else {
        confirmationMessage += '   Enrolled Classrooms: None\n';
      }
      if (detail.enrollments.courses.length > 0) {
        const courseNames = detail.enrollments.courses.map(c => c.course.course_title).join(', ');
        confirmationMessage += `   Enrolled Courses: ${courseNames}\n`;
      } else {
        confirmationMessage += '   Enrolled Courses: None\n';
      }
      confirmationMessage += '\n';
    });

    confirmationMessage += isTeacherView
      ? 'This will remove the students from your classrooms and courses.'
      : 'This will unenroll the students from their classrooms and courses.';

    if (!confirm(confirmationMessage)) {
      deleteBtn.disabled = false;
      deleteBtn.textContent = originalText;
      return;
    }

    await deleteStudentsFromDb(selectedIds);
    if (isTeacherView) {
      selectedIds.forEach((id) => teacherState.studentDetails.delete(id));
    }
    students = students.filter(stu => !selectedIds.includes(stu.id));
    renderStudents();
    renderOverlayList();
    overlay.style.display = 'none';
    if (selectAllChk) {
      selectAllChk.checked = false;
    }
  } catch (err) {
    console.error('Failed to delete selected students:', err);
    alert('Failed to delete selected students. Please try again.');
  } finally {
    deleteBtn.disabled = false;
    deleteBtn.textContent = originalText;
  }
});

studentListEl?.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.classList.contains('delete-btn')) {
    const id = target.dataset.id;
    removeStudent(id, { button: target });
  }
});

init();
