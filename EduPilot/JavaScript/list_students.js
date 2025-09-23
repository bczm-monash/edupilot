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
    removeBtn.textContent = 'Remove';
    actionTd.appendChild(removeBtn);

    tr.appendChild(nameTd);
    tr.appendChild(emailTd);
    tr.appendChild(actionTd);

    fragment.appendChild(tr);
  });

  studentListEl.appendChild(fragment);
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
    label.textContent = `${stu.name} (${stu.email || '—'})`;

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

    confirmationMessage += '\nThis will unenroll the student from all classrooms and courses.';

    if (!confirm(confirmationMessage)) {
      if (button) {
        button.disabled = false;
        button.textContent = originalLabel;
      }
      return;
    }

    await deleteStudentsFromDb([id]);
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
  deleteBtn.textContent = 'Deleting…';

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

    confirmationMessage += 'This will unenroll the students from their classrooms and courses.';

    if (!confirm(confirmationMessage)) {
      deleteBtn.disabled = false;
      deleteBtn.textContent = originalText;
      return;
    }

    await deleteStudentsFromDb(selectedIds);
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
