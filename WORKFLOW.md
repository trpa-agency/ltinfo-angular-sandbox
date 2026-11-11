# LT Info Angular sandbox

A practice copy of how ESA's apps are put together, small enough to read in one sitting. Use it to rehearse the edit, test, deploy, branch, and commit loop before working in ESA's repo. Nothing here is production code.

## What is in the box

| Folder | What it is |
|---|---|
| `Sandbox.Web` | Angular 21 app styled with Ecology, plus its browser tests in `e2e/` |
| `Sandbox.API` | .NET 10 API, the same JSON shape as the real LT Info API |
| `Sandbox.Database` | table scripts and seed data (36 real programs, 43 partners) |
| `Sandbox.Tests` | the container that runs the tests |
| `Build` | PowerShell scripts: database, one-time SQL Server setup, deploy |
| `docker-compose` | the files that start the containers |

The database is the **SQL Server installed on this machine** (database `LTInfoSandbox`), not a container. Angular and the API run in containers and reach it as `host.docker.internal`. This is the arrangement ESA's repos use, and the folder names copy their public apps (`esassoc/wadnrforesthealth`, `esassoc/neptune`).

## One-time setup on a new machine

1. Install Docker Desktop and SQL Server 2025 Developer (default instance, Windows login).
2. `copy docker-compose\.env.template docker-compose\.env` and choose a `SQL_PASSWORD`.
3. `powershell -File Build\Enable-SqlServerForDocker.ps1` turns on TCP/IP and mixed-mode login so containers can connect. It asks for administrator approval. ESA's setup needs the same two settings.

## Deploy and test, one command

```powershell
powershell -File Build\Deploy.ps1
```

It builds the database, builds the release images, starts the site, waits until it is healthy, and runs the 26 automated tests against it. About a minute. The site is then at http://localhost:8080 and stays up, restarting with Docker.

The deploy puts the seed rows back first so the tests start from known data. Add `-KeepData` to leave your rows alone and skip the tests.

## Develop

```bash
cd docker-compose
docker compose up --build          # Angular http://localhost:4200, API http://localhost:3211/health
docker compose run --rm sandbox.e2e   # the same tests, against the dev stack
docker compose down
```

- **Angular:** edit anything in `Sandbox.Web/src`. The page reloads in a few seconds.
- **API:** edit a `.cs` file in `Sandbox.API`. The API restarts itself.
- **Database:** edit the scripts, then `powershell -File Build\DatabaseBuild.ps1 -Reset`. Look at the tables in SSMS: server `localhost`, Windows Authentication.
- **Packages:** after changing `package.json` or the `.csproj`, run `docker compose build`.
- **Tests:** specs are in `Sandbox.Web/e2e`. The report is `Sandbox.Tests/results/html-report/index.html`.

The dev stack and the deployed site can run at the same time. They share the one database.

## The git loop to rehearse

```bash
git switch -c my-change      # branch
# edit, look at localhost:4200, run the tests
git add -A
git commit -m "Describe the change"
git switch main && git merge my-change
```

In ESA's repo the last step becomes `git push` and a pull request.

## How Ecology gets into Angular

Ecology cannot be installed from npm into an Angular build yet, so the sandbox shows the three ways it is used:

1. **Tokens and theme (plain CSS).** `Sandbox.Web/src/ecology/css`, loaded in `styles.scss`, with the LT Info theme switched on by `data-theme="ltinfo"` in `index.html`.
2. **Real Ecology elements (search box, select, toggle).** Pre-bundled into `src/ecology/ecology-elements.js` and used in `program-filters`. Read values from `$event.detail`, and pass lists with `[options]`.
3. **Angular versions of the rest (card, stat, badge, button, empty state).** `src/app/ecology`, rebuilt to match Ecology's markup and tokens. Writing `<esa-badge>` without one of these renders nothing.

`tools/sync-ecology.mjs` refreshes items 1 and 2 from the Ecology repo at the commit in `ecology.ref`.

## What will differ in ESA's repo

- The database is restored from a backup by their `Build\DatabaseRestore.ps1`, then updated by `Build\DatabaseBuild.ps1`, instead of being seeded from a script.
- Angular usually runs on your machine with `npm start`, not in a container.
- The API's connection string lives in a gitignored `appsecrets.json`, not in `.env`. Ask a teammate for a copy.
- There is login (Auth0), an Angular client generated from the API's contract, GeoServer, and far more code.
- Real deployment goes through Azure pipelines to their servers. `Deploy.ps1` here only stands a release build up on this machine.

## Check on the first day

- Does their Angular app already have its own Ecology components, or raw SCSS?
- Does `proxy.conf` point at `localhost`? On this machine Node needs `127.0.0.1`.
- Which branch do they want work based on, and do they want pull requests or pushes?
