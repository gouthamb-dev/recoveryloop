/**
 * UnblockAgent Lambda Handler — Orchestrates the agentic unblocking workflow.
 * Uses Lambda Function URL with RESPONSE_STREAM for SSE output.
 */

import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createLogger } from './logger';
import { validateRequest } from './validator';
import { loadSession, saveSession, generateSessionId } from './session';
import { buildSystemPrompt, buildInitialMessages, buildRetryMessages } from './prompt';
import { invokeModel } from './bedrock';
import { executeScript } from './sandbox';
import { SseEvent, ConverseMessage, ExecutionResult } from './types';

// Environment configuration
const TABLE_NAME = process.env.RECOVERY_SESSIONS_TABLE ?? 'RecoverySessions';
const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? 'us.amazon.nova-2-lite-v1:0';
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES ?? '2', 10);
const SANDBOX_TIMEOUT_MS = parseInt(process.env.SANDBOX_TIMEOUT_MS ?? '30000', 10);
const BEDROCK_TIMEOUT_MS = parseInt(process.env.BEDROCK_TIMEOUT_MS ?? '25000', 10);

/**
 * Emit a typed SSE event to the response stream.
 */
function formatSseEvent(event: SseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Lambda Function URL streaming handler.
 * Uses the awslambda.streamifyResponse wrapper for response streaming.
 */
export const handler = awslambda.streamifyResponse(
  async (event: APIGatewayProxyEventV2, responseStream: any, context: any) => {
    const requestId = context.awsRequestId ?? 'unknown';
    const logger = createLogger(requestId);

    // Set SSE content type headers
    const metadata = {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Content-Type-Options': 'nosniff',
      },
    };

    responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);

    const emit = (event: SseEvent): void => {
      responseStream.write(formatSseEvent(event));
    };

    try {
      // ─── Parse and validate request ───────────────────────────────────
      let body: unknown;
      try {
        body = JSON.parse(event.body ?? '{}');
      } catch {
        emit({ type: 'error', payload: 'Invalid JSON in request body' });
        responseStream.end();
        return;
      }

      const validation = validateRequest(body);
      if (!validation.valid) {
        emit({
          type: 'error',
          payload: 'Validation failed',
          metadata: { errors: validation.errors },
        });
        responseStream.end();
        return;
      }

      const { sessionId: inputSessionId, userPrompt, codeContext } = validation.data;

      // ─── Session management ───────────────────────────────────────────
      let sessionId: string;
      let existingSession = null;

      if (inputSessionId) {
        sessionId = inputSessionId;
        try {
          existingSession = await loadSession(sessionId, TABLE_NAME);
          logger.info('Session loaded', { sessionId, found: !!existingSession });
        } catch (err) {
          logger.warn('Failed to load session, continuing without prior context', {
            sessionId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      } else {
        sessionId = generateSessionId();
        logger.info('New session created', { sessionId });
      }

      emit({ type: 'session_start', payload: sessionId });

      // ─── Agentic retry loop ───────────────────────────────────────────
      const startTime = Date.now();
      const systemPrompt = buildSystemPrompt();
      let messages: ConverseMessage[] = buildInitialMessages(
        userPrompt,
        codeContext,
        existingSession ?? undefined
      );

      let lastScript = '';
      let lastResult: ExecutionResult = {
        status: 'failure',
        stdout: '',
        stderr: '',
        exitCode: 1,
        executionTimeMs: 0,
      };
      let retryCount = 0;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        // ─── Invoke Bedrock ─────────────────────────────────────────────
        emit({
          type: 'bedrock_start',
          payload: attempt === 0
            ? 'Invoking Nova Lite...'
            : `Invoking Nova Lite (retry ${attempt})...`,
        });

        let scriptText: string;
        try {
          scriptText = await invokeModel(messages, systemPrompt, MODEL_ID, BEDROCK_TIMEOUT_MS, logger);
        } catch (err) {
          logger.error('Bedrock invocation failed', err instanceof Error ? err : new Error(String(err)));
          emit({ type: 'error', payload: 'Failed to generate script from AI model' });

          if (attempt < MAX_RETRIES) {
            emit({ type: 'retry', payload: `Attempt ${attempt + 1} failed. Retrying...`, metadata: { attempt: attempt + 1 } });
            retryCount = attempt + 1;
            continue;
          }
          break;
        }

        lastScript = scriptText;
        emit({ type: 'script_generated', payload: scriptText });

        // ─── Execute in sandbox ─────────────────────────────────────────
        emit({ type: 'sandbox_start', payload: 'Executing script in sandbox...' });

        const result = await executeScript(scriptText, SANDBOX_TIMEOUT_MS, logger);
        lastResult = result;

        // Emit stdout/stderr
        if (result.stdout) {
          emit({ type: 'stdout', payload: result.stdout });
        }
        if (result.stderr) {
          emit({ type: 'stderr', payload: result.stderr });
        }

        // ─── Check result ───────────────────────────────────────────────
        if (result.status === 'success') {
          retryCount = attempt;
          break;
        }

        // Failed — retry if attempts remain
        if (attempt < MAX_RETRIES) {
          retryCount = attempt + 1;
          emit({
            type: 'retry',
            payload: `Attempt ${attempt + 1} failed (exit code ${result.exitCode}). Sending error to model for correction...`,
            metadata: { attempt: attempt + 1 },
          });

          // Build retry messages with error context
          messages = buildRetryMessages(messages, scriptText, result.stderr, result.exitCode);
        } else {
          retryCount = attempt;
        }
      }

      const executionTimeMs = Date.now() - startTime;

      // ─── Persist session state ──────────────────────────────────────────
      try {
        await saveSession(sessionId, userPrompt, lastScript, lastResult, TABLE_NAME);
        logger.info('Session saved', { sessionId });
      } catch (err) {
        logger.error('Failed to save session', err instanceof Error ? err : new Error(String(err)));
        // Non-fatal — we still emit the final event
      }

      // ─── Emit final result ──────────────────────────────────────────────
      emit({
        type: 'final',
        payload: lastResult.status === 'success' ? 'success' : 'failure',
        metadata: {
          sessionId,
          retryCount,
          executionTimeMs,
          generatedScript: lastScript,
          message: lastResult.status === 'success'
            ? 'Script executed successfully'
            : `Script failed after ${retryCount + 1} attempt(s)`,
        },
      });
    } catch (err: unknown) {
      // Global error handler — catches any unhandled exception
      logger.error('Unhandled error in handler', err instanceof Error ? err : new Error(String(err)));
      emit({ type: 'error', payload: 'An internal error occurred. Please try again.' });
    } finally {
      responseStream.end();
    }
  }
);

// Type declaration for the Lambda streaming API
declare const awslambda: {
  streamifyResponse: (handler: (event: any, responseStream: any, context: any) => Promise<void>) => any;
  HttpResponseStream: {
    from: (stream: any, metadata: any) => any;
  };
};
