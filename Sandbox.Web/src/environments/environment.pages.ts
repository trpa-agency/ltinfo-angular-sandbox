/**
 * The GitHub Pages build: no API and no database, so the app reads the JSON snapshot
 * that scripts/export-static-api.mjs wrote to static-api/ and the build serves as api/.
 */
export const environment = {
  staticApi: true,
};
