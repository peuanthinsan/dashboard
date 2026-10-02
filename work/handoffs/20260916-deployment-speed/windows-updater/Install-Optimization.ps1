param([string]$DeploymentRoot = 'C:\Users\gps01\songdee-host\deployment')
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run this reviewed installer as administrator' }
$resolved = (Resolve-Path -LiteralPath $DeploymentRoot).Path
if ($resolved -ne 'C:\Users\gps01\songdee-host\deployment') { throw 'Unexpected deployment installation target' }
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'install-manifest.json') -Raw | ConvertFrom-Json
$mutex = New-Object Threading.Mutex($false, 'Global\SongdeeDeployment')
$locked = $false
try { $locked = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $locked = $true }
if (-not $locked) { $mutex.Dispose(); throw 'Deployment is running; retry installation when it finishes' }
$backup = Join-Path $resolved ('logs\optimization-backups\' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$written = New-Object System.Collections.Generic.List[string]
try {
  foreach ($entry in $manifest.files) {
    if ($entry.name -notin @('Controller.ps1','worker.cjs','change-policy.cjs')) { throw 'Unexpected installer file' }
    $source = Join-Path $PSScriptRoot $entry.name
    if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $entry.updated) { throw ('Reviewed source changed: ' + $entry.name) }
    $target = Join-Path $resolved $entry.name
    if (Test-Path -LiteralPath $target) {
      $hash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
      if ($hash -ne $entry.original -and $hash -ne $entry.updated) { throw ('Installed file changed since review: ' + $entry.name) }
    } elseif ($entry.original) { throw ('Expected installed file is missing: ' + $entry.name) }
  }
  New-Item -ItemType Directory -Path $backup -Force | Out-Null
  foreach ($entry in $manifest.files) {
    $target = Join-Path $resolved $entry.name
    if (Test-Path -LiteralPath $target) { Copy-Item -LiteralPath $target -Destination (Join-Path $backup $entry.name) }
    $written.Add($entry.name)
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $entry.name) -Destination $target -Force
    if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $entry.updated) { throw 'Installed hash mismatch' }
  }
  $schedules = @(Get-ScheduledTask | Where-Object {
    ($_.Actions.Arguments -join ' ') -match 'Controller\.ps1'
  } | ForEach-Object {
    [pscustomobject]@{name=$_.TaskName;state=[string]$_.State;intervals=@($_.Triggers | ForEach-Object {$_.Repetition.Interval})}
  })
  $receipt = [pscustomobject]@{status='installed';at=(Get-Date).ToUniversalTime().ToString('o');backup=$backup;files=$manifest.files;schedules=$schedules}
  $receipt | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $resolved 'logs\optimization-install.json') -Encoding UTF8
  $receipt | ConvertTo-Json -Depth 6
} catch {
  $originalError = $_
  foreach ($name in $written) {
    $saved = Join-Path $backup $name
    $target = Join-Path $resolved $name
    if (Test-Path -LiteralPath $saved) { Copy-Item -LiteralPath $saved -Destination $target -Force }
    elseif ($name -eq 'change-policy.cjs' -and (Test-Path -LiteralPath $target)) { Remove-Item -LiteralPath $target -Force }
  }
  throw $originalError
} finally { $mutex.ReleaseMutex(); $mutex.Dispose() }
