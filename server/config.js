export function getConfig(env = process.env) {
  const placeholder = value => /^(?:your[_\s-]|replace[_\s-]|change[_\s-]?me|sk[-_]your|<)/i.test(value);
  const apiKey = String(env.OPENAI_API_KEY || '').trim();
  const configuredModel = String(env.OPENAI_MODEL || 'gpt-5.6-sol').trim();
  const modelValid = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(configuredModel);
  const accessCode = String(env.HESABU_ACCESS_CODE || '');
  const sessionSecret = String(env.SESSION_SECRET || '');
  const redisUrl = String(env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
  const redisToken = String(env.UPSTASH_REDIS_REST_TOKEN || '');
  const production = env.VERCEL === '1' || env.NODE_ENV === 'production';
  const reasons = [];
  if (!apiKey || placeholder(apiKey)) reasons.push('Add a valid OPENAI_API_KEY on the server');
  if (!modelValid) reasons.push('Set OPENAI_MODEL to a valid API model ID');
  const authConfigured = accessCode.length >= 16 && sessionSecret.length >= 32 && !placeholder(accessCode) && !placeholder(sessionSecret);
  if (accessCode.length < 16 || placeholder(accessCode)) reasons.push('Set HESABU_ACCESS_CODE to your own private code of at least 16 characters');
  if (sessionSecret.length < 32 || placeholder(sessionSecret)) reasons.push('Set SESSION_SECRET to your own random secret of at least 32 characters');
  if (Boolean(redisUrl) !== Boolean(redisToken)) reasons.push('Set both Upstash variables, or remove both');
  if (redisUrl && !/^https:\/\/[^/\s]+(?:\/)?$/.test(redisUrl)) reasons.push('Use a valid HTTPS Upstash REST URL');
  return {
    apiKey, model: modelValid ? configuredModel : 'gpt-5.6-sol', accessCode, sessionSecret,
    redisUrl, redisToken, production, ready: reasons.length === 0,
    reason: reasons.length ? `${reasons.join('. ')}.` : undefined,
    authConfigured,
    sessionSeconds: 12 * 60 * 60,
  };
}
