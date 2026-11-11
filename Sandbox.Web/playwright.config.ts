// Playwright end-to-end tests for the sandbox: the API contract and the Angular app.
//
// The suite runs in a container (see Sandbox.Tests/Dockerfile) and takes its
// targets from two environment variables:
//
//   BASE_URL  the web app   default http://sandbox.web:4200  (the dev server)
//   API_URL   the API       default http://sandbox.api:8080
//
// The same specs run against the production nginx build with
// BASE_URL=http://sandbox.web. Nothing here depends on the dev server.
import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://sandbox.web:4200';

// Everything a run writes lands in Sandbox.Tests/results, which is gitignored:
// artifacts/ (traces and screenshots of failed tests) and html-report/. The two
// subfolders matter, because Playwright empties its output folders at the start
// of a run and cannot remove a folder that is itself a bind mount. In the
// container, Sandbox.Tests/run-e2e.sh sets RESULTS_DIR to a folder on the
// container's own disk and copies it to Sandbox.Tests/results at the end.
const resultsDir = path.resolve(__dirname, process.env.RESULTS_DIR ?? '../Sandbox.Tests/results');

export default defineConfig({
  testDir: './e2e',
  outputDir: path.join(resultsDir, 'artifacts'),
  globalSetup: './e2e/global-setup.ts',

  // One worker, in file order: api.spec.ts, then app.spec.ts. Two tests change
  // a row in SQL Server and others count featured programs, so nothing runs in
  // parallel. No retries: a test that needs a second try is a failing test.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,

  timeout: 30_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['line'],
    ['html', { outputFolder: path.join(resultsDir, 'html-report'), open: 'never' }],
  ],

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
