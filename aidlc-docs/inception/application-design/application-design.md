# Recovery Loop — Application Design Summary

## Architecture Overview

Recovery Loop is a stateful AI unblocking tool with three deployment units:

- **Unit 1: Infrastructure** — AWS SAM stack (DynamoDB, Lambda Function URL, S3, CloudFront, IAM, CloudWatch)
- **Unit 2: Backend Lambda** — TypeScript Lambda (`UnblockAgent`) with 6 focused modules
- **Unit 3: Frontend** — Svelte 4 + Vite SPA served via CloudFront

The key architectural decisions made in Application Design:

| Decision | Choice | Rationale |
|---|---|---|
| Lambda streaming | Single Lambda + Function URL | Native response streaming support for SSE |
| Session concurrency | Last-write-wins | Single developer per session; no concurrent access expected |
| Bedrock API | Converse API | Model-agnostic; easier to swap models; supports ConverseStream |
| SSE event format | Typed JSON envelope `{type, payload}` | Frontend can route and style each event type independently |
| Sandbox lifecycle | Ephemeral MicroVM per request | Simpler; no sandbox state leak; terminate immediately after execution |
| Frontend API client | Thin wrapper | MVP; no SSE reconnect complexity needed |

---

## Component Summary

### Unit 1: Infrastructure

| Component | Technology | Purpose |
|---|---|---|
| SAM Stack | AWS SAM, CloudFormation | All AWS resource definitions |

### Unit 2: Backend Lambda

| Component | Technology | Purpose |
|---|---|---|
| UnblockAgentHandler | TypeScript, Node.js 22 | Request orchestration, agentic retry loop, SSE emission |
| SessionService | TypeScript, AWS SDK v3 DynamoDB | Load/save DynamoDB session records |
| PromptBuilder | TypeScript (pure) | Build Converse API message arrays |
| BedrockService | TypeScript, AWS SDK v3 Bedrock Runtime | Invoke Nova Lite Converse API |
| SandboxService | TypeScript, AWS SDK v3 Lambda MicroVMs | Execute scripts in ephemeral Lambda MicroVM |
| InputValidator | TypeScript (pure) | Validate and sanitize request parameters |
| Logger | TypeScript | Structured JSON logging to stdout/CloudWatch |

### Unit 3: Frontend

| Component | Technology | Purpose |
|---|---|---|
| App | Svelte 4, TypeScript | Root component, global state, layout |
| LeftPane | Svelte 4, TypeScript | Input form (codeContext, userPrompt, sessionId, Recover button) |
| RightPane | Svelte 4, TypeScript | Terminal-style SSE output panel |
| ApiClient | TypeScript, fetch, EventSource | POST + SSE connection to Lambda Function URL |

---

## Service Orchestration (UnblockAgentService)

The Lambda orchestrates a sequential agentic loop:

1. Validate request (InputValidator)
2. Load/create session (SessionService)
3. LOOP (max 3 attempts = 1 initial + 2 retries):
   a. Build Converse API messages (PromptBuilder)
   b. Invoke Nova Lite (BedrockService) → script text
   c. Execute in Lambda MicroVM sandbox (SandboxService) → result
   d. If success → break; if failure → append error context, retry
4. Save session state (SessionService)
5. Emit final SSE event, close stream

---

## SSE Event Types

| Event Type | Emitted When | Payload |
|---|---|---|
| `session_start` | Request validated, sessionId known | sessionId string |
| `bedrock_start` | About to invoke Bedrock | Status message |
| `script_generated` | Script received from Bedrock | Raw script text |
| `sandbox_start` | About to execute in MicroVM | Status message |
| `stdout` | Script produced stdout | stdout chunk |
| `stderr` | Script produced stderr | stderr chunk |
| `retry` | Execution failed, retrying | Attempt number + reason |
| `final` | Workflow complete | `{status, sessionId, retryCount, executionTimeMs}` |
| `error` | Unrecoverable error | Generic error message (no internal details) |

---

## Cross-Cutting Concerns

- **Security**: All secrets via IAM roles; least-privilege IAM; input validation on every request; HTTP security headers on CloudFront; CORS restricted to CloudFront origin; custom domain with ACM certificate
- **Observability**: Structured JSON logs (Logger) → CloudWatch; API GW access logs; CloudWatch alarms on Lambda error rate and throttles
- **Resiliency**: Explicit 25s Bedrock timeout; explicit 30s MicroVM timeout; agentic retry loop (up to 2); global error handler; ephemeral MicroVM teardown on every path
- **PBT**: PromptBuilder and InputValidator are pure functions — fast-check property tests for round-trip and invariant properties

---

## Artifact Index

| File | Contents |
|---|---|
| `components.md` | Component definitions, responsibilities, technology |
| `component-methods.md` | Method signatures and TypeScript interfaces |
| `services.md` | Service layer design, orchestration workflow, SSE sequence diagrams |
| `component-dependency.md` | Dependency matrix, data flow, external services, unit deployment order |
| `application-design.md` | This consolidated summary |
