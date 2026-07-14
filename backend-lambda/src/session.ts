/**
 * SessionService — DynamoDB session state operations.
 * Handles loading and persisting session records.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { SessionRecord, ExecutionResult } from './types';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const SESSION_TTL_SECONDS = 86400; // 24 hours

/**
 * Load an existing session from DynamoDB. Returns null if not found.
 */
export async function loadSession(
  sessionId: string,
  tableName: string
): Promise<SessionRecord | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: tableName,
      Key: { sessionId },
    })
  );

  if (!result.Item) {
    return null;
  }

  return result.Item as SessionRecord;
}

/**
 * Persist the most recent exchange to DynamoDB (upsert — last-write-wins).
 */
export async function saveSession(
  sessionId: string,
  userPrompt: string,
  generatedScript: string,
  executionResult: ExecutionResult,
  tableName: string
): Promise<void> {
  const now = new Date();
  const record: SessionRecord = {
    sessionId,
    lastPrompt: userPrompt,
    lastScript: generatedScript,
    lastResult: executionResult,
    lastUpdatedAt: now.toISOString(),
    expiresAt: Math.floor(now.getTime() / 1000) + SESSION_TTL_SECONDS,
  };

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: record,
    })
  );
}

/**
 * Generate a new session ID (UUID v4).
 */
export function generateSessionId(): string {
  return uuidv4();
}
