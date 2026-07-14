# Infrastructure Unit — Deployment Architecture

## Deployment Architecture Diagram

```
AWS us-east-1
+------------------------------------------------------------------+
|                                                                  |
|  [Browser]                                                       |
|      |                                                           |
|      | HTTPS (SPA assets)          | HTTPS SSE + POST           |
|      v                             v                             |
|  [CloudFront Distribution]    [Lambda Function URL]              |
|  recoveryloop.goutham.dev          |                             |
|  (ACM cert)                        |                             |
|      |                             | invoke                     |
|      | OAC                         v                             |
|      v                      [Lambda: UnblockAgent]               |
|  [S3 Bucket: frontend]            |                             |
|                    +---------------+---------------+             |
|                    |               |               |             |
|                    v               v               v             |
|             [DynamoDB]     [Bedrock Nova 2 Lite] [Lambda MicroVMs]|
|          RecoverySessions    (via AWS API)    recovery-loop-executor|
|                                                                  |
|  [CloudWatch]                                                    |
|    Log Group: /aws/lambda/UnblockAgent (90d)                     |
|    Alarms: Errors, Throttles, Duration                           |
|    SNS Topic: RecoveryLoopAlerts                                 |
|                                                                  |
+------------------------------------------------------------------+
```

## Network Security

- Lambda Function URL: public HTTPS endpoint, no VPC required
- All AWS SDK calls go through AWS service endpoints (HTTPS, TLS 1.2+)
- Lambda MicroVM communication goes through AWS internal endpoints (IAM-authenticated)
- No VPC configuration needed for MVP (Lambda runs in AWS-managed VPC)
- CORS on Function URL: restricted to CloudFront domain (`recoveryloop.goutham.dev`)

## Deployment Steps

```
1. sam build
   - Compiles backend-lambda TypeScript (runs npm run build in backend-lambda/)
   - Packages Lambda artifact

2. sam deploy --guided (first time) OR sam deploy (subsequent)
   - Creates/updates CloudFormation stack: recovery-loop
   - Provisions all resources in dependency order
   - Outputs: FunctionUrl, FrontendBucketName, CloudFrontDomain, CustomDomain, TableName, MicrovmImageArn

3. VITE_API_URL=<FunctionUrl> npm run build (in frontend/)
   - Build Svelte SPA with correct API endpoint

4. aws s3 sync frontend/dist/ s3://<FrontendBucketName>/ --delete
   - Sync frontend assets to S3

5. aws cloudfront create-invalidation \
     --distribution-id <DistributionId> \
     --paths "/*"
   - Invalidate CloudFront cache
```

## Rollback Procedure

```
# Lambda / infrastructure rollback
aws cloudformation rollback-stack --stack-name recovery-loop

# Frontend rollback (restore previous S3 version)
# List previous versions:
aws s3api list-object-versions --bucket <FrontendBucketName> --prefix index.html
# Copy previous version to current:
aws s3api copy-object --copy-source <BucketName>/index.html?versionId=<PrevVersionId> \
  --bucket <BucketName> --key index.html
aws cloudfront create-invalidation --distribution-id <DistId> --paths "/*"
```
