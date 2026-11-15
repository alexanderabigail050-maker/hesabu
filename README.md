# Hesabu AI

**A clear space for deeper learning.**

Hesabu is a blue and black student workspace with a streaming tutor, guided learning, active recall, flashcards, study planning, and local notes. The AI connection uses **`gpt-5.6-sol`** through the OpenAI Responses API. Your API key stays in server environment variables.

## Launch from GitHub to Vercel

1. Extract the ZIP. Open the **`hesabu-ai`** folder. The directory containing `package.json`, `vercel.json`, `api/`, and `src/` is the project root.
2. Create a GitHub repository and upload that folder's **contents**. Include the supplied `.gitignore`, `.env.example`, `package-lock.json`, and `public/vendor/`. Do not upload your real `.env.local` or `node_modules`.
3. In Vercel choose **Add New → Project**, import the repository, and use the directory containing `package.json` as **Root Directory**.
4. Use **Framework Preset: Other**, **Node.js: 24.x**, **Build Command: `npm run build`**, **Output Directory: `dist`**, **Install Command: `npm ci`**. The supplied `vercel.json` and `package.json` set these values.
5. Add the environment variables below to **Production**. Add them to **Preview** as well if you want live AI on preview deployments.
6. Deploy. Open the site, start a tutor conversation, enter your study access code, and run the verification steps below.

Upload the source project, not only `dist`. The `api/` directory is required for the server connection.

### Environment variables

| Variable | Value you supply | Required |
| --- | --- | --- |
| `OPENAI_API_KEY` | Your OpenAI project API key | Yes, for live AI |
| `OPENAI_MODEL` | `gpt-5.6-sol` | Recommended. This exact model is also the default. |
| `HESABU_ACCESS_CODE` | A private, hard-to-guess study code of at least 16 characters | Yes, for live AI |
| `SESSION_SECRET` | A separately generated random secret of at least 32 characters | Yes, for live AI |
| `UPSTASH_REDIS_REST_URL` | Your Upstash Redis REST URL | Optional, with the token below |
| `UPSTASH_REDIS_REST_TOKEN` | Your Upstash Redis REST token | Optional, with the URL above |

Use actual values in Vercel. `.env.example` contains placeholders only. Never add `VITE_`, `NEXT_PUBLIC_`, or `PUBLIC_` to secret names. There is no API key field in the browser.

Generate a session secret on a computer with Node installed:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep `SESSION_SECRET` private. Only the study access code is shared with invited learners. Changing either the access code or the session secret invalidates existing AI sessions.

After changing Vercel variables, **redeploy** so the new values reach the functions. OpenAI account access and API usage billing must be enabled for the configured model. The application does not silently switch to another model if access fails.

## Learning tools

| Tool | What it does |
| --- | --- |
| Explain | Breaks a concept into a clear explanation and example, with a quick understanding check. |
| Guide me | Uses questions and hints to help the student reach an answer. |
| Teach back | Lets the student explain a concept and receive feedback on gaps and misconceptions. |
| Summarize | Turns the current topic or selected notes into a structured revision summary. |
| Practice | Creates multiple-choice questions with answer explanations and records completed attempts. |
| Weak topics | Uses recorded quiz answers to identify topics that need another attempt. |
| Flashcards | Creates cards or accepts manual cards, then schedules reviews using Again, Hard, Good, and Easy ratings. |
| Study plan | Divides available study time into learning, recall, and review tasks before an exam. Runs locally without an AI request. |
| Notes | Imports text PDFs, TXT, and Markdown, or accepts pasted notes. Selected source excerpts can accompany tutor requests. |
| Focus timer | Runs a study session and records completed focus time. |
| Workspace backup | Exports and imports your local learning data as JSON. |

The interface supports desktop and mobile layouts, keyboard navigation, reduced motion, English or Kiswahili AI responses, and configurable study level. App interface labels remain in English.

Study plans cover up to 90 days and require at least one available study day per topic. If the timeline is too short, the app asks you to combine topics or move the exam date rather than silently leaving topics out.

### Source notes

PDF text extraction happens in the browser with the included, self-hosted PDF.js files. No PDF parsing service is required. File import is limited to **10 MB**, the first **60 PDF pages**, and **30,000 characters** per note. The app reports when content is shortened. Scanned PDFs need OCR before import. Images, PPTX, and DOCX are not accepted by this release.

The learner chooses which notes to attach. Only selected text excerpts and recent conversation context are sent through the backend to OpenAI when an AI action runs. The interface identifies shortened context. Full local notes and chat history remain in the browser until removed.

**Source-only mode** instructs the tutor to answer from attached notes and say when they are insufficient. Source labels refer to supplied note titles. They are AI-generated references to your notes, not independently verified web citations. This app does not browse the web or search a university library.

### Preview and sample content

