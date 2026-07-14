# Recovery Loop — Unit Test Instructions

## Test Framework
- **Runner**: Vitest 2.0.5
- **PBT**: fast-check 3.22.0
- **Location**: `backend-lambda/tests/`

---

## Running Unit Tests

```bash
cd backend-lambda
npm ci
npm test
```

**Expected output**: All tests pass with `vitest run`.

---

## Test Files

| File | Module Tested | Type |
|---|---|---|
| `tests/validator.test.ts` | InputValidator | Unit + PBT (invariants, idempotency) |
| `tests/prompt.test.ts` | PromptBuilder | Unit + PBT (invariants) |
| `tests/session.test.ts` | SessionService | Unit (mocked AWS SDK) |
| `tests/bedrock.test.ts` | BedrockService | Unit (response parsing) |
| `tests/sandbox.test.ts` | SandboxService | Unit (language detection) |

---

## Property-Based Tests (PBT)

### PBT in `validator.test.ts`
| Property | Category | Description |
|---|---|---|
| Valid inputs always pass | Invariant | Well-formed `{userPrompt, codeContext}` always returns `valid: true` |
| Empty userPrompt always fails | Invariant | Empty string always returns `valid: false` |
| sanitizeString is idempotent | Idempotence | `f(f(x)) === f(x)` for all strings |

### PBT in `prompt.test.ts`
| Property | Category | Description |
|---|---|---|
| buildInitialMessages produces 1 user message | Invariant | Always exactly 1 message with role `user` |
| Output contains both inputs | Invariant | userPrompt and codeContext appear in output text |
| buildRetryMessages appends exactly 2 | Invariant | Previous messages + 2 (assistant + user) |

### PBT Configuration
- **Seed logging**: fast-check logs seed on failure by default
- **Shrinking**: Enabled (default behavior, not overridden)
- **Number of runs**: 100 per property
- **CI integration**: `npm test` runs all PBT as part of the standard test suite

---

## Test Coverage Expectations

| Module | Coverage Target | Rationale |
|---|---|---|
| `validator.ts` | > 90% | Pure functions, fully testable |
| `prompt.ts` | > 90% | Pure functions, fully testable |
| `session.ts` | > 70% | I/O bound, SDK mocked |
| `bedrock.ts` | > 50% | Response parsing tested; SDK mocked |
| `sandbox.ts` | > 40% | Language detection tested; Lambda MicroVMs SDK mocked |
| `handler.ts` | Excluded | Integration orchestrator, tested via integration tests |

---

## Running with Coverage

```bash
cd backend-lambda
npx vitest run --coverage
```

Coverage report output to `coverage/` directory.
