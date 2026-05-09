const HISTORY_TABLE = 'meeting_history';
const SELECT_COLUMNS = [
  'id',
  'created_at',
  'type',
  'title',
  'date',
  'month',
  'year',
  'summary',
  'pending_tasks',
  'completed_or_coordinated',
  'risks',
  'notes',
  'source_reference',
  'provider',
  'model',
  'raw_result',
  'tags',
].join(',');

function getSupabaseConfig() {
  return {
    url: (process.env.SUPABASE_URL || '').replace(/\/$/, ''),
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  };
}

function isConfigured() {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.serviceRoleKey);
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeRecord(payload = {}) {
  const parsedDate = payload.date ? new Date(payload.date) : null;
  const validDate = parsedDate && !Number.isNaN(parsedDate.getTime());

  return {
    type: String(payload.type || 'meeting').slice(0, 80),
    title: String(payload.title || '').slice(0, 500),
    date: validDate ? payload.date : null,
    month: Number.isInteger(Number(payload.month))
      ? Number(payload.month)
      : (validDate ? parsedDate.getUTCMonth() + 1 : null),
    year: Number.isInteger(Number(payload.year))
      ? Number(payload.year)
      : (validDate ? parsedDate.getUTCFullYear() : null),
    summary: String(payload.summary || ''),
    pending_tasks: normalizeArray(payload.pending_tasks),
    completed_or_coordinated: normalizeArray(payload.completed_or_coordinated),
    risks: normalizeArray(payload.risks),
    notes: normalizeArray(payload.notes),
    source_reference: String(payload.source_reference || '').slice(0, 1000),
    provider: String(payload.provider || '').slice(0, 100),
    model: String(payload.model || '').slice(0, 160),
    raw_result: payload.raw_result && typeof payload.raw_result === 'object' ? payload.raw_result : {},
    tags: normalizeArray(payload.tags).map(tag => String(tag).slice(0, 80)).filter(Boolean),
  };
}

function supabaseHeaders(prefer) {
  const { serviceRoleKey } = getSupabaseConfig();
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;
  return headers;
}

function buildListUrl(query = {}) {
  const { url } = getSupabaseConfig();
  const params = new URLSearchParams();
  params.set('select', SELECT_COLUMNS);
  params.set('order', 'created_at.desc');
  params.set('limit', String(Math.min(Math.max(Number(query.limit) || 50, 1), 200)));

  if (query.type) params.set('type', `eq.${query.type}`);
  if (query.month) params.set('month', `eq.${Number(query.month)}`);
  if (query.year) params.set('year', `eq.${Number(query.year)}`);
  if (query.q) {
    const term = String(query.q).replace(/[(),]/g, ' ').trim();
    if (term) {
      params.set('or', `(title.ilike.*${term}*,summary.ilike.*${term}*,source_reference.ilike.*${term}*)`);
    }
  }

  return `${url}/rest/v1/${HISTORY_TABLE}?${params.toString()}`;
}

async function saveMeetingHistory(payload) {
  if (!isConfigured()) {
    const error = new Error('Supabase no configurado');
    error.code = 'SUPABASE_NOT_CONFIGURED';
    throw error;
  }

  const { url } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${HISTORY_TABLE}`, {
    method: 'POST',
    headers: supabaseHeaders('return=representation'),
    body: JSON.stringify(normalizeRecord(payload)),
  });

  if (!response.ok) throw new Error(`Supabase history insert ${response.status}: ${await response.text()}`);
  const records = await response.json();
  return Array.isArray(records) ? records[0] : records;
}

async function listMeetingHistory(query) {
  if (!isConfigured()) {
    const error = new Error('Supabase no configurado');
    error.code = 'SUPABASE_NOT_CONFIGURED';
    throw error;
  }

  const response = await fetch(buildListUrl(query), {
    method: 'GET',
    headers: supabaseHeaders(),
  });

  if (!response.ok) throw new Error(`Supabase history list ${response.status}: ${await response.text()}`);
  return response.json();
}

module.exports = {
  HISTORY_TABLE,
  isConfigured,
  normalizeRecord,
  saveMeetingHistory,
  listMeetingHistory,
};
