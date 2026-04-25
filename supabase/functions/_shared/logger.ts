// Structured JSON logger. Never logs PII — callers must minimize fields.

type Level = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  fn: string;
  trace_id?: string;
  tenant_id?: string;
  application_id?: string;
  session_id?: string;
  reason_code?: string;
  duration_ms?: number;
  status?: number;
  // Catch-all for adapter-specific or domain fields. Caller is responsible
  // for ensuring no PII leaks here.
  [k: string]: unknown;
}

function emit(level: Level, message: string, fields: LogFields): void {
  const line = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...fields,
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, fields: LogFields) => emit('debug', msg, fields),
  info: (msg: string, fields: LogFields) => emit('info', msg, fields),
  warn: (msg: string, fields: LogFields) => emit('warn', msg, fields),
  error: (msg: string, fields: LogFields) => emit('error', msg, fields),
};

export function newTraceId(): string {
  return crypto.randomUUID();
}
