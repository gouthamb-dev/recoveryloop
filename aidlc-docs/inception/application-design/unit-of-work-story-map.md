# Recovery Loop — Component-to-Unit Mapping

## Mapping Summary

| Component | Unit | Folder Path |
|---|---|---|
| SAM Stack (InfrastructureStack) | Unit 1: infrastructure | `infrastructure/template.yaml` |
| UnblockAgentHandler | Unit 2: backend-lambda | `backend-lambda/src/handler.ts` |
| SessionService | Unit 2: backend-lambda | `backend-lambda/src/session.ts` |
| PromptBuilder | Unit 2: backend-lambda | `backend-lambda/src/prompt.ts` |
| BedrockService | Unit 2: backend-lambda | `backend-lambda/src/bedrock.ts` |
| SandboxService | Unit 2: backend-lambda | `backend-lambda/src/sandbox.ts` |
| InputValidator | Unit 2: backend-lambda | `backend-lambda/src/validator.ts` |
| Logger | Unit 2: backend-lambda | `backend-lambda/src/logger.ts` |
| Shared Types (backend copy) | Unit 2: backend-lambda | `backend-lambda/src/types.ts` |
| App (root Svelte component) | Unit 3: frontend | `frontend/src/App.svelte` |
| LeftPane | Unit 3: frontend | `frontend/src/lib/LeftPane.svelte` |
| RightPane | Unit 3: frontend | `frontend/src/lib/RightPane.svelte` |
| ApiClient | Unit 3: frontend | `frontend/src/lib/api.ts` |
| Shared Types (frontend copy) | Unit 3: frontend | `frontend/src/lib/types.ts` |

---

## Functional Requirement Coverage by Unit

| Functional Requirement | Unit(s) |
|---|---|
| FR-01: Session Management | Unit 1 (table), Unit 2 (SessionService) |
| FR-02: LLM Integration (Bedrock Nova Lite) | Unit 2 (BedrockService, PromptBuilder) |
| FR-03: Agentic Retry Loop | Unit 2 (UnblockAgentHandler) |
| FR-04: Lambda MicroVM Sandbox Execution | Unit 2 (SandboxService) |
| FR-05: Frontend Split-Screen Layout | Unit 3 (App, LeftPane, RightPane) |
| FR-06: SSE Streaming | Unit 1 (Function URL config), Unit 2 (handler SSE emission), Unit 3 (ApiClient) |
| FR-07: Backend Lambda Structure | Unit 2 (all modules) |
| FR-08: Infrastructure | Unit 1 (template.yaml) |
| FR-09: API Contract | Unit 1 (API GW), Unit 2 (handler), Unit 3 (ApiClient) |

---

## NFR Coverage by Unit

| Non-Functional Requirement | Unit(s) |
|---|---|
| NFR-01: Performance (timeouts) | Unit 2 (BedrockService 25s, SandboxService 30s) |
| NFR-02: Security (IAM, MicroVM, headers) | Unit 1 (IAM, MicroVM permissions, CloudFront headers, ACM cert) |
| NFR-02: Security (input validation) | Unit 2 (InputValidator) |
| NFR-03: Scalability (concurrency) | Unit 1 (Lambda default account concurrency) |
| NFR-04: Observability (logs, alarms) | Unit 1 (CloudWatch Alarms, Log Group), Unit 2 (Logger) |
| NFR-05: Reliability (error handling) | Unit 2 (global error handler in handler.ts) |
| NFR-07: Deployment | Unit 1 (samconfig.toml), Unit 2 (package.json scripts), Unit 3 (package.json scripts) |
| NFR-08: Developer Experience | README.md (workspace root) |

---

## Test Coverage by Unit

| Test Type | Unit | Location |
|---|---|---|
| Unit tests (PromptBuilder) | Unit 2 | `backend-lambda/tests/prompt.test.ts` |
| PBT — PromptBuilder invariants | Unit 2 | `backend-lambda/tests/prompt.test.ts` |
| PBT — InputValidator round-trip | Unit 2 | `backend-lambda/tests/validator.test.ts` |
| Unit tests (SessionService — mocked) | Unit 2 | `backend-lambda/tests/session.test.ts` |
| Unit tests (BedrockService — mocked) | Unit 2 | `backend-lambda/tests/bedrock.test.ts` |
| Unit tests (SandboxService — mocked) | Unit 2 | `backend-lambda/tests/sandbox.test.ts` |
| Integration-style handler tests | Unit 2 | `backend-lambda/tests/handler.test.ts` |
| Frontend component tests | Unit 3 | Out of scope for MVP |
