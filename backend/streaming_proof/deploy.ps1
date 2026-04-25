# Deploys a minimal Node.js Lambda with a public Function URL and RESPONSE_STREAM invoke mode.
# Requires: AWS CLI v2, credentials with Lambda + IAM permissions, region set (e.g. us-west-2).
# Run from this directory:  .\deploy.ps1

# AWS CLI writes expected "not found" errors to stderr; do not use Stop or those calls throw.
$ErrorActionPreference = 'Continue'

$FunctionName = 'securepass-streaming-proof'
$RoleName = 'securepass-streaming-proof-role'
$Region = if ($env:AWS_REGION) { $env:AWS_REGION } elseif ($env:AWS_DEFAULT_REGION) { $env:AWS_DEFAULT_REGION } else { 'us-west-2' }
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ZipPath = Join-Path $ScriptDir 'function.zip'
$IndexPath = Join-Path $ScriptDir 'index.mjs'
$Runtime = 'nodejs20.x'
$Handler = 'index.handler'

if (-not (Test-Path -LiteralPath $IndexPath)) {
  throw "Missing index.mjs at $IndexPath"
}

# Package (index.mjs at zip root)
if (Test-Path -LiteralPath $ZipPath) {
  Remove-Item -LiteralPath $ZipPath -Force
}
Compress-Archive -Path $IndexPath -DestinationPath $ZipPath -Force

# Trust policy for Lambda
$trustJson = @'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
'@

$roleArn = $null
aws iam get-role --role-name $RoleName 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
  $roleArn = (aws iam get-role --role-name $RoleName | ConvertFrom-Json).Role.Arn
  Write-Host "Using existing IAM role: $roleArn"
} else {
  Write-Host "Creating IAM role $RoleName..."
  $trustPath = Join-Path $env:TEMP "lambda-streaming-trust.json"
  # UTF-8 without BOM: IAM rejects some BOM-prefixed policy files on Windows.
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($trustPath, $trustJson, $utf8NoBom)
  $trustUri = ($trustPath -replace '\\', '/')
  aws iam create-role --role-name $RoleName --assume-role-policy-document "file://$trustUri" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "iam create-role failed" }
  aws iam attach-role-policy --role-name $RoleName --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" | Out-Null
  Start-Sleep -Seconds 10
  $roleArn = (aws iam get-role --role-name $RoleName | ConvertFrom-Json).Role.Arn
  Write-Host "Created IAM role: $roleArn"
}

aws lambda get-function --function-name $FunctionName --region $Region 2>$null | Out-Null
$functionExists = $LASTEXITCODE -eq 0

if (-not $functionExists) {
  Write-Host "Creating Lambda function $FunctionName..."
  aws lambda create-function `
    --function-name $FunctionName `
    --runtime $Runtime `
    --role $roleArn `
    --handler $Handler `
    --zip-file "fileb://$ZipPath" `
    --timeout 30 `
    --region $Region | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "lambda create-function failed" }
} else {
  Write-Host "Updating Lambda code for $FunctionName..."
  aws lambda update-function-code `
    --function-name $FunctionName `
    --zip-file "fileb://$ZipPath" `
    --region $Region | Out-Null
  aws lambda update-function-configuration `
    --function-name $FunctionName `
    --handler $Handler `
    --runtime $Runtime `
    --timeout 30 `
    --region $Region | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "lambda update failed" }
}

# Wait until Active
$status = 'Pending'
$attempts = 0
while ($status -ne 'Active' -and $attempts -lt 30) {
  Start-Sleep -Seconds 2
  $config = aws lambda get-function-configuration --function-name $FunctionName --region $Region | ConvertFrom-Json
  $status = $config.State
  $attempts++
}

# Public Function URL (NONE) + streaming
aws lambda get-function-url-config --function-name $FunctionName --region $Region 2>$null | Out-Null
$urlExists = $LASTEXITCODE -eq 0

if (-not $urlExists) {
  Write-Host "Creating Function URL (auth NONE, RESPONSE_STREAM)..."
  aws lambda create-function-url-config `
    --function-name $FunctionName `
    --auth-type NONE `
    --invoke-mode RESPONSE_STREAM `
    --region $Region | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "create-function-url-config failed" }

  # Resource policy so the URL is invokable without IAM signing. Some clients
  # (including curl) need both actions for public function URLs; InvokeFunctionUrl
  # alone can return 403 Forbidden.
  aws lambda add-permission `
    --function-name $FunctionName `
    --statement-id "FunctionURLAllowPublicInvoke-$FunctionName" `
    --action lambda:InvokeFunctionUrl `
    --principal '*' `
    --function-url-auth-type NONE `
    --region $Region 2>$null
  aws lambda add-permission `
    --function-name $FunctionName `
    --statement-id "FunctionURLAllowPublicInvokeFunction-$FunctionName" `
    --action lambda:InvokeFunction `
    --principal '*' `
    --region $Region 2>$null
} else {
  Write-Host "Updating Function URL invoke mode to RESPONSE_STREAM..."
  aws lambda update-function-url-config `
    --function-name $FunctionName `
    --invoke-mode RESPONSE_STREAM `
    --region $Region | Out-Null
}

$finalUrl = (aws lambda get-function-url-config --function-name $FunctionName --region $Region | ConvertFrom-Json).FunctionUrl
Write-Host ""
Write-Host "Function URL: $finalUrl"
Write-Host "Test: curl.exe -N `"$finalUrl`""
Write-Host ""
