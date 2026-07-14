# Recovery Loop — Integration Test Instructions

## Overview

Integration tests validate the end-to-end flow: Lambda handler → DynamoDB → Bedrock → Lambda MicroVM → SSE response.
These require a deployed stack or local substitutes.

---

## Option A: Live Integration Test (against deployed stack)

### Prerequisites
- Stack deployed via `sam deploy`
- Nova 2 Lite enabled in Bedrock console

### Test Procedure

```bash
# 1. Get the Function URL from stack outputs
FUNCTION_URL=$(aws cloudformation describe-stacks \
  --stack-name recovery-loop \
  --query "Stacks[0].Outputs[?OutputKey=='FunctionUrl'].OutputValue" \
  --output text)

# 2. Send a test request
curl -N -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "userPrompt": "Fix a Python script that fails with ModuleNotFoundError for requests",
    "codeContext": "import requests\nrequests.get(\"https://example.com\")\n\nTraceback:\nModuleNotFoundError: No module named requests"
  }'
```

### Expected SSE Output

```
data: {"type":"session_start","payload":"<uuid>"}
data: {"type":"bedrock_start","payload":"Invoking Nova Lite..."}
data: {"type":"script_generated","payload":"#!/usr/bin/env python3\n..."}
data: {"type":"sandbox_start","payload":"Executing script in sandbox..."}
data: {"type":"stdout","payload":"..."}
data: {"type":"final","payload":"success","metadata":{...}}
```

### Validation Checklist
- [ ] SSE stream opens successfully (HTTP 200, Content-Type: text/event-stream)
- [ ] `session_start` event returns a valid UUID
- [ ] `script_generated` event contains a valid Python or Bash script
- [ ] `sandbox_start` event fires before execution
- [ ] `stdout` or `stderr` events contain sandbox output
- [ ] `final` event includes `sessionId`, `retryCount`, `executionTimeMs`
- [ ] Session record exists in DynamoDB after completion

### Verify DynamoDB Record

```bash
SESSION_ID="<uuid from session_start event>"
aws dynamodb get-item \
  --table-name RecoverySessions \
  --key "{\"sessionId\": {\"S\": \"$SESSION_ID\"}}"
```

### Session Resume Test

```bash
# Use the sessionId from the previous test
curl -N -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"userPrompt\": \"The previous fix installed the package, but now I get a connection timeout\",
    \"codeContext\": \"requests.exceptions.ConnectionError: Max retries exceeded\"
  }"
```

---

## Option B: Local Integration Test (mocked services)

For CI environments without AWS access, use the handler tests in
`backend-lambda/tests/handler.test.ts` (future expansion) with:
- Mocked DynamoDB (via `@aws-sdk` mock)
- Mocked Bedrock (returns canned script)
- Mocked Lambda MicroVMs (returns canned execution result)

This validates the orchestration logic without external dependencies.

---

## Error Scenario Tests

### Invalid Request
```bash
curl -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -d '{"codeContext": "error"}'
# Expected: SSE error event with "Validation failed"
```

### Invalid Session ID
```bash
curl -N -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "not-a-uuid", "userPrompt": "help", "codeContext": "err"}'
# Expected: SSE error event with validation error
```

### Script Execution Failure (triggers retry)
```bash
curl -N -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "userPrompt": "Run a command that does not exist",
    "codeContext": "$ nonexistent_command\nbash: nonexistent_command: command not found"
  }'
# Expected: retry events, then final with failure or success after correction
```
