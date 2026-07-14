/**
 * InputValidator — Pure functions for request validation and sanitization.
 * PBT applicable (invariant and round-trip tests).
 */

import { UnblockRequest, ValidationResult, ValidationError } from './types';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_USER_PROMPT_LENGTH = 2000;
const MAX_CODE_CONTEXT_LENGTH = 10000;
const HTML_SCRIPT_PATTERN = /<\s*script[^>]*>|<\/\s*script\s*>|javascript\s*:/gi;

/**
 * Validate the raw request body and return a typed UnblockRequest or errors.
 */
export function validateRequest(body: unknown): ValidationResult<UnblockRequest> {
  const errors: ValidationError[] = [];

  if (body === null || body === undefined || typeof body !== 'object') {
    return { valid: false, errors: [{ field: 'body', message: 'Request body must be a JSON object' }] };
  }

  const obj = body as Record<string, unknown>;

  // Validate sessionId (optional)
  if (obj.sessionId !== undefined && obj.sessionId !== null && obj.sessionId !== '') {
    if (typeof obj.sessionId !== 'string') {
      errors.push({ field: 'sessionId', message: 'sessionId must be a string' });
    } else if (!isValidSessionId(obj.sessionId)) {
      errors.push({ field: 'sessionId', message: 'sessionId must be a valid UUID v4' });
    }
  }

  // Validate userPrompt (required)
  if (obj.userPrompt === undefined || obj.userPrompt === null || obj.userPrompt === '') {
    errors.push({ field: 'userPrompt', message: 'userPrompt is required' });
  } else if (typeof obj.userPrompt !== 'string') {
    errors.push({ field: 'userPrompt', message: 'userPrompt must be a string' });
  } else if (obj.userPrompt.length > MAX_USER_PROMPT_LENGTH) {
    errors.push({ field: 'userPrompt', message: `userPrompt must be ${MAX_USER_PROMPT_LENGTH} characters or fewer` });
  }

  // Validate codeContext (required)
  if (obj.codeContext === undefined || obj.codeContext === null) {
    errors.push({ field: 'codeContext', message: 'codeContext is required' });
  } else if (typeof obj.codeContext !== 'string') {
    errors.push({ field: 'codeContext', message: 'codeContext must be a string' });
  } else if (obj.codeContext.length > MAX_CODE_CONTEXT_LENGTH) {
    errors.push({ field: 'codeContext', message: `codeContext must be ${MAX_CODE_CONTEXT_LENGTH} characters or fewer` });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Sanitize and return validated data
  return {
    valid: true,
    data: {
      sessionId: obj.sessionId ? String(obj.sessionId).trim() : undefined,
      userPrompt: sanitizeString(String(obj.userPrompt).trim()),
      codeContext: String(obj.codeContext),
    },
  };
}

/**
 * Check if a string is a valid UUID v4.
 */
export function isValidSessionId(value: string): boolean {
  return UUID_V4_REGEX.test(value);
}

/**
 * Sanitize a string — strip script injection patterns.
 * Preserves legitimate code content but removes script tags and javascript: URIs.
 */
export function sanitizeString(input: string): string {
  return input.replace(HTML_SCRIPT_PATTERN, '');
}
