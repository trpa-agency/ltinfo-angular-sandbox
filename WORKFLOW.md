# LT Info Angular sandbox

A practice copy of how ESA's apps are put together, small enough to read in one sitting. Use it to rehearse the edit, test, deploy, branch, and commit loop before working in ESA's repo. Nothing here is production code.

## What is in the box

| Folder | What it is |
|---|---|
| `Sandbox.Web` | Angular 21 app styled with Ecology, plus its browser tests in `e2e/` |
| `Sandbox.API` | .NET 10 API, the same JSON shape as the real LT Info API |
| `Sandbox.Database` | table scripts and seed data (113 real programs and indicators, 61 partners) |
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

It builds the database, builds the release images, starts the site, waits until it is healthy, and runs the 151 automated tests against it. About six minutes. The site is then at http://localhost:8080 and stays up, restarting with Docker.

The deploy puts the seed rows back first so the tests start from known data. Add `-KeepData` to leave your rows alone and skip the tests.

## Page templates

Every program page uses one of three layouts, stored per program in the database (`Template`):

| Layout | Leads with | Example |
|---|---|---|
| Map | a tall Leaflet map with the site list beside it | http://localhost:4200/programs/39 |
| Charts | the Vega-Lite measurement charts | http://localhost:4200/programs/41 |
| Content | the program story and photos | http://localhost:4200/programs/82 |

All three share the header and show the program's photos. The header is the name, the summary tiles, and the key photo: the tiles lead with the first measure's latest value, its standard, and a small trend line (when that measure is one record over time), then the site count and the record span. A program with no photo gives the text the full width. A breadcrumb above the header leads back to the category and the home page. Add `?template=map`, `charts`, or `context` to a program address to preview another layout; the Page layout control saves it.

The charts and maps read live data from the TRPA LTInfo_Monitoring map service. What each program charts and maps is its `DashboardConfig` in the database, with the keys documented in the dashboard repo's `templates/README.md`. Two keys exist only here: `service` on a chart, map layer, sites layer, sites-per-year chart, or overlay reads that layer from another ArcGIS map service (LTInfo_Monitoring when omitted), and `csv` on a chart reads a CSV file instead of a layer, charting its rows as they are (no `where` or `stat`); `json` does the same for a JSON file of rows. `tools/extract-static-charts.py` writes the 2023 Threshold Evaluation charts (static Plotly pages and a few images) as JSON to `Sandbox.Web/public/data/threshold-evaluation/`, and `sourceHref` and `sourceLabel` credit the source under each chart. `xOrder`, `seriesOrder`, and `seriesColors` set the order of classes and fixed colors per series. `mirror` names the series a horizontal stacked chart draws to the left of zero, for a population pyramid. A map layer's `breaks` (each a `max`, `label`, and `color`) draws a numeric `colorBy` field as a choropleth, and `dotDensity` (`dotValue` and a color per count field) draws each polygon as seeded random dots, one per `dotValue`, as on the Demographics race map. A map layer's `url` draws a GeoJSON file instead of a service layer, with `sourceHref` and `sourceLabel` crediting the service it came from. `tools/build-fire-forest-data.py` writes the two that need geometry work first, to `Sandbox.Web/public/data/fire-history/` and `large-trees/`: CAL FIRE perimeters clipped to the TRPA boundary, with acres burned inside it by year, and the 84,373 large trees counted in 100-acre hexagons. It needs geopandas, so run it with the `arcgispro-py3-clone` environment.

Visitors see no staff controls. Add `?staff=1` to any address for staff mode (remembered in that browser; `?staff=0` turns it off): it shows the Page layout control, Program Settings, the Layout column and filter in All Programs, and the connection line in the footer. It hides controls rather than securing them; in LT Info they sit behind the admin role. The tests run in staff mode except `e2e/visitor.spec.ts`.

