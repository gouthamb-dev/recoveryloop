/**
 * SandboxService — Executes scripts in AWS Lambda MicroVMs.
 * Each request gets an ephemeral MicroVM that is terminated after execution.
 */

import {
  LambdaMicrovmsClient,
  RunMicrovmCommand,
  CreateMicrovmAuthTokenCommand,
  TerminateMicrovmCommand,
} from '@aws-sdk/client-lambda-microvms';
import { ExecutionResult } from './types';
import { Logger } from './logger';

const microvmsClient = new LambdaMicrovmsClient({});

// MicroVM Image ARN — set via environment variable
const MICROVM_IMAGE_ARN = process.env.MICROVM_IMAGE_ARN ?? '';

/**
 * Detect script language from content (shebang or heuristic).
 */
export function detectScriptLanguage(script: string): 'python' | 'bash' {
  const firstLine = script.split('\n')[0].trim();
  if (firstLine.includes('python')) return 'python';
  if (firstLine.includes('bash') || firstLine.includes('sh')) return 'bash';
  if (/^(import |from |def |print\()/.test(script)) return 'python';
  return 'bash';
}

/**
 * Execute a script in an ephemeral Lambda MicroVM.
 * Flow: run-microvm → create-auth-token → POST /execute → terminate-microvm
 */
export async function executeScript(
  script: string,
  timeoutMs: number,
  logger: Logger
): Promise<ExecutionResult> {
  const startTime = Date.now();
  let microvmId: string | undefined;

  try {
    const language = detectScriptLanguage(script);
    logger.info('Creating ephemeral Lambda MicroVM', { language, timeoutMs });

    // 1. Run a new MicroVM from the pre-built image
    const runResponse = await microvmsClient.send(
      new RunMicrovmCommand({
        imageIdentifier: MICROVM_IMAGE_ARN,
        maximumDurationInSeconds: 120, // 2 minutes max lifetime
        idlePolicy: {
          autoResumeEnabled: false,
          maxIdleDurationSeconds: 60,
          suspendedDurationSeconds: 30,
        },
      })
    );

    microvmId = runResponse.microvmId;
    const endpoint = runResponse.endpoint;

    if (!microvmId || !endpoint) {
      throw new Error('Failed to get MicroVM ID or endpoint from run response');
    }

    logger.info('MicroVM running', { microvmId, endpoint });

    // 2. Create an auth token to connect to the MicroVM
    const tokenResponse = await microvmsClient.send(
      new CreateMicrovmAuthTokenCommand({
        microvmIdentifier: microvmId,
        expirationInMinutes: 5,
        allowedPorts: [{ allPorts: {} }],
      })
    );

    const authToken = tokenResponse.authToken?.['X-aws-proxy-auth'];
    if (!authToken) {
      throw new Error('Failed to get auth token for MicroVM');
    }

    // 3. Send the script to the MicroVM for execution
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const execResponse = await fetch(`https://${endpoint}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-aws-proxy-auth': authToken,
          'X-aws-proxy-port': '8080',
        },
        body: JSON.stringify({
          script,
          language,
          timeoutMs,
        }),
        signal: controller.signal,
      });

      if (!execResponse.ok) {
        const errorText = await execResponse.text();
        throw new Error(`MicroVM execution request failed: ${execResponse.status} ${errorText}`);
      }

      const result = await execResponse.json() as {
        status: string;
        stdout: string;
        stderr: string;
        exitCode: number;
        executionTimeMs: number;
      };

      const executionTimeMs = Date.now() - startTime;

      logger.info('MicroVM execution complete', {
        status: result.status,
        exitCode: result.exitCode,
        executionTimeMs,
      });

      return {
        status: result.status as ExecutionResult['status'],
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        executionTimeMs,
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (err: unknown) {
    const executionTimeMs = Date.now() - startTime;

    if (err instanceof Error && err.name === 'AbortError') {
      logger.warn('MicroVM execution timed out', { timeoutMs, executionTimeMs });
      return {
        status: 'timeout',
        stdout: '',
        stderr: `Execution timed out after ${timeoutMs}ms`,
        exitCode: 124,
        executionTimeMs,
      };
    }

    logger.error('MicroVM execution error', err instanceof Error ? err : new Error(String(err)));
    return {
      status: 'failure',
      stdout: '',
      stderr: err instanceof Error ? err.message : String(err),
      exitCode: 1,
      executionTimeMs,
    };
  } finally {
    // 4. Always terminate the MicroVM (ephemeral lifecycle)
    if (microvmId) {
      try {
        await microvmsClient.send(
          new TerminateMicrovmCommand({ microvmIdentifier: microvmId })
        );
        logger.info('MicroVM terminated', { microvmId });
      } catch (termErr) {
        // Best-effort cleanup — MicroVM will auto-terminate via maxDuration anyway
        logger.warn('Failed to terminate MicroVM', {
          microvmId,
          error: termErr instanceof Error ? termErr.message : String(termErr),
        });
      }
    }
  }
}
