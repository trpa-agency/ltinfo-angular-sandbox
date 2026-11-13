/**
 * The Docker and dev builds: every call goes to the live API at /api/.
 * The pages build swaps this file for environment.pages.ts (angular.json fileReplacements).
 */
export const environment = {
  /** True when the app reads the JSON snapshot in api/ instead of calling Sandbox.API. */
  staticApi: false,
};
