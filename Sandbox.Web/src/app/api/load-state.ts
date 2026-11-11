import { HttpErrorResponse } from '@angular/common/http';

// What a page shows while it waits for the API, and what it shows when the API
// does not answer. Each page keeps one of these in a signal.
export type LoadState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; title: string; description: string };

export function ready<T>(data: T): LoadState<T> {
  return { status: 'ready', data };
}

/**
 * Turns a failed request into the two lines an empty state needs: what is
 * wrong, stated as a fact, and the one thing the reader can do about it.
 */
export function describeError(error: unknown): { title: string; description: string } {
  const status = error instanceof HttpErrorResponse ? error.status : 0;
  if (status === 404) {
    return {
      title: 'Not found',
      description: 'Go back to the list and pick a program.',
    };
  }
  if (status >= 400 && status < 500) {
    return {
      title: `The API refused the request (HTTP ${status})`,
      description: 'Check the request in the browser network tab.',
    };
  }
  // Status 0 is no answer at all. A 5xx here is usually the proxy saying that
  // Sandbox.API is not running, so both read the same way to the user.
  return {
    title: 'The API did not respond',
    description: 'Start the sandbox.api container, then try again.',
  };
}

export function failed<T>(error: unknown): LoadState<T> {
  return { status: 'error', ...describeError(error) };
}
