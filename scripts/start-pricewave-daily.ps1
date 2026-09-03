param(
  [switch]$NoVSCode
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root

function Test-PricewaveServer {
  try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/automation/run" -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Start-PricewaveDevServer {
  $escapedRoot = $Root.Replace("'", "''")
  $command = "Set-Location -LiteralPath '$escapedRoot'; npm.cmd run dev"

  if (Get-Command wt.exe -ErrorAction SilentlyContinue) {
    Start-Process wt.exe -ArgumentList @(
      "new-tab",
      "--title", "Pricewave Dev",
      "powershell.exe",
      "-NoExit",
      "-Command", $command
    ) | Out-Null
  } else {
    Start-Process powershell.exe -ArgumentList @(
      "-NoExit",
      "-Command", $command
    ) | Out-Null
  }
}

if (-not $NoVSCode) {
  if (Get-Command code.cmd -ErrorAction SilentlyContinue) {
    Start-Process code.cmd -ArgumentList "." | Out-Null
  } elseif (Get-Command code.exe -ErrorAction SilentlyContinue) {
    Start-Process code.exe -ArgumentList "." | Out-Null
  }
}

if (-not (Test-PricewaveServer)) {
  Start-PricewaveDevServer

  $ready = $false
  for ($attempt = 0; $attempt -lt 90; $attempt += 1) {
    Start-Sleep -Seconds 1
    if (Test-PricewaveServer) {
      $ready = $true
      break
    }
  }
  if (-not $ready) {
    throw "Pricewave開発サーバーが90秒以内に起動しませんでした。"
  }
}

$runId = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
$url = "http://localhost:3000/automation/run?run=$runId"

if (Get-Command msedge.exe -ErrorAction SilentlyContinue) {
  Start-Process msedge.exe -ArgumentList $url | Out-Null
} else {
  Start-Process $url | Out-Null
}

Write-Host "Pricewave自動更新を開始しました。"
Write-Host "Edge上で巡回完了後、自動的にViewerへ公開されます。"
