/**
 * Recovery Loop — Frontend TypeScript types (duplicated from backend for MVP)
 */

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

export interface OutputLine {
  type: 'info' | 'stdout' | 'stderr' | 'error' | 'success' | 'retry';
  text: string;
  timestamp: string;
}
