# Recovery Loop — Units of Work

## Overview

Recovery Loop is decomposed into three units of work. Each unit maps to a distinct folder at
the workspace root. Units are built and deployed in dependency order: infrastructure first,
then backend-lambda, then frontend.

**Shared types**: Duplicated per unit (MVP decision) — no shared package overhead.
**Test runner (backend-lambda)**: Vitest + fast-check
**Frontend tests**: Out of scope for MVP

---

## Unit 1: infrastructure

### Description
AWS SAM stack defining all cloud resources for Recovery Loop. This is the foundation unit —
all other units depend on its outputs.

### Business Criticality: High
Without infrastructure, neither the backend nor the frontend can operate.

### Responsibilities
- DynamoDB table `RecoverySessions` (partition key: `sessionId`, TTL: `expiresAt`)
- Lambda function `UnblockAgent` with Function URL (streaming enabled)
- API Gateway HTTP API (health endpoint, auxiliary routes)
- S3 bucket for frontend static assets (private, CloudFront-only OAC policy)
- CloudFront distribution (S3 origin + security headers response policy) with custom domain `recoveryloop.goutham.dev`
- ACM certificate for custom domain (`recoveryloop.goutham.dev`)
- MicroVM image (`recovery-loop-executor`) built from `microvm-image/` (Dockerfile + server.py)
- IAM execution role for Lambda (least-privilege: DynamoDB CRUD + Bedrock InvokeModel + Lambda MicroVM operations)
- CloudWatch Log Group with 90-day retention
- CloudWatch Alarms (Lambda errors, throttles)
- Stack outputs: Function URL, CloudFront domain, DynamoDB table name, MicroVM Image ARN

### Workspace Location
```
recovery-loop/
  infrastructure/
    template.yaml          # SAM template (all AWS resources)
    samconfig.toml         # SAM deploy configuration
  microvm-image/
    Dockerfile             # FROM amazonlinux:2023, installs python3+nodejs+bash
    server.py              # HTTP executor on port 8080
```

### Technology Stack
- AWS SAM (CloudFormation)
- AWS services: Lambda, Lambda MicroVMs, DynamoDB, API Gateway HTTP API, S3, CloudFront, IAM, CloudWatch, ACM

### Definition of Done
- `sam build` completes without errors
- `sam deploy` provisions all resources in us-east-1
- Stack outputs include Function URL, CloudFront domain, table name
- CloudWatch alarms are active
- MicroVM image `recovery-loop-executor` is built and available
- Custom domain `recoveryloop.goutham.dev` resolves to CloudFront

---

## Unit 2: backend-lambda

### Description
TypeScript Lambda function implementing the full agentic unblocking workflow. Single entry
point (`handler.ts`) coordinating five focused modules.

### Business Criticality: Critical
This is the core value-delivery component — without it the tool does nothing.

### Responsibilities
- Accept and validate incoming requests (InputValidator)
- Load/save DynamoDB session state (SessionService)
- Build Bedrock Converse API message arrays (PromptBuilder)
- Invoke Amazon Bedrock Nova Lite (BedrockService)
- Execute scripts in ephemeral Lambda MicroVM (SandboxService)
- Orchestrate the agentic retry loop (UnblockAgentHandler)
- Emit typed SSE events throughout the workflow
- Structured JSON logging (Logger)
- Unit tests + PBT for pure function modules (Vitest + fast-check)

### Workspace Location
```
recovery-loop/
  backend-lambda/
    src/
      handler.ts           # Lambda entry point + agentic loop orchestration
      session.ts           # SessionService — DynamoDB reads/writes
      prompt.ts            # PromptBuilder — pure Converse API message construction
      bedrock.ts           # BedrockService — Bedrock Converse API invocation
      sandbox.ts           # SandboxService — Lambda MicroVM ephemeral execution
      validator.ts         # InputValidator — pure request validation/sanitization
      logger.ts            # Logger — structured JSON logging
      types.ts             # Local TypeScript types (duplicated from frontend where shared)
    tests/
      prompt.test.ts       # PromptBuilder unit + PBT tests (fast-check)
      validator.test.ts    # InputValidator unit + PBT tests (fast-check)
      session.test.ts      # SessionService unit tests (mocked AWS SDK)
      bedrock.test.ts      # BedrockService unit tests (mocked AWS SDK)
      sandbox.test.ts      # SandboxService unit tests (mocked Lambda MicroVMs SDK)
      handler.test.ts      # Integration-style handler tests (all deps mocked)
    package.json
    tsconfig.json
    vitest.config.ts
    .env.example
```

### Technology Stack
- Node.js 22, TypeScript 5
- AWS SDK v3 (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-bedrock-runtime`, `@aws-sdk/client-lambda-microvms`)
- Vitest (test runner), fast-check (PBT)
- `uuid` (session ID generation)

### Definition of Done
- All source modules compile without TypeScript errors
- All unit tests pass (`vitest run`)
- PBT tests pass for PromptBuilder and InputValidator
- Lambda deploys via `sam build && sam deploy` and responds to test invocations
- SSE stream emits correct typed events for happy path and retry scenarios

---

## Unit 3: frontend

### Description
Svelte 4 + Vite single-page application. Split-screen developer tool UI with real-time
SSE streaming output.

### Business Criticality: High
The primary user interface. Without it, the tool has no usable surface.

### Responsibilities
- Split-screen layout (LeftPane: input form, RightPane: terminal output)
- Session resumption via `sessionId` text input
- SSE stream connection to Lambda Function URL
- Real-time terminal-style output rendering (color-coded by event type)
- Display and copy of current `sessionId`
- Build output deployable to S3 via `aws s3 sync`

### Workspace Location
```
recovery-loop/
  frontend/
    src/
      App.svelte           # Root component + global state
      lib/
        LeftPane.svelte    # Input form component
        RightPane.svelte   # Terminal output component
        api.ts             # ApiClient — fetch + EventSource wrapper
        types.ts           # Local TypeScript types (duplicated)
    index.html
    vite.config.ts
    tsconfig.json
    package.json
    .env.example           # VITE_API_URL=<Lambda Function URL>
    .env.local             # (gitignored) local dev overrides
```

### Technology Stack
- Svelte 4, Vite 5, TypeScript 5
- Browser APIs: `fetch`, `EventSource`
- No frontend testing framework (MVP scope)

### Definition of Done
- `npm run build` produces `dist/` output without errors
- App renders split-screen layout in browser
- Recover button submits and streams SSE events to the terminal pane
- Session ID is displayed and copyable
- Resume Session input pre-populates on form re-use
- `dist/` contents sync to S3 bucket and render via CloudFront

---

## Workspace Root Structure

```
recovery-loop/                     # Workspace root
  infrastructure/
    template.yaml
    samconfig.toml
  microvm-image/
    Dockerfile
    server.py
  backend-lambda/
    src/
      handler.ts
      session.ts
      prompt.ts
      bedrock.ts
      sandbox.ts
      validator.ts
      logger.ts
      types.ts
    tests/
      prompt.test.ts
      validator.test.ts
      session.test.ts
      bedrock.test.ts
      sandbox.test.ts
      handler.test.ts
    package.json
    tsconfig.json
    vitest.config.ts
    .env.example
  frontend/
    src/
      App.svelte
      lib/
        LeftPane.svelte
        RightPane.svelte
        api.ts
        types.ts
    index.html
    vite.config.ts
    tsconfig.json
    package.json
    .env.example
  README.md
  .gitignore
  aidlc-docs/                      # AI-DLC documentation only (never application code)
```
