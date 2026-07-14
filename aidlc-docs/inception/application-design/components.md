# Recovery Loop — Component Definitions

## Component Overview

Recovery Loop is composed of eight logical components across three deployment units:
Infrastructure, Backend Lambda, and Frontend SPA.

---

## UNIT 1: Infrastructure

### Component: SAM Stack (InfrastructureStack)

**Purpose**: Defines and provisions all AWS resources for the Recovery Loop application.

**Responsibilities**:
- Define DynamoDB table `RecoverySessions` with TTL, encryption, and on-demand billing
- Define Lambda Function URL for SSE streaming (UnblockAgent)
- Define API Gateway HTTP API for health/auxiliary endpoints
- Define S3 bucket for frontend static assets (private, CloudFront-only access)
- Define CloudFront distribution with security headers policy and S3 origin
- Define IAM role for UnblockAgent Lambda with least-privilege policies
- Define CloudWatch Log Groups with 90-day retention
- Define CloudWatch Alarms for Lambda error rate and throttles
- Export stack outputs (Function URL, CloudFront domain, DynamoDB table name)

**Technology**: AWS SAM (`template.yaml`), CloudFormation

---

## UNIT 2: Backend Lambda

### Component: UnblockAgentHandler

**Purpose**: Lambda entry point. Orchestrates the full agentic unblocking workflow for a single request.

**Responsibilities**:
- Parse and validate the incoming request payload (`sessionId`, `userPrompt`, `codeContext`)
- Initialize the SSE response stream via Lambda Function URL streaming
- Delegate to SessionService, BedrockService, SandboxService in sequence
- Manage the agentic retry loop (up to 2 retries on execution failure)
- Emit typed SSE events at each workflow step
- Persist final session state via SessionService
- Catch all unhandled errors and emit a safe error event before closing the stream
- Log all significant events with structured JSON (requestId, timestamp, level, message)

**Technology**: TypeScript, Node.js 22, AWS Lambda (streaming response mode)

---

### Component: SessionService

**Purpose**: All DynamoDB session state operations. Pure I/O module — no business logic.

**Responsibilities**:
- Load an existing session record by `sessionId` from DynamoDB
- Create a new session record when no `sessionId` is provided (generate UUID v4)
- Persist the most recent exchange (overwrite `lastPrompt`, `lastScript`, `lastResult`, `lastUpdatedAt`)
- Set TTL attribute (`expiresAt`) to `now + 24 hours` on every write
- Throw typed errors on DynamoDB failures (distinguishing not-found from service errors)

