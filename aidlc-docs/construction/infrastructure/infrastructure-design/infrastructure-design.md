# Infrastructure Unit — Infrastructure Design

## AWS Region: us-east-1

## Resource Inventory

| Resource | Type | Name / ID Pattern |
|---|---|---|
| DynamoDB Table | AWS::DynamoDB::Table | `RecoverySessions` |
| Lambda Function | AWS::Serverless::Function | `UnblockAgent` |
| Lambda Function URL | (part of Function) | `https://qjxbc57mvi42vo4ldw3rygg64q0ywkoa.lambda-url.us-east-1.on.aws/` |
| Lambda MicroVM Image | AWS::Lambda::MicrovmImage | `recovery-loop-executor` |
| S3 Bucket (assets) | AWS::S3::Bucket | `recovery-loop-frontend-<AccountId>` |
| S3 Bucket (logs) | AWS::S3::Bucket | `recovery-loop-logs-<AccountId>` |
| CloudFront OAC | AWS::CloudFront::OriginAccessControl | `RecoveryLoopOAC` |
| CloudFront Distribution | AWS::CloudFront::Distribution | `djvdymyhnpiw0.cloudfront.net` |
| CloudFront Headers Policy | AWS::CloudFront::ResponseHeadersPolicy | `RecoveryLoopSecurityHeaders` |
| ACM Certificate | AWS::CertificateManager::Certificate | `recoveryloop.goutham.dev` |
| IAM Role | AWS::IAM::Role | `UnblockAgentRole` |
| CloudWatch Log Group | AWS::Logs::LogGroup | `/aws/lambda/UnblockAgent` |
| CloudWatch Alarm (errors) | AWS::CloudWatch::Alarm | `UnblockAgentErrors` |
| CloudWatch Alarm (throttles) | AWS::CloudWatch::Alarm | `UnblockAgentThrottles` |
| CloudWatch Alarm (duration) | AWS::CloudWatch::Alarm | `UnblockAgentDuration` |
| SNS Topic (alarms) | AWS::SNS::Topic | `RecoveryLoopAlerts` (placeholder) |

## IAM Role: UnblockAgentRole

```yaml
Policies:
  - PolicyName: DynamoDBAccess
    PolicyDocument:
      Statement:
        - Effect: Allow
          Actions: [dynamodb:GetItem, dynamodb:PutItem]
          Resource: !GetAtt RecoverySessionsTable.Arn

  - PolicyName: BedrockAccess
    PolicyDocument:
      Statement:
        - Effect: Allow
          Actions: [bedrock:InvokeModel]
          Resource: !Sub arn:aws:bedrock:us-east-1::foundation-model/us.amazon.nova-2-lite-v1:0

  - PolicyName: MicroVMAccess
    PolicyDocument:
      Statement:
        - Effect: Allow
          Actions:
            - lambda:RunMicrovm
            - lambda:CreateMicrovmAuthToken
            - lambda:TerminateMicrovm
            - lambda:GetMicrovm
            - lambda:PassNetworkConnector
          Resource: arn:aws:lambda:us-east-1:<ACCOUNT_ID>:microvm-image:recovery-loop-executor

  - PolicyName: LogsAccess
    PolicyDocument:
      Statement:
        - Effect: Allow
          Actions: [logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents]
          Resource: !Sub arn:aws:logs:us-east-1:${AWS::AccountId}:log-group:/aws/lambda/UnblockAgent:*
```

## SAM Parameters

```yaml
Parameters:
  RecoverySessionsTableName:
    Type: String
    Default: RecoverySessions
  BedrockModelId:
    Type: String
    Default: us.amazon.nova-2-lite-v1:0
  MicrovmImageArn:
    Type: String
    Default: arn:aws:lambda:us-east-1:<ACCOUNT_ID>:microvm-image:recovery-loop-executor
  LogRetentionDays:
    Type: Number
    Default: 90
  Environment:
    Type: String
    Default: prod
    AllowedValues: [dev, staging, prod]
  CustomDomainName:
    Type: String
    Default: recoveryloop.goutham.dev
  AcmCertificateArn:
    Type: String
    Default: arn:aws:acm:us-east-1:<ACCOUNT_ID>:certificate/efef378a-6405-4800-8158-b864ea298fbd
```

## Stack Outputs

```yaml
Outputs:
  FunctionUrl:
    Description: Lambda Function URL for SSE streaming
    Value: !GetAtt UnblockAgentFunctionUrl.FunctionUrl
    Export:
      Name: !Sub ${AWS::StackName}-FunctionUrl

  FrontendBucketName:
    Description: S3 bucket name for frontend asset sync
    Value: !Ref FrontendBucket
    Export:
      Name: !Sub ${AWS::StackName}-FrontendBucket

  CloudFrontDomain:
    Description: CloudFront distribution domain name
    Value: !GetAtt FrontendDistribution.DomainName
    Export:
      Name: !Sub ${AWS::StackName}-CloudFrontDomain

  CustomDomain:
    Description: Custom domain for the application
    Value: !Ref CustomDomainName
    Export:
      Name: !Sub ${AWS::StackName}-CustomDomain

  TableName:
    Description: DynamoDB table name
    Value: !Ref RecoverySessionsTable
    Export:
      Name: !Sub ${AWS::StackName}-TableName

  MicrovmImageArn:
    Description: Lambda MicroVM image ARN for sandbox execution
    Value: !Ref MicrovmImageArn
    Export:
      Name: !Sub ${AWS::StackName}-MicrovmImageArn
```

## Deploy Configuration (samconfig.toml)

```toml
version = 0.1

[default.deploy.parameters]
stack_name = "recovery-loop"
region = "us-east-1"
confirm_changeset = true
capabilities = "CAPABILITY_IAM"
parameter_overrides = "Environment=prod"
resolve_s3 = true
```

