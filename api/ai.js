const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const OPENAI_TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions';

const meetingSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    agreements: { type: 'array', items: { type: 'string' } },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: { type: 'string' },
          responsible: { type: 'string' },
          date: { type: 'string' },
          priority: { type: 'string' },
        },
        required: ['action', 'responsible', 'date', 'priority'],
      },
    },
    risks: { type: 'array', items: { type: 'string' } },
    next_steps: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'agreements', 'tasks', 'risks', 'next_steps'],
};

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function readBody(req) {
  if (req.body) {
    if (typeof req.body === 'string') return Promise.resolve(JSON.parse(req.body));
    return Promise.resolve(req.body);
  }
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (error) { reject(error); }
    });
    req.on('error', reject);
  });
}

function extractResponseText(data) {
  if (data.output_text) return data.output_text;
  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.text) parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

async function transcribeAudio(audio, apiKey) {
  if (!audio || !audio.data) return '';
  const buffer = Buffer.from(audio.data, 'base64');
  const blob = new Blob([buffer], { type: audio.mime || 'audio/webm' });
  const form = new FormData();
  form.append('model', audio.model || 'gpt-4o-transcribe');
  form.append('file', blob, audio.name || 'audio.webm');

  const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) throw new Error(`OpenAI transcription error ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return data.text || '';
}

async function runOpenAI({ model, prompt, input, type }, apiKey) {
  const transcript = input && input.audio ? await transcribeAudio(input.audio, apiKey) : '';
  const finalPrompt = [
    prompt || '',
    input && input.text ? `\nINPUT:\n${input.text}` : '',
    transcript ? `\nTRANSCRIPCIÓN DE AUDIO:\n${transcript}` : '',
  ].filter(Boolean).join('\n');

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      instructions: 'Responde únicamente JSON válido y accionable para operaciones UNICEF/WASH.',
      input: finalPrompt,
      text: {
        format: {
          type: 'json_schema',
          name: type === 'meeting' ? 'meeting_result' : 'wash_result',
          strict: true,
          schema: meetingSchema,
        },
      },
    }),
  });

  if (!response.ok) throw new Error(`OpenAI Responses error ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const text = extractResponseText(data);
  JSON.parse(text);
  return text;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 200, { ok: true });
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' });

  try {
    const { provider = 'openai', model = 'gpt-4o-mini', prompt = '', input = {}, type = 'meeting' } = await readBody(req);
    if (!process.env.OPENAI_API_KEY) return send(res, 500, { ok: false, error: 'OPENAI_API_KEY no configurada' });
    if (provider !== 'openai') return send(res, 501, { ok: false, error: `Provider no implementado todavía: ${provider}` });

    const text = await runOpenAI({ model, prompt, input, type }, process.env.OPENAI_API_KEY);
    return send(res, 200, { ok: true, text, provider, model });
  } catch (error) {
    return send(res, 500, { ok: false, error: error.message || 'AI gateway error' });
  }
};
