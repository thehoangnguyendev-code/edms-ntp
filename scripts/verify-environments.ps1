<#
.SYNOPSIS
  Proves that DEV, TEST and PROD do not share anything that would let one touch another's data.

.DESCRIPTION
  Renders the real Docker Compose configuration of each environment and compares them. Fails (exit 1) if any of these is
  shared, wrong or unsafe: project name, container names, published host ports, database name, bucket names, secrets,
  declared environment name, bucket prefix, developer tools in PROD, development-only migrations in TEST/PROD, missing
  strict-secret mode in TEST/PROD, an image that is not pinned for TEST/PROD.

  By default it checks the *.env.example templates, where secrets are placeholders: the secret checks are then skipped and
  the report says so. Run it again with -Files pointing at the real env files on each host to check secrets too.

.EXAMPLE
  scripts/verify-environments.ps1
  scripts/verify-environments.ps1 -Files .env,deploy/env/test.env,deploy/env/prod.env
#>
param(
    [string[]]$Files = @('deploy/env/dev.env.example', 'deploy/env/test.env.example', 'deploy/env/prod.env.example')
)

$ErrorActionPreference = 'Stop'
# `powershell -File` hands a comma list over as one string, so split it here.
$Files = @($Files | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$failures = New-Object System.Collections.Generic.List[string]
$notes = New-Object System.Collections.Generic.List[string]
function Fail([string]$message) { $script:failures.Add($message) }

$envs = @()
foreach ($file in $Files) {
    if (-not (Test-Path $file)) { Fail "Missing env file: $file"; continue }
    $lines = Get-Content $file | Where-Object { $_ -match '^[A-Za-z_][A-Za-z0-9_]*=' }
    $vars = @{}
    foreach ($line in $lines) { $k, $v = $line -split '=', 2; $vars[$k] = $v }
    $name = $vars['EQMS_ENVIRONMENT']
    if (-not $name) { Fail "$file does not declare EQMS_ENVIRONMENT"; continue }
    $controlled = $name -ne 'DEV'
    $composeFiles = @('-f', 'docker-compose.yml')
    if ($controlled) { $composeFiles += @('-f', 'docker-compose.gmp.yml') }
    $json = & docker compose --env-file $file @composeFiles config --format json 2>&1
    if ($LASTEXITCODE -ne 0) { Fail "$file : docker compose config failed: $json"; continue }
    $cfg = ($json -join "`n") | ConvertFrom-Json
    $placeholders = ($vars.Values | Where-Object { $_ -match 'CHANGE_ME' }).Count -gt 0
    $envs += [pscustomobject]@{ File = $file; Name = $name; Vars = $vars; Cfg = $cfg; Placeholders = $placeholders; Controlled = $controlled }
}

function Names($e) { @($e.Cfg.services.PSObject.Properties | ForEach-Object { $_.Value.container_name }) }
function Ports($e) {
    @($e.Cfg.services.PSObject.Properties | ForEach-Object { $_.Value.ports } | Where-Object { $_ } | ForEach-Object { "$($_.published)" })
}

foreach ($e in $envs) {
    $label = "$($e.Name) ($($e.File))"
    $cfg = $e.Cfg
    $backend = $cfg.services.backend.environment
    if ($backend.APP_ENVIRONMENT -ne $e.Name) { Fail "$label : backend APP_ENVIRONMENT is '$($backend.APP_ENVIRONMENT)'" }
    $prefix = @{ DEV = $null; TEST = 'eqms-test-'; PROD = 'eqms-prod-' }[$e.Name]
    foreach ($bucket in @($backend.APP_MINIO_BUCKET, $backend.APP_MINIO_TEMPLATES_BUCKET)) {
        if ($prefix -and -not $bucket.StartsWith($prefix)) { Fail "$label : bucket '$bucket' must start with $prefix" }
        if (-not $prefix -and ($bucket.StartsWith('eqms-test-') -or $bucket.StartsWith('eqms-prod-'))) { Fail "$label : DEV bucket '$bucket' uses a TEST/PROD name" }
    }
    if ($e.Controlled) {
        if ($backend.APP_SECURITY_STRICT_SECRETS -ne 'true') { Fail "$label : strict secrets are not enabled" }
        if ("$($backend.SPRING_FLYWAY_LOCATIONS)" -match 'migration-dev') { Fail "$label : loads development-only migrations" }
        if ($backend.SPRING_DATASOURCE_URL -match '/eqms-database(\?|$)') { Fail "$label : uses the development database name" }
        foreach ($img in @($cfg.services.backend.image, $cfg.services.frontend.image)) {
            if ($img -match ':local$') { Fail "$label : image '$img' is not a release candidate/digest" }
        }
    }
    if ($e.Name -eq 'PROD') {
        foreach ($tool in @('adminer', 'mailhog')) {
            if ($cfg.services.PSObject.Properties.Name -contains $tool) { Fail "$label : developer tool '$tool' is enabled in PROD" }
        }
        if ($e.Vars['APP_SECURITY_COOKIES_SECURE'] -ne 'true') { Fail "$label : secure cookies are not enabled" }
    }
    if ($e.Placeholders) { $notes.Add("$label : contains CHANGE_ME placeholders, secret checks skipped") }
}

# Nothing may be shared between two environments.
function CheckUnique([string]$what, [scriptblock]$selector) {
    $seen = @{}
    foreach ($e in $envs) {
        foreach ($value in @(& $selector $e) | Where-Object { $_ }) {
            if ($seen.ContainsKey($value) -and $seen[$value] -ne $e.Name) { Fail "$what '$value' is shared by $($seen[$value]) and $($e.Name)" }
            else { $seen[$value] = $e.Name }
        }
    }
}
CheckUnique 'project name' { param($e) $e.Cfg.name }
CheckUnique 'container name' { param($e) Names $e }
CheckUnique 'host port' { param($e) Ports $e }
CheckUnique 'database name' { param($e) $e.Vars['POSTGRES_DB'] }
CheckUnique 'bucket' { param($e) @($e.Vars['APP_MINIO_BUCKET'], $e.Vars['APP_MINIO_TEMPLATES_BUCKET']) }
$secretable = $envs | Where-Object { -not $_.Placeholders }
if (@($secretable).Count -gt 1) {
    foreach ($key in @('APP_AUTH_JWT_SECRET', 'ONLYOFFICE_JWT_SECRET', 'POSTGRES_PASSWORD', 'MINIO_ROOT_PASSWORD')) {
        $seen = @{}
        foreach ($e in $secretable) {
            $v = $e.Vars[$key]
            if ($v -and $seen.ContainsKey($v)) { Fail "secret $key is identical in $($seen[$v]) and $($e.Name)" } elseif ($v) { $seen[$v] = $e.Name }
        }
    }
    foreach ($e in ($secretable | Where-Object { $_.Controlled })) {
        if ($e.Vars['APP_AUTH_JWT_SECRET'] -match 'EQMS_DEV') { Fail "$($e.Name) uses the development JWT secret" }
    }
} else {
    $notes.Add('Secret comparison skipped (placeholders or fewer than two real env files).')
}

"Environments checked: " + (($envs | ForEach-Object { $_.Name }) -join ', ')
foreach ($n in $notes) { "NOTE : $n" }
if ($failures.Count -eq 0) { 'RESULT: PASS - no shared project, container, port, database, bucket or secret; controlled rules hold.'; exit 0 }
foreach ($f in $failures) { "FAIL : $f" }
'RESULT: FAIL'
exit 1
