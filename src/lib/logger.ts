import fs from 'fs';
import path from 'path';

// Root directory for logs
const LOG_DIR = path.join(process.cwd(), 'logs');

// Ensure log directory exists
try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
} catch (err) {
  console.error('[LOGGER_INIT_ERROR]: Could not create logs directory:', err);
}

function getLogFilePath(filename: string): string {
  return path.join(LOG_DIR, filename);
}

function formatTimestamp(): string {
  const now = new Date();
  return now.toISOString();
}

/**
 * Appends a log line to a specified log file with timestamp and formatting
 */
function appendLog(filename: string, level: string, message: string, meta?: any) {
  try {
    const timestamp = formatTimestamp();
    let metaString = '';
    if (meta) {
      if (typeof meta === 'string') {
        metaString = ` | ${meta}`;
      } else if (meta instanceof Error) {
        metaString = ` | ${meta.message}\nStack: ${meta.stack || ''}`;
      } else {
        try {
          metaString = ` | ${JSON.stringify(meta)}`;
        } catch {
          metaString = ` | [Unserializable Metadata]`;
        }
      }
    }

    const logLine = `[${timestamp}] [${level}] ${message}${metaString}\n`;
    fs.appendFile(getLogFilePath(filename), logLine, (err) => {
      if (err) {
        console.error(`[LOG_WRITE_FAIL ${filename}]:`, err.message);
      }
    });
  } catch (err) {
    console.error(`[LOGGER_ERROR]:`, err);
  }
}

export const logger = {
  /**
   * Logs application, server, and database errors to logs/error.log
   */
  error(message: string, error?: unknown, meta?: Record<string, any>) {
    console.error(`[SERVER_ERROR] ${message}`, error);
    let errorDetails: any = meta || {};
    if (error instanceof Error) {
      errorDetails = {
        ...errorDetails,
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else if (error) {
      errorDetails = { ...errorDetails, rawError: String(error) };
    }
    appendLog('error.log', 'ERROR', message, errorDetails);
  },

  /**
   * Logs security events (failed logins, lockouts, unauthorized requests, forbidden operations) to logs/security.log
   */
  security(event: string, meta?: Record<string, any>) {
    console.warn(`[SECURITY_EVENT] ${event}`, meta || '');
    appendLog('security.log', 'SECURITY_ALERT', event, meta);
  },

  /**
   * Logs business activity and audit trail (created bill, recorded payment, deleted record, user login) to logs/activity.log
   */
  activity(action: string, meta?: Record<string, any>) {
    console.log(`[ACTIVITY] ${action}`, meta || '');
    appendLog('activity.log', 'ACTIVITY', action, meta);
  },

  /**
   * Logs HTTP access requests to logs/access.log
   */
  access(method: string, url: string, status: number, durationMs?: number, ip?: string) {
    const message = `${method} ${url} -> HTTP ${status} (${durationMs ?? 0}ms) from IP: ${ip || 'unknown'}`;
    appendLog('access.log', 'ACCESS', message);
  },
};

