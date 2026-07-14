import { describe, it, expect } from 'vitest';
import { extractScriptFromResponse, stripCodeFences } from '../src/bedrock';

describe('BedrockService', () => {
  describe('extractScriptFromResponse', () => {
    it('extracts text from a valid Converse response', () => {
      const output = {
        message: {
          role: 'assistant',
          content: [{ text: '#!/bin/bash\necho hello' }],
        },
      };
      const result = extractScriptFromResponse(output);
      expect(result).toBe('#!/bin/bash\necho hello');
    });

    it('trims whitespace from extracted text', () => {
      const output = {
        message: {
          content: [{ text: '  #!/bin/bash\necho hi  ' }],
        },
      };
      expect(extractScriptFromResponse(output)).toBe('#!/bin/bash\necho hi');
    });

    it('strips markdown code fences from response', () => {
      const output = {
        message: {
          content: [{ text: '```bash\n#!/bin/bash\necho hello\n```' }],
        },
      };
      expect(extractScriptFromResponse(output)).toBe('#!/bin/bash\necho hello');
    });

    it('strips python code fences', () => {
      const output = {
        message: {
          content: [{ text: '```python\n#!/usr/bin/env python3\nprint("hi")\n```' }],
        },
      };
      expect(extractScriptFromResponse(output)).toBe('#!/usr/bin/env python3\nprint("hi")');
    });

    it('throws when content is empty', () => {
      const output = { message: { content: [] } };
      expect(() => extractScriptFromResponse(output)).toThrow('no content blocks');
    });

    it('throws when message is missing', () => {
      const output = {};
      expect(() => extractScriptFromResponse(output)).toThrow();
    });
  });

  describe('stripCodeFences', () => {
    it('removes ```bash fences', () => {
      expect(stripCodeFences('```bash\necho hi\n```')).toBe('echo hi');
    });

    it('removes ``` fences without language', () => {
      expect(stripCodeFences('```\necho hi\n```')).toBe('echo hi');
    });

    it('leaves plain text unchanged', () => {
      expect(stripCodeFences('#!/bin/bash\necho hi')).toBe('#!/bin/bash\necho hi');
    });

    it('handles multiline scripts inside fences', () => {
      const input = '```python\nimport os\nprint(os.getcwd())\n```';
      expect(stripCodeFences(input)).toBe('import os\nprint(os.getcwd())');
    });
  });
});
