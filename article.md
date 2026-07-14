# Weekend Productivity Challenge: Recovery Loop

**Tags:** #productivity

---

## Vision & What the App Does

Every developer knows the feeling: you're deep in a task, a script breaks, an install command fails with a cryptic error, and suddenly you're spending 30 minutes on Stack Overflow instead of building. **Recovery Loop** is a stateful AI unblocking tool that takes your broken code or failing command, generates a fix, executes it in an isolated sandbox, and gives you back a working solution — all in under 10 seconds.

Here's how it works from a user's perspective:

1. **Paste your problem** — drop in the error output, broken script, or describe what's blocked
2. **Click Recover** — the AI analyzes your issue, generates a safe fix script (Python or Bash), and runs it in a Firecracker-isolated sandbox
3. **Watch it work** — see real-time streaming output as the AI reasons, generates code, and executes it
4. **If it fails, it self-corrects** — the agentic retry loop feeds the error back to the model for up to 2 automatic correction attempts
5. **Resume anytime** — sessions are preserved for 24 hours in DynamoDB, so you can come back and continue where you left off

The key insight is that developers don't just need code suggestions — they need **verified execution**. Recovery Loop doesn't just tell you what to run; it actually runs it in a safe environment and shows you the real stdout/stderr result.

---

## See It in Action

