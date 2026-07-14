# Recovery Loop — Unit of Work Dependencies

## Dependency Matrix

| Unit | Depends On | Type | Why |
|---|---|---|---|
| Unit 1: infrastructure | (none) | — | Foundation; no upstream dependencies |
| Unit 2: backend-lambda | Unit 1: infrastructure | Build-time + Deploy-time | Needs `RECOVERY_SESSIONS_TABLE`, `MICROVM_IMAGE_ARN`, Function URL from stack outputs |
| Unit 3: frontend | Unit 2: backend-lambda | Build-time | Needs `VITE_API_URL` (Lambda Function URL) for `vite build` |

## Build and Deploy Order

```
Step 1: infrastructure
  sam build
  sam deploy --guided           --> outputs: FunctionUrl, TableName, MicrovmImageArn, CloudFrontDomain

Step 2: backend-lambda
  npm ci
  npm run build                 --> compiles TypeScript to dist/
  sam build (via infrastructure template referencing backend-lambda/dist)
  (sam deploy handled by infrastructure stack)

Step 3: frontend
  npm ci
  VITE_API_URL=<FunctionUrl> npm run build   --> produces dist/
  aws s3 sync dist/ s3://<BucketName>/ --delete
  aws cloudfront create-invalidation --paths "/*"
```

## Inter-Unit Contracts

### infrastructure → backend-lambda
The SAM template defines the Lambda function pointing to `backend-lambda/dist/handler.js`.
Environment variables injected by SAM:
- `RECOVERY_SESSIONS_TABLE` — DynamoDB table name
- `BEDROCK_MODEL_ID` — configurable (default: `us.amazon.nova-2-lite-v1:0`)
- `MICROVM_IMAGE_ARN` — Lambda MicroVM image ARN for sandbox execution

### backend-lambda → frontend
The Lambda Function URL is exported as a CloudFormation stack output (`FunctionUrl`).
The frontend reads it via `VITE_API_URL` environment variable at build time.

### Shared Types (duplicated — MVP decision)
Types duplicated across units. If types diverge, update both manually.
Key shared types:
- `SseEvent` (`{type, payload, metadata?}`)
- `UnblockRequest` (`{sessionId?, userPrompt, codeContext}`)
- `ExecutionResult` (`{status, stdout, stderr, exitCode, executionTimeMs}`)

## Parallel Development Opportunities

After Unit 1 infrastructure is deployed once (stack outputs available):
- Unit 2 and Unit 3 CAN be developed in parallel
- Frontend developer uses a local mock SSE server during development
- Backend developer uses `.env` file with local DynamoDB (DynamoDB Local) or a dev stack

## Rollback Strategy

Per the execution plan (Backup & Restore / direct deploy):
- **Unit 1**: CloudFormation stack rollback via `aws cloudformation rollback-stack`
- **Unit 2**: Redeploy previous Lambda code version via `sam deploy` with prior artifact
- **Unit 3**: Redeploy prior `dist/` to S3 + CloudFront invalidation

## Risk by Unit

| Unit | Risk | Notes |
|---|---|---|
| infrastructure | Low | SAM/CloudFormation is well-understood; no external APIs |
| backend-lambda | Medium | External dependencies (Lambda MicroVMs, Bedrock); agentic retry loop complexity |
| frontend | Low-Medium | Standard Svelte + Vite; SSE EventSource is well-supported in browsers |
