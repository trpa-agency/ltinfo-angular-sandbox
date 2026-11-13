// Snapshots the sandbox API to JSON for the GitHub Pages build.
//
// GitHub Pages serves files only: no Sandbox.API, no SQL Server. This script reads every
// GET route the app calls from the running stack and writes one file per route to
// static-api/, which the pages build serves as api/. Run it after a reseed, then commit
// static-api/ so the Pages workflow can build without a database.
//
//   node scripts/export-static-api.mjs [api base, default http://127.0.0.1:8080/api]

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = (process.argv[2] ?? 'http://127.0.0.1:8080/api').replace(/\/$/, '');
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'static-api');
const MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

async function get(route) {
  const response = await fetch(`${API}/${route}`);
  if (!response.ok) throw new Error(`${API}/${route} returned ${response.status}`);
  return response.json();
}

async function save(route, body) {
  const file = join(OUT, `${route}.json`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(body, null, 1) + '\n');
}

const health = await get('health');
const now = new Date();
health.SnapshotDate = `${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

const programs = await get('monitoring-programs');
await rm(OUT, { recursive: true, force: true });
await save('health', health);
for (const route of ['summary', 'categories', 'monitoring-sites']) await save(route, await get(route));
await save('monitoring-programs', programs);
for (const { MonitoringProgramID: id } of programs) {
  await save(`monitoring-programs/${id}`, await get(`monitoring-programs/${id}`));
}
console.log(`Wrote ${programs.length + 5} files to static-api/ from ${API}, ${health.Database}.`);
