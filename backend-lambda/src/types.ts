/**
 * Recovery Loop — Shared TypeScript types for the backend Lambda
 */

// ─── Request / Response ────────────────────────────────────────────────────────

export interface UnblockRequest {
  sessionId?: string;
  userPrompt: string;
  codeContext: string;
}

export interface UnblockResponse {
  sessionId: string;
  status: 'success' | 'failure';
  generatedScript: string;
  stdout: string;
  stderr: string;
  retryCount: number;
  executionTimeMs: number;
  message: string;
}

// ─── Session ───────────────────────────────────────────────────────────────────

export interface SessionRecord {
  sessionId: string;
  lastPrompt: string;
  lastScript: string;
  lastResult: ExecutionResult;
  lastUpdatedAt: string;
  expiresAt: number;
}

// ─── Execution ─────────────────────────────────────────────────────────────────

export interface ExecutionResult {
  status: 'success' | 'failure' | 'timeout';
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
}

// ─── SSE Events ────────────────────────────────────────────────────────────────

export type SseEventType =
  | 'session_start'
  | 'bedrock_start'
  | 'script_generated'
  | 'sandbox_start'
  | 'stdout'
  | 'stderr'
  | 'retry'
  | 'final'
  | 'error';

export interface SseEvent {
  type: SseEventType;
  payload: string;
  metadata?: Record<string, unknown>;
}

// ─── Bedrock (Converse API) ────────────────────────────────────────────────────

export interface ConverseMessage {
  role: 'user' | 'assistant';
  content: Array<{ text: string }>;
}

// ─── Validation ────────────────────────────────────────────────────────────────

export type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; errors: ValidationError[] };

export interface ValidationError {
  field: string;
  message: string;
}

// ─── Agentic Loop ──────────────────────────────────────────────────────────────

export interface AgenticLoopParams {
  sessionId: string;
  userPrompt: string;
  codeContext: string;
  existingSession?: SessionRecord;
}

export interface AgenticLoopResult {
  status: 'success' | 'failure';
  generatedScript: string;
  stdout: string;
  stderr: string;
  retryCount: number;
  executionTimeMs: number;
}
