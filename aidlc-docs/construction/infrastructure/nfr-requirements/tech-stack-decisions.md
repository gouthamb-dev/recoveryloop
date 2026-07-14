# Infrastructure Unit — Tech Stack Decisions

## IaC Tool
| Decision | Choice | Rationale |
|---|---|---|
| IaC Framework | AWS SAM | Specified in requirements; native Lambda support; simpler than CDK for MVP |
| Template format | YAML | Standard for SAM; more readable than JSON for CloudFormation |
| SAM CLI version | >= 1.100.0 | Supports Lambda Response Streaming via Function URL |

## AWS Services

| Resource | Service | Tier/Config | Rationale |
|---|---|---|---|
| Database | DynamoDB | On-demand (PAY_PER_REQUEST) | Auto-scaling, no capacity planning for MVP |
| Compute | Lambda (Node.js 22) | 256 MB, 60s timeout | Serverless, inherently multi-AZ, cold start < 1s |
| Streaming | Lambda Function URL | RESPONSE_STREAM, AuthType=NONE | Only Lambda native option for SSE streaming |
| Frontend hosting | S3 + CloudFront | Standard | Static SPA hosting, edge caching, HTTPS |
| CDN | CloudFront | PriceClass_100 | US/EU coverage; lowest cost price class |
| Secrets | (none required) | — | Sandbox auth is IAM-based; no external API keys |
| Monitoring | CloudWatch | Standard | Native Lambda/DynamoDB metrics; no extra cost |
| LLM | Amazon Bedrock (Nova 2 Lite) | On-demand (cross-region) | Specified in requirements; no provisioned throughput for MVP |

## Tooling

| Tool | Version | Purpose |
|---|---|---|
| AWS SAM CLI | >= 1.100.0 | Build and deploy |
| AWS CLI | >= 2.x | S3 sync, CloudFront invalidation |
| Node.js | 20.x LTS | Lambda runtime |
| TypeScript | 5.x | Lambda source language |
