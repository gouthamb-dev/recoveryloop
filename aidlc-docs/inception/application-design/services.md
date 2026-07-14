# Recovery Loop — Service Layer Design

## Overview

Recovery Loop has a single backend service — the **UnblockAgentService** — implemented as a
Lambda function. The service layer is the orchestration layer inside `handler.ts` that coordinates
the four focused modules (SessionService, PromptBuilder, BedrockService, SandboxService) into
a coherent agentic workflow.

The frontend has a thin **ApiClient** that acts as the client-side service boundary.

---

## Backend Service: UnblockAgentService

### Role
Orchestrates the full agentic unblocking workflow for a single request. Owns the retry loop,
the SSE event emission sequence, and the overall request lifecycle.

### Coordination Pattern
Request-scoped sequential orchestration with an embedded retry loop. No queues, no async
background workers — the Lambda runs synchronously with streaming output.

### Workflow Sequence

```
Client POST /unblock
    |
    v
[1] UnblockAgentHandler.handler()
        |-- validate request (InputValidator)
        |-- emit: session_start event
        |
        v
[2] SessionService.loadSession(sessionId)
        |-- if found: attach prior context to params
        |-- if not found: generate new sessionId
        |
        v
[3] AGENTIC LOOP (attempt = 0; attempt <= maxRetries)
        |
        |-- [3a] PromptBuilder.buildMessages(attempt == 0 ? initial : retry)
        |
        |-- [3b] emit: bedrock_start event
        |        BedrockService.invokeModel(messages, systemPrompt, modelId)
        |        --> scriptText
        |
        |-- [3c] emit: script_generated event (scriptText)
        |
        |-- [3d] emit: sandbox_start event
        |        SandboxService.executeScript(scriptText, timeout)
        |        --> ExecutionResult { status, stdout, stderr, exitCode }
        |
        |-- [3e] emit: stdout/stderr events (chunked from result)
        |
        |-- [3f] if status == "success" --> break loop
        |        if status == "failure" && attempt < maxRetries:
        |            emit: retry event
        |            append failure context to messages
        |            attempt++
        |            continue
        |        if status == "failure" && attempt == maxRetries:
        |            break loop (final failure)
        |
        v
[4] SessionService.saveSession(record)
        |-- persist: sessionId, lastPrompt, lastScript, lastResult, expiresAt
        |
        v
[5] emit: final event { status, sessionId, retryCount, executionTimeMs }
    close SSE stream
```

### Error Handling
- InputValidator returns invalid: emit `error` event, close stream, return 400
- SessionService throws: log + continue without prior context (non-blocking for new sessions); throw for save failures
- BedrockService throws (throttle/timeout): emit `error` event, count as retry-eligible failure
- SandboxService throws timeout: emit `error` event with `SandboxTimeoutError`, count as failure
- Unhandled exception: global catch in handler → emit `error` event → close stream → return 500

### SSE Event Sequence (happy path, no retries)

```
data: {"type":"session_start","payload":"sess-uuid-1234"}
data: {"type":"bedrock_start","payload":"Invoking Nova Lite..."}
data: {"type":"script_generated","payload":"#!/bin/bash\nnpm config set..."}
data: {"type":"sandbox_start","payload":"Executing script..."}
data: {"type":"stdout","payload":"Global prefix set to ~/.npm-global"}
data: {"type":"final","payload":"success","metadata":{"sessionId":"sess-uuid-1234","retryCount":0,"executionTimeMs":3200}}
```

### SSE Event Sequence (one retry)

```
data: {"type":"session_start","payload":"sess-uuid-1234"}
data: {"type":"bedrock_start","payload":"Invoking Nova Lite..."}
data: {"type":"script_generated","payload":"#!/usr/bin/env python3\nimport os..."}
data: {"type":"sandbox_start","payload":"Executing script..."}
data: {"type":"stderr","payload":"ModuleNotFoundError: No module named 'requests'"}
data: {"type":"retry","payload":"Attempt 1 failed. Sending error to model for correction...","metadata":{"attempt":1}}
data: {"type":"bedrock_start","payload":"Invoking Nova Lite (retry 1)..."}
data: {"type":"script_generated","payload":"#!/usr/bin/env python3\nimport subprocess\nsubprocess.run(['pip',..."}
data: {"type":"sandbox_start","payload":"Executing corrected script..."}
data: {"type":"stdout","payload":"Successfully installed requests-2.31.0"}
data: {"type":"final","payload":"success","metadata":{"sessionId":"sess-uuid-1234","retryCount":1,"executionTimeMs":7100}}
```

---

## Frontend Service: ApiClient

### Role
Client-side service boundary. Abstracts the Lambda Function URL + SSE connection from the
Svelte UI components.

### Coordination Pattern
Single async call: POST to initiate, then `EventSource` for the SSE stream. No state stored
in ApiClient itself — all state is owned by the App component.

### Responsibilities
- Construct and send the POST payload
- Open `EventSource` on the Function URL (or a dedicated SSE endpoint)
- Parse `data:` lines as JSON typed envelopes
- Dispatch each event to the `onEvent` callback
- Call `onComplete` when a `final` event arrives
- Call `onError` on stream error or invalid payload
- Close the `EventSource` after completion

---

## Service Configuration

| Service | Config Source | Key Config |
|---|---|---|
| UnblockAgentService | Environment variables | `RECOVERY_SESSIONS_TABLE`, `BEDROCK_MODEL_ID`, `MICROVM_IMAGE_ARN`, `MAX_RETRIES=2`, `SANDBOX_TIMEOUT_MS=30000`, `BEDROCK_TIMEOUT_MS=25000` |
| ApiClient | Vite env vars | `VITE_API_URL` (Function URL base) |

---

## Service Boundaries and Isolation

- **No direct database access from frontend** — all DynamoDB access is inside SessionService on the Lambda
- **No Lambda MicroVM SDK in frontend** — sandbox execution is Lambda-only
- **No Bedrock SDK in frontend** — LLM invocation is Lambda-only
- **Lambda modules are stateless per request** — no shared mutable state between invocations
