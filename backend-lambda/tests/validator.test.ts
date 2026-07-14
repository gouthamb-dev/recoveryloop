import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateRequest, isValidSessionId, sanitizeString } from '../src/validator';

describe('InputValidator', () => {
  describe('validateRequest', () => {
    it('accepts a valid request with all fields', () => {
      const result = validateRequest({
        sessionId: '123e4567-e89b-42d3-a456-426614174000',
        userPrompt: 'Fix my npm install',
        codeContext: 'npm ERR! EACCES',
      });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data.userPrompt).toBe('Fix my npm install');
      }
    });

    it('accepts a request without sessionId', () => {
      const result = validateRequest({
        userPrompt: 'Help me',
        codeContext: 'error output',
      });
      expect(result.valid).toBe(true);
    });

    it('rejects null body', () => {
      const result = validateRequest(null);
      expect(result.valid).toBe(false);
    });

    it('rejects missing userPrompt', () => {
      const result = validateRequest({ codeContext: 'something' });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.field === 'userPrompt')).toBe(true);
      }
    });

    it('rejects userPrompt exceeding 2000 chars', () => {
      const result = validateRequest({
        userPrompt: 'a'.repeat(2001),
        codeContext: 'x',
      });
      expect(result.valid).toBe(false);
    });

    it('rejects invalid sessionId format', () => {
      const result = validateRequest({
        sessionId: 'not-a-uuid',
        userPrompt: 'Help',
        codeContext: 'error',
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('isValidSessionId', () => {
    it('accepts valid UUID v4', () => {
      expect(isValidSessionId('123e4567-e89b-42d3-a456-426614174000')).toBe(true);
    });

    it('rejects non-UUID strings', () => {
      expect(isValidSessionId('hello')).toBe(false);
      expect(isValidSessionId('')).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('removes script tags', () => {
      expect(sanitizeString('hello <script>alert(1)</script> world')).toBe('hello alert(1) world');
    });

    it('removes javascript: URIs', () => {
      expect(sanitizeString('click javascript: void(0)')).toBe('click  void(0)');
    });

    it('preserves normal text', () => {
      expect(sanitizeString('npm install typescript')).toBe('npm install typescript');
    });
  });

  // ─── Property-Based Tests (PBT) ─────────────────────────────────────────────

  describe('PBT: validateRequest invariants', () => {
    it('always returns valid:true for well-formed inputs', () => {
      fc.assert(
        fc.property(
          fc.record({
            userPrompt: fc.string({ minLength: 1, maxLength: 2000 }),
            codeContext: fc.string({ minLength: 0, maxLength: 10000 }),
          }),
          (input) => {
            const result = validateRequest(input);
            expect(result.valid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('always returns valid:false for empty userPrompt', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 10000 }),
          (codeContext) => {
            const result = validateRequest({ userPrompt: '', codeContext });
            expect(result.valid).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('sanitizeString is idempotent', () => {
      fc.assert(
        fc.property(fc.string({ maxLength: 500 }), (input) => {
          const once = sanitizeString(input);
          const twice = sanitizeString(once);
          expect(twice).toBe(once);
        }),
        { numRuns: 100 }
      );
    });
  });
});
