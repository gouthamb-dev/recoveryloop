import { describe, it, expect } from 'vitest';
import { detectScriptLanguage } from '../src/sandbox';

describe('SandboxService', () => {
  describe('detectScriptLanguage', () => {
    it('detects bash from shebang', () => {
      expect(detectScriptLanguage('#!/bin/bash\necho hello')).toBe('bash');
    });

    it('detects python from shebang', () => {
      expect(detectScriptLanguage('#!/usr/bin/env python3\nprint("hi")')).toBe('python');
    });

    it('detects python from import statement', () => {
      expect(detectScriptLanguage('import os\nos.listdir(".")')).toBe('python');
    });

    it('detects python from def keyword', () => {
      expect(detectScriptLanguage('def main():\n  pass')).toBe('python');
    });

    it('defaults to bash for ambiguous scripts', () => {
      expect(detectScriptLanguage('ls -la')).toBe('bash');
    });
  });
});
