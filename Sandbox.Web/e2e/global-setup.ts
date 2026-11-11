// Runs once before the first test. Waits until the API, the web app, and the
// /api proxy of the web app all answer, so a suite started alongside the stack
// (docker compose --profile test up) does not fail while a container is still
// starting. It checks that the services are up, not what they return; the
// specs do that.
import { request } from '@playwright/test';

import { API_URL, BASE_URL } from './support';

const WAIT_MS = Number(process.env.WAIT_FOR_STACK_MS ?? 90_000);
const PAUSE_MS = 2_000;

class BlockedHostError extends Error {
  constructor(url: string) {
    const host = new URL(url).hostname;
    super(
      `The Angular dev server refused ${url}: the host "${host}" is not in its allowed hosts. ` +
        `Add "allowedHosts": ["${host}"] to the serve options in angular.json, or reach the ` +
        'dev server as localhost by sharing its network (docker run --network container:<web container>, ' +
        'or network_mode: "service:sandbox.web" in compose) with BASE_URL=http://localhost:4200.',
    );
  }
}

export default async function globalSetup(): Promise<void> {
  const targets = [`${API_URL}/health`, `${BASE_URL}/`, `${BASE_URL}/api/health`];
  const context = await request.newContext();
  const deadline = Date.now() + WAIT_MS;
  let waiting: string[] = [];

  try {
    for (;;) {
      waiting = [];
      for (const url of targets) {
        try {
          const response = await context.get(url, { timeout: 5_000 });
          if (response.status() === 403 && (await response.text()).includes('Blocked request')) {
            // Not a slow start, so do not wait: the Angular dev server refuses
            // any Host name it was not told about, and it will keep refusing.
            throw new BlockedHostError(url);
          }
          if (!response.ok()) waiting.push(`${url} (HTTP ${response.status()})`);
        } catch (error) {
          if (error instanceof BlockedHostError) throw error;
          waiting.push(`${url} (no answer)`);
        }
      }
      if (waiting.length === 0) return;
      if (Date.now() + PAUSE_MS > deadline) break;
      await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    }
  } finally {
    await context.dispose();
  }

  throw new Error(
    `The stack did not answer within ${WAIT_MS / 1000} seconds: ${waiting.join(', ')}. ` +
      'Check BASE_URL and API_URL, and that the test container is on the compose network.',
  );
}
