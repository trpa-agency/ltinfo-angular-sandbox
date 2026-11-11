# Deploys the sandbox and proves it works, in one command.
#
#   1. Database: builds it on the local SQL Server and puts the seed rows back, so the
#      tests start from known data. (-KeepData leaves your rows alone and skips step 4,
#      because the tests check the seed counts.)
#   2. Images: builds the release API and the compiled Angular site.
#   3. Start: brings up the deployed stack and waits until the site reports healthy,
#      which needs nginx, the API, and SQL Server all answering.
#   4. Test: runs the automated API and browser tests against the deployed site.
#
#   powershell -File Build\Deploy.ps1
#   powershell -File Build\Deploy.ps1 -KeepData
#
# The site is then at http://localhost:8080 and keeps running until:
#   docker compose -f docker-compose\docker-compose.deploy.yml down

param(
    [switch] $KeepData
)

$ErrorActionPreference = 'Stop'
$composeDir = Join-Path $PSScriptRoot '..\docker-compose'
$composeFile = Join-Path $composeDir 'docker-compose.deploy.yml'
$site = 'http://localhost:8080'
$started = Get-Date

function Step([string] $text) { ''; "== $text" }

# docker writes progress to stderr; run it without turning that into a PowerShell error
# and judge it by exit code.
function Invoke-Compose([string[]] $arguments) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & docker compose --project-directory $composeDir -f $composeFile @arguments }
    finally { $ErrorActionPreference = $previous }
    if ($LASTEXITCODE -ne 0) { throw "docker compose $($arguments -join ' ') failed with exit code $LASTEXITCODE" }
}

Step '1 of 4  Database'
if ($KeepData) { & (Join-Path $PSScriptRoot 'DatabaseBuild.ps1') }
else { & (Join-Path $PSScriptRoot 'DatabaseBuild.ps1') -Reseed }

Step '2 of 4  Build the release images'
Invoke-Compose @('build', '--quiet')

Step '3 of 4  Start and wait for healthy'
Invoke-Compose @('up', '-d', '--wait')
$health = Invoke-RestMethod -Uri "$site/api/health" -TimeoutSec 15
"Site answers: database $($health.Database), $($health.ProgramCount) programs"

$testResult = 'skipped (-KeepData)'
if (-not $KeepData) {
    Step '4 of 4  Automated tests against the deployed site'
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & docker compose --project-directory $composeDir -f $composeFile --profile test run --rm --build sandbox.e2e
    $testExit = $LASTEXITCODE
    $ErrorActionPreference = $previous
    $testResult = if ($testExit -eq 0) { 'passed' } else { "FAILED (exit code $testExit)" }
}

''
'== Result'
"Site:     $site"
"Tests:    $testResult"
"Report:   Sandbox.Tests\results\html-report\index.html"
"Took:     $([math]::Round(((Get-Date) - $started).TotalSeconds)) seconds"
if ($testResult -like 'FAILED*') { exit 1 }
