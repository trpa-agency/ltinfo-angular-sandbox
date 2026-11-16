#!/usr/bin/env bash
# Refreshes the LT Info snapshot the Data Model page reads (Sandbox.Web/public/data/ltinfo/).
#
# Needs the LT Info devcontainer (esassoc/ltinfo) with the database restored and the API running
# (make api-run). The two routes are anonymous. planned-sources.json is copied from the LT Info
# checkout, where tools/gen-monitoring-new-planned-sources.mjs writes it. Update takenOn in
# snapshot.json by hand to the date of the restored database.
#
#   bash tools/snapshot-ltinfo-data-model.sh ../ltinfo
set -euo pipefail
LTINFO="${1:?path to the ltinfo checkout}"
OUT="$(dirname "$0")/../Sandbox.Web/public/data/ltinfo"
CONTAINER="${LTINFO_CONTAINER:-ltinfo-ltinfo.dev-1}"
for route in programs data-model; do
  MSYS_NO_PATHCONV=1 docker exec "$CONTAINER" curl -sfk "https://localhost:7212/monitoring-new/$route" > "$OUT/monitoring-new-$route.json"
done
cp "$LTINFO/LtInfo.Web/src/assets/monitoring-new/planned-sources.json" "$OUT/planned-sources.json"
echo "Wrote $OUT. Set takenOn in snapshot.json."
