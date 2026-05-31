param(
  [int]$Port = 4173
)

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = "http://127.0.0.1:$Port"

function Get-NodeCommand {
  if (Get-Command node -ErrorAction SilentlyContinue) {
    return "node"
  }

  throw "Node.js was not found. Please install Node.js 18+ first."
}

try {
  $existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1

  if (-not $existing) {
    $node = Get-NodeCommand
    Start-Process -FilePath $node `
      -ArgumentList @("server.js", "--port", "$Port") `
      -WorkingDirectory $projectRoot `
      -WindowStyle Normal | Out-Null

    Start-Sleep -Seconds 2
  }

  $ready = Test-NetConnection -ComputerName 127.0.0.1 -Port $Port -WarningAction SilentlyContinue
  if (-not $ready.TcpTestSucceeded) {
    throw "Local preview server failed to start."
  }

  Start-Process $url
  Write-Host ""
  Write-Host "Preview started:" -ForegroundColor Green
  Write-Host "  $url"
  Write-Host ""
  Write-Host "Keep the Node window open. Closing it will stop the preview server."
} catch {
  Write-Error $_
  exit 1
}
