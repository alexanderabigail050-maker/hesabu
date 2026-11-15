# Deployment and data boundaries

## Secrets and sessions

All paid AI requests pass through the Node handlers in `api/`. Only those handlers read `OPENAI_API_KEY`. The build embeds no environment values except the literal production mode flag. There is no client-supplied model, system prompt, or arbitrary upstream endpoint.

AI access requires a configured private study code and a separate session signing secret. Login uses a timing-safe comparison and creates a signed, 12-hour `HttpOnly`, `SameSite=Strict` cookie. Vercel production cookies are `Secure`. The cookie includes a random session identifier. Rotating either secret invalidates existing cookies. Logging out clears the current cookie; this stateless release has no central per-session revocation list.

The static interface and local tools are accessible before login. The code gate protects use of the AI API, not access to files already saved in the same browser profile. Use separate device/browser profiles for separate learners.

Mutation endpoints check the request Origin against the Host, require HTTPS in production, reject cross-site fetches, and accept JSON bodies for submitted data. The API does not enable cross-origin requests.

## Request and response limits

- Request body: 120 KiB.
- Chat history: at most 24 messages, each at most 12,000 characters, with a 40,000-character conversation budget.
- Sources: at most four notes, at most 30,000 characters per note, and 48,000 characters in total at the server boundary. The browser deliberately sends smaller excerpts and shows the context notice.
- Chat output: at most 4,500 model output tokens. Structured study output: at most 5,000 tokens. These limits include reasoning tokens when applicable.
- Upstream time limit: 50 seconds. Vercel function configuration: 60 seconds.
- Provider response parsing is bounded, and unfinished or invalid outputs produce explicit errors.

The server handles refusals, truncated responses, interrupted streams, unavailable models, and upstream errors. It does not forward raw provider errors, API keys, or secrets to the browser. Learner content and provider responses are not intentionally logged by the application.

## Rate limits and operating scale

Login attempts are limited to 8 per 15 minutes per IP. AI calls are limited to 30 per hour per signed session and 60 per hour per IP.

Without Upstash, counters exist in a function instance's memory. They can reset on cold starts and are not shared between instances or routes. They are a convenience for a trusted small group, **not a reliable global quota or billing cap**. A holder of the shared study code is authorized to spend the owner's API quota.

Set both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to use atomic Redis counters across serverless instances. If the configured limiter fails, AI requests fail closed rather than bypassing the limits. The optional Redis integration was tested with mocked REST responses, not a live database.

For an unrestricted public student service, add individual authentication, persistent per-user quotas, operational monitoring, and a billing policy before opening access. Review provider usage controls and costs. The bundled access-code design is intended for personal use and invited study groups.

## Student content

Browser storage is not encrypted. Local backups contain the student's notes and chats. Protect exported files as you would the original material.

PDF files are parsed locally. On an AI action, selected text excerpts and recent messages are processed by the deployed server and sent to OpenAI. Requests use `store: false`; that setting is not a promise of zero provider retention. Consult the provider's data controls for your account.

Notes are treated as untrusted reference material in the prompt. Source-only behavior is an instruction to the model, not a formal guarantee that each generated statement is supported. Review explanations and answer keys when using them for assessed work.

The Markdown renderer uses React text nodes, excludes raw HTML execution, and restricts links to safe schemes. Security headers include a Content Security Policy, frame restrictions, and MIME sniffing protection. PDF parsing is self-hosted and disables evaluation support.
