# Lambda Function URL streaming proof

This folder is a **throwaway** prototype to prove that a Lambda **Function URL** can return **chunked streaming** when `InvokeMode` is set to `RESPONSE_STREAM`. It does not use the SecurePass Python tutor.

## What it proves

- Deploy path: IAM role, zip package, Node.js runtime, Function URL.
- Transport: `InvokeWithResponseStream` behind the Function URL (not API Gateway).
- Manual test: `curl.exe -N` should print one line every ~500ms, not one blob at the end.

## Prerequisites

- AWS CLI v2 (`aws --version`) with a recent build that supports `--invoke-mode RESPONSE_STREAM`.
- Credentials with permissions to create/update IAM roles, Lambda, and function URLs in your account.
- Region: uses `AWS_REGION` or `AWS_DEFAULT_REGION` if set, otherwise `us-west-2`.

## Deploy

From repo root (PowerShell):

```powershell
cd backend\streaming_proof
.\deploy.ps1
```

The script:

1. Zips `index.mjs` to `function.zip`.
2. Creates or reuses IAM role `securepass-streaming-proof-role` with `AWSLambdaBasicExecutionRole`.
3. Creates or updates Lambda `securepass-streaming-proof` (Node.js 20, handler `index.handler`).
4. Creates or updates a **public** Function URL (`auth-type NONE`, `invoke-mode RESPONSE_STREAM`).
5. Adds resource policies so unauthenticated `curl` can call the URL:
   - `lambda:InvokeFunctionUrl` (with `function-url-auth-type NONE`)
   - `lambda:InvokeFunction` (principal `*`) – required in practice; `InvokeFunctionUrl` alone may return `403 Forbidden` for unauthenticated requests.

It prints the **Function URL** and a sample `curl.exe -N` command.

## Test (acceptance)

Replace `<url>` with the printed Function URL (include trailing path `/` or not, both are fine):

```powershell
curl.exe -N "https://<id>.lambda-url.<region>.on.aws/"
```

**Pass:** Four lines appear with a visible delay between them:

```text
hello
from
lambda
streaming
```

**Fail:** All four lines appear at once after a single pause. That usually means the client is buffering, or the Function URL is not in `RESPONSE_STREAM` mode.

**Note:** Some terminals buffer less than others. Prefer `curl.exe -N` (disable buffering) over bare `curl` aliases.

## How the handler works

- [`index.mjs`](index.mjs) uses the Node managed runtime global `awslambda`.
- The handler is wrapped in `awslambda.streamifyResponse(...)`.
- HTTP metadata (status, `Content-Type`) is set with `awslambda.HttpResponseStream.from(...)`, per the [response streaming tutorial](https://docs.aws.amazon.com/lambda/latest/dg/response-streaming-tutorial.html).

## Cleanup (optional)

When the team no longer needs the proof:

```powershell
$Region = "us-west-2"   # or your region
$FunctionName = "securepass-streaming-proof"
$RoleName = "securepass-streaming-proof-role"

aws lambda delete-function-url-config --function-name $FunctionName --region $Region
aws lambda delete-function --function-name $FunctionName --region $Region
aws iam detach-role-policy --role-name $RoleName --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
aws iam delete-role --role-name $RoleName
```

You may also need to remove resource-policy statements on the function if you recreated permissions by hand. For a full account cleanup, check **IAM** and **CloudWatch** log groups: `/aws/lambda/$FunctionName`.

## Deployment result (fill in after you run `deploy.ps1`)

See [`DEPLOYMENT_RESULT.md`](DEPLOYMENT_RESULT.md) for the last run: whether deploy succeeded, Function URL, and `curl` outcome.

## If credentials are expired (Workshop Studio)

- You can still keep this folder in Git; Person A runs `.\deploy.ps1` after refreshing credentials in the event dashboard.
- Do not block the team on a live URL tonight if the session is expired, document the gap in `DEPLOYMENT_RESULT.md` instead.
