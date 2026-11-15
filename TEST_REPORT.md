# Verification report

Prepared 15 November 2026 for Hesabu AI 1.0.0.

## Result

The delivered source passes **37 automated tests** and its **production build**. Initial React rendering and a production HTTP smoke check also pass. This is a source package configured for Vercel; no live Vercel deployment or paid OpenAI request was performed.

| Check | Result | What it establishes |
| --- | --- | --- |
| `npm test` | 37 passed, 0 failed | Core learning logic and server integration behavior |
| `npm run build` | Passed | All frontend imports and JSX compile, hashed assets and HTML are produced |
| `npm run check` | Passed | Tests and production build run together |
| Initial React server render | Passed | The default workspace, composer, navigation, sample entry, and profile render without a runtime exception |
| Production HTTP smoke | Passed | `npm start` implementation serves HTML, compiled assets and PDF worker, applies CSP, returns status, gates unconfigured AI, and returns 404 for unknown API routes |
| `npm ci --dry-run --ignore-scripts --offline --no-audit --no-fund` | Passed | The pinned dependency tree and lockfile are internally consistent on Linux |
| Independent code review | Completed | API contracts, persistence boundaries, limits, deployment documentation, and cancellation behavior reviewed |

Runtime used: Node.js **24.22.1**. Vercel is configured to use the **24.x** major version.

## Automated coverage

### Learning core: 18 tests

- Empty workspaces contain no invented progress or personal data.
- Workspace backups round-trip through validation.
- Corrupt local storage is preserved and reported instead of silently overwritten.
- Storage quota errors and unavailable storage return useful messages.
- Invalid versions, oversized backups, duplicate IDs, prototype-pollution keys, and inconsistent quiz scores are rejected.
- Due cards and all four review ratings use the intended intervals.
- Repeated reviews preserve earlier activity dates.
- Study plans preserve the daily time budget and handle calendar boundaries, invalid dates, unsupported horizons, and topic coverage.
- Statistics are calculated from recorded activity.
- Text-file ingestion rejects unsupported/oversized files and reports truncation.
- Client SSE parsing handles split Unicode, split frames, cancellation, server errors, and missing completion events.
- Structured quiz responses are checked before rendering.

### Server and HTTP integration: 19 tests

- Configuration readiness and authentication remain distinct, and secrets are not returned.
- Login, logout, cookie attributes, token tampering, token expiry, and secret rotation work as intended.
- Copied example placeholders and missing access controls fail closed.
- Foreign, absent, malformed, and insecure production origins are rejected.
- Streamed and pre-parsed request bodies are bounded.
- Client model overrides and system-message injection through the request schema are rejected.
- Source-only requests require notes.
- The configured model is used exactly, without automatic fallback.
- Provider errors are sanitized.
- Successful streaming, split UTF-8, unfinished streams, timeouts, and client cancellation are handled.
- A request disconnected before provider setup never starts an upstream request.
- Structured activity counts, options, answer indexes, refusals, incomplete responses, and source names are validated.
- In-memory limits enforce their window.
- Optional Redis limits use an atomic operation and fail closed when the configured limiter is unavailable.

OpenAI responses and Redis responses are mocked in these tests. The HTTP integration tests exercise the actual handlers through a local server.

## Issues corrected during review

- Already-disconnected clients are recognized before an AI call starts.
- Copied access-code and session-secret placeholders are rejected.
- Plans cannot silently omit topics when too few study days remain.
- Card review history survives subsequent reviews.
- The UI flushes local state when leaving or hiding the page.
- Again-rated cards can reappear when due without remounting the flashcard view.
- Full workspaces show explicit capacity messages instead of silently trimming saved conversations, notes, or cards.
- Expired AI sessions clear the cached authentication state so the next attempt can unlock again.
- Removed a missing font stylesheet import so the build has no external font dependency.

The last four UI behaviors were reviewed in code and compiled; they were not verified through interactive browser automation in this environment.

## Checks still required after deployment

**Browser visual and interaction checks are unverified.** The available headless browser could not launch under the environment's process restrictions. The shared browser could not reach the isolated local server, and its URL security policy rejected opening local HTML. No screenshot or desktop/mobile interaction is claimed as verified. The responsive CSS, accessible controls, modal focus behavior, and reduced-motion styles are implemented, but should be checked on the deployed site.

**A clean registry download/install was not completed here.** npm registry access was restricted. The build used already available packages at the exact versions recorded in the project. The lockfile dry run passed, but is not equivalent to installing from an empty dependency cache. The lockfile pins versions and resolved locations without recorded tarball integrity hashes. Vercel's install log is the next confirmation of clean installation.

**Real model access and billing are unverified.** Supply your own API key, confirm access to `gpt-5.6-sol`, and complete a live tutor and quiz request. `/api/status` reports configured values, not a provider connectivity test.

**PDF browser extraction and optional live Redis are unverified.** PDF assets are bundled and the worker is served with the correct MIME type. Text-file and limit handling are tested. Run a selectable-text PDF through the deployed browser and test Redis if you enable it.

The deployment verification sequence is in `README.md`. Account-specific failures, visual defects, accessibility issues, or provider limits can still surface in those checks.
