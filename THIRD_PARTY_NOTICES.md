# Third-party components

The application uses these independently maintained components:

| Component | Version | License |
| --- | --- | --- |
| React | 19.2.6 | MIT |
| React DOM | 19.2.6 | MIT |
| Scheduler | 0.27.0 | MIT |
| Lucide React | 1.31.0 | ISC |
| esbuild | 0.28.0 | MIT |
| Mozilla PDF.js | 5.6.205 | Apache 2.0 |

React, React DOM, Scheduler, Lucide, and esbuild are installed from npm. Their packages include the relevant licenses. Build output retains bundled legal notices.

PDF.js browser modules, character maps, and standard fonts are included under `public/vendor/`. The PDF.js license is in `public/vendor/PDFJS-LICENSE.txt`. The character-map and standard-font directories also retain their own supplied license notices. These files are copied unchanged from the installed distribution.

Hesabu's icon artwork, interface composition, prompts, and original sample lesson content are provided with this project. OpenAI, GPT, ChatGPT, GitHub, and Vercel names identify external services. This application is not endorsed by those providers.