Without live server credentials, the interface remains available with a clearly labeled, hand-authored photosynthesis sample. It demonstrates the learning workflow. Samples are not live GPT responses. Local notes, manual flashcards, planning, and the timer still work. Sample work is labeled separately from ordinary study content.

## Where data is stored

This first release uses **browser local storage** for profiles, conversations, notes, cards, quiz results, and plans. You do not need Supabase or any database to launch it.

Data belongs to that browser profile and site address. A different device, incognito window, browser, or domain starts a separate workspace. Clearing browser site data deletes it. Use Settings to export a backup before changing devices or domains. Importing a backup replaces the current workspace after confirmation.

The study code controls paid AI access. It is **not an individual account**, and does not encrypt local data or separate students sharing one browser profile. This version has no account signup, cloud sync, classroom administration, subscriptions, or email service.

## Run on your computer

Install Node.js 24, then open a terminal in the project root:

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. The initial screen works without credentials. To connect live AI, copy `.env.example` to `.env.local`, replace the placeholders privately, and restart the server. The development script automatically loads `.env.local`.

Client source changes rebuild the app. Refresh the page after a build. Restart the server after changes under `server/` or `api/`. To preview a production build:

```bash
npm run build
npm start
```

The development and production preview server use the same API handlers as Vercel. `npm start` is a local preview command. Vercel runs the `api/` functions rather than this long-lived server.

## Verify your deployment

1. Open `/api/status`. Expect `ready: true`, the configured model, and `authenticated: false` before login. The endpoint never returns keys or the study code.
2. Ask a simple question in Learn. Enter the study code. Confirm text streams into the reply and a follow-up uses the same conversation.
3. Stop a reply during generation, then send another request. Check that the UI recovers.
4. Create a quiz. Answer it, read the explanations, and confirm the result is retained after a refresh.
5. Create cards, reveal an answer, and rate it. Confirm its next review changes.
6. Add a short text PDF or pasted note. Select it, enable source-only mode, and ask a question answered by that material. Ask an unrelated question to check the tutor states the source limitation.
7. Create a study plan, check a task, and refresh. Complete a short focus session.
8. Export a workspace backup. Open a separate browser profile, import it, and confirm the expected content.
9. In a private browser window, confirm live AI asks for the code. Try a wrong code and confirm access is denied.
10. Check the mobile layout and Vercel function logs for unexpected failures. Do not paste credentials into logs or chat.

The included automated tests mock OpenAI. They validate integration logic without spending API credit. A live request with your own deployment is still required to confirm that your OpenAI project can access the model.

## Test and build

```bash
npm test
npm run build
```

Or run both with `npm run check`. See `TEST_REPORT.md` for the checks performed on the delivered package, including limitations.

## Project map

| Path | Purpose |
| --- | --- |
| `src/App.jsx` | Workspace navigation, chat, and app state |
| `src/components/` | Reusable UI and learning views |
| `src/lib/` | Browser storage, learning logic, PDF import, client API |
| `src/data/demo.js` | Explicit sample learning content |
| `src/styles.css` | Blue and black visual system and responsive layouts |
| `api/` | Four Vercel serverless entry points |
| `server/` | Authentication, validation, prompts, rate limits, OpenAI calls |
| `public/vendor/` | Self-hosted PDF.js modules, character maps, fonts, and licenses |
| `scripts/` | Build and local preview tools |
| `tests/` | Node test-runner checks |
| `docs/` | Security, architecture, and documentation sources |

## Troubleshooting

**The site says Preview.** Open `/api/status` and read `reason`. Confirm all required variables are present, the values are not placeholders, and you redeployed after editing them.

**The site works, but `/api/status` is a 404.** You likely deployed only `dist`, or chose the wrong root directory. Deploy the complete folder containing both `api/` and `package.json`.

**The study code does not work.** The value is case-sensitive and includes any spaces you entered. Use the value of `HESABU_ACCESS_CODE`, not the API key or session secret.

**Model unavailable or API access error.** Confirm that your API key belongs to a project with access to `gpt-5.6-sol` and available usage quota. The UI reports errors instead of substituting sample output. If you intentionally choose a different compatible model, change `OPENAI_MODEL` and redeploy.

**A response times out.** Requests stop after 50 seconds, below the configured 60-second function duration. Narrow the topic, reduce attached notes, or generate fewer questions. Outputs are capped to control request size.

**Too many requests.** Wait for the limit window to reset. See `docs/SECURITY.md` for the exact limits and the distinction between local and distributed enforcement.

**A PDF looks empty or fails import.** Export it with selectable text, unlock it if password protected, or paste the relevant text. PDF diagrams, images, and scanned pages are not interpreted.

**History disappeared.** Check that you are on the same site address and browser profile. Local storage is not a cloud backup. Restore an exported JSON backup if available.

## Documentation sources

The requested model, Responses API, and Vercel runtime were checked against official documentation. See [`docs/SOURCES.md`](docs/SOURCES.md). This project is a custom educational application and is not an official OpenAI or ChatGPT product.
