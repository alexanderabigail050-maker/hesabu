import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
await rm('dist', { recursive: true, force: true });
await mkdir('dist/assets', { recursive: true });
await cp('public', 'dist', { recursive: true });

const result = await build({
  entryPoints: ['src/main.jsx'],
  bundle: true,
  splitting: true,
  format: 'esm',
  jsx: 'automatic',
  outdir: 'dist/assets',
  entryNames: '[name]-[hash]',
  chunkNames: 'chunk-[hash]',
  assetNames: '[name]-[hash]',
  minify: true,
  sourcemap: false,
  target: ['es2022'],
  metafile: true,
  legalComments: 'linked',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info'
});
const [entry, details] = Object.entries(result.metafile.outputs).find(([, value]) => value.entryPoint === 'src/main.jsx');
const url = (file) => '/' + path.relative('dist', file).split(path.sep).join('/');
const css = details.cssBundle ? `<link rel="stylesheet" href="${url(details.cssBundle)}">` : '';
const html = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#080b11"><meta name="color-scheme" content="dark"><meta name="description" content="A clear space for deeper learning. Understand concepts, practice with questions, and make knowledge stick with Hesabu AI."><link rel="icon" href="/favicon.svg" type="image/svg+xml"><title>Hesabu AI — Make it click.</title>${css}</head><body><div id="root"></div><noscript>Hesabu AI needs JavaScript to run its interactive learning tools. Please enable it and reload.</noscript><script type="module" src="${url(entry)}"></script></body></html>`;
await writeFile('dist/index.html', html);
await writeFile('dist/build-info.json', JSON.stringify({ version: JSON.parse(await readFile('package.json', 'utf8')).version, builtAt: new Date().toISOString() }));
console.log('Built Hesabu AI into dist/. Server API functions remain in api/.');
