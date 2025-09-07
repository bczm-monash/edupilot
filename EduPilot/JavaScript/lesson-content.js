(function () {
  const headerEl = document.getElementById('lessonHeader');
  const detailsEl = document.getElementById('lessonDetails');

  function getQueryId() {
    const p = new URLSearchParams(window.location.search);
    return p.get('id') || '';
  }

  function setHeader(id, title) {
    const idPart = id ? String(id) : '';
    const titlePart = title ? String(title) : 'Lesson';
    headerEl.textContent = idPart ? `${idPart} - ${titlePart}` : titlePart;
  }

  function renderDetails(obj) {
    if (!detailsEl) return;
    detailsEl.innerHTML = '';
    if (!obj || typeof obj !== 'object') {
      const li = document.createElement('li');
      li.textContent = 'No details available';
      detailsEl.appendChild(li);
      return;
    }

    const entries = Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== '');
    if (entries.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No details available';
      detailsEl.appendChild(li);
      return;
    }

    for (const [key, val] of entries) {
      const li = document.createElement('li');
      const k = document.createElement('span');
      k.className = 'details-key';
      k.textContent = `${key}:`;
      const v = document.createElement('span');
      v.className = 'details-value';
      v.textContent = Array.isArray(val) || typeof val === 'object' ? JSON.stringify(val) : String(val);
      li.appendChild(k);
      li.appendChild(v);
      detailsEl.appendChild(li);
    }
  }

  async function fetchLessonById(id) {
    if (!window.supabase) return { data: null, error: new Error('Supabase not initialized') };
    let res = await window.supabase.from('lesson').select('*').eq('id', id).maybeSingle();
    if (res.data || !res.error) return res;
    res = await window.supabase.from('lesson').select('*').eq('lesson_id', id).maybeSingle();
    return res;
  }

  async function load() {
    const queryId = getQueryId();
    if (!queryId) {
      setHeader('', 'Lesson');
      renderDetails(null);
      return;
    }

    try {
      const { data, error } = await fetchLessonById(queryId);
      if (error) {
        console.error('Failed to fetch lesson', error);
        setHeader(queryId, 'Lesson');
        renderDetails(null);
        return;
      }

      const titleVal = data?.title || data?.lesson_title || data?.name || data?.lesson_desc || 'Lesson';
      const idVal = data?.id || data?.lesson_id || queryId;
      setHeader(idVal, titleVal);
      renderDetails(data);
    } catch (e) {
      console.error('Unexpected error', e);
      setHeader(queryId, 'Lesson');
      renderDetails(null);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();

