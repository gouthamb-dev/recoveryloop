# Infrastructure Unit — NFR Design Patterns

## Security Patterns

### Pattern: Secrets Management
- No external API keys required — Lambda MicroVM access is controlled via IAM role
- All secrets management is handled through AWS IAM (no Secrets Manager dependency for sandbox execution)
- Lambda environment variables contain only non-secret configuration values (table name, model ID, MicroVM image ARN)
- **Never** passed as a Lambda environment variable directly

### Pattern: Origin Access Control (OAC) for S3
- CloudFront uses OAC (not legacy OAI) to access the S3 bucket
- S3 bucket policy denies all other principals — only the CloudFront distribution can read
- Bucket has all four public access block settings enabled

### Pattern: Security Response Headers Policy
- CloudFront managed response headers policy attached to default cache behavior
- Enforces: CSP, HSTS (1 year), X-Content-Type-Options, X-Frame-Options: DENY, Referrer-Policy
- CSP `connect-src` includes the Lambda Function URL domain to allow SSE connections

### Pattern: Least-Privilege IAM Role
- Separate inline policy statements per action group (DynamoDB, Bedrock, Secrets Manager, Logs)
- Each statement uses specific resource ARN (`!GetAtt` or `!Sub` with account/region)
- No `*` resources; no `*` actions

### Pattern: Lambda Concurrency Management
- No `ReservedConcurrentExecutions` set (removed due to account quota limitations)
- Relies on account-level Lambda concurrency quotas
- API Gateway throttling serves as the primary rate limiter
- Prevents runaway costs and protects MicroVM/Bedrock quotas

## Resilience Patterns

### Pattern: Multi-AZ by Default (Serverless)
- Lambda: deployed to all AZs in us-east-1 automatically
- DynamoDB: multi-AZ replication built-in for on-demand tables
- CloudFront: globally distributed — no single-AZ failure risk
- No explicit AZ pinning needed for any resource

### Pattern: DynamoDB Point-in-Time Recovery (PITR)
- PITR enabled on `RecoverySessions` table
- Provides continuous backup with 35-day recovery window
- Satisfies RESILIENCY-12 (automated backups) for Backup & Restore DR strategy

### Pattern: S3 Versioning for Rollback
- S3 bucket versioning enabled
- Previous frontend build versions retained for rollback via `aws s3 cp` from prior version

## Observability Patterns

### Pattern: Structured CloudWatch Alarms
- Three alarms covering: error rate, throttles, P99 duration
- All alarms use 5-minute evaluation periods with 1 datapoint threshold
- Alarm actions: SNS topic ARN (placeholder — user configures post-deploy)
- Alarm state visible in CloudWatch console immediately after deploy

### Pattern: CloudFront Access Logging
- Access logs delivered to a dedicated S3 logging bucket (separate from assets)
- Log prefix: `cloudfront/`
- Satisfies SECURITY-02 (CDN access logging)
