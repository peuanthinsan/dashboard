$ErrorActionPreference = 'Stop'
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Administrator access is required to restore the stopped PostgreSQL service' }
$service = Get-Service -Name 'postgresql-songdee-17'
if ($service.Status -eq 'Stopped') { Start-Service -Name 'postgresql-songdee-17' }
(Get-Service -Name 'postgresql-songdee-17').WaitForStatus('Running',[TimeSpan]::FromSeconds(30))
foreach ($target in @(@('dashboard','8080'),@('svis','8081'),@('ops','8082'))) {
  & 'C:\Program Files\nodejs\node.exe' 'C:\Users\gps01\songdee-host\deployment\Health.cjs' $target[0] $target[1]
  if ($LASTEXITCODE -ne 0) { throw ('Health verification failed: '+$target[0]) }
}
Write-Output 'PostgreSQL and all application health checks recovered'