`Sandbox.Web/src/styles/_access.scss` re-points two of Ecology's roles for accessibility: links use grass 11 (4.9:1 on white, where the default brand green is 3.0:1), and text roles never fall below 16 px for prose and 13 px for small text on narrow screens. Both are worth raising with ESA, since the design system is theirs.

Data colors come from `Sandbox.Web/src/styles/_palettes.scss`: Phosphor palettes (Turbid sequential, Chlorophyll and Frostfire diverging, Stevens 4 and Stevens 9 qualitative, Gold-Purple bivariate, and Greens for seral stage) as `--mon-*` tokens, with Ecology's dataviz roles re-pointed to them. Configs name the tokens, for example `var(--mon-greens-3)`. Charts with four series or fewer use Stevens 4. Land capability, fire severity, Caldor burn severity, and the WUI zones copy the map service's own symbology. To regenerate the seed from that repo and LT Info, run `python Sandbox.Database/Scripts/make-seed.py`, then `Build\DatabaseBuild.ps1 -Reseed`.

The categories differ from the dashboard repo's on purpose: `Sandbox.Database/Scripts/extra-categories.json` removes Vegetation Preservation, Fisheries, and Wildlife, and adds Forest Structure, Fire Dynamics, Biodiversity, Demographics, Climate and Lake Conditions, Housing and Economy, and Aquatic Invasive Species. Demographics follows the Tahoe Open Data demographics page and reads the TRPA Demographics map service. `drop` leaves programs out by id: Socio-Economic (68) is left out, since Demographics covers it. Their pages are the old categories' programs, the LT Info programs that cover the same threshold indicators, pages built from Threshold Dashboard records for indicators with no program (ids 9600 plus the threshold indicator id), and the four forest health standards written from the Forest Health Threshold Standards Update story maps. Forest Structure leads with four indicators (seral stage and canopy cover, stand density, large trees, and tree mortality) and Fire Dynamics has three (annual burn probability, likely fire severity, and area burned). Annual burn probability shows its empty state until Vibrant Planet's assessment is published. Climate and Lake Conditions and Housing and Economy read the TRPA LTinfo_Climate_Resilience_Dashboard map service, plus the Climate Resilience Dashboard charts no table publishes (lake level, lake temperature, the air quality index, and snow and rain shares), extracted by `tools/extract-static-charts.py`. Housing and Income moved there from Demographics. Aquatic Invasive Species takes its four programs from Water Quality and adds two threshold standards.

Two pages show the two ways data that is not TRPA's own, or not yet published, gets in. SMART Traffic Cameras (Transportation) reads the Transportation_SMART feature service: Tahoe Transportation District cameras, read by Derq's software and loaded to maps.trpa.org by the SMART_Phase1 script in TRPA's Transportation repository. Its 15 cameras are seeded as mapped sites from the service's camera layer, which `make-seed.py` does for any page written in `extra-categories.json` that has a `sitesLayer`. Affordable and Workforce Housing (Housing and Economy) charts TRPA Long Range Planning's parcel inventory, a spreadsheet no service publishes: `python -I tools/extract-housing-inventory.py` reads the copy behind the Housing Progress page and writes three files to `Sandbox.Web/public/data/housing/`, printing the checks it ran on the source. Rerun it when the inventory changes.

Two more pages read raw monitoring records that sat on maps.trpa.org with no page. Calcium and eDNA Sampling (Aquatic Invasive Species) maps the 77 calcium sites from the Calcium_Sites service, draws the 2024 eDNA samples over them, and charts the Calcium_Survey and eDNA_Samples services. Visitation and Lodging (Housing and Economy, beside Transient Occupancy Tax) charts the lodging reports TRPA compiles in the Occupancy Rates table of the Transportation_Planning service and the Sand Harbor visitor counts in the Demographics service.

