# Recovery Loop — Requirements Document

## Intent Analysis Summary

- **User Request**: Build a stateful AI unblocking tool that helps developers recover from broken scripts, failing commands, or blocked implementation tasks
- **Request Type**: New Project (Greenfield)
- **Scope Estimate**: Multiple Components (frontend SPA, backend Lambda, DynamoDB, Bedrock, Lambda MicroVM sandbox, S3+CloudFront)
- **Complexity Estimate**: Complex — multi-service, cloud-native, agentic retry loop, streaming output
- **Deployment Region**: AWS us-east-1

---

## Extension Configuration

| Extension | Enabled | Mode | Decided At |
|---|---|---|---|
| Security Baseline | Yes | Full enforcement (blocking) | Requirements Analysis |
| Resiliency Baseline | Yes | Directional best practices (blocking) | Requirements Analysis |
| Property-Based Testing | Yes | Partial (pure functions + serialization only) | Requirements Analysis |

---

## Functional Requirements

### FR-01: Session Management
- The system SHALL accept a `sessionId`, `userPrompt`, and `codeContext` on each API call
- If `sessionId` already exists in DynamoDB, the system SHALL load the prior session state before invoking Bedrock
- If `sessionId` does not exist, the system SHALL create a new session record in DynamoDB
- The frontend SHALL provide a "Resume Session" text input field allowing users to enter a prior `sessionId`
- DynamoDB session records SHALL expire automatically after **24 hours** using a TTL attribute
- Each session record SHALL store only the **most recent exchange** (latest prompt, generated script, execution result) — overwriting on each call

### FR-02: LLM Integration (Amazon Bedrock — Nova Lite)
- The Lambda SHALL invoke **Amazon Nova Lite** via Amazon Bedrock to generate the recovery script
- The Lambda SHALL construct a Bedrock prompt using the following persona:
  > *"You are an Unblocking Agent. Analyze the issue, generate a safe bash or Python script to fix it, and output only the raw code to be executed."*
- The prompt SHALL include: session context (if resuming), `userPrompt`, and `codeContext`
- The Bedrock model ARN/ID SHALL be configurable via an environment variable (`BEDROCK_MODEL_ID`)

### FR-03: Agentic Retry Loop
- After receiving the generated script from Bedrock, the Lambda SHALL execute it in a Lambda MicroVM sandbox
- If execution fails (non-zero exit code or timeout), the Lambda SHALL automatically feed the error (stderr + exit code) back to Bedrock for a corrected script attempt
- The agentic retry loop SHALL attempt **up to 2 retries** before returning a final failure response
- Each retry attempt SHALL be tracked and included in the response payload

### FR-04: Lambda MicroVM Sandbox Execution
- The Lambda SHALL use **AWS Lambda MicroVMs** (`@aws-sdk/client-lambda-microvms`) to execute the generated script in an isolated sandbox
- The execution flow SHALL be: `RunMicrovm` → `CreateMicrovmAuthToken` → `POST /execute` to the MicroVM endpoint → `TerminateMicrovm`
- The sandbox SHALL support both **Python** and **Bash/Shell** scripts — the LLM decides which language to generate based on the user's context
- Each execution SHALL have a hard timeout of **30 seconds**
- The Lambda SHALL capture both `stdout` and `stderr` from the MicroVM execution
- Execution result SHALL be classified as `success` (exit code 0) or `failure` (non-zero exit code or timeout)
- The MicroVM image ARN SHALL be provided via the `MICROVM_IMAGE_ARN` environment variable
- A MicroVM image (`recovery-loop-executor`) SHALL be built from a Dockerfile + server.py in the `microvm-image/` directory

### FR-05: Frontend — Split-Screen Layout
- The frontend SHALL be a **Svelte + Vite** single-page application
- Left pane SHALL contain:
  - A textarea for the user to enter broken code, error messages, or a blocked goal (`codeContext`)
  - A text input field for the user's description of what they want to fix (`userPrompt`)
  - A "Resume Session" text input for entering an existing `sessionId`
  - A **Recover** button to submit the session payload
- Right pane SHALL contain:
  - A read-only, terminal-style output panel
  - Display of AI reasoning progress, execution steps, stdout, stderr, and final result
  - The current `sessionId` SHALL be displayed so users can copy it for future resumption

