(function(){
  const LOCAL_HISTORY_KEY = 'wash-operational-history';

  function readLocal(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn('WASH storage local read failed.', error);
      return fallback;
    }
  }

  function writeLocal(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('WASH storage local write failed.', error);
      return false;
    }
  }

  function normalizeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeRecord(payload) {
    const date = payload && payload.date ? new Date(payload.date) : null;
    const validDate = date && !Number.isNaN(date.getTime());
    return {
      type: payload?.type || 'meeting',
      title: payload?.title || '',
      date: validDate ? payload.date : '',
      month: Number(payload?.month) || (validDate ? date.getUTCMonth() + 1 : null),
      year: Number(payload?.year) || (validDate ? date.getUTCFullYear() : null),
      summary: payload?.summary || '',
      pending_tasks: normalizeArray(payload?.pending_tasks),
      completed_or_coordinated: normalizeArray(payload?.completed_or_coordinated),
      risks: normalizeArray(payload?.risks),
      notes: normalizeArray(payload?.notes),
      source_reference: payload?.source_reference || '',
      provider: payload?.provider || '',
      model: payload?.model || '',
      raw_result: payload?.raw_result || {},
      tags: normalizeArray(payload?.tags),
      created_at: payload?.created_at || new Date().toISOString(),
    };
  }

  function saveLocalHistory(payload) {
    const record = normalizeRecord(payload);
    record.id = record.id || `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const records = readLocal(LOCAL_HISTORY_KEY, []);
    records.unshift(record);
    writeLocal(LOCAL_HISTORY_KEY, records.slice(0, 500));
    return record;
  }

  function matchLocal(record, filters) {
    if (filters.type && record.type !== filters.type) return false;
    if (filters.month && Number(record.month) !== Number(filters.month)) return false;
    if (filters.year && Number(record.year) !== Number(filters.year)) return false;
    if (filters.q) {
      const q = String(filters.q).toLowerCase();
      const haystack = [record.title, record.summary, record.source_reference, ...(record.tags || [])]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  }

  function listLocalHistory(filters) {
    const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
    return readLocal(LOCAL_HISTORY_KEY, []).filter(record => matchLocal(record, filters)).slice(0, limit);
  }

  function buildQuery(filters) {
    const params = new URLSearchParams();
    ['type', 'month', 'year', 'q', 'limit'].forEach(key => {
      if (filters && filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        params.set(key, filters[key]);
      }
    });
    const qs = params.toString();
    return `/api/history${qs ? `?${qs}` : ''}`;
  }

  async function saveHistory(payload) {
    try {
      const response = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizeRecord(payload)),
      });
      if (!response.ok) throw new Error(`History API ${response.status}`);
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || 'History API error');
      return { ok: true, storage: 'supabase', record: data.record };
    } catch (error) {
      console.warn('Supabase history unavailable; using localStorage fallback.', error);
      return { ok: true, storage: 'local', record: saveLocalHistory(payload), error: error.message };
    }
  }

  async function listHistory(filters = {}) {
    try {
      const response = await fetch(buildQuery(filters), { method: 'GET' });
      if (!response.ok) throw new Error(`History API ${response.status}`);
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || 'History API error');
      return { ok: true, storage: 'supabase', records: data.records || [] };
    } catch (error) {
      console.warn('Supabase history list unavailable; using localStorage fallback.', error);
      return { ok: true, storage: 'local', records: listLocalHistory(filters), error: error.message };
    }
  }

  window.WashStorage = window.WashStorage || {};
  window.WashStorage.saveHistory = saveHistory;
  window.WashStorage.listHistory = listHistory;
  window.WashStorage.saveLocalHistory = saveLocalHistory;
  window.WashStorage.listLocalHistory = listLocalHistory;

  if (!window.storage) {
    window.storage = {
      async get(key) {
        const value = localStorage.getItem(key);
        return value === null ? null : { key, value };
      },
      async set(key, value) {
        localStorage.setItem(key, value);
        return { key, value };
      },
    };
  }
})();
