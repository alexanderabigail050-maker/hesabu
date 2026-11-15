# Official implementation references

Checked 15 November 2026. These are implementation references, not citations for AI-generated teaching content.

| Topic | Primary documentation |
| --- | --- |
| Exact requested model `gpt-5.6-sol`, reasoning support, streaming and structured outputs | https://developers.openai.com/api/docs/models/gpt-5.6-sol |
| Responses streaming events | https://developers.openai.com/api/docs/guides/streaming-responses |
| JSON Schema structured outputs | https://developers.openai.com/api/docs/guides/structured-outputs |
| Responses API request fields | https://developers.openai.com/api/reference/resources/responses/methods/create |
| Vercel Node functions | https://vercel.com/docs/functions/runtimes/node-js |
| Default function exports in the API directory | https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration |
| Vercel Node 24 support and package engine selection | https://vercel.com/docs/functions/runtimes/node-js/node-js-versions |
| Static Vercel project configuration | https://vercel.com/docs/project-configuration/vercel-json |

Dependencies are pinned in `package.json` and `package-lock.json`. PDF.js browser files are self-hosted from version 5.6.205 with its Apache 2.0 license. Consult current provider documentation before changing models, runtime limits, or deployment policies.
