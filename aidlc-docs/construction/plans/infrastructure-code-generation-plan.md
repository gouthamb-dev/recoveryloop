# Code Generation Plan — Unit 1: infrastructure

## Unit Context
- **Unit**: infrastructure
- **Location**: `infrastructure/` (workspace root)
- **Technology**: AWS SAM (template.yaml), samconfig.toml
- **Dependencies**: None (foundation unit)
- **Stories/FRs Covered**: FR-08 (Infrastructure), NFR-02 (Security), NFR-03 (Scalability), NFR-04 (Observability)

---

## Generation Steps

- [x] Step 1: Create `infrastructure/` directory structure
- [x] Step 2: Generate `infrastructure/template.yaml` — full SAM template with all AWS resources
- [x] Step 3: Generate `infrastructure/samconfig.toml` — SAM deploy configuration
- [x] Step 4: Verify template.yaml completeness and security compliance

---

## Step Detail

### Step 1: Create directory structure
Target: `infrastructure/` at workspace root

### Step 2: Generate `infrastructure/template.yaml`
Must include:
- Transform: AWS::Serverless-2016-10-31
- Parameters (6): RecoverySessionsTableName, BedrockModelId, MicrovmImageArn, LogRetentionDays, Environment, CustomDomainName, AcmCertificateArn
- Globals: Function runtime (nodejs22.x), timeout, memory, tracing
- Resources:
  - RecoverySessionsTable (DynamoDB with TTL, SSE, PITR, on-demand)
  - UnblockAgentFunction (SAM Function with Function URL RESPONSE_STREAM, env vars, IAM policies incl. MicroVM permissions)
  - FrontendBucket (S3 private, versioning, SSE-S3, public access block)
  - FrontendBucketPolicy (CloudFront OAC only)
  - LogsBucket (S3 for CloudFront access logs)
  - CloudFrontOAC (OriginAccessControl)
  - SecurityHeadersPolicy (CloudFront ResponseHeadersPolicy with all 5 required headers)
  - FrontendDistribution (CloudFront with S3 origin, HTTPS redirect, SPA 404 handling, custom domain + ACM cert)
  - LambdaLogGroup (CloudWatch 90-day retention)
  - AlertsTopic (SNS placeholder)
  - LambdaErrorAlarm, LambdaThrottleAlarm, LambdaDurationAlarm (CloudWatch Alarms)
- Outputs: FunctionUrl, FrontendBucketName, CloudFrontDomain, CustomDomain, TableName, MicrovmImageArn

### Step 3: Generate `infrastructure/samconfig.toml`
SAM deploy defaults for us-east-1, stack name recovery-loop

### Step 4: Verify
- No wildcard IAM resources or actions
- MicroVM IAM permissions correctly scoped to image ARN
- All security headers present in ResponseHeadersPolicy
- DynamoDB TTL attribute name matches code (`expiresAt`)
- Function URL InvokeMode = RESPONSE_STREAM
- Custom domain and ACM cert configured on CloudFront
