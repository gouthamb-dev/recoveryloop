# Infrastructure Unit — NFR Requirements

## Performance
- CloudFront serves static frontend assets from edge — target P99 < 100ms for cached assets
- Lambda cold start budget: 2 seconds (Node.js 22 with 256 MB is typically < 1s)
- Lambda timeout: 60 seconds (hard Lambda limit; internal Bedrock/MicroVM timeouts enforce 25s/30s)
- DynamoDB GetItem/PutItem: < 10ms P99 (on-demand, single-item access pattern)

## Security (SECURITY baseline — full enforcement)
- **SECURITY-01**: DynamoDB SSE enabled; S3 SSE-S3; all traffic TLS 1.2+
- **SECURITY-02**: CloudFront access logging enabled; API Gateway access logging enabled
- **SECURITY-04**: CloudFront Response Headers Policy enforces all 5 required security headers
- **SECURITY-06**: IAM role least-privilege — specific resource ARNs, no wildcards
- **SECURITY-09**: S3 public access blocked; no default credentials in template; error responses generic
- **SECURITY-11**: Rate limiting via API GW throttling
- **SECURITY-12**: Lambda MicroVM access controlled via IAM role (no external API keys)
- **SECURITY-14**: CloudWatch Log Group retention 90 days; Lambda role cannot delete its own logs

## Scalability
- DynamoDB PAY_PER_REQUEST: scales to any read/write volume automatically
- Lambda concurrency: no explicit reserved concurrency (account-level quota applies)
- CloudFront: global CDN, no scaling concerns for static assets
- Service quotas to monitor: Lambda concurrent executions, Bedrock RPM

## Availability (RESILIENCY baseline)
- **RESILIENCY-01**: Infrastructure classified as High criticality (supports the core tool)
- **RESILIENCY-02**: SLA 99.5%; RTO hours; RPO 24 hours — Backup & Restore strategy
- **RESILIENCY-08**: Lambda, DynamoDB, API GW are inherently multi-AZ in us-east-1
- **RESILIENCY-09**: Lambda auto-scales within concurrency limit; DynamoDB on-demand auto-scales
- **RESILIENCY-12**: DynamoDB automated backups enabled (point-in-time recovery); S3 versioning enabled

## Observability
- CloudWatch Log Group `/aws/lambda/UnblockAgent` with 90-day retention
- CloudWatch Alarms: Lambda error rate, throttles, P99 duration
- CloudFront access logs: stored in S3 logging bucket (separate from assets bucket)
- API Gateway access logs: enabled for the HTTP API stage

## Maintainability
- All resource names use SAM parameters — environment-specific values are injectable
- `samconfig.toml` captures deploy configuration for repeatable deployments
- Stack outputs enable other units to discover resource names without hardcoding

## Compliance
- No personal data stored in DynamoDB (sessionId + code context only — developer tool)
- 90-day log retention meets default compliance baseline per SECURITY-14
- S3 versioning provides audit trail for frontend deploys
