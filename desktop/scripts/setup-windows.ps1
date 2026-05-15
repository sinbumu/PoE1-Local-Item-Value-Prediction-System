param(
  [switch]$SkipPythonInstall,
  [switch]$SkipNpmInstall,
  [switch]$StartApp
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DesktopDir = Split-Path -Parent $ScriptDir
$RepoRoot = Split-Path -Parent $DesktopDir
$VenvPython = Join-Path $RepoRoot "ml\.venv\Scripts\python.exe"
$ModelPath = Join-Path $RepoRoot "desktop\models\v2_mvp\model.cbm"
$SchemaPath = Join-Path $RepoRoot "desktop\models\v2_mvp\feature_schema.json"

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

Set-Location $RepoRoot

Write-Step "Checking required files"
if (-not (Test-Path $ModelPath)) {
  throw "Missing model file: $ModelPath. Pull the latest repository or copy desktop/models/v2_mvp/model.cbm."
}
if (-not (Test-Path $SchemaPath)) {
  throw "Missing schema file: $SchemaPath. Pull the latest repository or copy desktop/models/v2_mvp/feature_schema.json."
}

if (-not $SkipNpmInstall) {
  Write-Step "Installing root Node dependencies"
  npm install

  Write-Step "Installing Electron app dependencies"
  Set-Location $DesktopDir
  npm install
  Set-Location $RepoRoot
}

if (-not $SkipPythonInstall) {
  Write-Step "Creating Python venv if needed"
  if (-not (Test-Path $VenvPython)) {
    py -3 -m venv (Join-Path $RepoRoot "ml\.venv")
  }

  Write-Step "Installing Python ML dependencies"
  & $VenvPython -m pip install -r (Join-Path $RepoRoot "ml\requirements.txt")
}

Write-Step "Verifying Python predictor dependencies"
& $VenvPython -c "import catboost, pandas; print('catboost/pandas import OK')"

Write-Step "Verifying TypeScript feature builder"
npm run --silent v2:clipboard-features -- --input "samples\clipboard\en\rare-equipment-001.txt" | Out-Null

Write-Step "Verifying CatBoost prediction"
npm run --silent v2:clipboard-features -- --input "samples\clipboard\en\rare-equipment-001.txt" | & $VenvPython "ml\predict_item_value.py" --model "desktop\models\v2_mvp\model.cbm" --schema "desktop\models\v2_mvp\feature_schema.json" --threshold 0.40

Write-Host ""
Write-Host "Windows Electron MVP setup completed." -ForegroundColor Green

if ($StartApp) {
  Write-Step "Starting Electron app"
  Set-Location $DesktopDir
  npm start
}
