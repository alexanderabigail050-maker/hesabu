export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const MAX_BODY_BYTES = 120 * 1024;

export function setPrivateHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Vary', 'Cookie, Origin');
}

export function json(res, status, value) {
  if (res.writableEnded || res.destroyed) return;
  setPrivateHeaders(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(value));
}

export function fail(res, error) {
  if (res.writableEnded || res.destroyed) return;
  const known = error instanceof ApiError;
  if (known && error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
  json(res, known ? error.status : 500, {
    error: known ? error.message : 'Something went wrong. Please try again.',
    code: known ? error.code : 'INTERNAL_ERROR',
  });
}

export function method(req, res, allowed) {
  if (!allowed.includes(req.method)) {
    res.setHeader('Allow', allowed.join(', '));
    throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'This request method is not supported.');
  }
}

export async function readJson(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(String(req.headers['content-type'] || ''))) {
    throw new ApiError(415, 'JSON_REQUIRED', 'Send this request as application/json.');
  }
  const length = Number(req.headers['content-length']);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    throw new ApiError(413, 'BODY_TOO_LARGE', 'This request is too large. Use fewer notes or a shorter conversation.');
  }
  let body = req.body;
  if (body === undefined) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) throw new ApiError(413, 'BODY_TOO_LARGE', 'This request is too large. Use fewer notes or a shorter conversation.');
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    body = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw new ApiError(413, 'BODY_TOO_LARGE', 'This request is too large.');
    try { body = JSON.parse(body); }
    catch { throw new ApiError(400, 'INVALID_JSON', 'The request contains invalid JSON.'); }
  } else {
    try {
      if (Buffer.byteLength(JSON.stringify(body) || '') > MAX_BODY_BYTES) throw new ApiError(413, 'BODY_TOO_LARGE', 'This request is too large.');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(400, 'INVALID_JSON', 'The request contains invalid JSON.');
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'INVALID_BODY', 'The request must be a JSON object.');
  return body;
}

export function sameOrigin(req, production = false) {
  const raw = req.headers.origin;
  const host = req.headers.host;
  if (typeof raw !== 'string' || typeof host !== 'string' || !host || /[\s,\/\\]/.test(host)) {
    throw new ApiError(403, 'ORIGIN_REQUIRED', 'Open Hesabu AI in its own browser tab and try again.');
  }
  let origin;
  try { origin = new URL(raw); }
  catch { throw new ApiError(403, 'ORIGIN_MISMATCH', 'This request did not come from this app.'); }
  if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== raw || origin.host.toLowerCase() !== host.toLowerCase() || (production && origin.protocol !== 'https:') || req.headers['sec-fetch-site'] === 'cross-site') {
    throw new ApiError(403, 'ORIGIN_MISMATCH', 'This request did not come from this app.');
  }
}

export function requestAbort(req, res, timeoutMs = 50_000) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  timer.unref?.();
  const disconnected = () => { if (!res.writableEnded) controller.abort(); };
  req.on?.('aborted', disconnected);
  res.on?.('close', disconnected);
  // Authentication and a remote rate-limit lookup can finish after the browser
  // has gone away. The close event may therefore predate these listeners.
  if (req.aborted || res.destroyed || res.writableEnded) controller.abort();
  return {
    signal: controller.signal,
    get timedOut() { return timedOut; },
    abort: () => controller.abort(),
    cleanup() {
      clearTimeout(timer);
      req.off?.('aborted', disconnected);
      res.off?.('close', disconnected);
    },
  };
}

export function sse(res, event) {
  if (!res.destroyed && !res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
}