**Technology**: TypeScript, AWS SDK v3 (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`)

---

### Component: PromptBuilder

**Purpose**: Pure function module for constructing Bedrock Converse API message payloads. No I/O.

**Responsibilities**:
- Build the initial system prompt (Unblocking Agent persona)
- Build the user turn message combining `userPrompt`, `codeContext`, and optional prior session context
- Build the retry turn message incorporating the failed execution's `stderr` and `exitCode`
- Return a typed `ConverseInput` message array — no side effects

**Technology**: TypeScript (pure functions — PBT applicable)

---

### Component: BedrockService

**Purpose**: Invokes Amazon Bedrock Nova Lite via the Converse API. Handles the HTTP call and response parsing.

**Responsibilities**:
- Send a Converse API request to the configured model (`BEDROCK_MODEL_ID`)
- Extract the generated script text from the response `content` block
- Apply an explicit timeout to the Bedrock HTTP call (configurable, default 25 seconds)
- Throw typed errors distinguishing throttling, model errors, and network failures
- Log the Bedrock invocation start, token usage, and latency

**Technology**: TypeScript, AWS SDK v3 (`@aws-sdk/client-bedrock-runtime`)

---

### Component: SandboxService

**Purpose**: Executes scripts in ephemeral AWS Lambda MicroVMs and returns structured results.

**Responsibilities**:
- Create a new ephemeral Lambda MicroVM instance per request via `RunMicrovmCommand`
- Obtain an auth token via `CreateMicrovmAuthTokenCommand`
- Detect script language (Python vs Bash) from the script content or shebang line
- POST the script to the MicroVM `/execute` endpoint with a 30-second hard timeout
- Capture `stdout`, `stderr`, and exit code from the MicroVM response
- Classify execution as `success` (exit code 0) or `failure` (non-zero or timeout)
- Terminate the MicroVM immediately after execution via `TerminateMicrovmCommand` (ephemeral lifecycle)
- Throw a typed `SandboxTimeoutError` on timeout; `SandboxExecutionError` on failure

**Technology**: TypeScript, AWS SDK v3 (`@aws-sdk/client-lambda-microvms`)

---

### Component: Logger

**Purpose**: Centralized structured JSON logger. Used by all Lambda components.

**Responsibilities**:
- Emit structured JSON log entries with: `timestamp`, `requestId`, `level`, `message`, `context`
- Support log levels: `DEBUG`, `INFO`, `WARN`, `ERROR`
- Ensure no secrets, API keys, tokens, or PII appear in log output
- Route output to stdout (captured by CloudWatch Logs automatically in Lambda)

**Technology**: TypeScript (thin wrapper, no external logging framework dependency)

---

### Component: InputValidator

**Purpose**: Validates and sanitizes all incoming API request parameters. Pure function module.

**Responsibilities**:
- Validate `sessionId` format (UUID v4 or empty/undefined)
- Validate `userPrompt`: non-empty string, max 2000 characters, no HTML/script injection
- Validate `codeContext`: string, max 10000 characters
- Return a typed `ValidationResult` (valid payload or structured error list)
- Never throw — always return a result type

**Technology**: TypeScript (pure functions — PBT applicable)

---

## UNIT 3: Frontend

### Component: App (Root Svelte Component)

**Purpose**: Root Svelte component. Owns global state and renders the two-pane layout.

**Responsibilities**:
- Manage reactive state: `sessionId`, `userPrompt`, `codeContext`, `outputLines`, `isLoading`, `status`
- Render the split-screen layout (LeftPane + RightPane)
- Handle the Recover button submit event
- Pre-populate `sessionId` from a stored prior session (local state)

**Technology**: Svelte 4, TypeScript

---

### Component: LeftPane

**Purpose**: Input panel. Collects the user's problem description and code context.

**Responsibilities**:
- Render `codeContext` textarea (label: "Broken code / error output")
- Render `userPrompt` text input (label: "What are you trying to fix?")
- Render `sessionId` text input (label: "Resume Session ID (optional)")
- Render the **Recover** button (disabled while `isLoading`)
- Emit a `submit` event upward to App with the current form values

**Technology**: Svelte 4, TypeScript

---

### Component: RightPane

**Purpose**: Terminal-style output panel. Displays streaming SSE events in real time.

**Responsibilities**:
- Render a scrollable, read-only terminal-style `<div>` (dark background, monospace font)
- Display `outputLines` — each line typed and color-coded by event type (info, stdout, stderr, error, success)
- Show the `sessionId` in a copyable badge at the top of the panel
- Auto-scroll to the bottom when new lines arrive
- Show a subtle spinner/indicator when `isLoading` is true

**Technology**: Svelte 4, TypeScript

---

### Component: ApiClient

**Purpose**: Frontend API utility. Thin wrapper around Lambda Function URL for SSE streaming.

**Responsibilities**:
- POST the session payload (`sessionId`, `userPrompt`, `codeContext`) to the Function URL
- Open an `EventSource` connection to the SSE stream endpoint
- Parse typed envelope events (`{type, payload}`) and dispatch them via a callback
- Return the `sessionId` from the first event (or from response headers)
- Close the `EventSource` connection on `final` event or error
- No retry logic — thin wrapper for MVP

**Technology**: TypeScript, browser `fetch` API, `EventSource` API

---

## Component Inventory Summary

| Component | Unit | Type | PBT Applicable |
|---|---|---|---|
| SAM Stack | Infrastructure | IaC | No |
| UnblockAgentHandler | Backend Lambda | Orchestrator | No (I/O bound) |
| SessionService | Backend Lambda | I/O Service | No (I/O bound) |
| PromptBuilder | Backend Lambda | Pure Functions | Yes (invariants, round-trip) |
| BedrockService | Backend Lambda | I/O Service | No (I/O bound) |
| SandboxService | Backend Lambda | I/O Service | No (I/O bound) |
| Logger | Backend Lambda | Utility | No |
| InputValidator | Backend Lambda | Pure Functions | Yes (invariants) |
| App | Frontend | UI Root | No |
| LeftPane | Frontend | UI Component | No |
| RightPane | Frontend | UI Component | No |
| ApiClient | Frontend | API Utility | No |
