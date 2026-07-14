# Infrastructure Unit — Logical Components

## Component Map

| Logical Component | AWS Resource | Purpose |
|---|---|---|
| Session Store | DynamoDB Table | Persist ephemeral session state with 24h TTL |
| Compute + Streaming | Lambda Function URL (RESPONSE_STREAM) | Execute agentic workflow; stream SSE to browser |
| Frontend CDN | CloudFront Distribution | Serve compiled Svelte SPA from edge |
| Frontend Storage | S3 Bucket | Store compiled frontend assets (private) |
| Secret Store | (removed) | E2B no longer used; sandbox auth is IAM-based |
| Observability | CloudWatch Log Group + 3 Alarms | Logs (90-day) + error/throttle/duration alerting |
| Access Control | IAM Role + Inline Policies | Least-privilege Lambda execution permissions |

## Component Interactions

```
[Browser]
    |
    | HTTPS (static assets)
    v
[CloudFront] --> [S3 Bucket] (OAC — frontend SPA)
    |
    | (SSE streaming via Lambda Function URL)
    v
[Lambda Function URL]
    |
    v
[Lambda: UnblockAgent]
    |-- [DynamoDB: RecoverySessions] (session state)
    |-- [Bedrock: Nova 2 Lite]        (LLM inference)
    |-- [Lambda MicroVMs]             (script execution sandbox)
    |-- [CloudWatch Logs]            (structured logging)
```

## Sizing and Limits

| Component | Limit | Configured Value |
|---|---|---|
| Lambda concurrency | AWS default 1000/region | 10 (reserved) |
| Lambda memory | 128 MB – 10 GB | 256 MB |
| Lambda timeout | Max 900s | 60s |
| DynamoDB item size | Max 400 KB | ~10 KB estimated max |
| Secrets Manager rate | 10,000 req/s | ~1 req/cold start (cached) |
| Bedrock RPM (Nova Lite) | Varies by quota | 1 req/invocation (retried inline) |
