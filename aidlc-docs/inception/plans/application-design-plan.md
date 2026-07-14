# Recovery Loop — Application Design Plan

## Plan Overview

This plan generates the Application Design artifacts for Recovery Loop: component definitions,
method signatures, service layer design, and component dependencies. The system has a clear
multi-component shape from the requirements, so questions are targeted at genuine ambiguities.

---

## Steps

- [x] Step 1: Answer design questions (user input required)
- [x] Step 2: Generate `components.md` — component definitions and responsibilities
- [x] Step 3: Generate `component-methods.md` — method signatures per component
- [x] Step 4: Generate `services.md` — service layer orchestration design
- [x] Step 5: Generate `component-dependency.md` — dependency matrix and data flow
- [x] Step 6: Generate `application-design.md` — consolidated summary
- [x] Step 7: Validate design completeness and consistency

---

## Design Questions

Please answer each question by filling in the letter choice after the `[Answer]:` tag.

---

### Question 1
The Lambda handler needs to support both a **synchronous JSON response** (for simple cases or
fallback) and **SSE streaming** (for real-time progress). How should the Lambda expose these
two modes?

A) Single Lambda with a Lambda Function URL (supports streaming natively via response streaming); API Gateway is used only for the health/GET endpoints

B) Two separate Lambda functions: one for SSE streaming (Function URL) and one for standard JSON (API Gateway)

C) Single Lambda behind API Gateway HTTP API only — use chunked transfer encoding with API Gateway v2 integration (note: true SSE requires careful API GW config)

D) Other (please describe after [Answer]: tag below)

[Answer]: A

---

### Question 2
The `session.ts` module manages DynamoDB reads and writes. Should session data include
a **version/counter** field to detect concurrent writes (optimistic locking), or is
last-write-wins acceptable for the MVP (given the single-user developer tool use case)?

A) Last-write-wins — no optimistic locking needed for MVP (single developer uses a session at a time)

B) Add a `version` counter with a DynamoDB conditional write to detect and reject concurrent updates

C) Other (please describe after [Answer]: tag below)

[Answer]: A

---

### Question 3
The `bedrock.ts` module invokes Nova Lite. Should the Bedrock call use the
**Converse API** (unified, model-agnostic) or the **InvokeModel API** (model-specific,
direct payload control)?

A) Converse API — cleaner abstraction, easier to swap models later, supports streaming via ConverseStream

B) InvokeModel API — direct payload control, slightly lower overhead, model-specific format

C) Other (please describe after [Answer]: tag below)

[Answer]: A

---

### Question 4
The SSE stream emits discrete typed events (Bedrock start, script generated, sandbox start,
stdout/stderr chunks, retry, final result). Should these events follow a **typed envelope
format** (e.g. `{ type: "stdout", data: "..." }`) or emit **plain text lines** in the
terminal output?

A) Typed envelope — `data: {"type":"stdout","payload":"..."}` — frontend parses and routes each event type

B) Plain text lines — `data: [STDOUT] some output\n` — frontend renders lines directly with minimal parsing

C) Other (please describe after [Answer]: tag below)

[Answer]: A

---

### Question 5
The `sandbox.ts` module will use the E2B SDK. E2B sandboxes can be either **ephemeral**
(created and destroyed per request) or **persistent** (kept alive across requests via a
sandbox ID). Which model fits the MVP best?

A) Ephemeral per request — create sandbox, run script, destroy immediately. Simpler, no sandbox state leak between sessions.

B) Persistent per session — reuse the same E2B sandbox for the lifetime of a sessionId, enabling stateful multi-step execution within a session

C) Other (please describe after [Answer]: tag below)

[Answer]: A

---

### Question 6
Should the frontend `api.ts` utility be a **thin fetch wrapper** (just sends the POST and
opens the SSE connection), or should it include **retry logic** (e.g. reconnect SSE on
network drop)?

A) Thin wrapper — just POST + SSE EventSource; no client-side retry logic for MVP

B) Include SSE reconnect logic — auto-reconnect with exponential backoff on connection drop

C) Other (please describe after [Answer]: tag below)

[Answer]: A

---

*Please fill in all [Answer]: tags, then let me know and I will generate the design artifacts.*