Two Transportation pages read tables published with the Climate Resilience Dashboard's that the server cannot shape for a chart. Transit Ridership reads table 131 of the LTinfo_Climate_Resilience_Dashboard service: a row a month, a column a service, and the month as text ("Jul-17"). Travel Mode Share reads table 136: counts from three sources (TRPA travel surveys, Replica, and LOCUS), charted apart and as shares. Five measure settings do the shaping in the browser, in `shapeRows` in `lib/measures.ts`: a date axis reads a month and a year in words as the first of that month, and `dateStep: "month"` labels it "July 2017"; `dateParts` names a date field and adds `<field>_year` and `<field>_month` to each row, to chart by year or by month of the year; `combine: "sum"` adds up the rows that share x, series, and pick, where `stat` cannot because the server cannot group by a derived year; `share: true` charts each count as its share of the total at its x and pick, and keeps the count in the table under `yName`; and `xWith` joins a second field to x, so Year and Season make "2021 Fall". `format: ".1%"` keeps a decimal for shares under one percent. They are tested in `e2e/measure-shape.spec.ts`, which runs in Node.

A chart on a date axis marks an obvious hole in its record with a gray block that says No Data, and a line stops at the hole instead of running across it. A hole counts when it is at least four times the usual step between values and at least four percent of the axis: two months missing from a daily record, not a five-day outage. A bar chart has no empty axis to shade, so it gets one placeholder band for the gap. `gaps: true` on a measure turns this on for a year axis, where it is off because years are often sparse by design (a census, a survey every five years), and `gaps: false` turns it off. The rule and what is drawn are in `chartGaps` and `vegaLiteSpec` in `lib/vega-spec.ts`, tested in `e2e/chart-gaps.spec.ts`, which runs in Node with no browser; the test image copies `src/app/lib` for it.

Every program page lists its pages on the other LT Info dashboards (Threshold Dashboard, Climate Resilience Dashboard, Lake Clarity Tracker, and Transportation Tracker) in an On Other Dashboards card. `make-seed.py` builds them from the LT Info indicators each program reports, using each indicator's dashboard flags, and stores them in the program's `RelatedLinks` column. `relatedIndicators` on an entry in `extra-categories.json`, or `related` (program id to LT Info indicator ids), adds indicators LT Info does not link the program to. The other direction, the links those dashboards should carry back to monitoring pages, is written to `Sandbox.Database/Scripts/cross-links.csv` for ESA.

Test pages for the two building blocks: http://localhost:4200/dev/charts (every chart shape) and http://localhost:4200/dev/map (sites, areas with a year pick, a layer with no list).

## Look and feel

The app uses Ecology's default theme (DM Sans, neutral white surfaces) with no `data-theme` set; `data-theme="ltinfo"` in `index.html` switches to the LT Info theme. Category colors from the Threshold Dashboard are not used: containers stay neutral and one data color carries the sites. Every map opens on light gray terrain (`Sandbox.Web/src/app/dashboard/basemaps.ts`).

## Site profiles

Clicking a site on a program map, or its row in the list, opens its profile in the list column: the site's record chart against the median of all sites and any standard, its facts, rank, and program-specific detail (SEZ indicators, invasive plant status by year, LTIMP samples). What each program shows is set in `Sandbox.Database/Scripts/site-profiles.json`; rerun `make-seed.py`, then `Build\DatabaseBuild.ps1 -Reseed`. A site's record and its attached photos are read from the map service its own layer is in, unless the settings name another with `service`. The SMART cameras use this for the aerial view attached to each camera.

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

## Data Model page

`/data-model` (linked from About Monitoring) has three parts:

1. **Tables.** The six tables and how they join, drawn from the list in `pages/data-model/schema-diagram.ts`. Update that list when a table script in `Sandbox.Database/dbo/Tables` changes.
2. **Ingestion Paths and Acceptance Criteria.** The five ways data reaches the dashboard: a TRPA web service, partner data through a TRPA pipeline, a partner's own web service, data entered in LT Info, and an extracted file. Each lists what the app checks and what a person confirms. The wording lives in `lib/ingest.ts` (`INGEST_PATHS`) and is a draft to edit.
3. **Chart and Map Sources.** Every chart, map, site list, overlay, and site profile traced to its service layer or file, from `GET /dashboard-configs`. Nothing is typed by hand, so it follows the settings. Run Checks tests the source on screen: the layer exists and has a description, each field exists, the filter returns records, and a file cites its original source.

