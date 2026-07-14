import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSessionId } from '../src/session';

// Mock AWS SDK
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => {
  const mockSend = vi.fn();
  return {
    DynamoDBDocumentClient: {
      from: vi.fn().mockReturnValue({ send: mockSend }),
    },
    GetCommand: vi.fn().mockImplementation((params) => ({ ...params, _type: 'Get' })),
    PutCommand: vi.fn().mockImplementation((params) => ({ ...params, _type: 'Put' })),
    __mockSend: mockSend,
  };
});

describe('SessionService', () => {
  describe('generateSessionId', () => {
    it('returns a valid UUID v4 string', () => {
      const id = generateSessionId();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(id).toMatch(uuidRegex);
    });

    it('generates unique IDs each time', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateSessionId()));
      expect(ids.size).toBe(100);
    });
  });
});
