# Recovery Loop — Requirements Verification Questions

Please answer each question by filling in the letter choice (or custom response) after the `[Answer]:` tag.
If none of the provided options match your needs, choose the last option (Other) and describe your preference.

---

## Question 1
Which Amazon Bedrock model should be used as the primary LLM?

A) Amazon Nova Lite (lower cost, faster latency — good for iteration)

B) Anthropic Claude 3 Haiku (strong instruction-following — good for code generation)

C) Support both models with a configurable environment variable (default to one)

D) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 2
What is the expected session lifecycle for DynamoDB records?

A) Sessions expire after 24 hours (TTL-based cleanup)

B) Sessions expire after 7 days (TTL-based cleanup)

C) Sessions are permanent until explicitly deleted

D) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 3
What is the expected maximum execution time for E2B sandbox scripts?

A) 30 seconds (safe default for most scripts)

B) 60 seconds (longer-running scripts)

C) 120 seconds (complex multi-step scripts)

D) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 4
Should the frontend support resuming a prior session by entering an existing sessionId?

A) Yes — include a "Resume Session" input field on the frontend so users can re-enter a prior sessionId

B) No — sessions are identified automatically server-side; the frontend always starts fresh

C) Yes — but only via URL query parameter (e.g., `?session=abc123`)

D) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 5
How should the frontend display AI reasoning progress and execution steps?

A) Stream output token-by-token from the backend using Server-Sent Events (SSE)

B) Poll the backend periodically (e.g., every 2 seconds) while execution is in progress

C) Single-shot: show a loading spinner and display the final result only

D) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 6
Should the E2B sandbox support both Python and Bash/Shell scripts, or only one language?

A) Both Python and Bash (the LLM decides which to generate based on context)

B) Python only

C) Bash/Shell only

D) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 7
What should happen when the E2B sandbox execution fails (non-zero exit code or timeout)?

A) Retry once automatically, then return failure with full stderr output

B) Return failure immediately with full stderr — no retry

C) Automatically feed the error back to Bedrock for a corrected script attempt (agentic loop), up to 2 retries

D) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## Question 8
What is the intended deployment environment for the MVP?

A) AWS us-east-1 (N. Virginia)

B) AWS us-west-2 (Oregon)

C) AWS eu-west-1 (Ireland)

D) Other region (please specify after [Answer]: tag below)

[Answer]: A

---

## Question 9
Should the API Gateway endpoint be public (no auth) or protected?

A) Public — no authentication for the MVP (developer tool, internal use)

B) API Key authentication via API Gateway usage plan

C) AWS IAM authentication (SigV4 signed requests)

D) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 10
Should the Svelte frontend be deployed as a static site (e.g., S3 + CloudFront), or is local-only sufficient for the MVP?

A) Local dev only for the MVP — no cloud frontend deployment needed

B) Deploy to S3 + CloudFront as part of the SAM/CDK stack

C) Deploy to a separate hosting provider (Netlify, Vercel, etc.) — just need the Vite build output

D) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 11
Should the system store the full conversation history (multi-turn) per session, or only the most recent exchange?

A) Full conversation history — append each exchange to the DynamoDB record (supports multi-turn context)

B) Most recent exchange only — overwrite the previous result on each call

C) Last N exchanges (e.g., last 5) to manage DynamoDB item size

D) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 12: Security Extension
Should security extension rules be enforced for this project?

A) Yes — enforce all SECURITY rules as blocking constraints (recommended for production-grade applications)

B) No — skip all SECURITY rules (suitable for PoCs, prototypes, and experimental projects)

X) Other (please describe after [Answer]: tag below)

[Answer]: A and B

---

## Question 13: Resiliency Extension
Should the resiliency baseline be applied to this project?

**What this extension is.** Enabling it applies a set of **directional, design-time best practices** for building resilient systems, derived from the **AWS Well-Architected Framework (Reliability Pillar)**. It steers requirements, design, and code toward fault tolerance, high availability, observability, and recoverability.

**What this extension is NOT.** It does **not** make your workload production-ready, nor does it certify any availability, RTO, or RPO target. Treat output as a well-grounded **first draft of your resiliency posture**.

A) Yes — apply the resiliency baseline as directional best practices (recommended for production-grade tools)

B) No — skip the resiliency baseline (suitable for PoCs and prototypes)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 14: Property-Based Testing Extension
Should property-based testing (PBT) rules be enforced for this project?

A) Yes — enforce all PBT rules as blocking constraints (recommended for projects with business logic, data transformations, or stateful components)

B) Partial — enforce PBT rules only for pure functions and serialization round-trips

C) No — skip all PBT rules (suitable for simple MVP/prototype scope)

X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

*Once you have answered all questions, please let me know and I will generate the full requirements document.*
