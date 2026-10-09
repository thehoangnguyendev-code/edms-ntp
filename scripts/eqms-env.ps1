<#
.SYNOPSIS
  Runs one of the three separated environments (dev, test, prod) with its own project, containers, volumes, ports,
  database, object store and secrets.

.EXAMPLE
  scripts/eqms-env.ps1 -Environment dev  -Action up
  scripts/eqms-env.ps1 -Environment test -Action config
  scripts/eqms-env.ps1 -Environment prod -Action up -ConfirmProd

  dev   uses ./.env and docker-compose.yml (as before).
  test  uses deploy/env/test.env and the controlled overlay docker-compose.gmp.yml.
  prod  uses deploy/env/prod.env and the controlled overlay; needs -ConfirmProd; run it on the PROD host only.
#>
param(
    [Parameter(Mandatory = $true)][ValidateSet('dev', 'test', 'prod')][string]$Environment,
    [Parameter(Mandatory = $true)][ValidateSet('up', 'down', 'ps', 'config', 'logs')][string]$Action,
    [switch]$ConfirmProd
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if ($Environment -eq 'dev') {
    $envFile = Join-Path $root '.env'
    $files = @('-f', 'docker-compose.yml')
} else {
    $envFile = Join-Path $root "deploy/env/$Environment.env"
    $files = @('-f', 'docker-compose.yml', '-f', 'docker-compose.gmp.yml')
    if (-not (Test-Path $envFile)) {
        throw "Missing $envFile. Copy deploy/env/$Environment.env.example to deploy/env/$Environment.env and replace every CHANGE_ME."
    }
    if (Select-String -Path $envFile -Pattern 'CHANGE_ME' -Quiet) {
        throw "$envFile still contains CHANGE_ME. Replace every placeholder with a value generated for this environment."
    }
    $declared = (Select-String -Path $envFile -Pattern '^EQMS_ENVIRONMENT=(.+)$').Matches.Groups[1].Value.Trim()
    if ($declared -ne $Environment.ToUpper()) {
        throw "$envFile declares EQMS_ENVIRONMENT=$declared but you asked for $Environment. Refusing to continue."
    }
}

if ($Environment -eq 'prod' -and $Action -in @('up', 'down') -and -not $ConfirmProd) {
    throw 'PROD actions need -ConfirmProd. PROD is operated under change control, on the PROD host.'
}

$base = @('compose', '--env-file', $envFile) + $files
switch ($Action) {
    'up' {
        # DEV builds from source. TEST and PROD run an image that already exists (the release candidate); never build there.
        if ($Environment -eq 'dev') { & docker @base 'up' '-d' '--build' } else { & docker @base 'up' '-d' '--no-build' }
    }
    'down'   { & docker @base 'down' }
    'ps'     { & docker @base 'ps' }
    'config' { & docker @base 'config' }
    'logs'   { & docker @base 'logs' '--tail' '100' }
}
exit $LASTEXITCODE
