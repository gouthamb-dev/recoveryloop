# Infrastructure Unit — Business Logic Model

## Overview
The infrastructure unit contains no application business logic. Its "logic" is the
declarative resource provisioning model expressed in the SAM template.

---

## Resource Provisioning Model

```
SAM Template (template.yaml)
  |
  +-- Parameters
  |     RecoverySessionsTableName    (default: RecoverySessions)
  |     BedrockModelId               (default: us.amazon.nova-2-lite-v1:0)
  |     MicrovmImageArn              (default: arn:aws:lambda:us-east-1:<ACCOUNT_ID>:microvm-image:recovery-loop-executor)
  |     LogRetentionDays             (default: 90)
  |     Environment                  (default: prod)
  |     CustomDomainName             (default: recoveryloop.goutham.dev)
  |     AcmCertificateArn            (default: arn:aws:acm:us-east-1:<ACCOUNT_ID>:certificate/efef378a-6405-4800-8158-b864ea298fbd)
  |
  +-- Globals
  |     Function: Runtime, Timeout, MemorySize, Environment vars
  |
  +-- Resources
        |
        +-- RecoverySessionsTable (AWS::DynamoDB::Table)
        |     KeySchema: sessionId (HASH)
        |     BillingMode: PAY_PER_REQUEST
        |     SSESpecification: Enabled
        |     TimeToLiveSpecification: expiresAt
        |
        +-- UnblockAgentFunction (AWS::Serverless::Function)
        |     Runtime: nodejs22.x
        |     FunctionUrlConfig: AuthType=NONE, InvokeMode=RESPONSE_STREAM
        |     Policies: [DynamoDBPolicy, BedrockPolicy, MicroVMPolicy, LogsPolicy]
        |
        +-- FrontendBucket (AWS::S3::Bucket)
        |     PublicAccessBlockConfiguration: all true
        |     VersioningConfiguration: Enabled
        |     BucketEncryption: SSE-S3
        |
        +-- FrontendBucketPolicy (AWS::S3::BucketPolicy)
        |     Allows: CloudFront OAC only
        |
        +-- CloudFrontOAC (AWS::CloudFront::OriginAccessControl)
        |
        +-- AcmCertificate (AWS::CertificateManager::Certificate)
        |     DomainName: recoveryloop.goutham.dev
        |
        +-- FrontendDistribution (AWS::CloudFront::Distribution)
        |     Origins: S3 (OAC)
        |     Aliases: [recoveryloop.goutham.dev]
        |     ViewerCertificate: AcmCertificateArn
        |     DefaultRootObject: index.html
        |     CustomErrorResponses: 404 -> /index.html (200)
        |     ResponseHeadersPolicy: Security headers
        |     ViewerProtocolPolicy: redirect-to-https
        |
        +-- LambdaLogGroup (AWS::Logs::LogGroup)
        |     RetentionInDays: !Ref LogRetentionDays
        |
        +-- LambdaErrorAlarm (AWS::CloudWatch::Alarm)
        +-- LambdaThrottleAlarm (AWS::CloudWatch::Alarm)
        +-- LambdaDurationAlarm (AWS::CloudWatch::Alarm)
  |
  +-- Outputs
        FunctionUrl        (Lambda Function URL for frontend VITE_API_URL)
        FrontendBucketName (S3 bucket name for aws s3 sync)
        CloudFrontDomain   (CloudFront domain for CORS configuration)
        CustomDomain       (Custom domain: recoveryloop.goutham.dev)
        TableName          (DynamoDB table name)
        MicrovmImageArn    (Lambda MicroVM image ARN)
```

## Deployment Sequence Logic
1. SAM resolves all `!Ref` and `!Sub` expressions
2. CloudFormation creates resources in dependency order automatically
3. Key dependency chain: DynamoDB Table → Lambda IAM Role → Lambda Function → Function URL → CloudFront

## Stack Outputs (consumed by other units)
All outputs are exported for cross-stack or manual consumption:
- `FunctionUrl` → used as `VITE_API_URL` in frontend build
- `FrontendBucketName` → used in `aws s3 sync` deploy command
- `CloudFrontDomain` → used in Lambda Function URL CORS config and frontend display
- `CustomDomain` → `recoveryloop.goutham.dev` (served via CloudFront)
- `TableName` → injected as Lambda env var `RECOVERY_SESSIONS_TABLE`
- `MicrovmImageArn` → injected as Lambda env var `MICROVM_IMAGE_ARN`

