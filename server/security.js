import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { ApiError } from './http.js';

const COOKIE_NAME = 'hesabu_session';
const memoryWindows = new Map();
const hash = value => createHash('sha256').update(String(value)).digest('hex');
const sign = (value, secret) => createHmac('sha256', secret).update(value).digest('base64url');

export function matchesPassword(candidate, expected) {
  return typeof candidate === 'string' && candidate.length <= 1024 && timingSafeEqual(Buffer.from(hash(candidate)), Buffer.from(hash(expected)));
}

export function createSession(config, now = Date.now()) {
  const payload = {
    v: 1,
    sid: randomBytes(18).toString('base64url'),
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + config.sessionSeconds,
    version: hash(config.accessCode).slice(0, 24),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded, config.sessionSecret)}`;
}

export function readSession(req, config, now = Date.now()) {
  if (!config.authConfigured) return null;
  const cookies = String(req.headers.cookie || '');
  if (cookies.length > 16_384) return null;
  const value = cookies.split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!value || value.length > 2048) return null;
  const parts = value.split('.');
  if (parts.length !== 2 || !parts.every(p => /^[A-Za-z0-9_-]+$/.test(p))) return null;
  const expected = sign(parts[0], config.sessionSecret);
  if (parts[1].length !== expected.length || !timingSafeEqual(Buffer.from(parts[1]), Buffer.from(expected))) return null;
  try {
    const session = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const seconds = Math.floor(now / 1000);
    if (session.v !== 1 || typeof session.sid !== 'string' || !/^[A-Za-z0-9_-]{24}$/.test(session.sid) || !Number.isInteger(session.exp) || !Number.isInteger(session.iat) || session.exp <= seconds || session.iat > seconds + 30 || session.exp - session.iat !== config.sessionSeconds || session.version !== hash(config.accessCode).slice(0, 24)) return null;
    return session;
  } catch { return null; }
}

export function setSessionCookie(res, token, config) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${config.sessionSeconds}${config.production ? '; Secure' : ''}`);
}

export function clearSessionCookie(res, config) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${config.production ? '; Secure' : ''}`);
}

export function requireSession(req, config) {
  if (!config.ready) throw new ApiError(503, 'NOT_CONFIGURED', 'Live AI is not configured yet. You can still use the sample learning workspace.');
  const session = readSession(req, config);
  if (!session) throw new ApiError(401, 'AUTH_REQUIRED', 'Enter your study access code to use live AI.');
  return session;
}

export function clientKey(req, config) {
  // Vercel sets this header. Locally, use the socket instead of trusting a caller-supplied header.
  const address = process.env.VERCEL === '1'
    ? String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()
    : String(req.socket?.remoteAddress || 'local');
  return hash(`${config.sessionSecret}:${address}`).slice(0, 32);
}

const REDIS_SCRIPT = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return {n,redis.call('TTL',KEYS[1])}";

export async function consumeLimit(key, limit, windowSeconds, config, now = Date.now(), fetcher = fetch) {
  let count;
  let retryAfter;
  if (config.redisUrl && config.redisToken) {
    try {
      const response = await fetcher(config.redisUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.redisToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['EVAL', REDIS_SCRIPT, '1', `hesabu:${key}`, String(windowSeconds)]),
        signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) throw new Error('Rate limit unavailable');
      const data = await response.json();
      if (data.error || !Array.isArray(data.result) || data.result.length !== 2 || !Number.isFinite(data.result[0]) || !Number.isFinite(data.result[1])) throw new Error('Invalid rate limit result');
      [count, retryAfter] = data.result;
    } catch {
      throw new ApiError(503, 'LIMITER_UNAVAILABLE', 'The request limit service is temporarily unavailable. Please try again shortly.');
    }
  } else {
    let entry = memoryWindows.get(key);
    if (!entry || entry.until <= now) entry = { count: 0, until: now + windowSeconds * 1000 };
    entry.count += 1;
    memoryWindows.set(key, entry);
    count = entry.count;
    retryAfter = Math.max(1, Math.ceil((entry.until - now) / 1000));
    if (memoryWindows.size > 10_000) {
      for (const [k, v] of memoryWindows) if (v.until <= now) memoryWindows.delete(k);
      if (memoryWindows.size > 10_000) {
        for (const k of Array.from(memoryWindows.keys()).slice(0, 1000)) memoryWindows.delete(k);
      }
    }
  }
  if (count > limit) {
    const error = new ApiError(429, 'RATE_LIMITED', 'Too many requests. Take a short break and try again later.');
    error.retryAfter = Math.max(1, Number(retryAfter) || windowSeconds);
    throw error;
  }
}

export async function limitLogin(req, config) {
  await consumeLimit(`login:${clientKey(req, config)}`, 8, 900, config);
}

export async function limitAI(req, session, config) {
  await consumeLimit(`ai-ip:${clientKey(req, config)}`, 60, 3600, config);
  await consumeLimit(`ai-session:${session.sid}`, 30, 3600, config);
}

export function clearMemoryLimitsForTests() { memoryWindows.clear(); }
