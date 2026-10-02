$ErrorActionPreference = 'Stop'
$prefix = 'C:\Users\gps01\AppData\Local\Temp\songdee-deploy-opt-20260916\benchmarks\'
$deadline = (Get-Date).AddMinutes(30)
while ((Get-Date) -lt $deadline) {
  $owned = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($prefix) })
  if ($owned.Count -gt 64) {
    foreach ($worker in $owned) { Stop-Process -Id $worker.ProcessId -Force -ErrorAction SilentlyContinue }
    [IO.File]::WriteAllText('C:\Users\gps01\AppData\Local\Temp\songdee-deploy-opt-20260916\benchmark-guard-triggered.txt', ('Stopped benchmark workers: '+$owned.Count))
    exit 1
  }
  Start-Sleep -Seconds 3
}