### FR-06: Streaming Output (SSE)
- The backend SHALL support **Server-Sent Events (SSE)** to stream execution progress to the frontend
- The frontend SHALL consume the SSE stream and update the terminal-style output panel token-by-token / event-by-event
- The stream SHALL emit discrete events for: Bedrock invocation start, script generated, sandbox execution start, stdout/stderr chunks, retry attempts, and final result

### FR-07: Backend Lambda Structure
- The Lambda handler SHALL be implemented in **TypeScript**
- Concerns SHALL be separated into dedicated functions/modules:
  - `session.ts` — session loading and persistence (DynamoDB)
  - `prompt.ts` — Bedrock prompt construction
  - `bedrock.ts` — Bedrock invocation
  - `sandbox.ts` — Lambda MicroVM sandbox execution
  - `handler.ts` — orchestration / Lambda entry point
- The Lambda SHALL return a **structured JSON response** to the frontend (or stream via SSE)

### FR-08: Infrastructure
- Infrastructure SHALL be defined using **AWS SAM** (`template.yaml`)
- The following resources SHALL be provisioned:
  - DynamoDB table named `RecoverySessions` (partition key: `sessionId` string)
  - API Gateway endpoint (HTTP API or REST API)
  - Lambda function named `UnblockAgent` (runtime: `nodejs22.x`)
  - S3 bucket for frontend static assets
  - CloudFront distribution fronting the S3 bucket with custom domain `recoveryloop.goutham.dev`
  - ACM certificate for `recoveryloop.goutham.dev`
  - MicroVM image (`recovery-loop-executor`) built from `microvm-image/` directory (Dockerfile + server.py)
- Lambda environment variables SHALL include:
  - `MICROVM_IMAGE_ARN`
  - `RECOVERY_SESSIONS_TABLE`
  - `BEDROCK_MODEL_ID`
- Lambda IAM role SHALL grant minimum necessary permissions:
  - `bedrock:InvokeModel` on the configured model ARN
  - `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:UpdateItem` on `RecoverySessions`
  - `lambda:RunMicrovm`, `lambda:CreateMicrovmAuthToken`, `lambda:TerminateMicrovm`, `lambda:GetMicrovm`, `lambda:PassNetworkConnector` on the MicroVM image
  - No wildcard resource policies

### FR-09: API Contract

**Request (POST /sessions)**:
```json
{
  "sessionId": "optional-existing-session-id",
  "userPrompt": "My npm install command fails with EACCES error",
  "codeContext": "$ npm install -g typescript\nnpm ERR! Error: EACCES: permission denied..."
}
```

**Response**:
```json
{
  "sessionId": "uuid-v4",
  "status": "success" | "failure",
  "generatedScript": "#!/bin/bash\nnpm config set prefix ~/.npm-global...",
  "stdout": "...",
  "stderr": "",
  "retryCount": 0,
  "executionTimeMs": 1240,
  "message": "Script executed successfully"
}
```

---

## Non-Functional Requirements

### NFR-01: Performance
- Lambda cold start SHALL be minimized (target < 2 seconds with provisioned concurrency optional)
- MicroVM sandbox execution SHALL complete within 30 seconds (hard timeout)
- End-to-end response (from Recover button click to final result) SHOULD complete within 45 seconds for typical scripts

