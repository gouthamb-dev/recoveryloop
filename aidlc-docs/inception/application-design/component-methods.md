# Recovery Loop — Component Method Signatures

**Note**: Detailed business rule logic is defined in Functional Design (per-unit, CONSTRUCTION phase).
This document captures method signatures, input/output types, and high-level purpose.

---

## UNIT 2: Backend Lambda

### UnblockAgentHandler

```typescript
// Lambda Function URL streaming handler entry point
export const handler: StreamifyHandler = async (
  event: APIGatewayProxyEventV2,
  responseStream: ResponseStream,
  context: Context
): Promise<void>
```

```typescript
// Core orchestration loop — called by handler
async function runAgenticLoop(
  params: AgenticLoopParams,       // { sessionId, userPrompt, codeContext, existingSession? }
  emitter: SseEmitter,             // typed SSE event emitter
  maxRetries: number               // = 2
): Promise<AgenticLoopResult>      // { status, generatedScript, stdout, stderr, retryCount, executionTimeMs }
```

---

### SessionService

```typescript
// Load an existing session — returns null if not found
export async function loadSession(
  sessionId: string,
  tableName: string
): Promise<SessionRecord | null>

// Session record shape
export interface SessionRecord {
  sessionId: string;
  lastPrompt: string;
  lastScript: string;
  lastResult: ExecutionResult;
  lastUpdatedAt: string;           // ISO 8601
  expiresAt: number;               // Unix epoch seconds (TTL)
}

// Persist the most recent exchange (upsert — last-write-wins)
export async function saveSession(
  record: SessionRecord,
  tableName: string
): Promise<void>

// Generate a new sessionId (UUID v4)
export function generateSessionId(): string
```

---

### PromptBuilder

```typescript
// Build the initial system prompt message array for Converse API
export function buildInitialMessages(
  userPrompt: string,
  codeContext: string,
  priorSession?: SessionRecord
): ConverseMessage[]              // [{ role: "user", content: [{ text: "..." }] }]

// Build the retry message — appends error context from failed execution
export function buildRetryMessages(
  previousMessages: ConverseMessage[],
  failedResult: ExecutionResult   // { stdout, stderr, exitCode }
): ConverseMessage[]

// Build the full system prompt string (Unblocking Agent persona)
export function buildSystemPrompt(): string

// Types
export interface ConverseMessage {
  role: "user" | "assistant";
  content: Array<{ text: string }>;
}
```

---

### BedrockService

```typescript
// Invoke Bedrock Converse API — returns the raw generated script text
export async function invokeModel(
  messages: ConverseMessage[],
  systemPrompt: string,
  modelId: string,
  timeoutMs: number               // default: 25000
): Promise<string>                // raw script text extracted from response

// Parse the script text out of a Converse API response
export function extractScriptFromResponse(
  response: ConverseResponse
): string

// Types
export interface BedrockInvocationResult {
  scriptText: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}
```

---

### SandboxService

```typescript
// Execute a script in an ephemeral Lambda MicroVM
export async function executeScript(
  script: string,
  timeoutMs: number,              // default: 30000
  logger: Logger
): Promise<ExecutionResult>

// Detect script language from content (shebang or heuristic)
export function detectScriptLanguage(
  script: string
): "python" | "bash"

// Types
export interface ExecutionResult {
  status: "success" | "failure" | "timeout";
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
}
```

---

### Logger

```typescript
// Structured JSON logger — all methods log to stdout
export interface LogEntry {
  timestamp: string;               // ISO 8601
  requestId: string;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR";
  message: string;
  context?: Record<string, unknown>;
}

export function createLogger(requestId: string): Logger

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
}
```

---

### InputValidator

```typescript
// Validate and sanitize the raw Lambda event body
export function validateRequest(
  body: unknown
): ValidationResult<UnblockRequest>

// Types
export interface UnblockRequest {
  sessionId?: string;              // optional — UUID v4 or absent
  userPrompt: string;              // 1–2000 chars, no HTML/script
  codeContext: string;             // 0–10000 chars
}

export type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; errors: ValidationError[] }

export interface ValidationError {
  field: string;
  message: string;
}

// Check sessionId format
export function isValidSessionId(value: string): boolean

// Sanitize a string — strip HTML tags and script injection patterns
export function sanitizeString(input: string): string
```

---

### SSE Emitter (shared type used by handler)

```typescript
// Typed SSE event envelope
export interface SseEvent {
  type:
    | "session_start"
    | "bedrock_start"
    | "script_generated"
    | "sandbox_start"
    | "stdout"
    | "stderr"
    | "retry"
    | "final"
    | "error";
  payload: string;
  metadata?: Record<string, unknown>;
}

// Emit a typed SSE event to the response stream
export function emitSseEvent(
  stream: ResponseStream,
  event: SseEvent
): void
```

---

## UNIT 3: Frontend

### ApiClient

```typescript
// Submit a session and open the SSE stream
export async function submitSession(
  params: SessionPayload,
  onEvent: (event: SseEvent) => void,
  onComplete: (sessionId: string) => void,
  onError: (error: Error) => void
): Promise<void>

// Types
export interface SessionPayload {
  sessionId?: string;
  userPrompt: string;
  codeContext: string;
}

export interface SseEvent {
  type: string;
  payload: string;
  metadata?: Record<string, unknown>;
}
```

---

### App (Svelte store/state shape)

```typescript
// Reactive state shape managed in App.svelte
interface AppState {
  sessionId: string;
  userPrompt: string;
  codeContext: string;
  outputLines: OutputLine[];
  isLoading: boolean;
  status: "idle" | "running" | "success" | "failure";
}

interface OutputLine {
  type: "info" | "stdout" | "stderr" | "error" | "success" | "retry";
  text: string;
  timestamp: string;
}
```
