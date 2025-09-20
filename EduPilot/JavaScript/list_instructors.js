// instructors.js

const editBtn = document.getElementById('editToggle');
const overlay = document.getElementById('editOverlay');
const closeOverlayBtn = document.getElementById('closeOverlay');
const deleteBtn = document.getElementById('deleteSelected');
const selectAllChk = document.getElementById('selectAllChk');
const overlayBody = document.getElementById('overlayBody');
const instructorListEl = document.getElementById('instructorList');

let instructors = [];
let supabaseClient = null;

function waitForSupabase(timeoutMs = 6000) {
  if (window.supabase) {
    return Promise.resolve(window.supabase);
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      document.removeEventListener('supabase-ready', onReady);
      if (timer) {
        clearTimeout(timer);
      }
    };

    const onReady = (event) => {
      cleanup();
      resolve(event?.detail?.supabase || window.supabase);
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
  if (!instructorListEl) return;
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = 3;
  cell.className = 'muted';
  cell.textContent = message;
  row.appendChild(cell);
  instructorListEl.innerHTML = '';
  instructorListEl.appendChild(row);
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

function renderInstructors() {
  if (!instructorListEl) return;

  instructorListEl.innerHTML = '';
  if (!instructors.length) {
    renderMessage('No instructors found.');
    return;
  }

  const fragment = document.createDocumentFragment();

  instructors.forEach(inst => {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.textContent = inst.name;

    const emailTd = document.createElement('td');
    emailTd.textContent = inst.email || '—';

    const actionTd = document.createElement('td');
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'delete-btn';
    removeBtn.dataset.id = inst.id;
    removeBtn.textContent = 'Remove';
    actionTd.appendChild(removeBtn);

    tr.appendChild(nameTd);
    tr.appendChild(emailTd);
    tr.appendChild(actionTd);

    fragment.appendChild(tr);
  });

  instructorListEl.appendChild(fragment);
}

function renderOverlayList() {
  if (!overlayBody) return;

  overlayBody.innerHTML = '';

  if (!instructors.length) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'muted';
    emptyMsg.textContent = 'No instructors available.';
    overlayBody.appendChild(emptyMsg);
    return;
  }

  const fragment = document.createDocumentFragment();

  instructors.forEach(inst => {
    const row = document.createElement('div');
    row.className = 'list-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'rowChk';
    checkbox.dataset.id = inst.id;

    const label = document.createElement('span');
    label.textContent = `${inst.name} (${inst.email || '—'})`;

    row.appendChild(checkbox);
    row.appendChild(label);
    fragment.appendChild(row);
  });

  overlayBody.appendChild(fragment);
}

async function deleteInstructorsFromDb(ids) {
  if (!supabaseClient) {
    throw new Error('Supabase client not available.');
  }

  if (!Array.isArray(ids) || !ids.length) {
    return;
  }

  const { error } = await supabaseClient
    .from('users')
    .delete()
    .in('users_id', ids);

  if (error) {
    throw error;
  }
}

async function removeInstructor(id, { button } = {}) {
  if (!id) return;
  const index = instructors.findIndex(inst => inst.id === id);
  if (index === -1) return;

  const originalLabel = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = 'Removing…';
  }

  try {
    await deleteInstructorsFromDb([id]);
    instructors.splice(index, 1);
    renderInstructors();
    renderOverlayList();
  } catch (err) {
    console.error('Failed to delete instructor:', err);
    alert('Failed to delete instructor. Please try again.');
    if (button) {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }
}

async function fetchInstructorsFromDb() {
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
      return role === 'teacher' || role === 'instructor';
    })
    .map(user => ({
      id: user.users_id,
      name: formatName(user),
      email: user.users_email || '',
    }));
}

async function init() {
  renderMessage('Loading instructors…');

  try {
    supabaseClient = await waitForSupabase();
    instructors = await fetchInstructorsFromDb();
    renderInstructors();
    renderOverlayList();
  } catch (err) {
    console.error('Failed to load instructors:', err);
    renderMessage('Failed to load instructors.');
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
    await deleteInstructorsFromDb(selectedIds);
    instructors = instructors.filter(inst => !selectedIds.includes(inst.id));
    renderInstructors();
    renderOverlayList();
    overlay.style.display = 'none';
    if (selectAllChk) {
      selectAllChk.checked = false;
    }
  } catch (err) {
    console.error('Failed to delete selected instructors:', err);
    alert('Failed to delete selected instructors. Please try again.');
  } finally {
    deleteBtn.disabled = false;
    deleteBtn.textContent = originalText;
  }
});

instructorListEl?.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.classList.contains('delete-btn')) {
    const id = target.dataset.id;
    removeInstructor(id, { button: target });
  }
});

init();