### NFR-02: Security
- API Gateway endpoint is public (no auth) for the MVP — rate limiting SHALL be configured
- DynamoDB encryption at rest SHALL be enabled
- All traffic between components SHALL use TLS 1.2+
- Lambda role SHALL follow least-privilege (no wildcard actions or resources)
- Lambda IAM role SHALL include MicroVM permissions: `lambda:RunMicrovm`, `lambda:CreateMicrovmAuthToken`, `lambda:TerminateMicrovm`, `lambda:GetMicrovm`, `lambda:PassNetworkConnector`
- CORS on API Gateway SHALL be restricted to the CloudFront distribution origin
- HTTP security headers SHALL be set on CloudFront responses (CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- CloudFront SHALL serve at custom domain `recoveryloop.goutham.dev` with an ACM certificate
- Input validation SHALL be enforced on all API parameters (type, length, sanitization)
- Error responses SHALL not expose internal stack traces, paths, or system details

### NFR-03: Scalability
- DynamoDB SHALL use on-demand billing mode (PAY_PER_REQUEST) to scale automatically
- Lambda concurrency is not explicitly reserved (account-level quota applies)

### NFR-04: Observability
- Lambda SHALL emit structured JSON logs to CloudWatch Logs (with timestamp, requestId, level, message)
- CloudWatch Log Group retention SHALL be set to **90 days minimum**
- API Gateway access logging SHALL be enabled
- CloudWatch alarms SHALL be configured for Lambda error rate and throttle metrics

### NFR-05: Reliability
- Lambda SHALL implement explicit error handling for all external calls (DynamoDB, Bedrock, Lambda MicroVMs)
- A global error handler SHALL catch unhandled exceptions and return a safe, generic error response
- The agentic retry loop (up to 2 retries) provides basic self-healing for transient MicroVM/Bedrock failures

### NFR-06: Availability Targets (MVP)
- Target SLA: **99.5%** (single-region, multi-AZ via serverless architecture)
- RTO: Hours (Backup & Restore — acceptable for MVP developer tool)
- RPO: 24 hours (DynamoDB TTL-based, session data is ephemeral by design)
- DR Strategy: Backup & Restore — lowest cost, appropriate for an MVP developer tool with ephemeral sessions

### NFR-07: Deployment
- Infrastructure MUST be deployable via `sam build && sam deploy`
- Frontend MUST be deployable via `npm run build` + S3 sync
- All dependency versions MUST be pinned in lock files (`package-lock.json`)

### NFR-08: Developer Experience
- README SHALL include local dev instructions for the Vite app
- README SHALL include backend deployment instructions using `sam build` and `sam deploy`
- Local development SHALL support a `.env` file for environment variables

---

## Resiliency Questions (RESILIENCY-02, RESILIENCY-03, RESILIENCY-04, RESILIENCY-08)

The following resiliency decisions have been captured based on requirements analysis and the MVP scope:

| Decision | Value | Rationale |
|---|---|---|
| RTO/RPO Strategy | Backup & Restore (Option A) | MVP developer tool with ephemeral 24hr sessions; lowest cost appropriate |
| Regional Topology | Single-region multi-zone (Option A) | Serverless (Lambda, API GW, DynamoDB) is inherently multi-AZ; no cross-region DR needed for MVP |
| Change Management | N/A / Exempt (MVP) | Internal developer tool; exempt from formal change management for MVP |
| CI/CD Tooling | Proposed by AI-DLC | No existing pipeline referenced; SAM build/deploy documented in README |
| Rollback Mechanism | Redeploy previous IaC artifact version (Option A) | SAM version-pinned rollback via CloudFormation |
| Deployment Style | Direct / in-place (Option A) | MVP; low blast radius for a developer tool |
| Incident Response | No formal process — propose lightweight (Option B) | MVP; no existing org process referenced |
| Resiliency Testing | Defer to Operations (Option C) | Capture scenarios now, execute post-MVP |

---

## Assumptions and Tradeoffs

1. **No auth for MVP**: The API is public. This is acceptable for an internal developer tool but MUST be revisited before any production/shared deployment. Rate limiting on API Gateway mitigates abuse risk.
2. **Single-region**: Serverless services (Lambda, DynamoDB, API GW) are inherently multi-AZ within us-east-1, providing zone-level resilience without explicit multi-region configuration.
3. **Session data is ephemeral**: Storing only the most recent exchange and expiring after 24 hours keeps DynamoDB item sizes bounded and aligns with the "unblocking tool" use case where historical context is less important than the current task.
4. **SSE streaming**: Requires API Gateway HTTP API (not REST API) or a Lambda Function URL for proper streaming support. The SAM template will use Lambda Function URL with CORS for streaming, and API Gateway for standard invocations. This will be clarified in infrastructure design.
5. **Lambda MicroVMs**: Sandbox execution uses AWS Lambda MicroVMs instead of E2B. No external API key or Secrets Manager dependency for sandbox execution.
6. **Nova 2 Lite model availability**: Amazon Nova 2 Lite (`us.amazon.nova-2-lite-v1:0`, cross-region inference profile) must be enabled in the Bedrock console before deployment.
7. **Property-Based Testing (Partial mode)**: PBT applied only to pure functions (prompt construction, response parsing, session serialization) and serialization round-trips. Not applied to I/O-bound Lambda handler paths.
