(function () {
  const listEl = document.getElementById('classroomList');

  function renderEmpty(message) {
    if (!listEl) return;
    listEl.innerHTML = '';
    const li = document.createElement('li');
    li.textContent = message || 'No classrooms found.';
    li.style.listStyle = 'none';
    li.style.margin = '12px';
    listEl.appendChild(li);
  }

  function normaliseDate(dateText) {
    if (!dateText) return '';
    const parts = dateText.split(/[-/]/);
    if (parts.length === 3) {
      const [a, b, c] = parts;
      if (a.length === 4) {
        return `${c.padStart(2, '0')}/${b.padStart(2, '0')}/${a}`;
      }
      if (c.length === 4) {
        return `${a.padStart(2, '0')}/${b.padStart(2, '0')}/${c}`;
      }
    }
    return dateText;
  }

  function makeCard(classroom) {
    const li = document.createElement('li');
    li.className = 'classroom-card';
    li.dataset.id = classroom.classroom_id || '';
    li.tabIndex = 0;
    li.setAttribute('role', 'button');

    const content = document.createElement('div');
    content.className = 'card-content';

    const title = document.createElement('div');
    title.className = 'classroom-title';
    title.textContent = classroom.classroom_title || 'Untitled classroom';

    const metaId = document.createElement('div');
    metaId.className = 'classroom-meta';
    metaId.textContent = `ID: ${classroom.classroom_id || '-'}`;

    const course = document.createElement('div');
    course.className = 'classroom-meta';
    if (classroom.course_id) course.textContent = `Course: ${classroom.course_id}`;

    const start = document.createElement('div');
    start.className = 'classroom-meta';
    if (classroom.classroom_start_date) {
      start.textContent = `Start: ${normaliseDate(classroom.classroom_start_date)}`;
    }

    const end = document.createElement('div');
    end.className = 'classroom-meta';
    if (classroom.classroom_end_date) {
      end.textContent = `End: ${normaliseDate(classroom.classroom_end_date)}`;
    }

    content.appendChild(title);
    content.appendChild(metaId);
    if (course.textContent) content.appendChild(course);
    if (start.textContent) content.appendChild(start);
    if (end.textContent) content.appendChild(end);

    function open() {
      if (!classroom.classroom_id) return;
      const url = `/EduPilot/html/teacher/classroom_content.html?id=${encodeURIComponent(classroom.classroom_id)}`;
      window.location.href = url;
    }

    li.addEventListener('click', open);
    li.addEventListener('keypress', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
    
    li.appendChild(content);
    return li;
  }

  async function fetchClassrooms() {
    const client = window.supabase;
    if (!client) {
      renderEmpty('Supabase not initialized.');
      return [];
    }

    const { data, error } = await client
      .from('classroom')
      .select('*')
      .order('classroom_id', { ascending: true })
      .limit(100);

    if (error) {
      console.error('Error fetching classrooms:', error);
      renderEmpty('Failed to load classrooms.');
      return [];
    }

    return Array.isArray(data) ? data : [];
  }

  async function loadClassrooms() {
    if (!listEl) return;
    listEl.innerHTML = '';

    try {
      const classrooms = await fetchClassrooms();
      if (!classrooms.length) {
        renderEmpty('No classrooms found.');
        return;
      }

      const frag = document.createDocumentFragment();
      classrooms.forEach((room) => {
        frag.appendChild(makeCard(room));
      });
      listEl.appendChild(frag);
    } catch (error) {
      console.error('Failed to load classrooms:', error);
      renderEmpty('Failed to load classrooms.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadClassrooms);
  } else {
    loadClassrooms();
  }
})();
