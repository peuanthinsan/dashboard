param([switch]$BuildOnly, [switch]$ActivatePrepared, [switch]$CheckOnly, [switch]$Retry, [ValidateSet('dashboard','svis','ops','')][string]$OnlyApp='')
. (Join-Path $PSScriptRoot 'Common.ps1')
$config = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'config.json') -Raw | ConvertFrom-Json
$buildBase = [IO.Path]::GetFullPath([string]$config.buildRoot)
$mutex = New-Object Threading.Mutex($false, 'Global\SongdeeDeployment')
$locked = $false
try { $locked = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $locked = $true }
if (-not $locked) { $mutex.Dispose(); exit 0 }
$failed = $false
function Write-Event([string]$App, [string]$Status, [string]$Message) {
    $event = [pscustomobject]@{ at=(Get-Date).ToUniversalTime().ToString('o'); app=$App; status=$Status; message=$Message }
    Add-Content -LiteralPath (Join-Path $PSScriptRoot 'logs\events.jsonl') -Value ($event | ConvertTo-Json -Compress)
    Save-Json (Join-Path $PSScriptRoot ('logs\' + $App + '-latest.json')) $event
}
function Git-Command([string[]]$Arguments) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    # Never enable executable Git helpers from the build account's checkout.
    $result = & 'C:\Program Files\Git\cmd\git.exe' -c core.fsmonitor=false -c core.hooksPath=NUL @Arguments 2>&1
    $code = $LASTEXITCODE; $ErrorActionPreference = $previous
    if ($code -ne 0) { throw 'Git command failed; check repository/network access or commit ancestry' }
    return ($result | Out-String).Trim()
}
function Main-Sha($App) {
    $sha = (Git-Command @('ls-remote', $App.repository, 'refs/heads/main')).Split("`t")[0]
    if ($sha -notmatch '^[0-9a-f]{40}$') { throw 'Invalid remote revision' }
    return $sha
}
function Build-Candidate($App, [string]$Sha, [bool]$ReuseExisting = $false, [string]$PreviousSha = '') {
    if ((Get-ScheduledTask -TaskName 'Songdee Build Worker').State -eq 'Running') { throw 'A build worker is already running' }
    $id = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + $Sha.Substring(0,12)
    $reuse=$false
    if($ReuseExisting){
        foreach($directory in Get-ChildItem -LiteralPath $buildBase -Directory | Sort-Object Name -Descending){
            if($directory.Name -notmatch '^\d{8}-\d{6}-[0-9a-f]{12}$'){continue}
            $receipt=Join-Path $directory.FullName 'result.json'
            if(-not (Test-Path -LiteralPath $receipt)){continue}
            $prior=Get-Content -LiteralPath $receipt -Raw|ConvertFrom-Json
            if($prior.status -eq 'built' -and $prior.app -eq $App.name -and $prior.sha -eq $Sha){$id=$directory.Name;$reuse=$true;break}
        }
    }
    if(-not $reuse){
    $request = @{ app=$App.name; sha=$Sha; id=$id; previousSha=$PreviousSha }
    Save-Json (Join-Path $PSScriptRoot 'request.json') $request
    Write-Event $App.name 'building' $Sha
    Start-ScheduledTask -TaskName 'Songdee Build Worker'
    $requestedAt=Get-Date
    $resultPath = Join-Path $buildBase ($id + '\result.json')
    $deadline = (Get-Date).AddMinutes(50)
    while (-not (Test-Path -LiteralPath $resultPath)) {
        if ((Get-Date) -gt $deadline) { Stop-ScheduledTask -TaskName 'Songdee Build Worker'; throw 'Build timed out' }
        if ((Get-Date) -gt $requestedAt.AddSeconds(20)) {
            $taskInfo=Get-ScheduledTaskInfo -TaskName 'Songdee Build Worker'
            if ((Get-ScheduledTask -TaskName 'Songdee Build Worker').State -ne 'Running' -and $taskInfo.LastRunTime -ge $requestedAt.AddSeconds(-5)) {
                throw ('Build worker exited before writing a result; task exit code '+$taskInfo.LastTaskResult)
            }
        }
        Start-Sleep -Seconds 3
    }
    while ((Get-ScheduledTask -TaskName 'Songdee Build Worker').State -eq 'Running') {
        if ((Get-Date) -gt $deadline) { throw 'Build task did not exit' }
        Start-Sleep -Seconds 1
    }
    }
    $resultPath = Join-Path $buildBase ($id + '\result.json')
    $result = Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
    if ($result.status -ne 'built' -or $result.sha -ne $Sha -or $result.app -ne $App.name) { throw ('Build failed; inspect ' + (Join-Path $buildBase ($id + '\build.log'))) }
    $sourceRelease = Join-Path $buildBase ($id + '\release')
    Assert-Within $buildBase $sourceRelease
    if (Get-ChildItem -LiteralPath $sourceRelease -Force -Recurse | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint } | Select-Object -First 1) { throw 'Built release contains a reparse point' }
    $candidate = Join-Path $App.root ('candidates\' + $id + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8))
    Assert-Within $App.root $candidate
    if (Test-Path -LiteralPath $candidate) { throw 'Candidate directory already exists' }
    New-Item -ItemType Directory -Path $candidate -Force | Out-Null
    # Copy data without builder ACLs into the protected candidate tree.
    & robocopy.exe $sourceRelease $candidate /E /COPY:DAT /DCOPY:DAT /R:1 /W:1 /XJ /NFL /NDL /NJH /NJS *> $null
    if ($LASTEXITCODE -ge 8) { throw 'Candidate copy failed' }
    # Next.js needs a writable cache; application code remains read-only to its service.
    $cacheRelative = if($App.name -eq 'dashboard'){'.next\cache'}elseif($App.name -eq 'ops'){'web\.next\cache'}else{$null}
    if($cacheRelative){
        $cache=Join-Path $candidate $cacheRelative;Assert-Within $candidate $cache
        New-Item -ItemType Directory -Path $cache -Force|Out-Null
        & icacls.exe $cache /grant '*S-1-5-19:(OI)(CI)M' *> $null
        if($LASTEXITCODE -ne 0){throw 'Runtime cache permission setup failed'}
    }
    $prepared = @{ sha=$Sha; candidate=$candidate; buildId=$id }
    Save-Json (Join-Path $App.root 'prepared.json') $prepared
    return $prepared
}
function Verify-Candidate($App, [string]$Candidate) {
    Stop-App 'SongdeeDeployCandidate'
    $candidatePort = $App.port + 1000
    $listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, $candidatePort)
    try { $listener.Start() } finally { $listener.Stop() }
    $xmlPath = Join-Path $PSScriptRoot 'candidate-service\SongdeeDeployCandidate.xml'
    [xml]$xml = Get-Content -LiteralPath $xmlPath -Raw
    $xml.service.workingdirectory = $Candidate
    foreach ($entry in @($xml.service.SelectNodes('env'))) { [void]$xml.service.RemoveChild($entry) }
    foreach ($pair in @(@('SONGDEE_CONFIG',$App.runtime),@('SONGDEE_CANDIDATE_PORT',[string]$candidatePort))) {
        $entry=$xml.CreateElement('env'); $entry.SetAttribute('name',$pair[0]); $entry.SetAttribute('value',$pair[1]); [void]$xml.service.AppendChild($entry)
    }
    $xml.Save($xmlPath)
    try {
        Start-App 'SongdeeDeployCandidate'
        Test-AppHealth $App $candidatePort
        if ((Get-Service 'SongdeeDeployCandidate').Status -ne 'Running') { throw 'Candidate exited after health check' }
    } finally { Stop-App 'SongdeeDeployCandidate' }
    Write-Event $App.name 'candidate-verified' $Candidate
}
try {
    $env:GIT_TERMINAL_PROMPT='0'; $env:GCM_INTERACTIVE='Never'
    foreach ($app in $config.apps) {
        if($OnlyApp -and $app.name -ne $OnlyApp){continue}
        $sha = ''
        try {
            $statePath = Join-Path $app.root 'deployment-state.json'
            $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
            $journalPath = Join-Path $app.root 'transaction.json'
            if (Test-Path -LiteralPath $journalPath) {
                $journal = Get-Content -LiteralPath $journalPath -Raw | ConvertFrom-Json
                if ($journal.phase -notin @('committed','rolled-back')) {
                    if ($CheckOnly) { throw 'Interrupted deployment requires recovery' }
                    Restore-Transaction $app $journal
                    Write-Event $app.name 'recovered' 'Restored the previous release after an interrupted deployment'
                    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
                }
            }
            if (-not ($BuildOnly -or $ActivatePrepared -or $CheckOnly) -and -not $state.enabled) { continue }
            $sha = Main-Sha $app
            if (($BuildOnly -or $ActivatePrepared) -and $sha -ne $app.initialSha) { throw 'Main changed since the reviewed publication; inspect before initial activation' }
            if(($BuildOnly -or $ActivatePrepared) -and $state.deployed -eq $sha -and $state.status -eq 'healthy'){Test-AppHealth $app $app.port;continue}
            if ($CheckOnly) { Write-Output ($app.name + ': deployed=' + $state.deployed + ', main=' + $sha); continue }
            if (-not ($BuildOnly -or $ActivatePrepared)) {
                if ($sha -eq $state.deployed) { continue }
                if ($sha -eq $state.failed -and -not $Retry) { $failed=$true; continue }
            }
            if ($ActivatePrepared) {
                $prepared = Get-Content -LiteralPath (Join-Path $app.root 'prepared.json') -Raw | ConvertFrom-Json
                if ($prepared.sha -ne $sha) { throw 'Prepared revision mismatch' }
            } else {
                $previousSha = if ($BuildOnly) { '' } else { [string]$state.deployed }
                $prepared = Build-Candidate $app $sha ([bool]$BuildOnly) $previousSha
            }
            if (-not ($BuildOnly -or $ActivatePrepared)) {
                $source = Join-Path $buildBase ($prepared.buildId + '\source')
                Assert-Within $buildBase $source
                Git-Command @('-c',('safe.directory=' + $source),'-C',$source,'merge-base','--is-ancestor',$state.deployed,$sha) | Out-Null
                $changed = Git-Command @('-c',('safe.directory=' + $source),'-C',$source,'diff','--no-ext-diff','--no-textconv','--ignore-submodules=all','--name-only',$state.deployed,$sha)
                $changed = (($changed -split '\r?\n' | Where-Object { $_ -ne 'db/README.md' }) -join [Environment]::NewLine)
                if ($changed -match '(?m)^(migrations/|drizzle/|db/|sql/|scripts/migrate|web/scripts/migrate|app/db-schema\.ts)|\.sql\r?$') { throw 'Schema or migration files changed; review and apply migrations explicitly before retrying deployment' }
            }
            Verify-Candidate $app $prepared.candidate
            if ($BuildOnly) { continue }
            if ((Main-Sha $app) -ne $sha) { Write-Event $app.name 'superseded' $sha; continue }
            Activate-Release $app $prepared.candidate $sha
            Write-Event $app.name 'deployed' $sha
            # Retention must never turn a healthy activation into a deployment failure.
            try { & (Join-Path $PSScriptRoot 'Retention.ps1') -App $app -KeepBuild $prepared.buildId -BuildRoot $buildBase }
            catch { Write-Event $app.name 'cleanup-warning' $_.Exception.Message }
        } catch {
            $failed = $true
            Write-Event $app.name 'failed' $_.Exception.Message
            if ($sha -and -not ($BuildOnly -or $ActivatePrepared -or $CheckOnly)) {
                $state = Get-Content -LiteralPath (Join-Path $app.root 'deployment-state.json') -Raw | ConvertFrom-Json
                $state.failed=$sha; $state.status='failed'; $state.updatedAt=(Get-Date).ToUniversalTime().ToString('o')
                Save-Json (Join-Path $app.root 'deployment-state.json') $state
            }
        }
    }
} finally { $mutex.ReleaseMutex(); $mutex.Dispose() }
if ($failed) { exit 1 }
