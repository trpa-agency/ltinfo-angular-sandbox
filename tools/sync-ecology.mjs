#!/usr/bin/env node
// sync-ecology.mjs: vendor the parts of ESA's Ecology design system that the
// Angular app uses into Sandbox.Web/src/ecology/.
//
// Why vendor: @esa/ecology cannot be npm-installed into a stock Angular CLI
// build. It ships raw TypeScript with .js-extension relative imports, has no
// build output, and declares astro as a hard peer dependency. So the Lit
// elements are bundled once here, and the token CSS is copied as is. The
// outputs are committed, so building the web image needs only Sandbox.Web.
//
// Usage (from the sandbox root):
//   node tools/sync-ecology.mjs [hubDir] [--force] [--theme <file>]
//
//   hubDir    the Ecology checkout. Default: ECOLOGY_DIR, then ../ecology.
//   --force   run even when the hub HEAD is not the commit in ecology.ref.
//   --theme   the LT Info theme CSS to copy. Default: LTINFO_THEME, then
//             ../ltinfo-monitoring-dashboard/src/styles/theme-ltinfo.css.
//             When that file is missing, the vendored copy is kept.
//
// esbuild is the only tool needed. It is looked up next to this script, then
// in NODE_PATH, then in the hub's own node_modules. The hub is only read,
// never written.

import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sandboxRoot = path.resolve(here, '..');
const outDir = path.join(sandboxRoot, 'Sandbox.Web', 'src', 'ecology');

// The Lit elements to register. Each entry is a file in
// packages/ecology/src/components/. Anything those files import (Lit, the
// typography and a11y style strings, the announcer) is bundled with them.
const ELEMENTS = ['esa-select', 'esa-button-toggle', 'esa-text-field'];

// Token and primitive CSS, copied byte for byte. [path in the hub, output name].
const CSS_FILES = [
  ['packages/tokens/dist/tokens.css', 'tokens.css'],
  ['packages/tokens/src/component-tokens.css', 'component-tokens.css'],
  ['packages/tokens/src/typography.css', 'typography.css'],
  ['packages/tokens/src/layouts.css', 'layouts.css'],
  ['packages/tokens/src/focus.css', 'focus.css'],
  ['packages/tokens/src/a11y.css', 'a11y.css'],
];

function fail(message) {
  console.error(`sync-ecology: ${message}`);
  process.exit(1);
}

// ---- arguments -------------------------------------------------------------
const args = process.argv.slice(2);
let force = false;
let hubArg = null;
let themeArg = null;
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--force') force = true;
  else if (arg === '--theme') themeArg = args[(i += 1)];
  else if (arg.startsWith('--')) fail(`unknown option ${arg}`);
  else hubArg = arg;
}

const hubDir = path.resolve(
  sandboxRoot,
  hubArg ?? process.env.ECOLOGY_DIR ?? path.join('..', 'ecology'),
);
const themeSource = path.resolve(
  sandboxRoot,
  themeArg ??
    process.env.LTINFO_THEME ??
    path.join('..', 'ltinfo-monitoring-dashboard', 'src', 'styles', 'theme-ltinfo.css'),
);

if (!existsSync(path.join(hubDir, 'packages', 'ecology', 'src', 'components'))) {
  fail(`no Ecology hub at ${hubDir}. Pass the path as an argument or set ECOLOGY_DIR.`);
}

// ---- pin check -------------------------------------------------------------
// Reads .git directly so the script also runs where git is not installed
// (a node:22-bookworm-slim container, for one).
function readHubHead(dir) {
  let gitDir = path.join(dir, '.git');
  if (!existsSync(gitDir)) return null;
  if (statSync(gitDir).isFile()) {
    // A worktree or submodule: .git is a file that points at the real folder.
    const pointer = readFileSync(gitDir, 'utf8').match(/^gitdir:\s*(.+)$/m);
    if (!pointer) return null;
    gitDir = path.resolve(dir, pointer[1].trim());
  }
  const head = readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
  if (!head.startsWith('ref:')) return head;
  const ref = head.slice(4).trim();
  const looseRef = path.join(gitDir, ref);
  if (existsSync(looseRef)) return readFileSync(looseRef, 'utf8').trim();
  const packed = path.join(gitDir, 'packed-refs');
  if (existsSync(packed)) {
    for (const line of readFileSync(packed, 'utf8').split('\n')) {
      const [sha, name] = line.trim().split(' ');
      if (name === ref) return sha;
    }
  }
  return null;
}

