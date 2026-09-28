param(
  [ValidateSet('Setup', 'Verify', 'Store')]
  [string]$Mode = 'Verify',
  [string]$PsqlPath = 'C:\Program Files\PostgreSQL\18\bin\psql.exe',
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$targetHost = 'ep-dawn-paper-alws45vx.c-3.eu-central-1.aws.neon.tech'
$database = 'neondb'
$owner = 'neondb_owner'
$writer = 'pubquiz_external_import_writer'
$setupPath = Join-Path $PSScriptRoot 'setup-production-writer.psql'
$verifyPath = Join-Path $PSScriptRoot 'verify-production-writer.psql'

function ConvertFrom-SecureValue([Security.SecureString]$Value) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try {
    [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

$connectionUser = if ($Mode -eq 'Setup') { $owner } else { $writer }
$connection = "host=$targetHost port=5432 dbname=$database user=$connectionUser sslmode=require channel_binding=require connect_timeout=30"
$scriptPath = if ($Mode -eq 'Setup') { $setupPath } else { $verifyPath }

$previousPg = @{}
Get-ChildItem Env: | Where-Object Name -Like 'PG*' | ForEach-Object {
  $previousPg[$_.Name] = $_.Value
}

try {
  foreach ($name in $previousPg.Keys) {
    [Environment]::SetEnvironmentVariable($name, $null, 'Process')
  }

  $version = & $PsqlPath --version
  if ($LASTEXITCODE -ne 0 -or $version -notmatch 'PostgreSQL\) 18\.') {
    throw 'PostgreSQL psql 18.x required.'
  }

  if ($DryRun) {
    [pscustomobject]@{
      Mode = $Mode
      Host = $targetHost
      Database = $database
      User = $connectionUser
      SSLMode = 'require'
      ChannelBinding = 'require'
      Script = $scriptPath
      ConnectionAttempted = $false
    }
    return
  }

  $loginSecret = Read-Host "Passwort fuer $connectionUser" -AsSecureString
  $loginPassword = ConvertFrom-SecureValue $loginSecret
  [Environment]::SetEnvironmentVariable('PGPASSWORD', $loginPassword, 'Process')

  if ($Mode -eq 'Setup') {
    $writerSecret = Read-Host "Neues Passwort fuer $writer" -AsSecureString
    $writerPassword = ConvertFrom-SecureValue $writerSecret
    if ([string]::IsNullOrWhiteSpace($writerPassword)) {
      throw 'Writer password must not be empty.'
    }
    $passwordLiteral = "'" + $writerPassword.Replace("'", "''") + "'"
    $setupSql = [IO.File]::ReadAllText($setupPath)
    if (($setupSql.Split('__ROLE_PASSWORD_SQL_LITERAL__').Length - 1) -ne 1) {
      throw 'Setup password placeholder contract invalid.'
    }
    $renderedSql = $setupSql.Replace('__ROLE_PASSWORD_SQL_LITERAL__', $passwordLiteral)
    $renderedSql | & $PsqlPath -X -q -v ON_ERROR_STOP=1 -d $connection
    if ($LASTEXITCODE -ne 0) {
      throw 'Writer role setup failed; stop and inspect the safe psql error.'
    }
  } else {
    & $PsqlPath -X -q -v ON_ERROR_STOP=1 -d $connection -f $verifyPath
    if ($LASTEXITCODE -ne 0) {
      throw 'Writer role verification failed; do not store or use the credential.'
    }
    if ($Mode -eq 'Store') {
      $encodedPassword = [Uri]::EscapeDataString($loginPassword)
      $secretUrl = "postgresql://${writer}:${encodedPassword}@${targetHost}/${database}?sslmode=require&channel_binding=require&schema=pubquiz"
      $secretUrl | & gh secret set PRODUCTION_IMPORT_DATABASE_URL --env operations-content-import --repo justphilgud/pubquiz-web
      if ($LASTEXITCODE -ne 0) {
        throw 'Writer role is verified, but the GitHub environment secret was not stored.'
      }
      Write-Output 'Writer credential verified and stored in operations-content-import.'
    }
  }
} finally {
  $loginPassword = $null
  $writerPassword = $null
  $passwordLiteral = $null
  $renderedSql = $null
  $encodedPassword = $null
  $secretUrl = $null
  [Environment]::SetEnvironmentVariable('PGPASSWORD', $null, 'Process')
  foreach ($name in $previousPg.Keys) {
    [Environment]::SetEnvironmentVariable($name, $previousPg[$name], 'Process')
  }
}
