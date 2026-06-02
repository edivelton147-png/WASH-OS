const { isConfigured, saveMeetingHistory, listMeetingHistory } = require('../core/storage/supabase');

const ALLOWED_ORIGINS = new Set([
  'https://wash-os.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
]);

function applyCors(req, res) {
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (!origin) return true;
  if (!ALLOWED_ORIGINS.has(origin)) return false;

  res.setHeader('Access-Control-Allow-Origin', origin);
  return true;
}

function send(req, res, status, data) {
  applyCors(req, res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Payload demasiado grande para historial operacional'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); }
      catch (error) { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}


function getDeleteId(req) {
  const host = req.headers.host || 'localhost';
  const url = new URL(req.url || '/api/history', `http://${host}`);
  return url.searchParams.get('id') || '';
}

async function deleteMeetingHistory(id) {
  const cleanId = String(id || '').trim();
  if (!cleanId) throw new Error('ID requerido para eliminar historial');

  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const response = await fetch(`${supabaseUrl}/rest/v1/meeting_history?id=eq.${encodeURIComponent(cleanId)}`, {
    method: 'DELETE',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: 'return=representation',
    },
  });

  if (!response.ok) throw new Error(`Supabase history delete ${response.status}: ${await response.text()}`);
  const records = await response.json().catch(() => []);
  return Array.isArray(records) ? records : [];
}

function parseQuery(req) {
  const host = req.headers.host || 'localhost';
  const url = new URL(req.url || '/api/history', `http://${host}`);
  return {
    type: url.searchParams.get('type') || '',
    month: url.searchParams.get('month') || '',
    year: url.searchParams.get('year') || '',
    q: url.searchParams.get('q') || '',
    limit: url.searchParams.get('limit') || '',
  };
}

module.exports = async function handler(req, res) {
  if (!applyCors(req, res)) return send(req, res, 403, { ok: false, error: 'Origin no permitido' });
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (!isConfigured()) {
    return send(req, res, 503, {
      ok: false,
      configured: false,
      error: 'SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configuradas',
    });
  }

  try {
    if (req.method === 'POST') {
      const record = await saveMeetingHistory(await readBody(req));
      return send(req, res, 200, { ok: true, configured: true, record });
    }

    if (req.method === 'GET') {
      const records = await listMeetingHistory(parseQuery(req));
      return send(req, res, 200, { ok: true, configured: true, records });
    }

    if (req.method === 'DELETE') {
      const deleted = await deleteMeetingHistory(getDeleteId(req));
      return send(req, res, 200, { ok: true, configured: true, deleted });
    }

    return send(req, res, 405, { ok: false, error: 'Method not allowed' });
  } catch (error) {
    return send(req, res, 500, { ok: false, configured: true, error: error.message || 'History API error' });
  }
};