A URL cannot tell TRPA data from partner data hosted at TRPA. List partner services in `PARTNER_PIPELINES` in `lib/ingest.ts`, each with the partner, where the data is pulled from, and the TRPA script that loads it, to move their layers to the pipeline path. The SMART traffic camera service is the first; every other maps.trpa.org layer shows as a TRPA web service.

## Redesign Plan page

`/project-plan` (linked from About Monitoring) is the working plan for the Monitoring Dashboard redesign under ESA Work Order 004: the proposed revisions, status by workstream, vision, roles, the four workstreams and how they feed each other, the timeline and milestones, the meeting cadence, the action items, and the data stewards.

The page holds no wording of its own. Everything is in `lib/project-plan.ts`, so updating the plan is editing that file:

- **A status update:** add an entry at the top of a workstream's `log`, and change its `health` and `next` if they moved.
- **An action item:** change its `status` (`done`, `scheduled`, or `todo`) in `ACTION_GROUPS`. The Action Items Done tile counts them.
- **A milestone date:** change `date` in `MILESTONES`. The timeline marker, the workstream cards, the workflow steps, and the milestones table all follow, and the timeline moves a label to another lane if it would collide with a neighbor.
- **A steward:** add a name to the category's list in `STEWARDS`. An empty list reads "Steward to assign".

Specific dates are ISO (`2027-01-14`) and the page writes them in TRPA style (Jan. 14, 2027) through `lib/plan-dates.ts`, which also places the timeline markers. A target that is not one date ("December", "This week") is typed as it should read. Keep to the TRPA writing rules when editing: no dashes between dates (write "April 1 to 20"), Oxford commas, and percent spelled out. `e2e/project-plan.spec.ts` checks the dates, the milestone order, and those wording rules in Node, then the page in the browser.

The plan names staff and carries working notes, and the Pages copy of this site is public. Read `lib/project-plan.ts` with that in mind before pushing a change to `main`.

## A read-only copy on GitHub Pages

GitHub Pages serves files only, so the Pages copy has no API and no database. The app reads a JSON snapshot instead, and the two save buttons (Featured and Save layout) say the copy is read-only. Charts and maps that read TRPA map services still query them live.

1. With the stack running, take the snapshot: `node Sandbox.Web/scripts/export-static-api.mjs`. It writes one file per API route to `Sandbox.Web/static-api/`, including the settings behind the Data Model page. Commit that folder; the Pages build cannot reach the database.
2. Build: `docker build --target pages-out --build-arg BASE_HREF=/<repo>/ --output dist/pages .` from `Sandbox.Web`. The base path is the repository name, because a project site lives at `https://<owner>.github.io/<repo>/`.
3. Check it: `node Sandbox.Web/scripts/serve-pages.mjs`, then open http://127.0.0.1:4340/ltinfo-angular-sandbox/. It serves files the way Pages does, with no rewrites.
4. Publish: push to a GitHub repository with Settings > Pages > Source set to GitHub Actions. `.github/workflows/pages.yml` builds and deploys on every push to `main`.

How it fits together: `angular.json` has a `pages` configuration that swaps `src/environments/environment.ts` for `environment.pages.ts` (which sets `staticApi`) and serves `static-api/` as `api/`. `SandboxApiService` then asks for `api/<route>.json` relative to the base path instead of `/api/<route>`. Pages has no SPA fallback, so `scripts/build-pages.mjs` writes a copy of `index.html` at every program and category address, plus `404.html` for anything else.

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