const refFile = path.join(sandboxRoot, 'ecology.ref');
if (!existsSync(refFile)) fail('ecology.ref is missing from the sandbox root.');
const pinned = readFileSync(refFile, 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .find((line) => line && !line.startsWith('#'));
const hubHead = readHubHead(hubDir);

if (hubHead !== pinned) {
  const message =
    `the hub is at ${hubHead ?? 'an unknown commit'}, but ecology.ref pins ${pinned}.`;
  if (!force) {
    fail(
      `${message}\n  Check out the pinned commit in the hub, or update ecology.ref ` +
        'on purpose, or rerun with --force.',
    );
  }
  console.warn(`sync-ecology: ${message} Continuing because of --force.`);
}

// ---- esbuild ---------------------------------------------------------------
function loadEsbuild() {
  const searchPaths = [
    here,
    ...(process.env.NODE_PATH ?? '').split(path.delimiter).filter(Boolean),
    hubDir,
  ];
  for (const base of searchPaths) {
    try {
      const require = createRequire(path.join(base, 'noop.js'));
      return require('esbuild');
    } catch {
      // Try the next location. A hub installed on Windows carries a Windows
      // esbuild binary, which fails to load inside a Linux container.
    }
  }
  return fail(
    'esbuild was not found. Install it somewhere and point NODE_PATH at it, ' +
      'for example: npm install --prefix /opt/esbuild esbuild',
  );
}
const esbuild = loadEsbuild();

// ---- CSS -------------------------------------------------------------------
const cssOut = path.join(outDir, 'css');
mkdirSync(cssOut, { recursive: true });
const written = [];

function record(file) {
  written.push({
    name: path.relative(outDir, file).split(path.sep).join('/'),
    bytes: statSync(file).size,
  });
}

for (const [from, name] of CSS_FILES) {
  const source = path.join(hubDir, from);
  if (!existsSync(source)) {
    fail(`${from} is missing from the hub. Run "npm run build:tokens" in the hub once.`);
  }
  const target = path.join(cssOut, name);
  writeFileSync(target, readFileSync(source));
  record(target);
}

const themeTarget = path.join(cssOut, 'theme-ltinfo.css');
let themeNote = '';
if (existsSync(themeSource)) {
  writeFileSync(themeTarget, readFileSync(themeSource));
  themeNote = 'copied from the ltinfo-monitoring-dashboard repo (src/styles/theme-ltinfo.css)';
} else if (existsSync(themeTarget)) {
  themeNote = 'source not found, existing vendored copy kept';
  console.warn(`sync-ecology: ${themeSource} not found. Keeping the vendored theme-ltinfo.css.`);
} else {
  fail(`theme-ltinfo.css not found at ${themeSource} and no vendored copy exists. Use --theme.`);
}
record(themeTarget);

// ---- Lit elements ----------------------------------------------------------
const componentsDir = path.join(hubDir, 'packages', 'ecology', 'src', 'components');
for (const tag of ELEMENTS) {
  if (!existsSync(path.join(componentsDir, `${tag}.ts`))) {
    fail(`${tag}.ts is not in the hub. It may be an .astro-only component, which has no element.`);
  }
}

const litVersion = JSON.parse(
  readFileSync(path.join(hubDir, 'node_modules', 'lit', 'package.json'), 'utf8'),
).version;
const today = new Date().toISOString().slice(0, 10);
const bundleFile = path.join(outDir, 'ecology-elements.js');

const result = await esbuild.build({
  stdin: {
    contents: ELEMENTS.map(
      (tag) => `import './packages/ecology/src/components/${tag}.ts';`,
    ).join('\n'),
    resolveDir: hubDir,
    sourcefile: 'ecology-elements.entry.js',
    loader: 'js',
  },
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: false,
  legalComments: 'inline',
  charset: 'utf8',
  outfile: bundleFile,
  // The hub has no tsconfig. State the two settings the output depends on.
  tsconfigRaw: { compilerOptions: { target: 'ES2022', useDefineForClassFields: true } },
  // The workspace links under node_modules/@esa are Windows junctions, which
  // do not resolve inside a container. Point at the real files instead.
  alias: {
    '@esa/tokens/typography-styles.js': path.join(
      hubDir,
      'packages/tokens/dist/typography-styles.js',
    ),
    '@esa/tokens/a11y-styles.js': path.join(hubDir, 'packages/tokens/dist/a11y-styles.js'),
  },
  banner: {
    js: [
      '// GENERATED by tools/sync-ecology.mjs. Do not edit; rerun the script.',
      `// ESA Ecology Lit elements, bundled from hub commit ${hubHead ?? 'unknown'}.`,
      `// Registers: ${ELEMENTS.join(', ')}. Includes Lit ${litVersion}.`,
      '// Import this file once for its side effect; each element registers itself.',
    ].join('\n'),
  },
  logLevel: 'warning',
});
if (result.errors.length > 0) fail('esbuild reported errors.');
record(bundleFile);

// Report the tags the bundle really defines, read back from the output.
const bundleText = readFileSync(bundleFile, 'utf8');
const definePattern = /customElements\.define\(\s*["']([a-z0-9-]+)["']/g;
const registered = [
  ...new Set([...bundleText.matchAll(definePattern)].map((match) => match[1])),
].sort();
const missing = ELEMENTS.filter((tag) => !registered.includes(tag));
if (missing.length > 0) fail(`the bundle does not register: ${missing.join(', ')}`);

// ---- VERSION.txt -----------------------------------------------------------
const fileLine = (file) => `  ${file.name.padEnd(28)} ${String(file.bytes).padStart(8)} bytes`;
const versionFile = path.join(outDir, 'VERSION.txt');
const lines = [
  'Ecology, vendored for Sandbox.Web',
  '',
  `Hub commit:     ${hubHead ?? 'unknown'}`,
  `Pinned commit:  ${pinned}${hubHead === pinned ? '' : '  (MISMATCH, synced with --force)'}`,
  `Synced on:      ${today} (UTC)`,
  `Lit:            ${litVersion}`,
  `esbuild:        ${esbuild.version}`,
  `Theme:          ${themeNote}`,
  '',
  'Elements registered by ecology-elements.js:',
  ...registered.map((tag) => `  ${tag}`),
  '',
  'Files:',
  ...written.map(fileLine),
  '',
  'Regenerate from the sandbox root with: node tools/sync-ecology.mjs',
  '',
];
writeFileSync(versionFile, lines.join('\n'));

const outLabel = path.relative(sandboxRoot, outDir).split(path.sep).join('/');
console.log(`sync-ecology: hub ${hubHead ?? 'unknown'} -> ${outLabel}`);
for (const file of written) console.log(fileLine(file));
console.log(`  elements: ${registered.join(', ')}`);
