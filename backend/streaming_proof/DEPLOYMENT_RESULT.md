# Lambda streaming proof – deployment log

| Field | Value |
|--------|--------|
| Date (UTC) | 2026-04-25 (deploy verified same session) |
| Region | us-west-2 |
| Deploy script | `.\deploy.ps1` in `backend/streaming_proof` |
| Outcome | **Success** (after adding `lambda:InvokeFunction` – see below) |

## Function URL

`https://a25vj4gp6hd5t6nnslj4k4jpsa0rkoau.lambda-url.us-west-2.on.aws/`

(Invoke mode: `RESPONSE_STREAM`, auth: `NONE`)

## curl test

Command:

```text
curl.exe -N "https://a25vj4gp6hd5t6nnslj4k4jpsa0rkoau.lambda-url.us-west-2.on.aws/"
```

**First attempt:** `403 Forbidden` with only this resource policy statement:

- `lambda:InvokeFunctionUrl` for `*`, `function-url-auth-type NONE`

**Second attempt (pass):** After adding a second statement:

- `lambda:InvokeFunction` for `*`

`curl.exe -N` then received the four lines incrementally (visible interleaved with curl’s progress output):

```text
hello
from
lambda
streaming
```

- [x] Pass: four lines; streaming / chunked behavior visible
- [ ] Not run (offline / no AWS)

## Caveats for Person A (Phase 5)

- **Two resource policies** may be required for a **public** Function URL: `lambda:InvokeFunctionUrl` and `lambda:InvokeFunction`. The deploy script now adds both; the AWS “hello streaming” sample sometimes only shows `InvokeFunctionUrl`, which was not enough for unauthenticated `curl` in this account.
- This proof is **Node.js** + `awslambda.streamifyResponse` + `HttpResponseStream`. The production tutor in **Python** will use the [Python response-streaming API](https://docs.aws.amazon.com/lambda/latest/dg/config-rs-write-functions.html) with the same Function URL `RESPONSE_STREAM` mode.
- **API Gateway** is not the right tool for progressive streaming to the browser for this pattern; keep **Function URL** for the live demo path unless you have confirmed streaming on another front.
- Re-fetch **Workshop Studio** credentials before the hack day; they expire in hours.
- **Cleanup** when done: see [README.md](README.md#cleanup-optional) (delete function URL, function, and IAM role).
