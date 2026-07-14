/**
 * BedrockService — Invokes Amazon Bedrock Nova Lite via the Converse API.
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type ContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import { ConverseMessage } from './types';
import { Logger } from './logger';

const client = new BedrockRuntimeClient({});

/**
 * Invoke Bedrock Converse API and return the generated script text.
 * Applies an explicit timeout via AbortController.
 */
export async function invokeModel(
  messages: ConverseMessage[],
  systemPrompt: string,
  modelId: string,
  timeoutMs: number,
  logger: Logger
): Promise<string> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    logger.info('Invoking Bedrock Converse API', { modelId, messageCount: messages.length });

    // Convert our typed messages to SDK format
    const sdkMessages: Message[] = messages.map((msg) => ({
      role: msg.role,
      content: msg.content.map((c) => ({ text: c.text }) as ContentBlock),
    }));

    const response = await client.send(
      new ConverseCommand({
        modelId,
        system: [{ text: systemPrompt }],
        messages: sdkMessages,
        inferenceConfig: {
          maxTokens: 4096,
          temperature: 0.2,
        },
      }),
      { abortSignal: controller.signal }
    );

    const latencyMs = Date.now() - startTime;
    const usage = response.usage;

    logger.info('Bedrock invocation complete', {
      latencyMs,
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
    });

    // Extract text from response
    const scriptText = extractScriptFromResponse(response.output);
    return scriptText;
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    if (err instanceof Error && err.name === 'AbortError') {
      logger.error('Bedrock invocation timed out', err, { timeoutMs, latencyMs });
      throw new BedrockTimeoutError(`Bedrock invocation timed out after ${timeoutMs}ms`);
    }
    logger.error('Bedrock invocation failed', err instanceof Error ? err : new Error(String(err)), { latencyMs });
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Extract the script text from a Converse API response output.
 */
export function extractScriptFromResponse(output: unknown): string {
  // The Converse API response output has shape: { message: { role, content: [{ text }] } }
  const msg = (output as { message?: { content?: Array<{ text?: string }> } })?.message;
  if (!msg?.content || msg.content.length === 0) {
    throw new Error('Bedrock response contained no content blocks');
  }

  const text = msg.content[0]?.text;
  if (!text) {
    throw new Error('Bedrock response content block had no text');
  }

  return stripCodeFences(text.trim());
}

/**
 * Strip markdown code fences from model output.
 * Models often wrap scripts in ```bash ... ``` or ```python ... ```
 */
export function stripCodeFences(text: string): string {
  // Match ```lang\n...``` or ```\n...```
  const fenceRegex = /^```[a-zA-Z]*\s*\n([\s\S]*?)\n```\s*$/;
  const match = text.match(fenceRegex);
  if (match) {
    return match[1].trim();
  }
  return text;
}

export class BedrockTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BedrockTimeoutError';
  }
}
