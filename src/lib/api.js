export class ApiError extends Error {
  constructor(message, status = 0, code = 'REQUEST_FAILED') {
    super(message);
    this.name = 'ApiError'; this.status = status; this.code = code;
  }
}

async function readError(response) {
  let detail;
  try {
    const body = await response.json();
    detail = typeof body.error === 'string' ? body.error : body.error?.message || body.message;
  } catch { /* Do not surface proxy HTML or upstream internals. */ }
  return new ApiError(typeof detail === 'string' && detail.length < 600 ? detail : response.status === 401
    ? 'Unlock AI access to continue.' : response.status === 429
      ? 'You have reached the request limit. Wait a moment and try again.'
      : response.status === 503 ? 'AI is not connected yet. Check the server configuration or explore the sample lesson.'
        : 'The request could not be completed. Please try again.', response.status);
}

function fetchError(error) {
  if (error?.name === 'AbortError' || error instanceof ApiError) return error;
  return new ApiError('The connection was interrupted. Check your internet connection and try again.');
}

async function requestJson(url, options = {}) {
  try {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    if (!response.ok) throw await readError(response);
    if (response.status === 204) return { ok: true };
    try { return await response.json(); }
    catch { throw new ApiError('The server returned an unreadable response. Please try again.', 502); }
  } catch (error) { throw fetchError(error); }
}

export async function getStatus() {
  const status = await requestJson('/api/status', { cache: 'no-store' });
  if (!status || typeof status.ready !== 'boolean' || typeof status.authenticated !== 'boolean') throw new ApiError('The AI connection status is unavailable.');
  return status;
}
export function login(password) {
  return requestJson('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
}
export function logout() { return requestJson('/api/session', { method: 'DELETE' }); }

function safePayload(payload) {
  const body = JSON.stringify(payload);
  if (new TextEncoder().encode(body).byteLength > 120 * 1024) throw new ApiError('This request is too large. Use fewer notes or start a new conversation.', 413);
  return body;
}

/** Parse SSE across arbitrary network chunk boundaries. An unexpected EOF must never look like a successful answer. */
export async function consumeChatStream(body, { onDelta = () => {}, signal } = {}) {
  if (!body || typeof body.getReader !== 'function') throw new ApiError('The server did not start a response stream.');
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', fullText = '', complete = false;
  const abort = () => { reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', abort, { once: true });
  const handleBlock = (block) => {
    const data = block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n');
    if (!data || data === '[DONE]') {
      // The app's protocol uses a typed done event. Upstream [DONE] is not forwarded as success.
      return;
    }
    let event;
    try { event = JSON.parse(data); }
    catch { throw new ApiError('The response stream was interrupted. Try asking again.'); }
    if (event.type === 'delta') {
      if (typeof event.text !== 'string') throw new ApiError('The response stream was invalid.');
      fullText += event.text;
      if (fullText.length > 200_000) throw new ApiError('The answer was too long. Ask for a shorter response.');
      onDelta(event.text);
    } else if (event.type === 'done') {
      complete = true;
    } else if (event.type === 'error') {
      throw new ApiError(typeof event.message === 'string' && event.message.length < 600 ? event.message : 'The AI could not finish this answer. Please try again.');
    }
  };
  const drain = () => {
    let match;
    while (!complete && (match = /\r?\n\r?\n/.exec(buffer))) {
      const block = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);
      handleBlock(block);
    }
  };
  try {
    if (signal?.aborted) throw new DOMException('The request was stopped.', 'AbortError');
    while (!complete) {
      const { value, done } = await reader.read();
      if (signal?.aborted) throw new DOMException('The request was stopped.', 'AbortError');
      if (done) {
        buffer += decoder.decode(); drain();
        if (!complete && buffer.trim()) handleBlock(buffer);
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 1_000_000) throw new ApiError('The response stream exceeded its size limit.');
      drain();
    }
    if (!complete) throw new ApiError('The connection ended before the answer was complete. Your partial answer is still visible.');
    return fullText;
  } finally {
    signal?.removeEventListener('abort', abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function streamChat(payload, { onDelta, signal } = {}) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: safePayload(payload), signal,
    });
    if (!response.ok) throw await readError(response);
    if (!response.headers.get('content-type')?.includes('text/event-stream')) throw new ApiError('The server did not return a live AI response. Check the API deployment.');
    return await consumeChatStream(response.body, { onDelta, signal });
  } catch (error) { throw fetchError(error); }
}

export function validateStudyResponse(value, kind) {
  const shortText = (s, max) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;
  if (!value || value.kind !== kind || !shortText(value.title, 180)) throw new ApiError('The AI returned an invalid study set. Please generate it again.', 502);
  if (kind === 'quiz') {
    if (!Array.isArray(value.questions) || value.questions.length < 1 || value.questions.length > 10) throw new ApiError('The quiz could not be read. Please try again.', 502);
    const ids = new Set();
    for (const q of value.questions) {
      if (!q || !shortText(q.id, 100) || ids.has(q.id) || !shortText(q.question, 3000) || !shortText(q.explanation, 5000) || !shortText(q.topic, 180)
        || !Array.isArray(q.options) || q.options.length !== 4 || !q.options.every(option => shortText(option, 1500))
        || !Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex > 3 || typeof q.source !== 'string' || q.source.length > 300) {
        throw new ApiError('The AI returned an incomplete quiz. Please generate it again.', 502);
      }
      ids.add(q.id);
    }
  } else if (kind === 'flashcards') {
    if (!Array.isArray(value.cards) || value.cards.length < 1 || value.cards.length > 10 || value.cards.some(c => !c
      || !shortText(c.front, 2000) || !shortText(c.back, 5000) || !shortText(c.topic, 180) || typeof c.source !== 'string' || c.source.length > 300)) {
      throw new ApiError('The AI returned incomplete review cards. Please generate them again.', 502);
    }
  } else throw new ApiError('That study tool is not supported.');
  return value;
}

export async function generateStudy(payload, { signal } = {}) {
  const result = await requestJson('/api/study', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: safePayload(payload), signal,
  });
  return validateStudyResponse(result, payload.kind);
}
