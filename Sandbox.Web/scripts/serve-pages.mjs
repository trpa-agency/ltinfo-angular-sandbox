// Serves dist/pages the way GitHub Pages does, to check a Pages build before it ships:
// files only, under /<repo>/, no rewrite rules, and 404.html (with status 404) for any
// path that is not a file. A deep link works here only if it works on Pages.
//
//   node scripts/serve-pages.mjs [port, default 4340] [base, default /ltinfo-angular-sandbox/]

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.argv[2] ?? 4340);
const base = process.argv[3] ?? '/ltinfo-angular-sandbox/';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'pages');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.geojson': 'application/geo+json', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
};

async function file(path) {
  try {
    const info = await stat(path);
    return info.isDirectory() ? file(join(path, 'index.html')) : path;
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === base.slice(0, -1)) {
    res.writeHead(301, { Location: base }).end();
    return;
  }
  const local = path.startsWith(base) ? join(root, normalize(path.slice(base.length))) : null;
  // Pages redirects a folder address without its trailing slash, then serves its index.html.
  if (local && !path.endsWith('/') && (await stat(local).catch(() => null))?.isDirectory()) {
    res.writeHead(301, { Location: `${path}/${new URL(req.url, 'http://x').search}` }).end();
    return;
  }
  const found = local ? await file(local) : null;
  const served = found ?? join(root, '404.html');
  // A rebuild empties dist/pages for a moment; answer 503 then instead of exiting.
  const body = await readFile(served).catch(() => null);
  if (!body) {
    res.writeHead(503).end('dist/pages is not built');
    return;
  }
  res.writeHead(found ? 200 : 404, { 'Content-Type': TYPES[extname(served)] ?? 'application/octet-stream' });
  res.end(body);
}).listen(port, '127.0.0.1', () => console.log(`GitHub Pages stand-in: http://127.0.0.1:${port}${base}`));
