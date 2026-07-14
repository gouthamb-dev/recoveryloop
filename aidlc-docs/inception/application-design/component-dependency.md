# Recovery Loop — Component Dependencies

## Dependency Matrix

| Component | Depends On | Communication | Notes |
|---|---|---|---|
| UnblockAgentHandler | SessionService, PromptBuilder, BedrockService, SandboxService, InputValidator, Logger | Direct in-process function calls | Orchestrator; owns the retry loop |
| SessionService | AWS SDK v3 DynamoDB | AWS SDK HTTP | Read/write to `RecoverySessions` table |
| PromptBuilder | (none) | Pure functions | No external dependencies; PBT applicable |
| BedrockService | AWS SDK v3 Bedrock Runtime, Logger | AWS SDK HTTP | Invokes Nova Lite Converse API |
| SandboxService | AWS SDK v3 Lambda MicroVMs, Logger | AWS SDK HTTP / MicroVM HTTP | Ephemeral MicroVM per request |
| InputValidator | (none) | Pure functions | No external dependencies; PBT applicable |
| Logger | (none) | stdout | Writes structured JSON to stdout → CloudWatch |
| App (Svelte) | LeftPane, RightPane, ApiClient | Svelte props/events | Owns all reactive state |
| LeftPane | (none) | Svelte events (dispatches submit) | Emits submit event to App |
| RightPane | (none) | Svelte props (receives outputLines) | Renders output lines reactively |
| ApiClient | Browser fetch, Browser EventSource | HTTP / SSE | Calls Lambda Function URL |

---

## Dependency Graph (Text)

```
Browser
  |
  +-- App.svelte
        |-- LeftPane.svelte  (emits: submit)
        |-- RightPane.svelte (receives: outputLines, sessionId, isLoading)
        |-- ApiClient.ts     (calls: Lambda Function URL via EventSource/fetch)

Internet / AWS
  |
  +-- Lambda Function URL (HTTPS)
        |
        +-- UnblockAgentHandler (handler.ts)
              |
              |-- InputValidator (pure — no I/O)
              |-- Logger (stdout)
              |
              |-- SessionService
              |     |-- DynamoDB (RecoverySessions table)
              |
              |-- PromptBuilder (pure — no I/O)
              |
              |-- BedrockService
              |     |-- Amazon Bedrock (Nova Lite, Converse API)
              |
              |-- SandboxService
                    |-- AWS Lambda MicroVMs (ephemeral execution)

CloudFront (recoveryloop.goutham.dev)
  |
  +-- S3 Bucket (frontend static assets: index.html, JS, CSS)
```

---

## Data Flow

### Request Path (SSE stream)

```
1. User clicks Recover
2. App calls ApiClient.submitSession({ sessionId?, userPrompt, codeContext })
3. ApiClient POSTs to Lambda Function URL
4. Lambda validates request (InputValidator)
5. Lambda loads session (SessionService → DynamoDB GetItem)
6. Lambda builds messages (PromptBuilder)
7. Lambda invokes Bedrock (BedrockService → Bedrock Converse API)
8. Lambda executes script (SandboxService → Lambda MicroVM)
9. If failure and retries remain: loop back to step 6 with error context
10. Lambda saves session (SessionService → DynamoDB PutItem)
11. Lambda emits final SSE event and closes stream
12. ApiClient calls onComplete(sessionId)
13. App updates UI state (RightPane re-renders)
```

### Session State Flow

```
DynamoDB RecoverySessions
  PK: sessionId (String, UUID v4)
  Attributes:
    - lastPrompt (String)
    - lastScript (String)
    - lastResult (Map: { status, stdout, stderr, exitCode })
    - lastUpdatedAt (String, ISO 8601)
    - expiresAt (Number, Unix epoch TTL)
```

---

## External Service Dependencies

| External Service | Used By | Protocol | Auth |
|---|---|---|---|
| Amazon DynamoDB | SessionService | AWS SDK (HTTPS) | Lambda IAM role |
| Amazon Bedrock (Nova 2 Lite) | BedrockService | AWS SDK (HTTPS) | Lambda IAM role |
| AWS Lambda MicroVMs | SandboxService | AWS SDK (HTTPS) + MicroVM HTTP | Lambda IAM role |
| Lambda Function URL | ApiClient (browser) | HTTPS / SSE | No auth (public for MVP) |
| CloudFront | Browser | HTTPS | No auth (public static site) |

---

## Unit-Level Deployment Dependencies

```
Unit 1: Infrastructure (SAM Stack)
  MUST deploy before Unit 2 (exports: Function URL, DynamoDB table name, MicroVM Image ARN)

Unit 2: Backend Lambda
  DEPENDS ON Unit 1 (reads: RECOVERY_SESSIONS_TABLE env var, MICROVM_IMAGE_ARN env var)
  MUST deploy before Unit 3 (exports: Function URL for frontend VITE_API_URL)

Unit 3: Frontend Svelte App
  DEPENDS ON Unit 2 (reads: VITE_API_URL = Lambda Function URL)
  Build output synced to S3 bucket from Unit 1
```

---

## Coupling Assessment

| Coupling Point | Type | Risk | Mitigation |
|---|---|---|---|
| Handler → SessionService | Direct in-process | Low | Module boundary; easily mockable |
| Handler → BedrockService | Direct in-process | Low | Module boundary; timeout configured |
| Handler → SandboxService | Direct in-process | Medium | Lambda MicroVM; timeout + retry loop |
| SandboxService → Lambda MicroVMs | AWS SDK + HTTP (external) | Medium | Ephemeral MicroVM; 30s timeout; error typed |
| BedrockService → Bedrock | AWS SDK (external) | Medium | 25s timeout; retry loop catches throttles |
| SessionService → DynamoDB | AWS SDK (external) | Low | Managed service; multi-AZ by default |
| ApiClient → Function URL | HTTP/SSE | Low | Simple protocol; thin wrapper |
