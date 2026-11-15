import { getConfig } from './config.js';
import { ApiError, fail, json, method, readJson, requestAbort, sameOrigin, setPrivateHeaders, sse } from './http.js';
import { clearSessionCookie, createSession, limitAI, limitLogin, matchesPassword, readSession, requireSession, setSessionCookie } from './security.js';
import { studySchema, validateChat, validateStudy, validateStudyOutput } from './validation.js';
import { instructions, sourceMessage, studyInput } from './prompts.js';
import { createResponse, outputText, readStructured, responseEvents, streamFailure } from './openai.js';

// A small factory keeps provider calls injectable in integration tests; the Vercel
// entry points below use the exact same handlers as the local development server.
export function createHandlers(options = {}) {
  const config = () => getConfig(options.env || process.env);
  const fetcher = (...args) => (options.fetcher || fetch)(...args);
  const timeout = options.timeoutMs ?? 50_000;

  async function status(req, res) {
    try {
      method(req, res, ['GET']);
      const current = config();
      json(res, 200, {
        ready: current.ready,
        model: current.model,
        authRequired: true,
        authenticated: Boolean(readSession(req, current)),
        ...(current.reason ? { reason: current.reason } : {}),
      });
    } catch (error) { fail(res, error); }
  }

  async function session(req, res) {
    try {
      method(req, res, ['POST', 'DELETE']);
      const current = config();
      sameOrigin(req, current.production);
      if (req.method === 'DELETE') {
        clearSessionCookie(res, current);
        json(res, 200, { authenticated: false });
        return;
      }
      await limitLogin(req, current);
      if (!current.authConfigured) throw new ApiError(503, 'NOT_CONFIGURED', 'The study access code has not been configured on the server.');
      const body = await readJson(req);
      if (Object.keys(body).some(k => k !== 'password') || !matchesPassword(body.password, current.accessCode)) throw new ApiError(401, 'INVALID_PASSWORD', 'That access code is not correct. Please try again.');
      setSessionCookie(res, createSession(current), current);
      json(res, 200, { authenticated: true });
    } catch (error) { fail(res, error); }
  }

  async function chat(req, res) {
    let abort;
    let started = false;
    try {
      method(req, res, ['POST']);
      const current = config();
      sameOrigin(req, current.production);
      const session = requireSession(req, current);
      const request = validateChat(await readJson(req));
      await limitAI(req, session, current);
      abort = requestAbort(req, res, timeout);
      abort.signal.throwIfAborted();
      const upstream = await createResponse(current, {
        instructions: instructions(request),
        input: [...sourceMessage(request.notes), ...request.messages],
        stream: true,
        max_output_tokens: 4500,
      }, abort.signal, fetcher);
      setPrivateHeaders(res);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();
      started = true;
      let sawText = false;
      let complete = false;
      for await (const event of responseEvents(upstream)) {
        if (abort.signal.aborted) throw new Error('Aborted');
        if (['response.output_text.delta', 'response.refusal.delta'].includes(event.type) && typeof event.delta === 'string') {
          if (event.delta) sawText = true;
          sse(res, { type: 'delta', text: event.delta });
        } else if (event.type === 'response.completed') {
          if (!sawText) {
            const text = outputText(event.response);
            sawText = true;
            sse(res, { type: 'delta', text });
          }
          complete = true;
          sse(res, { type: 'done' });
          break;
        } else if (['error', 'response.failed', 'response.incomplete'].includes(event.type)) {
          throw streamFailure(event);
        }
      }
      if (!complete) throw new ApiError(502, 'INTERRUPTED_AI_RESPONSE', 'The connection ended before the answer was complete. Please try again.');
      res.end();
    } catch (error) {
      if (abort?.timedOut) error = new ApiError(504, 'AI_TIMEOUT', 'The AI took too long to respond. Try a shorter question.');
      if (started) {
        sse(res, { type: 'error', message: error instanceof ApiError ? error.message : 'The response was interrupted. Please try again.' });
        if (!res.destroyed && !res.writableEnded) res.end();
      } else { fail(res, error); }
    } finally { abort?.abort(); abort?.cleanup(); }
  }

  async function study(req, res) {
    let abort;
    try {
      method(req, res, ['POST']);
      const current = config();
      sameOrigin(req, current.production);
      const session = requireSession(req, current);
      const request = validateStudy(await readJson(req));
      await limitAI(req, session, current);
      abort = requestAbort(req, res, timeout);
      abort.signal.throwIfAborted();
      const upstream = await createResponse(current, {
        instructions: instructions(request, true),
        input: studyInput(request),
        stream: false,
        max_output_tokens: 5000,
        text: { format: { type: 'json_schema', name: `hesabu_${request.kind}`, strict: true, schema: studySchema(request.kind) } },
      }, abort.signal, fetcher);
      const data = validateStudyOutput(await readStructured(upstream), request);
      json(res, 200, data);
    } catch (error) {
      if (abort?.timedOut) error = new ApiError(504, 'AI_TIMEOUT', 'The AI took too long to create this activity. Try fewer items or a narrower topic.');
      fail(res, error);
    } finally { abort?.abort(); abort?.cleanup(); }
  }

  return { status, session, chat, study };
}

export const handlers = createHandlers();
