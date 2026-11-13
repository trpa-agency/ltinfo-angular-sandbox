// Builds the GitHub Pages copy of the app into dist/sandbox-web/browser.
//
//   node scripts/build-pages.mjs [base path, default /ltinfo-angular-sandbox/]
//
// The base path is the repository name between slashes, because a project site is served
// at https://<owner>.github.io/<repo>/. The workflow passes it in; locally the default fits
// a repository with this folder's name.
//
// GitHub Pages has no rewrite rules, so a deep link such as /<repo>/programs/41 would 404.
// Every address the app links to gets its own copy of index.html (programs/41/index.html),
// so it loads with status 200, and the Angular router takes the address from there.
// 404.html, also a copy, catches anything else; it works but loads with status 404.

import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let base = process.argv[2] ?? '/ltinfo-angular-sandbox/';
if (!base.startsWith('/')) base = `/${base}`;
if (!base.endsWith('/')) base = `${base}/`;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist', 'sandbox-web', 'browser');

const build = spawnSync('npx', ['ng', 'build', '--configuration', 'pages', '--base-href', base], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (build.status !== 0) process.exit(build.status ?? 1);

const index = join(out, 'index.html');
const snapshot = async (name) => JSON.parse(await readFile(join(root, 'static-api', `${name}.json`), 'utf8'));
const routes = [
  'programs',
  'about',
  'data-model',
  ...(await snapshot('monitoring-programs')).map((p) => `programs/${p.MonitoringProgramID}`),
  ...(await snapshot('categories')).map((c) => `category/${c.Folder}`),
];
for (const route of routes) {
  await mkdir(join(out, route), { recursive: true });
  await copyFile(index, join(out, route, 'index.html'));
}
await copyFile(index, join(out, '404.html'));
// Serve files and folders that start with an underscore as they are.
await writeFile(join(out, '.nojekyll'), '');
console.log(`Pages build in dist/sandbox-web/browser, base ${base}, ${routes.length} addresses.`);