Here are two example scenarios you can try at [recoveryloop.goutham.dev](https://recoveryloop.goutham.dev):

### Example 1: Fix a broken pip install

**What are you trying to fix?**
> My Python script fails because the requests library isn't installed

**Broken code / error output:**
```
import requests
response = requests.get("https://api.github.com")

Traceback (most recent call last):
  File "app.py", line 1, in <module>
    import requests
ModuleNotFoundError: No module named 'requests'
```

**What Recovery Loop does:** Generates a script that installs the package and verifies the import works — then runs it in a sandbox to confirm.

<!-- INSERT SCREENSHOT OF EXAMPLE 1 RESULT HERE -->

### Example 2: Fix a permissions error

**What are you trying to fix?**
> npm global install fails with EACCES permission denied

**Broken code / error output:**
```
$ npm install -g typescript
npm ERR! Error: EACCES: permission denied, mkdir '/usr/local/lib/node_modules/typescript'
npm ERR! code EACCES
npm ERR! syscall mkdir
```

**What Recovery Loop does:** Generates a bash script that configures npm to use a local prefix directory (`~/.npm-global`), avoiding the need for sudo.

<!-- INSERT SCREENSHOT OF EXAMPLE 2 RESULT HERE -->

---

## How I Built It

### Development Process

I built Recovery Loop in a single weekend using **[Kiro IDE](https://kiro.dev)** with the **[AI-DLC (AI-Driven Development Life Cycle)](https://github.com/awslabs/aidlc-workflows)** workflow — an adaptive, structured methodology for AI coding agents that guides you through requirements → design → code generation with approval gates at each stage. The structured approach kept me focused:

1. **Requirements Analysis** (30 min) — Defined the functional requirements, security posture, and architecture decisions upfront through a question-and-answer process
2. **Application Design** (20 min) — Identified 12 components across 3 deployment units, defined method signatures and service orchestration
3. **Code Generation** (1 hour) — Generated the full TypeScript backend (7 modules), Svelte frontend (4 components), and SAM infrastructure template
4. **Deployment & Testing** (1.5 hours) — Iteratively deployed, hit IAM issues with the new Lambda MicroVMs service, and resolved them in real-time

### Key Decisions

**Lambda Function URL with RESPONSE_STREAM** — Instead of API Gateway (which doesn't support true SSE), I used Lambda's native Function URL with response streaming. This gives the frontend real-time progress events as the AI thinks and executes.

**Lambda MicroVMs for sandboxing** — AWS launched Lambda MicroVMs in June 2026, providing Firecracker-isolated VMs with sub-second startup. Each request gets its own ephemeral microVM that's terminated immediately after execution. This is the same isolation technology that powers Lambda itself — no shared state, no escape.

**Amazon Nova 2 Lite via Converse API** — The Converse API provides a model-agnostic interface, making it trivial to swap models later. Nova 2 Lite offers fast inference at low cost, perfect for an iterative tool.

**Svelte + Vite for the frontend** — Minimal bundle size (13KB gzipped), reactive state management without a virtual DOM, and instant HMR during development.

### Challenges & Solutions

**Challenge: Lambda MicroVMs IAM permissions**
The new `lambda:RunMicrovm` and `lambda:PassNetworkConnector` actions weren't documented in many places yet. I had to iteratively discover the required permissions by reading CloudWatch error logs and adding actions one by one.

**Challenge: Bedrock returns markdown code fences**
Nova 2 Lite wraps generated scripts in ` ```bash ... ``` ` markdown fences. The sandbox was trying to execute the backticks as shell commands. Solution: added a `stripCodeFences()` function that extracts raw code from markdown formatting before execution.

**Challenge: Cross-region inference IAM**
The model ID `us.amazon.nova-2-lite-v1:0` is a cross-region inference profile that routes to different regions. The IAM policy needed wildcard region in the resource ARN (`arn:aws:bedrock:*::foundation-model/...`) because Bedrock may route to us-east-2 or other regions.

**Challenge: CloudFormation circular dependencies**
The initial template had CloudFront referencing its own distribution ID in the S3 bucket policy (for OAC). Resolved by simplifying the bucket policy to allow the CloudFront service principal without a distribution-specific condition.

---

## AWS Services Used / Architecture Overview

### Architecture Diagram

<!-- INSERT YOUR ARCHITECTURE DIAGRAM IMAGE HERE -->
<!-- Export architecture-diagram.drawio as PNG and embed -->

```
[Architecture Diagram Placeholder — see architecture-diagram.drawio]
```

### Services Used

| Service | Purpose |
|---|---|
| **AWS Lambda** (Function URL) | Backend orchestrator — Node.js 22, TypeScript, SSE streaming |
| **Lambda MicroVMs** | Firecracker-isolated sandbox for executing AI-generated scripts |
| **Amazon Bedrock** (Nova 2 Lite) | LLM inference — generates fix scripts via Converse API |
| **Amazon DynamoDB** | Session state store — 24h TTL, on-demand, PITR enabled |
| **Amazon CloudFront** | CDN for the Svelte SPA + security headers |
| **Amazon S3** | Static frontend asset hosting (private, OAC-only) |
| **AWS Certificate Manager** | TLS certificate for custom domain |
| **Amazon CloudWatch** | Structured JSON logs (90-day retention) + alarms |
| **AWS IAM** | Least-privilege execution role |
| **AWS SAM** | Infrastructure as Code (entire stack in one template) |

### How It Flows

```
Developer → CloudFront (recoveryloop.goutham.dev) → S3 (Svelte SPA)
         → Lambda Function URL (POST + SSE Stream)
              → DynamoDB (load/save session)
              → Bedrock Nova 2 Lite (generate script via Converse API)
              → Lambda MicroVM (execute script in Firecracker sandbox)
              → SSE events streamed back to browser in real-time
```

### Code Example: The Agentic Retry Loop

The core orchestration lives in `handler.ts`. Here's the simplified agentic loop:

```typescript
for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
  // 1. Invoke Bedrock to generate a fix script
  emit({ type: 'bedrock_start', payload: `Invoking Nova Lite...` });
  const scriptText = await invokeModel(messages, systemPrompt, MODEL_ID, BEDROCK_TIMEOUT_MS, logger);

  // 2. Strip markdown code fences (models often wrap output in ```)
  const cleanScript = stripCodeFences(scriptText);
  emit({ type: 'script_generated', payload: cleanScript });

  // 3. Execute in an ephemeral Lambda MicroVM
  emit({ type: 'sandbox_start', payload: 'Executing in sandbox...' });
  const result = await executeScript(cleanScript, SANDBOX_TIMEOUT_MS, logger);

  // 4. Stream stdout/stderr to the frontend
  if (result.stdout) emit({ type: 'stdout', payload: result.stdout });
  if (result.stderr) emit({ type: 'stderr', payload: result.stderr });

  // 5. If success, break. If failure, feed error back to model for correction.
  if (result.status === 'success') break;

  if (attempt < MAX_RETRIES) {
    emit({ type: 'retry', payload: `Attempt ${attempt + 1} failed. Correcting...` });
    messages = buildRetryMessages(messages, cleanScript, result.stderr, result.exitCode);
  }
}
```

### Code Example: Lambda MicroVM Sandbox Execution

```typescript
// 1. Launch an ephemeral Firecracker microVM
const runResponse = await microvmsClient.send(new RunMicrovmCommand({
  imageIdentifier: MICROVM_IMAGE_ARN,
  maximumDurationInSeconds: 120,
}));

// 2. Get auth token (JWE — required for all MicroVM endpoint access)
const tokenResponse = await microvmsClient.send(new CreateMicrovmAuthTokenCommand({
  microvmIdentifier: runResponse.microvmId,
  expirationInMinutes: 5,
  allowedPorts: [{ allPorts: {} }],
}));

// 3. POST the script to the MicroVM's executor endpoint
const execResponse = await fetch(`https://${runResponse.endpoint}/execute`, {
  method: 'POST',
  headers: { 'X-aws-proxy-auth': tokenResponse.authToken['X-aws-proxy-auth'] },
  body: JSON.stringify({ script, language: 'python', timeoutMs: 30000 }),
});

// 4. Terminate immediately (ephemeral lifecycle)
await microvmsClient.send(new TerminateMicrovmCommand({ microvmIdentifier: runResponse.microvmId }));
```

### Code Example: SSE Streaming from Svelte Frontend

```typescript
// Frontend ApiClient — connects to Lambda Function URL and parses SSE events
const response = await fetch(API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userPrompt, codeContext, sessionId }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });

  // Parse SSE "data: {...}\n\n" chunks
  const lines = buffer.split('\n\n');
  buffer = lines.pop() ?? '';

  for (const chunk of lines) {
    if (!chunk.startsWith('data:')) continue;
    const event = JSON.parse(chunk.slice(5));
    onEvent(event); // Dispatches to Svelte reactive state
  }
}
```

---

## What I Learned

### Lambda MicroVMs Are a Game-Changer

This was my first time using Lambda MicroVMs (launched June 2026). The developer experience is remarkably smooth — you provide a Dockerfile, Lambda builds a snapshot, and each `run-microvm` call launches a fresh Firecracker VM in under a second. The security model (JWE auth tokens, dedicated endpoints per VM) is production-grade out of the box. For anyone building AI agents that execute untrusted code, this eliminates the need for third-party sandbox services entirely.

### Structured AI-DLC Workflow Saves Weekend Time

Using the **[AI-DLC workflow](https://github.com/awslabs/aidlc-workflows)** — a structured requirements → design → code methodology for AI coding agents — felt counterintuitive for a "weekend hack." Why spend time on design documents when you could just code? In practice, having clear component boundaries and method signatures upfront meant the code generation phase was nearly zero-effort. The 30 minutes spent on design saved 2+ hours of debugging and refactoring later. AI-DLC's adaptive depth meant I got full treatment for the complex parts (agentic loop, IAM policies) and minimal ceremony for the simple parts (frontend components).

### SSE Streaming Makes AI Tools Feel Alive

The difference between "wait 10 seconds for a result" and "watch the AI think in real-time" is enormous for developer experience. Lambda Function URLs with RESPONSE_STREAM make this trivially easy — no WebSocket infrastructure, no polling, just `data: {...}\n\n` chunks flowing to the browser.

### Cross-Region Inference Profiles Need Wildcard IAM

If you're using Bedrock cross-region inference profiles (e.g., `us.amazon.nova-2-lite-v1:0`), your IAM policy must allow `bedrock:InvokeModel` with a wildcard region in the resource ARN. The profile routes requests to whichever region has capacity, and the IAM check happens against the destination region's model ARN.

### Property-Based Testing Catches Real Bugs

Using `fast-check` for property-based testing on pure functions (prompt builder, input validator) caught an edge case I wouldn't have found with example-based tests: the `sanitizeString` function wasn't idempotent for certain Unicode inputs. PBT generated the failing case automatically and shrunk it to a minimal reproducer.

---

## Link to App & Repo

🔗 **Live App:** [https://recoveryloop.goutham.dev](https://recoveryloop.goutham.dev)

🔗 **Source Code:** [GitHub Repository — link to be added]

---

*Built in a weekend with [Kiro IDE](https://kiro.dev), [AI-DLC workflows](https://github.com/awslabs/aidlc-workflows), AWS SAM, Amazon Bedrock Nova 2 Lite, and AWS Lambda MicroVMs.*
