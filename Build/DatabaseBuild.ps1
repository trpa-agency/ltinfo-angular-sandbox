# Builds the sandbox database on the SQL Server installed on this machine.
#
# Connects with your Windows login (the server in build.ini, default .\), then:
#   1. creates the database if it is missing (or drops and recreates it with -Reset)
#   2. runs the table scripts in Sandbox.Database\dbo\Tables
#   3. seeds the tables when they are empty
#   4. creates the SQL login the API container signs in with, limited to reading and
#      writing this one database, using SQL_USER and SQL_PASSWORD from docker-compose\.env
# Safe to rerun; it only adds what is missing.
#
# This is the sandbox's stand-in for ESA's Build\DatabaseRestore.ps1 and
# Build\DatabaseBuild.ps1, which restore a backup and deploy a dacpac to the same
# kind of local instance.
#
#   powershell -File Build\DatabaseBuild.ps1
#   powershell -File Build\DatabaseBuild.ps1 -Reseed   (put the seed rows back, keep the database)
#   powershell -File Build\DatabaseBuild.ps1 -Reset    (drop the database and rebuild it)

param(
    [string] $IniFile = (Join-Path $PSScriptRoot 'build.ini'),
    [string] $EnvFile = (Join-Path $PSScriptRoot '..\docker-compose\.env'),
    [switch] $Reset,
    [switch] $Reseed
)

$ErrorActionPreference = 'Stop'

function Read-KeyValueFile([string] $path) {
    $values = @{}
    foreach ($line in Get-Content -LiteralPath $path) {
        if ($line -match '^\s*([^#;\[][^=]*?)\s*=\s*(.*)$') { $values[$Matches[1]] = $Matches[2] }
    }
    return $values
}

function Invoke-Sql([string] $database, [string] $sql) {
    $connection = New-Object System.Data.SqlClient.SqlConnection("Server=$server;Database=$database;Integrated Security=True;TrustServerCertificate=True;Connect Timeout=15")
    $connection.Open()
    try {
        $command = $connection.CreateCommand()
        $command.CommandTimeout = 120
        $command.CommandText = $sql
        return $command.ExecuteScalar()
    }
    finally { $connection.Close() }
}

$config = Read-KeyValueFile $IniFile
$server = $config['Server']
$databaseName = $config['DatabaseName']
if ($databaseName -notmatch '^[A-Za-z0-9_]+$') { throw "DatabaseName '$databaseName' in build.ini must be letters, digits, and underscores." }

if (-not (Test-Path -LiteralPath $EnvFile)) { throw "Missing $EnvFile. Copy docker-compose\.env.template to docker-compose\.env and fill it in." }
$envValues = Read-KeyValueFile $EnvFile
$sqlUser = $envValues['SQL_USER']
$sqlPassword = $envValues['SQL_PASSWORD']
if (-not $sqlUser -or -not $sqlPassword) { throw "SQL_USER and SQL_PASSWORD must be set in $EnvFile." }
if ($sqlUser -notmatch '^[A-Za-z0-9_]+$') { throw "SQL_USER must be letters, digits, and underscores." }

"Server: $server   Database: $databaseName   Signed in as: $(Invoke-Sql 'master' 'SELECT SUSER_SNAME()')"

if ($Reset -and (Invoke-Sql 'master' "SELECT DB_ID(N'$databaseName')") -isnot [DBNull]) {
    "Dropping $databaseName"
    Invoke-Sql 'master' "ALTER DATABASE [$databaseName] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$databaseName];" | Out-Null
}

Invoke-Sql 'master' "IF DB_ID(N'$databaseName') IS NULL CREATE DATABASE [$databaseName];" | Out-Null

# Order matters: parents before the tables that reference them.
$tablesDir = Join-Path $PSScriptRoot $config['DatabaseTablesDir']
foreach ($table in 'MonitoringProgramCategory', 'MonitoringProgram', 'Organization', 'MonitoringProgramOrganization', 'MonitoringProgramImage', 'MonitoringSite') {
    Invoke-Sql $databaseName (Get-Content -LiteralPath (Join-Path $tablesDir "dbo.$table.sql") -Raw) | Out-Null
    "Table dbo.$table"
}

if ($Reseed) {
    # Back to the seed rows without dropping the database, so running containers keep
    # their connections. Children first.
    Invoke-Sql $databaseName 'DELETE FROM dbo.MonitoringSite; DELETE FROM dbo.MonitoringProgramImage; DELETE FROM dbo.MonitoringProgramOrganization; DELETE FROM dbo.Organization; DELETE FROM dbo.MonitoringProgram; DELETE FROM dbo.MonitoringProgramCategory;' | Out-Null
    'Rows cleared for a reseed'
}

if ((Invoke-Sql $databaseName 'SELECT COUNT(*) FROM dbo.MonitoringProgram') -eq 0) {
    Invoke-Sql $databaseName (Get-Content -LiteralPath (Join-Path $PSScriptRoot $config['SeedScript']) -Raw -Encoding UTF8) | Out-Null
    'Seeded from Scripts\seed.sql'
}
else { 'Seed skipped: the tables already have rows' }

# The login the API container uses. Containers cannot sign in with Windows accounts.
$quotedPassword = $sqlPassword.Replace("'", "''")
Invoke-Sql 'master' @"
IF SUSER_ID(N'$sqlUser') IS NULL
    CREATE LOGIN [$sqlUser] WITH PASSWORD = N'$quotedPassword', DEFAULT_DATABASE = [$databaseName], CHECK_POLICY = ON, CHECK_EXPIRATION = OFF;
ELSE
    ALTER LOGIN [$sqlUser] WITH PASSWORD = N'$quotedPassword', DEFAULT_DATABASE = [$databaseName];
"@ | Out-Null
Invoke-Sql $databaseName @"
IF DATABASE_PRINCIPAL_ID(N'$sqlUser') IS NULL CREATE USER [$sqlUser] FOR LOGIN [$sqlUser];
ALTER ROLE db_datareader ADD MEMBER [$sqlUser];
ALTER ROLE db_datawriter ADD MEMBER [$sqlUser];
"@ | Out-Null
"Login $sqlUser can read and write $databaseName, and nothing else"

Invoke-Sql $databaseName "SELECT CONCAT('Ready: ', (SELECT COUNT(*) FROM dbo.MonitoringProgramCategory), ' categories, ', (SELECT COUNT(*) FROM dbo.MonitoringProgram), ' programs, ', (SELECT COUNT(*) FROM dbo.Organization), ' organizations, ', (SELECT COUNT(*) FROM dbo.MonitoringProgramOrganization), ' partner links, ', (SELECT COUNT(*) FROM dbo.MonitoringProgramImage), ' photos, ', (SELECT COUNT(*) FROM dbo.MonitoringSite), ' mapped locations')"

$mixed = (Invoke-Sql 'master' "SELECT CAST(SERVERPROPERTY('IsIntegratedSecurityOnly') AS int)") -eq 0
$tcp = [bool](Get-NetTCPConnection -LocalPort 1433 -State Listen -ErrorAction SilentlyContinue)
if (-not $mixed -or -not $tcp) {
    "NOTE: containers cannot connect yet (mixed-mode authentication: $mixed, listening on TCP 1433: $tcp)."
    '      Run Build\Enable-SqlServerForDocker.ps1 once.'
}
