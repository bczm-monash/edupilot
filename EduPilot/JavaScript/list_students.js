// list_students.js

const editBtn = document.getElementById('editToggle');
const overlay = document.getElementById('editOverlay');
const closeOverlayBtn = document.getElementById('closeOverlay');
const deleteBtn = document.getElementById('deleteSelected');
const selectAllChk = document.getElementById('selectAllChk');
const overlayBody = document.getElementById('overlayBody');
const studentListEl = document.getElementById('studentList');

let students = [];

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

function removeStudent(id) {
  if (!id) return;
  const index = students.findIndex(s => s.id === id);
  if (index === -1) return;

  students.splice(index, 1);
  renderStudents();
  renderOverlayList();
}

async function fetchStudentsFromDb() {
  const supabaseClient = window.supabase;
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
    await waitForSupabase();
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

deleteBtn?.addEventListener('click', () => {
  const selectedIds = Array.from(document.querySelectorAll('.rowChk:checked'))
    .map(chk => chk.dataset.id)
    .filter(Boolean);

  if (!selectedIds.length) {
    overlay.style.display = 'none';
    return;
  }

  students = students.filter(stu => !selectedIds.includes(stu.id));
  renderStudents();
  renderOverlayList();
});

studentListEl?.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.classList.contains('delete-btn')) {
    const id = target.dataset.id;
    removeStudent(id);
  }
});

init();
