(function () {
  const PLACEHOLDER_TEXT = '--Select course you want to teach--';

  function renderSingleOption(select, text, { disabled = true, value = '' } = {}) {
    select.innerHTML = '';
    const option = document.createElement('option');
    option.textContent = text;
    option.value = value;
    option.disabled = disabled;
    option.selected = true;
    select.appendChild(option);
  }

  async function resolveUserId(client) {
    try {
      const { data, error } = await client.auth.getUser();
      if (error) {
        console.warn('Failed to resolve current user for course loading:', error);
        return null;
      }
      return data?.user?.id || null;
    } catch (err) {
      console.warn('Unexpected error while resolving user for course loading:', err);
      return null;
    }
  }

  async function populateCourses(select) {
    const client = window.supabase;
    if (!client) {
      renderSingleOption(select, 'Supabase not ready');
      return;
    }

    select.disabled = true;
    renderSingleOption(select, 'Loading courses...', { disabled: true });

    let query = client
      .from('course')
      .select('course_id, course_title, course_desc, users_id')
      .order('course_id', { ascending: true });

    const userId = await resolveUserId(client);
    if (userId) {
      query = query.eq('users_id', userId);
    }

    try {
      const { data, error } = await query;
      if (error) throw error;

      const courses = Array.isArray(data) ? data : [];

      select.innerHTML = '';

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = PLACEHOLDER_TEXT;
      placeholder.disabled = true;
      placeholder.selected = true;
      select.appendChild(placeholder);

      if (!courses.length) {
        placeholder.textContent = 'No courses available';
        return;
      }

      courses.forEach((course) => {
        const option = document.createElement('option');
        option.value = course.course_id;
        const title = course.course_title || course.course_desc || course.course_id || 'Course';
        option.textContent = `${course.course_id} - ${title}`;
        select.appendChild(option);
      });

      select.disabled = false;
    } catch (err) {
      console.error('Failed to load courses for classroom form:', err);
      renderSingleOption(select, 'Failed to load courses');
    }
  }

  function init() {
    const select = document.getElementById('courseID');
    if (!select) return;

    const handleLoad = () => populateCourses(select);

    if (window.supabase) {
      handleLoad();
    } else {
      document.addEventListener('supabase-ready', handleLoad, { once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
