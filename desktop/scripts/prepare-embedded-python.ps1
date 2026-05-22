param(
  [string]$PythonLauncher = "py -3",
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DesktopDir = Split-Path -Parent $ScriptDir
$RepoRoot = Split-Path -Parent $DesktopDir
$PythonDir = Join-Path $DesktopDir "vendor\python-win"
$PythonExe = Join-Path $PythonDir "Scripts\python.exe"

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

Set-Location $RepoRoot

if ($Force -and (Test-Path $PythonDir)) {
  Write-Step "Removing existing embedded Python runtime"
  Remove-Item -Recurse -Force $PythonDir
}

if (-not (Test-Path $PythonExe)) {
  Write-Step "Creating embedded Python venv at desktop\vendor\python-win"
  New-Item -ItemType Directory -Force (Split-Path -Parent $PythonDir) | Out-Null
  Invoke-Expression "$PythonLauncher -m venv `"$PythonDir`""
}

Write-Step "Upgrading pip"
& $PythonExe -m pip install --upgrade pip

Write-Step "Installing ML runtime dependencies"
& $PythonExe -m pip install -r (Join-Path $RepoRoot "ml\requirements.txt")

Write-Step "Verifying CatBoost runtime"
& $PythonExe -c "import catboost, pandas, numpy; print('embedded Python ML runtime OK')"

Write-Host ""
Write-Host "Embedded Python runtime is ready: $PythonDir" -ForegroundColor Green
