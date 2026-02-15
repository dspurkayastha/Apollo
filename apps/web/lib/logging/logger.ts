export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  project_id?: string;
  phase?: number;
  duration_ms?: number;
  error_code?: string;
  [key: string]: unknown;
}

/**
 * Structured JSON logger.
 * Never logs metadata_json raw — only project_id + phase.
 */
export function log(
  level: LogLevel,
  message: string,
  context?: Omit<LogEntry, "timestamp" | "level" | "message">
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  // Ensure no raw metadata leaks
  delete (entry as Record<string, unknown>).metadata_json;
  delete (entry as Record<string, unknown>).synopsis_text;
  delete (entry as Record<string, unknown>).email;
  delete (entry as Record<string, unknown>).name;
  delete (entry as Record<string, unknown>).registration_no;

  switch (level) {
    case "error":
      console.error(JSON.stringify(entry));
      break;
    case "warn":
      console.warn(JSON.stringify(entry));
      break;
    case "debug":
      if (process.env.NODE_ENV !== "production") {
        console.debug(JSON.stringify(entry));
      }
      break;
    default:
      console.log(JSON.stringify(entry));
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) =>
    log("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) =>
    log("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) =>
    log("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) =>
    log("error", message, context),
};
