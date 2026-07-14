/**
 * Structured JSON logger for CloudWatch Logs.
 * Writes to stdout — Lambda automatically routes to CloudWatch.
 */

export interface LogEntry {
  timestamp: string;
  requestId: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  context?: Record<string, unknown>;
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
}

const LOG_LEVELS: Record<string, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const configuredLevel = LOG_LEVELS[process.env.LOG_LEVEL ?? 'INFO'] ?? 1;

export function createLogger(requestId: string): Logger {
  function emit(level: LogEntry['level'], message: string, context?: Record<string, unknown>): void {
    if (LOG_LEVELS[level] < configuredLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      level,
      message,
      ...(context && { context }),
    };

    // Write to stdout as single-line JSON
    process.stdout.write(JSON.stringify(entry) + '\n');
  }

  return {
    debug(message, context) {
      emit('DEBUG', message, context);
    },
    info(message, context) {
      emit('INFO', message, context);
    },
    warn(message, context) {
      emit('WARN', message, context);
    },
    error(message, error?, context?) {
      const errorContext: Record<string, unknown> = { ...context };
      if (error) {
        errorContext.errorName = error.name;
        errorContext.errorMessage = error.message;
        // Never log full stack traces to prevent leaking internal paths
      }
      emit('ERROR', message, errorContext);
    },
  };
}
