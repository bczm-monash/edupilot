(function () {
  const CACHE = new Map();
  const INFLIGHT = new Map();

  function formatName(row) {
    if (!row) return '';
    const first = row.users_fname || '';
    const last = row.users_lname || '';
    return [first, last].filter(Boolean).join(' ').trim();
  }

  async function ensureSupabase(retry = 0) {
    if (window.supabase) return window.supabase;
    if (retry >= 5) return null;
    await new Promise((resolve) => setTimeout(resolve, 100 * (retry + 1)));
    return ensureSupabase(retry + 1);
  }

  async function queryUsers(ids) {
    const supabase = await ensureSupabase();
    if (!supabase || !ids.length) return new Map();

    const uniqueIds = Array.from(new Set(ids.map((id) => String(id)).filter(Boolean)));
    if (!uniqueIds.length) return new Map();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .in('users_id', uniqueIds);

    if (error) {
      console.warn('[search_display_name] Failed to load user records:', error);
      return new Map();
    }

    const result = new Map();
    (data || []).forEach((row) => {
      const id = row.users_id;
      if (!id) return;
      const name = formatName(row);
      CACHE.set(id, name);
      result.set(id, name);
    });

    return result;
  }

  async function fetchUserDisplayNames(ids) {
    const keys = (ids || []).map((id) => String(id)).filter(Boolean);
    const result = new Map();
    const toFetch = [];

    keys.forEach((key) => {
      if (CACHE.has(key)) {
        result.set(key, CACHE.get(key));
      } else if (INFLIGHT.has(key)) {
        toFetch.push(key);
      } else {
        toFetch.push(key);
      }
    });

    const fetchIds = toFetch.filter((id) => !INFLIGHT.has(id));

    if (fetchIds.length) {
      const fetchPromise = queryUsers(fetchIds).finally(() => {
        fetchIds.forEach((id) => INFLIGHT.delete(id));
      });
      fetchIds.forEach((id) => INFLIGHT.set(id, fetchPromise));
    }

    const pendingPromises = Array.from(new Set(toFetch.map((id) => INFLIGHT.get(id)).filter(Boolean)));
    if (pendingPromises.length) {
      await Promise.all(pendingPromises);
    }

    keys.forEach((key) => {
      if (CACHE.has(key)) {
        result.set(key, CACHE.get(key));
      }
    });

    return result;
  }

  async function fetchUserDisplayName(id) {
    const key = String(id);
    if (!key) return '';
    if (CACHE.has(key)) return CACHE.get(key);

    const names = await fetchUserDisplayNames([key]);
    return names.get(key) || '';
  }

  window.fetchUserDisplayName = fetchUserDisplayName;
  window.fetchUserDisplayNames = fetchUserDisplayNames;
})();
