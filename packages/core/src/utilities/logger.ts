//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import type { LogEntry, Logger } from '../types/index.js';

//A short id that ties one failed request to its log line. Not a secret, and not
//a uuid, since it only has to be unique enough to grep for in a log.
export const newTraceId = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

//Whether the process looks like production. Read lazily and defensively, since
//this package is also bundled for the browser where process may not exist.
const isProduction = (): boolean => {
  try {
    return typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
  } catch {
    return false;
  }
};

//Formats one entry as a single readable line, with the detail fields after it.
//One line per entry keeps it greppable, which is the whole point of the trace id.
const format = (entry: LogEntry): string => {
  const parts = [`[tweaktags] ${entry.level.toUpperCase()} ${entry.event}`, `trace=${entry.traceId}`];

  if (entry.action) {
    parts.push(`action=${entry.action}`);
  }

  if (entry.status !== undefined) {
    parts.push(`status=${entry.status}`);
  }

  if (entry.code) {
    parts.push(`code=${entry.code}`);
  }

  if (entry.durationMs !== undefined) {
    parts.push(`durationMs=${entry.durationMs}`);
  }

  return `${parts.join(' ')} ${entry.message}`;
};

//The logger used when the config does not supply one. It writes to the console
//the server already has, so a self hosted install gets a usable trace with no
//setup. Pass your own logger in the config to send entries somewhere else.
export const createDefaultLogger = (): Logger => (entry: LogEntry) => {
  if (typeof console === 'undefined') {
    return;
  }

  //Debug lines are noise in a normal run, so they stay off unless asked for.
  if (entry.level === 'debug' && isProduction()) {
    return;
  }

  const line = format(entry);
  const detail: Record<string, unknown> = {};

  if (entry.hint) {
    detail.hint = entry.hint;
  }

  if (entry.tenant) {
    detail.tenant = entry.tenant;
  }

  if (entry.userId) {
    detail.userId = entry.userId;
  }

  if (entry.error) {
    detail.error = entry.error;
  }

  const write =
    entry.level === 'error'
      ? console.error
      : entry.level === 'warn'
        ? console.warn
        : console.log;

  if (Object.keys(detail).length > 0) {
    write(line, detail);
  } else {
    write(line);
  }
};

//Turns a thrown value into the plain shape a log entry carries. The stack is
//kept for the log only, and never goes into a response.
export const toLoggedError = (error: unknown): LogEntry['error'] => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...('code' in error ? { code: String((error as { code: unknown }).code) } : {}),
    };
  }

  return { name: 'UnknownError', message: String(error) };
};

export { isProduction };
