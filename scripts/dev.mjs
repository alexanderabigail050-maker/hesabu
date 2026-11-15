import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const port = Number(process.env.PORT || 3000);
const production = process.argv.includes('--production');
process.chdir(root);

async function build() {
  await new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ['scripts/build.mjs'], { cwd: root, stdio: 'inherit' });
    proc.once('exit', code => code === 0 ? resolve() : reject(new Error('Build failed')));
    proc.once('error', reject);
  });
}
if (!production) await build();
else await stat(path.join(dist, 'index.html')).catch(() => { throw new Error('Run npm run build before npm start.'); });

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.bcmap': 'application/octet-stream', '.pfb': 'application/octet-stream', '.ttf': 'font/ttf' };
const config = JSON.parse(await readFile('vercel.json', 'utf8'));
const commonHeaders = config.headers.find(rule => rule.source === '/(.*)').headers;
const allowedApis = new Set(['status', 'session', 'chat', 'study']);

const server = createServer(async (req, res) => {
  for (const { key, value } of commonHeaders) res.setHeader(key, value);
  res.setHeader('Cache-Control', 'no-store');
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      const name = url.pathname.slice(5);
      if (!allowedApis.has(name)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'This API route does not exist.' }));
      }
      const { default: handler } = await import(pathToFileURL(path.join(root, 'api', `${name}.js`)).href);
      return await handler(req, res);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      return res.end('Method not allowed');
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const filename = path.resolve(dist, relative);
    if (filename !== dist && !filename.startsWith(dist + path.sep)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    let contents;
    try { contents = await readFile(filename); }
    catch { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream' });
    return res.end(req.method === 'HEAD' ? undefined : contents);
  } catch (error) {
    console.error('Request failed:', error.message);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'The local server could not complete that request.' }));
  }
});

server.listen(port, '0.0.0.0', () => console.log(`Hesabu AI is running at http://localhost:${port}\n${production ? 'Production preview.' : 'Source changes rebuild automatically. Refresh the browser after each build. Restart for server changes.'}`));

if (!production) {
  let timer;
  let building = false;
  let queued = false;
  const rebuild = async () => {
    if (building) { queued = true; return; }
    building = true;
    try { await build(); } catch { console.error('Fix the source error and save again to rebuild.'); }
    finally { building = false; if (queued) { queued = false; void rebuild(); } }
  };
  const schedule = () => { clearTimeout(timer); timer = setTimeout(rebuild, 150); };
  watch(path.join(root, 'src'), { recursive: true }, schedule);
  watch(path.join(root, 'public'), { recursive: true }, schedule);
}
