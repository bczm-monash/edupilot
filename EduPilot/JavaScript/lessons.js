// Fetch lessons from Supabase and render as cards
(function () {
  const listEl = document.getElementById('lessonList');

  function renderEmpty(message) {
    if (!listEl) return;
    listEl.innerHTML = '';
    const li = document.createElement('li');
    li.textContent = message || 'No lessons found.';
    li.style.listStyle = 'none';
    li.style.margin = '12px';
    listEl.appendChild(li);
  }

  function makeMeta(label, value) {
    const el = document.createElement('div');
    el.className = 'lesson-meta';
    el.textContent = `${label}: ${value}`;
    return el;
  }

  function makeCard(item) {
    const li = document.createElement('li');
    li.className = 'lesson-card';
    li.dataset.id = item.id || item.lesson_id || '';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lesson-btn';

    // Build title
    const code = (item.lesson_id ?? item.code ?? item.course_id ?? '').toString();
    const titleField = item.title || item.lesson_title || item.name || item.lesson_desc || 'Lesson';
    const title = document.createElement('div');
    title.className = 'lesson-title';
    title.textContent = code ? `${code} - ${titleField}` : `${titleField}`;
    btn.appendChild(title);

    // Common meta fields if present
    if (item.owner || item.owner_name) {
      btn.appendChild(makeMeta('Owner', item.owner || item.owner_name));
    } else if (item.user_id) {
      btn.appendChild(makeMeta('Owner ID', item.user_id));
    }

    if (item.estimated_hours || item.estimated_hour) {
      btn.appendChild(makeMeta('Estimated Hour', item.estimated_hours || item.estimated_hour));
    }

    if (item.credit_points || item.course_credit_points) {
      btn.appendChild(makeMeta('Credit Point', item.credit_points || item.course_credit_points));
    }

    // Open handler (navigate to edit with id param if we have it)
    btn.addEventListener('click', () => {
      const id = li.dataset.id;
      if (id) {
        window.location.href = `/EduPilot/html/teacher/EditLesson.html?id=${encodeURIComponent(id)}`;
      } else {
        alert('Opening lesson');
      }
    });

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'delete-btn';
    del.textContent = 'Delete';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      // UI-only remove for now; wire to DB later
      li.remove();
    });

    li.appendChild(btn);
    li.appendChild(del);
    return li;
  }

  async function fetchLessons() {
    if (!window.supabase) {
      renderEmpty('Supabase not initialized.');
      return [];
    }

    // Use provided API signature: select all from 'lesson'
    const { data: lesson, error } = await window.supabase
      .from('lesson')
      .select('*')
      .limit(100);

    if (error) {
      console.error('Error fetching lessons:', error);
      renderEmpty('Failed to load lessons.');
      return [];
    }
    return Array.isArray(lesson) ? lesson : [];
  }

  async function load() {
    if (!listEl) return;
    listEl.innerHTML = '';

    try {
      const items = await fetchLessons();
      if (!items || items.length === 0) {
        renderEmpty('No lessons found.');
        return;
      }

      const frag = document.createDocumentFragment();
      for (const it of items) frag.appendChild(makeCard(it));
      listEl.appendChild(frag);
    } catch (e) {
      console.error('Failed loading lessons', e);
      renderEmpty('Failed to load lessons.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
