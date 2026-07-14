/**
 * PromptBuilder — Pure functions for constructing Bedrock Converse API messages.
 * No I/O, no side effects. PBT applicable.
 */

import { ConverseMessage, SessionRecord } from './types';

const SYSTEM_PROMPT = `You are an Unblocking Agent. Your job is to help developers recover from broken scripts, failing commands, or blocked implementation tasks.

Rules:
1. Analyze the issue described by the user.
2. Generate a safe bash or Python script to fix it.
3. Output ONLY the raw code to be executed — no explanations, no markdown, no code fences.
4. The script must be self-contained and safe to run in an isolated sandbox.
5. If the issue requires bash, start with #!/bin/bash
6. If the issue requires Python, start with #!/usr/bin/env python3
7. Never include destructive commands that could harm a real system (rm -rf /, etc.)
8. Focus on the most direct fix for the stated problem.`;

/**
 * Build the system prompt string (Unblocking Agent persona).
 */
export function buildSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

/**
 * Build the initial message array for the first Bedrock invocation.
 * Combines userPrompt, codeContext, and optional prior session context.
 */
export function buildInitialMessages(
  userPrompt: string,
  codeContext: string,
  priorSession?: SessionRecord
): ConverseMessage[] {
  let userContent = `## Problem\n${userPrompt}\n\n## Code/Error Context\n${codeContext}`;

  if (priorSession) {
    userContent += `\n\n## Prior Session Context\nPrevious attempt generated this script:\n${priorSession.lastScript}\n\nWith result: ${priorSession.lastResult.status}\nstdout: ${priorSession.lastResult.stdout}\nstderr: ${priorSession.lastResult.stderr}`;
  }

  return [
    {
      role: 'user',
      content: [{ text: userContent }],
    },
  ];
}

/**
 * Build the retry messages — appends error context from a failed execution
 * to the existing conversation, adding the assistant's prior script and the
 * user's error feedback.
 */
export function buildRetryMessages(
  previousMessages: ConverseMessage[],
  generatedScript: string,
  stderr: string,
  exitCode: number
): ConverseMessage[] {
  return [
    ...previousMessages,
    {
      role: 'assistant',
      content: [{ text: generatedScript }],
    },
    {
      role: 'user',
      content: [
        {
          text: `The script failed with exit code ${exitCode}.\n\nstderr:\n${stderr}\n\nPlease generate a corrected script that fixes this error. Output ONLY the raw code.`,
        },
      ],
    },
  ];
}
