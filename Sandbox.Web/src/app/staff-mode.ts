import { Injectable, signal } from '@angular/core';

/** The browser storage key that remembers staff mode between visits. */
export const STAFF_MODE_KEY = 'mon-staff';

/**
 * Staff mode shows the controls that write to the database or describe the stack: the page
 * layout control, Program Settings, the layout column and filter in the list, and the
 * connection line in the footer. A visitor never sees them.
 *
 * Turn it on with ?staff=1 on any address and off with ?staff=0; the choice is remembered in
 * this browser. It hides controls, it does not secure them: in LT Info the same controls sit
 * behind the admin role.
 */
@Injectable({ providedIn: 'root' })
export class StaffMode {
  readonly on = signal(StaffMode.initial());

  private static initial(): boolean {
    try {
      const flag = new URLSearchParams(globalThis.location?.search ?? '').get('staff');
      if (flag === '1') globalThis.localStorage?.setItem(STAFF_MODE_KEY, '1');
      if (flag === '0') globalThis.localStorage?.removeItem(STAFF_MODE_KEY);
      return globalThis.localStorage?.getItem(STAFF_MODE_KEY) === '1';
    } catch {
      return false;
    }
  }
}
