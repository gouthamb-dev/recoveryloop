# Infrastructure Unit — Business Rules

## Overview
Infrastructure unit business rules are resource configuration constraints and compliance
requirements rather than application business logic.

---

## Rule IR-01: DynamoDB TTL Enforcement
- Every DynamoDB item MUST have `expiresAt` set to `Math.floor(Date.now() / 1000) + 86400`
- TTL attribute name MUST be `expiresAt` (configured in table definition)
- Sessions MUST NOT be stored without an `expiresAt` value

## Rule IR-02: Lambda Concurrency
- `ReservedConcurrentExecutions` is NOT set (removed due to account quota limitations)
- Relies on account-level concurrency limits
- API Gateway throttling configuration serves as rate limiter

## Rule IR-03: S3 Public Access Block
- All four S3 Block Public Access settings MUST be `true`
- Bucket policy MUST only allow CloudFront OAC principal
- Direct S3 URL access MUST return 403

## Rule IR-04: CloudFront HTTPS Enforcement
- `ViewerProtocolPolicy` MUST be `redirect-to-https` on all behaviors
- `MinimumProtocolVersion` MUST be `TLSv1.2_2021` or higher

## Rule IR-05: IAM Least Privilege
- Lambda execution role MUST only include:
  - `dynamodb:GetItem`, `dynamodb:PutItem` on `RecoverySessions` table ARN
  - `bedrock:InvokeModel` on the specific model ARN (`us.amazon.nova-2-lite-v1:0`)
  - `lambda:RunMicrovm`, `lambda:CreateMicrovmAuthToken`, `lambda:TerminateMicrovm`, `lambda:GetMicrovm`, `lambda:PassNetworkConnector` on the MicroVM image ARN
  - `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` on the log group ARN
- No wildcard (`*`) resource ARNs permitted

## Rule IR-06: CloudWatch Log Retention
- Log Group retention MUST be set to exactly 90 days minimum
- Lambda role MUST NOT have `logs:DeleteLogGroup` or `logs:DeleteLogStream`

## Rule IR-07: Encryption at Rest
- DynamoDB: SSE enabled (AWS-managed key)
- S3: SSE-S3 (AES-256) on all objects
- Secrets Manager: encrypted by default (AWS-managed key)

## Rule IR-08: SAM Parameter Defaults
- All environment-specific values (table name, MicroVM image ARN, model ID) MUST be SAM parameters
  with sensible defaults — no hardcoded values in the template
- No external API keys should appear in `template.yaml` — all sandbox auth is via IAM
