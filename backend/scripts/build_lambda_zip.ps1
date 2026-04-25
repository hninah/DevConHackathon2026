# Build a deployment zip for AWS Lambda (handler: lambda_tutor.handler).
# Run from repo root:  pwsh backend/scripts/build_lambda_zip.ps1
# Or from backend:       pwsh scripts/build_lambda_zip.ps1
#
# Requires: Python 3.12+ on PATH, pip. For Linux-compatible wheels from Windows,
# use WSL or a Linux CI job; see backend/README.md "Lambda deployment".

$ErrorActionPreference = "Stop"

$backendRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$outZip = Join-Path $backendRoot "lambda_deployment.zip"
$stage = Join-Path ([System.IO.Path]::GetTempPath()) ("lambda-tutor-" + [Guid]::NewGuid().ToString("N"))

New-Item -ItemType Directory -Path $stage -Force | Out-Null
try {
  Write-Host "Staging Python sources in $stage"
  Copy-Item -Path (Join-Path $backendRoot "src\*.py") -Destination $stage

  $chunks = Join-Path $backendRoot "data\chunks.json"
  $dataDir = Join-Path $stage "data"
  if (Test-Path $chunks) {
    New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
    Copy-Item $chunks (Join-Path $dataDir "chunks.json")
  } else {
    Write-Warning "data/chunks.json not found. Run: python scripts/chunk_manual.py && python scripts/embed_chunks.py (chunks are required for retrieval)."
  }

  $req = Join-Path $backendRoot "requirements.txt"
  Write-Host "pip install -r requirements.txt -t (may take a minute)..."
  python -m pip install -r $req -t $stage --disable-pip-version-check -q
  if ($LASTEXITCODE -ne 0) { throw "pip install failed" }

  Get-ChildItem -Path $stage -Filter "__pycache__" -Recurse -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { Remove-Item $_.FullName -Recurse -Force }

  if (Test-Path $outZip) { Remove-Item $outZip -Force }
  Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $outZip -Force
  Write-Host "Wrote $outZip"
} finally {
  Remove-Item -Path $stage -Recurse -Force -ErrorAction SilentlyContinue
}
