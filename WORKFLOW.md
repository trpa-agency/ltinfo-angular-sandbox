# LT Info Angular sandbox

A practice copy of how ESA's apps are put together, small enough to read in one sitting. Use it to rehearse the edit, branch, and commit loop before working in ESA's repo. Nothing here is production code.

## What is in the box

| Folder | What it is | Runs as |
|---|---|---|
| `Sandbox.Web` | Angular 21 app styled with Ecology | container, http://localhost:4200 |
| `Sandbox.API` | .NET 10 API, the same JSON shape as the real LT Info API | container, http://localhost:3211/health |
| `Sandbox.Database` | table scripts and seed data (36 real programs, 43 partners) | SQL Server container, `localhost,14330` |
| `docker-compose` | the files that start all three | |

The folder names and the compose split copy ESA's public apps (`esassoc/wadnrforesthealth`, `esassoc/neptune`).

## Start and stop

```bash
cd docker-compose
cp .env.template .env        # first time only: set ACCEPT_EULA=Y and a password
docker compose up --build    # first run takes a few minutes
docker compose down          # stop; add -v to also erase the database
```

Open http://localhost:4200. The footer says whether Angular, the API, and SQL Server are connected. To look at the tables, connect SSMS to `localhost,14330` as `sa` with the password in `.env`.

## The edit loop

- **Angular:** edit anything in `Sandbox.Web/src`. The page reloads in a few seconds.
- **API:** edit a `.cs` file in `Sandbox.API`. The API restarts itself.
- **Database:** edit the scripts, then `docker compose down -v` and `up` to rebuild from scratch.
- **Packages:** after changing `package.json` or the `.csproj`, run `docker compose build`.

## The git loop to rehearse

```bash
git switch -c my-change      # branch
# edit, look at localhost:4200
git add -A
git commit -m "Describe the change"
git switch main              # back to a clean copy
```

In ESA's repo the last steps become `git push` and a pull request.

## How Ecology gets into Angular

Ecology cannot be installed from npm into an Angular build yet, so the sandbox shows the three ways it is used:

1. **Tokens and theme (plain CSS).** `Sandbox.Web/src/ecology/css`, loaded in `styles.scss`, with the LT Info theme switched on by `data-theme="ltinfo"` in `index.html`.
2. **Real Ecology elements (search box, select, toggle).** Pre-bundled into `src/ecology/ecology-elements.js` and used in `program-filters`. Read values from `$event.detail`, and pass lists with `[options]`.
3. **Angular versions of the rest (card, stat, badge, button, empty state).** `src/app/ecology`, rebuilt to match Ecology's markup and tokens. Writing `<esa-badge>` without one of these renders nothing.

`tools/sync-ecology.mjs` refreshes items 1 and 2 from the Ecology repo at the commit in `ecology.ref`.

## What will differ in ESA's repo

- The database is restored from a backup into SQL Server by their `Build/*.ps1` scripts, not seeded by a container.
- Angular usually runs on your machine with `npm start`, not in a container.
- There is login (Auth0), a generated API client, GeoServer, and far more code.

## Check on the first day

- Does their Angular app already have its own Ecology components, or raw SCSS?
- Does `proxy.conf` point at `localhost`? On this machine Node needs `127.0.0.1`.
- Which branch do they want work based on, and do they want pull requests or pushes?
