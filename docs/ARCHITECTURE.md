# Architecture

## Runtime

The frontend is a React application compiled with esbuild into static, hashed JS and CSS assets in `dist/`. It does not depend on a framework-specific hosting server. Vercel serves those assets and discovers the four Node.js functions in the repository's `api/` directory.

The only external service required for live learning features is the OpenAI Responses API. The model is configured on the server and defaults to `gpt-5.6-sol`. Model reasoning effort is `low` to balance response time with this app's bounded educational requests.

| Route | Method | Responsibility |
| --- | --- | --- |
| `/api/status` | GET | Nonsecret configuration readiness and current cookie status |
| `/api/session` | POST | Validate the study code and set a signed session cookie |
| `/api/session` | DELETE | Clear the session cookie |
| `/api/chat` | POST | Validate a tutor request and relay text through server-sent events |
| `/api/study` | POST | Generate and validate structured quiz or flashcard JSON |

The local server in `scripts/dev.mjs` dispatches to these same handlers. Backend tests can substitute the provider transport without changing production behavior.

## Learning state

Versioned browser storage holds a local profile, conversations, source notes, flashcards, quiz attempts, a study plan, and focus sessions. Import reconstructs known fields, checks types and sizes, and rejects incompatible or unsafe data. The app does not silently replace corrupted storage with a new saved workspace.

Review cards use explicit intervals derived from the learner's rating. The schedule is intentionally inspectable and makes no claim of scientifically predicting retention. Quiz feedback identifies weak topics from recorded correct/incorrect answers. It does not infer ability from demographics or invent progress.

The exam planner is deterministic. Its behavior can be checked without AI access, and task completion is local. Tutor text and learning activities are generated only after an explicit user action.

## Streaming

The browser sends selected context to `/api/chat`. The server authenticates, validates, applies limits, and calls the Responses API. Text delta events become small application-level SSE events. A terminal success event is required. If the stream ends early or the provider returns an error, the client shows an interruption rather than treating partial text as complete.

Stopping a request aborts the browser fetch. The server listens for disconnects and aborts its upstream fetch. A server timeout provides an additional bound. Abort is a best effort to stop processing and is not a guarantee that the provider will charge zero tokens for an interrupted request.

## Structured learning activities

Quiz and card requests use strict JSON schemas through `text.format`. The backend separately validates the parsed result, including the number of options and correct-answer index. Malformed output is rejected. The browser receives structured objects rather than trying to guess question boundaries from Markdown.

## Delivery

The ZIP contains source, pinned dependency metadata, serverless configuration, tests, documentation, and PDF parsing assets with license notices. Credentials, `node_modules`, transient screenshots, and local test outputs are excluded. The owner supplies the environment variables and deploys through GitHub and Vercel.
