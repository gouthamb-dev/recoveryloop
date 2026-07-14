import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildSystemPrompt, buildInitialMessages, buildRetryMessages } from '../src/prompt';
import { SessionRecord, ConverseMessage } from '../src/types';

describe('PromptBuilder', () => {
  describe('buildSystemPrompt', () => {
    it('returns a non-empty string', () => {
      const prompt = buildSystemPrompt();
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('contains the Unblocking Agent persona', () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain('Unblocking Agent');
    });
  });

  describe('buildInitialMessages', () => {
    it('returns a single user message', () => {
      const messages = buildInitialMessages('fix npm', 'EACCES error');
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('user');
    });

    it('includes userPrompt and codeContext in the message', () => {
      const messages = buildInitialMessages('fix npm', 'EACCES error');
      const text = messages[0].content[0].text;
      expect(text).toContain('fix npm');
      expect(text).toContain('EACCES error');
    });

    it('includes prior session context when provided', () => {
      const priorSession: SessionRecord = {
        sessionId: 'test-id',
        lastPrompt: 'old prompt',
        lastScript: '#!/bin/bash\necho hello',
        lastResult: { status: 'failure', stdout: '', stderr: 'error', exitCode: 1, executionTimeMs: 100 },
        lastUpdatedAt: '2026-01-01T00:00:00Z',
        expiresAt: 9999999999,
      };
      const messages = buildInitialMessages('new attempt', 'context', priorSession);
      const text = messages[0].content[0].text;
      expect(text).toContain('Prior Session Context');
      expect(text).toContain('echo hello');
    });
  });

  describe('buildRetryMessages', () => {
    it('appends assistant and user messages to previous', () => {
      const prev: ConverseMessage[] = [{ role: 'user', content: [{ text: 'initial' }] }];
      const result = buildRetryMessages(prev, '#!/bin/bash\nexit 1', 'some error', 1);
      expect(result).toHaveLength(3);
      expect(result[1].role).toBe('assistant');
      expect(result[2].role).toBe('user');
    });

    it('includes the failed script in assistant message', () => {
      const prev: ConverseMessage[] = [{ role: 'user', content: [{ text: 'help' }] }];
      const result = buildRetryMessages(prev, 'bad script', 'err', 127);
      expect(result[1].content[0].text).toBe('bad script');
    });

    it('includes stderr and exit code in retry user message', () => {
      const prev: ConverseMessage[] = [{ role: 'user', content: [{ text: 'x' }] }];
      const result = buildRetryMessages(prev, 'script', 'file not found', 2);
      const text = result[2].content[0].text;
      expect(text).toContain('file not found');
      expect(text).toContain('exit code 2');
    });
  });

  // ─── Property-Based Tests (PBT) ─────────────────────────────────────────────

  describe('PBT: buildInitialMessages invariants', () => {
    it('always produces exactly 1 message with role user', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 500 }),
          fc.string({ minLength: 0, maxLength: 1000 }),
          (userPrompt, codeContext) => {
            const messages = buildInitialMessages(userPrompt, codeContext);
            expect(messages).toHaveLength(1);
            expect(messages[0].role).toBe('user');
            expect(messages[0].content).toHaveLength(1);
            expect(messages[0].content[0].text.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('always includes both userPrompt and codeContext in output', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.string({ minLength: 1, maxLength: 200 }),
          (userPrompt, codeContext) => {
            const messages = buildInitialMessages(userPrompt, codeContext);
            const text = messages[0].content[0].text;
            expect(text).toContain(userPrompt);
            expect(text).toContain(codeContext);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('PBT: buildRetryMessages invariants', () => {
    it('always appends exactly 2 messages to previous', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              role: fc.constantFrom('user' as const, 'assistant' as const),
              content: fc.array(fc.record({ text: fc.string() }), { minLength: 1, maxLength: 1 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.string({ maxLength: 500 }),
          fc.integer({ min: 1, max: 255 }),
          (prev, script, stderr, exitCode) => {
            const result = buildRetryMessages(prev, script, stderr, exitCode);
            expect(result.length).toBe(prev.length + 2);
            expect(result[prev.length].role).toBe('assistant');
            expect(result[prev.length + 1].role).toBe('user');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
