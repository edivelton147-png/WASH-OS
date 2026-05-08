const { isConfigured, saveMeetingHistory, listMeetingHistory } = require('../core/storage/supabase');

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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
  if (req.method === 'OPTIONS') return send(res, 200, { ok: true });

  if (!isConfigured()) {
    return send(res, 503, {
      ok: false,
      configured: false,
      error: 'SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configuradas',
    });
  }

  try {
    if (req.method === 'POST') {
      const record = await saveMeetingHistory(await readBody(req));
      return send(res, 200, { ok: true, configured: true, record });
    }

    if (req.method === 'GET') {
      const records = await listMeetingHistory(parseQuery(req));
      return send(res, 200, { ok: true, configured: true, records });
    }

    return send(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (error) {
    return send(res, 500, { ok: false, configured: true, error: error.message || 'History API error' });
  }
};
