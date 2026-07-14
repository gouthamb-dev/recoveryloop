# Recovery Loop — Build and Test Summary

## Build Pipeline

```
backend-lambda/
  npm ci → npm run build (TypeScript → dist/) → sam build (package for Lambda)

frontend/
  npm ci → npm run build (Svelte + Vite → dist/) → aws s3 sync

infrastructure/
  sam build → sam deploy
```

## Test Matrix

| Test Type | Unit | Location | Command |
|---|---|---|---|
| Unit tests | backend-lambda | `tests/*.test.ts` | `npm test` |
| PBT (fast-check) | backend-lambda | `tests/validator.test.ts`, `tests/prompt.test.ts` | `npm test` (included) |
| Integration (live) | all | `aidlc-docs/construction/build-and-test/integration-test-instructions.md` | Manual curl commands |
| Frontend | frontend | N/A (MVP) | Visual check via `npm run dev` |

## Security Verification Checklist

- [ ] `template.yaml` has no wildcard IAM actions or resources
- [ ] No external API keys hardcoded in any source file or template
- [ ] CloudFront security headers policy includes all 5 required headers
- [ ] S3 bucket has public access block enabled (all 4 settings)
- [ ] Lambda reserved concurrency is set (rate limiting)
- [ ] CloudWatch Log Group retention is 90 days
- [ ] Lambda role cannot delete its own log group
- [ ] Input validation enforced on all request parameters

## Resiliency Verification Checklist

- [ ] All external calls have explicit timeouts (Bedrock 25s, MicroVM 30s)
- [ ] Agentic retry loop configured (max 2 retries)
- [ ] Global error handler catches unhandled exceptions in handler.ts
- [ ] DynamoDB PITR enabled
- [ ] S3 versioning enabled
- [ ] CloudWatch alarms configured (errors, throttles, duration P99)

## PBT Verification (Partial Mode)

- [ ] fast-check included in `package.json` devDependencies
- [ ] PBT tests exist for `validator.ts` (invariants, idempotency)
- [ ] PBT tests exist for `prompt.ts` (invariants)
- [ ] Shrinking is not disabled (default behavior)
- [ ] Seed is logged on failure (fast-check default)
- [ ] PBT runs as part of `npm test` (CI-integrated)

## Deployment Verification

After deployment, verify:
1. `sam deploy` completes without errors
2. CloudFormation stack status: `CREATE_COMPLETE` or `UPDATE_COMPLETE`
3. Lambda Function URL responds to health check (POST with valid payload)
4. CloudFront distribution status: `Deployed`
5. Frontend loads at CloudFront domain
6. End-to-end flow works (submit → SSE stream → final result)

## Known Limitations (MVP)

- No authentication on Lambda Function URL (public for developer tool use)
- No frontend component tests (Vitest + @testing-library/svelte deferred)
- No load testing / performance testing (deferred to post-MVP)
- No CI/CD pipeline definition (documented manual `sam deploy` + `s3 sync`)
- Resiliency testing deferred to Operations phase
