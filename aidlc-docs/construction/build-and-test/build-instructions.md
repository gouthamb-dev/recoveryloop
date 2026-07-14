# Recovery Loop — Build Instructions

## Prerequisites

| Tool | Version | Check Command |
|---|---|---|
| Node.js | >= 20.x | `node --version` |
| npm | >= 10.x | `npm --version` |
| AWS SAM CLI | >= 1.100.0 | `sam --version` |
| AWS CLI | >= 2.x | `aws --version` |
| AWS credentials | us-east-1 configured | `aws sts get-caller-identity` |

---

## Step 1: Install Backend Dependencies

```bash
cd backend-lambda
npm ci
```

**Expected output**: Clean install, no vulnerabilities in production dependencies.

## Step 2: Build Backend TypeScript

```bash
cd backend-lambda
npm run build
```

**Expected output**: TypeScript compiles to `dist/` without errors. Files:
- `dist/handler.js`
- `dist/session.js`
- `dist/prompt.js`
- `dist/bedrock.js`
- `dist/sandbox.js`
- `dist/validator.js`
- `dist/logger.js`
- `dist/types.js`

**Verification**: `ls dist/*.js` shows all 8 files.

## Step 3: SAM Build

```bash
cd infrastructure
sam build
```

**Expected output**: SAM resolves the Lambda code from `../backend-lambda/`, runs the Makefile build, and produces `.aws-sam/build/UnblockAgentFunction/`.

**Verification**: `.aws-sam/build/UnblockAgentFunction/dist/handler.js` exists.

## Step 4: Install Frontend Dependencies

```bash
cd frontend
npm ci
```

## Step 5: Build Frontend

```bash
cd frontend
VITE_API_URL=https://placeholder.lambda-url.us-east-1.on.aws/ npm run build
```

**Expected output**: Vite builds to `dist/` with:
- `dist/index.html`
- `dist/assets/index-*.js`
- `dist/assets/index-*.css`

**Verification**: `ls frontend/dist/index.html` exists.

---

## Full Build (all units, from workspace root)

```bash
# Backend
cd backend-lambda && npm ci && npm run build && cd ..

# SAM
cd infrastructure && sam build && cd ..

# Frontend (use placeholder URL for build validation)
cd frontend && npm ci && VITE_API_URL=https://placeholder.lambda-url.us-east-1.on.aws/ npm run build && cd ..
```

---

## Deployment (after build)

See `README.md` at workspace root for full deployment instructions including:
1. `sam deploy --guided`
2. Building frontend with real `VITE_API_URL`
3. S3 sync + CloudFront invalidation
