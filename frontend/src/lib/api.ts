/**
 * ApiClient — Thin wrapper for Lambda Function URL + SSE streaming.
 * No retry logic (MVP). Uses fetch for POST, then parses SSE from response body stream.
 */

import type { SessionPayload, SseEvent } from './types';

const API_URL = import.meta.env.VITE_API_URL as string;

/**
 * Submit a session payload and stream SSE events back.
 * Uses fetch + ReadableStream to parse SSE from the Lambda response stream.
 */
export async function submitSession(
  params: SessionPayload,
  onEvent: (event: SseEvent) => void,
  onComplete: (sessionId: string) => void,
  onError: (error: Error) => void
): Promise<void> {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      onError(new Error(`HTTP ${response.status}: ${response.statusText}`));
      return;
    }

    if (!response.body) {
      onError(new Error('Response body is null — SSE not supported'));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let sessionId = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      const lines = buffer.split('\n\n');
      buffer = lines.pop() ?? ''; // Keep incomplete last chunk

      for (const chunk of lines) {
        const line = chunk.trim();
        if (!line.startsWith('data:')) continue;

        const jsonStr = line.slice(5).trim(); // Remove 'data:' prefix
        if (!jsonStr) continue;

        try {
          const event: SseEvent = JSON.parse(jsonStr);
          onEvent(event);

          // Track sessionId from session_start event
          if (event.type === 'session_start') {
            sessionId = event.payload;
          }

          // Complete on final event
          if (event.type === 'final') {
            onComplete(sessionId || (event.metadata?.sessionId as string) || '');
            return;
          }

          // Error event — surface and continue (stream may have more)
          if (event.type === 'error') {
            // Don't abort — the stream will end naturally
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }

    // Stream ended without a 'final' event
    onComplete(sessionId);
  } catch (err: unknown) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}
