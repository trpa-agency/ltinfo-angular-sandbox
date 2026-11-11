#!/bin/bash
# Creates the LTInfoSandbox database, its tables, and the seed rows.
# Runs once per `docker compose up` in the sandbox.dbinit container and is safe to
# rerun: the database and tables are created only when missing, and the seed runs
# only when dbo.MonitoringProgram is empty, so edits made through the app survive.
#
# ESA's real repos do this step differently: a .sqlproj builds a dacpac and the
# Build/*.ps1 scripts restore a database backup into SQL Server. This script is the
# stand-in for that, so the sandbox needs nothing but Docker.
set -euo pipefail

SQLCMD=/opt/mssql-tools18/bin/sqlcmd
SERVER="${DB_HOST:-sandbox.db}"
DATABASE="${DB_NAME:-LTInfoSandbox}"
run() { "$SQLCMD" -C -S "$SERVER" -U sa -P "$MSSQL_SA_PASSWORD" -b "$@"; }

echo "Creating database $DATABASE if it is missing"
run -Q "IF DB_ID(N'$DATABASE') IS NULL CREATE DATABASE [$DATABASE];"

# Order matters: parents before the tables that reference them.
for table in MonitoringProgramCategory MonitoringProgram Organization MonitoringProgramOrganization; do
  echo "Table dbo.$table"
  run -d "$DATABASE" -i "/database/dbo/Tables/dbo.$table.sql"
done

count=$(run -d "$DATABASE" -h -1 -W -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM dbo.MonitoringProgram;" | tr -d '[:space:]')
if [ "$count" = "0" ]; then
  echo "Seeding from Scripts/seed.sql"
  run -d "$DATABASE" -i /database/Scripts/seed.sql
else
  echo "Seed skipped: dbo.MonitoringProgram already has $count rows"
fi

run -d "$DATABASE" -h -1 -W -Q "SET NOCOUNT ON; SELECT CONCAT('Ready: ', (SELECT COUNT(*) FROM dbo.MonitoringProgramCategory), ' categories, ', (SELECT COUNT(*) FROM dbo.MonitoringProgram), ' programs, ', (SELECT COUNT(*) FROM dbo.Organization), ' organizations');"
