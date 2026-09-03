param(
  [ValidatePattern('^([01]\d|2[0-3]):[0-5]\d$')]
  [string]$Time = "09:00",
  [string]$TaskName = "Pricewave Daily Update"
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Runner = Join-Path $PSScriptRoot "start-pricewave-daily.ps1"
if (-not (Test-Path -LiteralPath $Runner)) {
  throw "日次実行スクリプトが見つかりません: $Runner"
}

$PowerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
$escapedRunner = $Runner.Replace('"', '\"')
$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$Runner`" -NoVSCode"

$action = New-ScheduledTaskAction `
  -Execute $PowerShell `
  -Argument $arguments `
  -WorkingDirectory $Root

$trigger = New-ScheduledTaskTrigger -Daily -At $Time

$settings = New-ScheduledTaskSettingsSet `
  -WakeToRun `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit ([TimeSpan]::FromHours(12))

# Edge拡張機能を使うため、ユーザーがサインインしたままロック/休止している
# セッション内で実行する。ログオフ状態のSession 0ではブラウザ拡張を使わない。
$userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal `
  -UserId $userId `
  -LogonType Interactive `
  -RunLevel Limited

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description "Pricewaveを指定時刻に自動復帰して巡回し、Viewerを公開する。" `
  -Force | Out-Null

# 現在の電源プランでウェイクタイマーを許可する。環境によって設定項目が
# 公開されていない場合もあるため、その場合はタスク登録自体は成功扱いにする。
try {
  & powercfg.exe /SETACVALUEINDEX SCHEME_CURRENT SUB_SLEEP RTCWAKE 1 | Out-Null
  & powercfg.exe /SETDCVALUEINDEX SCHEME_CURRENT SUB_SLEEP RTCWAKE 1 | Out-Null
  & powercfg.exe /SETACTIVE SCHEME_CURRENT | Out-Null
} catch {
  Write-Warning "ウェイクタイマー設定を自動変更できませんでした。Windowsの電源設定を確認してください。"
}

$task = Get-ScheduledTask -TaskName $TaskName
$info = Get-ScheduledTaskInfo -TaskName $TaskName

Write-Host "登録完了: $TaskName"
Write-Host "実行時刻: 毎日 $Time"
Write-Host "WakeToRun: $($task.Settings.WakeToRun)"
Write-Host "次回実行: $($info.NextRunTime)"
Write-Host "PCはシャットダウンせず、サインインしたまま休止またはスリープしてください。"
