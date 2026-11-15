import { ApiError } from './http.js';

const ENDPOINT = 'https://api.openai.com/v1/responses';
const MAX_PROVIDER_BYTES = 1_000_000;

async function readLimited(response) {
  if (!response.body) throw new ApiError(502, 'EMPTY_AI_RESPONSE', 'The AI service returned no response. Please try again.');
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_PROVIDER_BYTES) throw new ApiError(502, 'INVALID_AI_RESPONSE', 'The AI response was too large. Please try a shorter request.');
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally { await reader.cancel().catch(() => {}); }
}

function providerError(status, code = '') {
  if (status === 401 || status === 403) return new ApiError(503, 'AI_ACCESS', 'The server cannot access the AI service. Ask the app owner to check its API key and model access.');
  if (status === 404 || ['model_not_found', 'invalid_model'].includes(code)) return new ApiError(503, 'MODEL_UNAVAILABLE', 'The configured AI model is unavailable to this API project. Ask the app owner to check model access.');
  if (status === 429) return new ApiError(429, 'AI_LIMIT', code === 'insufficient_quota' ? 'The AI project has no available API quota. Ask the app owner to check API billing.' : 'The AI service is busy or its request limit was reached. Please try again shortly.');
  if (status === 400) return new ApiError(502, 'AI_REQUEST', 'The AI service could not accept this request. Try a shorter topic or ask the app owner to check the model configuration.');
  return new ApiError(502, 'AI_UNAVAILABLE', 'The AI service is temporarily unavailable. Please try again.');
}

export async function createResponse(config, payload, signal, fetcher = fetch) {
  let response;
  try {
    response = await fetcher(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model, store: false, reasoning: { effort: 'low' }, ...payload }),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new ApiError(502, 'AI_UNAVAILABLE', 'The AI service could not be reached. Please try again.');
  }
  if (!response.ok) {
    let code = '';
    try { code = JSON.parse(await readLimited(response))?.error?.code || ''; } catch { /* Never expose provider text. */ }
    throw providerError(response.status, code);
  }
  return response;
}

export async function* responseEvents(response) {
  if (!response.body || !String(response.headers.get('content-type') || '').toLowerCase().includes('text/event-stream')) throw new ApiError(502, 'INVALID_AI_STREAM', 'The AI service did not return a valid response stream.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let bytes = 0;
  const parse = frame => {
    const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!data || data === '[DONE]') return null;
    try { return JSON.parse(data); }
    catch { throw new ApiError(502, 'INVALID_AI_STREAM', 'The AI stream was interrupted. Please try again.'); }
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_PROVIDER_BYTES) throw new ApiError(502, 'INVALID_AI_STREAM', 'The AI response was too large. Try a shorter request.');
      buffer += decoder.decode(value, { stream: true });
      let separator;
      while ((separator = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);
        const event = parse(frame);
        if (event) yield event;
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      const event = parse(buffer);
      if (event) yield event;
    }
  } finally { await reader.cancel().catch(() => {}); }
}

export function outputText(response) {
  if (!response || response.status !== 'completed') throw new ApiError(502, 'INCOMPLETE_AI_RESPONSE', 'The AI could not finish this activity. Try fewer items or a narrower topic.');
  const parts = [];
  if (Array.isArray(response.output)) {
    for (const item of response.output) {
      if (item.type !== 'message' || !Array.isArray(item.content)) continue;
      for (const content of item.content) {
        if (content.type === 'refusal') throw new ApiError(422, 'AI_REFUSAL', 'The AI could not create this study activity. Try a different educational topic.');
        if (content.type === 'output_text' && typeof content.text === 'string') parts.push(content.text);
      }
    }
  }
  const text = parts.join('');
  if (!text.trim()) throw new ApiError(502, 'EMPTY_AI_RESPONSE', 'The AI returned no usable text. Please try again.');
  return text;
}

export async function readStructured(response) {
  let body;
  try { body = JSON.parse(await readLimited(response)); }
  catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, 'INVALID_AI_RESPONSE', 'The AI returned an unreadable response. Please try again.');
  }
  const text = outputText(body);
  try { return JSON.parse(text); }
  catch { throw new ApiError(502, 'INVALID_AI_OUTPUT', 'The AI returned an incomplete study activity. Please try again.'); }
}

export function streamFailure(event) {
  if (event.type === 'response.incomplete') return new ApiError(502, 'INCOMPLETE_AI_RESPONSE', 'The response was cut short. Try asking a smaller question.');
  return providerError(502, event.error?.code || event.code || '');
}
