# Recovery Loop

A stateful AI unblocking tool that helps developers recover from broken scripts, failing commands, or blocked implementation tasks. Runs risky execution steps inside an isolated AWS Lambda MicroVM, preserves session state in DynamoDB, and lets you resume work without losing context.

**Live at**: [https://recoveryloop.goutham.dev](https://recoveryloop.goutham.dev)

## Architecture

```
Browser → CloudFront (recoveryloop.goutham.dev, ACM cert)
                ↓ SSE POST
       Lambda Function URL (RESPONSE_STREAM)
                ↓
       UnblockAgent Lambda (nodejs22.x)
         ├── DynamoDB (session state, 24hr TTL)
         ├── Amazon Bedrock Nova 2 Lite (code generation)
         └── AWS Lambda MicroVMs (sandbox execution)
```

## Project Structure

```
recovery-loop/
  infrastructure/       # AWS SAM template + deploy config
  microvm-image/        # Dockerfile + server.py for MicroVM executor
  backend-lambda/       # TypeScript Lambda (handler + 6 modules)
  frontend/             # Svelte 4 + Vite SPA
  README.md
```

## Prerequisites

- Node.js 22+
- AWS SAM CLI >= 1.100.0
- AWS CLI v2 (configured with us-east-1 credentials)

## Local Frontend Development

```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with your Lambda Function URL
npm run dev
# Opens at http://localhost:5173
```

## Backend Deployment

### 1. Deploy infrastructure + backend

```bash
# From workspace root
cd infrastructure
sam build
sam deploy --guided
# Follow prompts — stack name: recovery-loop, region: us-east-1
```

### 2. Enable Amazon Nova 2 Lite in Bedrock

Go to the [Amazon Bedrock console](https://console.aws.amazon.com/bedrock/) → Model access → Enable `us.amazon.nova-2-lite-v1:0` (cross-region inference profile).

### 3. Note the stack outputs

After `sam deploy` completes, note:
- **FunctionUrl** — Lambda Function URL for the frontend
- **FrontendBucketName** — S3 bucket for frontend assets
- **CloudFrontDomain** — `djvdymyhnpiw0.cloudfront.net`
- **CustomDomain** — `recoveryloop.goutham.dev`

### 4. DNS Configuration

A CNAME record pointing `recoveryloop.goutham.dev` → `djvdymyhnpiw0.cloudfront.net` is configured in Cloudflare DNS.

## Frontend Deployment

```bash
cd frontend
npm install
VITE_API_URL=<FunctionUrl from stack output> npm run build
aws s3 sync dist/ s3://<FrontendBucketName>/ --delete
aws cloudfront create-invalidation --distribution-id <DistId> --paths "/*"
```

## Running Backend Tests

```bash
cd backend-lambda
npm install
npm test
```

Tests use Vitest + fast-check for property-based testing on pure function modules.

## API Contract

### POST to Lambda Function URL

**Request:**
```json
{
  "sessionId": "optional-uuid-v4",
  "userPrompt": "My npm install fails with EACCES",
  "codeContext": "$ npm install -g typescript\nnpm ERR! EACCES..."
}
```

**Response:** Server-Sent Events stream with typed JSON envelopes:
```
data: {"type":"session_start","payload":"uuid-v4"}
data: {"type":"bedrock_start","payload":"Invoking Nova 2 Lite..."}
data: {"type":"script_generated","payload":"#!/bin/bash\nnpm config set..."}
data: {"type":"sandbox_start","payload":"Executing script in MicroVM..."}
data: {"type":"stdout","payload":"Global prefix set"}
data: {"type":"final","payload":"success","metadata":{"sessionId":"...","retryCount":0,"executionTimeMs":3200}}
```

## Environment Variables

### Backend (Lambda)
| Variable | Default | Description |
|---|---|---|
| `RECOVERY_SESSIONS_TABLE` | RecoverySessions | DynamoDB table name |
| `BEDROCK_MODEL_ID` | us.amazon.nova-2-lite-v1:0 | Bedrock model ID (cross-region inference profile) |
| `MICROVM_IMAGE_ARN` | arn:aws:lambda:us-east-1:<YOUR_ACCOUNT_ID>:microvm-image:recovery-loop-executor | Lambda MicroVM image for sandbox |
| `MAX_RETRIES` | 2 | Agentic retry attempts |
| `SANDBOX_TIMEOUT_MS` | 30000 | MicroVM execution timeout |
| `BEDROCK_TIMEOUT_MS` | 25000 | Bedrock invocation timeout |

### Frontend (Vite)
| Variable | Description |
|---|---|
| `VITE_API_URL` | Lambda Function URL |

## Kiro Hooks

This project uses [Kiro IDE hooks](https://kiro.dev) to automate developer workflows.

### Breaking Change Sentinel

**Trigger:** Any edit to source files in `backend-lambda/src/`, `backend-lambda/tests/`, `frontend/src/`, `infrastructure/`, or `microvm-image/server.py`

**What it does:** Automatically analyzes the git diff when you save a file and produces a markdown report covering:

- Public function signature changes (params added/removed/reordered, return type changes)
- Renamed, removed, or newly required props (component prop changes that break callers)
- API route changes (path, method, request/response shape)
- Exported symbol changes (renamed/removed exports, changed types)
- Changed return shapes (different keys, nullable changes)
- Behavior changes (logic changes affecting tests, docs, or usage)

**Output:** A concise risk report with sections for Change Detected, Possible Impact, Suggested Follow-up, and Risk Level.

**Files:**
- `.kiro/hooks/breaking-change-sentinel.kiro.hook` — hook configuration
- `.kiro/hooks/breaking-change-sentinel-prompt.md` — detailed prompt instructions

## Assumptions and Notes

- API is public (no auth) for MVP — add API key auth before sharing externally
- Sessions expire after 24 hours (DynamoDB TTL)
- Only the most recent exchange is stored per session
- Lambda MicroVMs are ephemeral (created and terminated per request)
- Custom domain `recoveryloop.goutham.dev` served via CloudFront with ACM certificate
- MicroVM image is based on amazonlinux:2023 with python3, nodejs, and bash pre-installed
