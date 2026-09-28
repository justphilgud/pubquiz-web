param(
  [ValidateSet('Precheck', 'Setup', 'Verify', 'Store')]
  [string]$Mode = 'Verify',
  [string]$PsqlPath = 'C:\Program Files\PostgreSQL\18\bin\psql.exe',
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$targetHost = 'ep-dawn-paper-alws45vx.c-3.eu-central-1.aws.neon.tech'
$database = 'neondb'
$owner = 'neondb_owner'
$writer = 'pubquiz_external_import_writer'
$precheckPath = Join-Path $PSScriptRoot 'precheck-production-writer.psql'
$setupPath = Join-Path $PSScriptRoot 'setup-production-writer.psql'
$verifyPath = Join-Path $PSScriptRoot 'verify-production-writer.psql'
$exitCodeSuccess = 0
$exitCodeBlocked = 10
$exitCodeTechnicalFailure = 20
$exitCodeProtocolFailure = 21
$operationExitCode = $exitCodeSuccess
$operationError = $null

function ConvertFrom-SecureValue([Security.SecureString]$Value) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try {
    [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

function Stop-WriterRoleOperation([string]$Message, [int]$ExitCode) {
  $exception = [InvalidOperationException]::new($Message)
  $exception.Data['WriterRoleExitCode'] = $ExitCode
  throw $exception
}

function Invoke-WriterPrecheck {
  $precheckOutput = @(
    & $PsqlPath -X -q -A -t -v ON_ERROR_STOP=1 -d $connection -f $precheckPath
  )
  $precheckProcessExitCode = $LASTEXITCODE

  if ($precheckProcessExitCode -ne 0) {
    Stop-WriterRoleOperation `
      'Writer role precheck failed technically; no role was created.' `
      $exitCodeTechnicalFailure
  }

  $statusLines = @(
    $precheckOutput |
      ForEach-Object { $_.ToString().Trim() } |
      Where-Object { $_ -ne '' }
  )
  if ($statusLines.Count -ne 1 -or
      $statusLines[0] -notmatch '^PUBQUIZ_WRITER_PRECHECK\|(PASS|BLOCK)\|([A-Z_]+)$') {
    Stop-WriterRoleOperation `
      'Writer role precheck returned no unique valid status; failing closed.' `
      $exitCodeProtocolFailure
  }

  $status = $Matches[1]
  $reason = $Matches[2]
  if ($status -eq 'BLOCK') {
    Stop-WriterRoleOperation "Writer role precheck blocked: $reason; no role was created." $exitCodeBlocked
  }
  if ($status -ne 'PASS' -or $reason -ne 'ALL_GATES_PASSED') {
    Stop-WriterRoleOperation `
      'Writer role precheck returned an unsupported PASS status; failing closed.' `
      $exitCodeProtocolFailure
  }

  Write-Output 'Writer role precheck passed; no write was executed.'
}

$connectionUser = if ($Mode -in @('Precheck', 'Setup')) { $owner } else { $writer }
$connection = "host=$targetHost port=5432 dbname=$database user=$connectionUser sslmode=require channel_binding=require connect_timeout=30"
$scriptPath = switch ($Mode) {
  'Precheck' { $precheckPath }
  'Setup' { $setupPath }
  default { $verifyPath }
}

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
    Stop-WriterRoleOperation 'PostgreSQL psql 18.x required.' $exitCodeTechnicalFailure
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
  } else {
    $loginSecret = Read-Host "Passwort fuer $connectionUser" -AsSecureString
    $loginPassword = ConvertFrom-SecureValue $loginSecret
    [Environment]::SetEnvironmentVariable('PGPASSWORD', $loginPassword, 'Process')

    if ($Mode -eq 'Precheck') {
      Invoke-WriterPrecheck
    } elseif ($Mode -eq 'Setup') {
      # Setup always repeats the complete read-only gate before prompting for a
      # writer password or sending any mutating SQL to Production.
      Invoke-WriterPrecheck

      $writerSecret = Read-Host "Neues Passwort fuer $writer" -AsSecureString
      $writerPassword = ConvertFrom-SecureValue $writerSecret
      if ([string]::IsNullOrWhiteSpace($writerPassword)) {
        Stop-WriterRoleOperation 'Writer password must not be empty.' $exitCodeTechnicalFailure
      }
      $passwordLiteral = "'" + $writerPassword.Replace("'", "''") + "'"
      $setupSql = [IO.File]::ReadAllText($setupPath)
      if (($setupSql.Split('__ROLE_PASSWORD_SQL_LITERAL__').Length - 1) -ne 1) {
        Stop-WriterRoleOperation 'Setup password placeholder contract invalid.' $exitCodeTechnicalFailure
      }
      $renderedSql = $setupSql.Replace('__ROLE_PASSWORD_SQL_LITERAL__', $passwordLiteral)
      $renderedSql | & $PsqlPath -X -q -v ON_ERROR_STOP=1 -d $connection
      if ($LASTEXITCODE -ne 0) {
        Stop-WriterRoleOperation `
          'Writer role setup failed; stop and inspect the safe psql error.' `
          $exitCodeTechnicalFailure
      }
    } else {
      & $PsqlPath -X -q -v ON_ERROR_STOP=1 -d $connection -f $verifyPath
      if ($LASTEXITCODE -ne 0) {
        Stop-WriterRoleOperation `
          'Writer role verification failed; do not store or use the credential.' `
          $exitCodeTechnicalFailure
      }
      if ($Mode -eq 'Store') {
        $encodedPassword = [Uri]::EscapeDataString($loginPassword)
        $secretUrl = "postgresql://${writer}:${encodedPassword}@${targetHost}/${database}?sslmode=require&channel_binding=require&schema=pubquiz"
        $secretUrl | & gh secret set PRODUCTION_IMPORT_DATABASE_URL --env operations-content-import --repo justphilgud/pubquiz-web
        if ($LASTEXITCODE -ne 0) {
          Stop-WriterRoleOperation `
            'Writer role is verified, but the GitHub environment secret was not stored.' `
            $exitCodeTechnicalFailure
        }
        Write-Output 'Writer credential verified and stored in operations-content-import.'
      }
    }
  }
} catch {
  $candidateExitCode = $_.Exception.Data['WriterRoleExitCode']
  $operationExitCode = if ($candidateExitCode -is [int]) {
    $candidateExitCode
  } else {
    $exitCodeTechnicalFailure
  }
  $operationError = $_.Exception.Message
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

if ($operationExitCode -ne $exitCodeSuccess) {
  [Console]::Error.WriteLine($operationError)
  exit $operationExitCode
}

exit $exitCodeSuccess
