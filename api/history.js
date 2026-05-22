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

function classifyError(error) {
  const raw = String(error && error.message ? error.message : 'History API error');
  const msg = raw.toLowerCase();

  if (msg.includes('supabase no configurado') || msg.includes('not configured')) {
    return { status: 503, configured: false, error: 'Supabase no configurado', hint: 'Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.' };
  }

  if (msg.includes('invalid url') || msg.includes('only absolute urls are supported')) {
    return { status: 500, configured: true, error: 'URL de Supabase inválida', hint: 'Revisa formato de SUPABASE_URL (incluye https:// y dominio correcto).' };
  }

  if (msg.includes('fetch failed') || msg.includes('econn') || msg.includes('enotfound') || msg.includes('network')) {
    return { status: 502, configured: true, error: 'Error de red al conectar con Supabase', hint: 'No se pudo alcanzar Supabase desde el runtime (DNS/red/firewall).' };
  }

  if (msg.includes('supabase history insert') || msg.includes('supabase history list')) {
    const statusMatch = raw.match(/\b(4\d\d|5\d\d)\b/);
    const supabaseStatus = statusMatch ? Number(statusMatch[1]) : 502;
    if (supabaseStatus === 401 || supabaseStatus === 403) {
      return { status: 502, configured: true, error: 'Supabase rechazó la autenticación/autorización', hint: 'Revisa permisos/RLS y la service role key en el entorno del backend.' };
    }
    if (supabaseStatus === 404) {
      return { status: 502, configured: true, error: 'Recurso de Supabase no encontrado', hint: 'Verifica endpoint REST y existencia de la tabla meeting_history.' };
    }
    if (supabaseStatus === 400 || supabaseStatus === 422) {
      return { status: 502, configured: true, error: 'Solicitud inválida a Supabase', hint: 'Posible problema de esquema/columnas o filtros de consulta.' };
    }
    return { status: 502, configured: true, error: 'Error HTTP de Supabase', hint: 'Supabase respondió con error al leer/escribir meeting_history.' };
  }

  return { status: 500, configured: true, error: 'History API error', hint: 'Error interno al procesar historial operacional.' };
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 200, { ok: true });

  if (!isConfigured()) {
    return send(res, 503, {
      ok: false,
      configured: false,
      error: 'Supabase no configurado',
      hint: 'Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.',
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

    return send(res, 405, { ok: false, configured: true, error: 'Method not allowed', hint: 'Usa GET para listar o POST para guardar historial.' });
  } catch (error) {
    const mapped = classifyError(error);
    return send(res, mapped.status, {
      ok: false,
      configured: mapped.configured,
      error: mapped.error,
      hint: mapped.hint,
    });
  }
};
