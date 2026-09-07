//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import type { FailureDiagnosis } from '../types/index.js';

//Reads a driver error code off an unknown thrown value.
const codeOf = (error: unknown): string | undefined => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const value = (error as { code: unknown }).code;

    return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
  }

  return undefined;
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : typeof error === 'string' ? error : '';

//The failures a self hosted install actually hits, and what to do about each.
//Order matters: the first match wins, so the specific patterns come first.
const RULES: Array<{
  reason: FailureDiagnosis['reason'];
  matches: (message: string, code: string | undefined) => boolean;
  hint: string;
}> = [
  {
    //The exact wording Postgres uses when the client asks for SSL and the server
    //has none. Common against a local Docker database with a hosted style url.
    reason: 'database_ssl_not_supported',
    matches: (message) => /does not support ssl/i.test(message),
    hint:
      'The database was asked for an SSL connection but has SSL turned off. Either remove "ssl: true" ' +
      'from the database config and drop any "sslmode=require" from the connection string, or turn SSL ' +
      'on at the database. A local Docker Postgres has no SSL unless you configure it.',
  },
  {
    //The other direction: the server insists on SSL and the client connected without it.
    reason: 'database_ssl_required',
    matches: (message, code) =>
      /no pg_hba\.conf entry/i.test(message) ||
      /ssl (connection )?(is )?required/i.test(message) ||
      code === 'ER_SECURE_TRANSPORT_REQUIRED',
    hint:
      'The database refused a connection without SSL. Set "ssl: true" in the database config, or add ' +
      '"sslmode=require" to the connection string. Hosted databases usually require SSL.',
  },
  {
    reason: 'database_unreachable',
    matches: (message, code) =>
      code === 'ECONNREFUSED' ||
      code === 'ENOTFOUND' ||
      code === 'ETIMEDOUT' ||
      code === 'EHOSTUNREACH' ||
      /connect (econnrefused|etimedout|enotfound)/i.test(message),
    hint:
      'Nothing answered at the database host and port. Check the database is running, and that the ' +
      'host and port in the config match it. From inside Docker, "localhost" means the container.',
  },
  {
    reason: 'database_auth_failed',
    matches: (message, code) =>
      code === '28P01' ||
      code === '28000' ||
      code === 'ER_ACCESS_DENIED_ERROR' ||
      /password authentication failed/i.test(message) ||
      /access denied for user/i.test(message),
    hint: 'The database rejected the username or password in the config.',
  },
  {
    reason: 'database_missing',
    matches: (message, code) =>
      code === '3D000' ||
      code === 'ER_BAD_DB_ERROR' ||
      code === 'SQLITE_CANTOPEN' ||
      /database .* does not exist/i.test(message) ||
      /unable to open database file/i.test(message),
    hint:
      'The database itself is not there. Create it first, or for SQLite check the "filename" path ' +
      'exists and is writable by the server.',
  },
  {
    reason: 'migrations_missing',
    matches: (message, code) =>
      code === '42P01' ||
      code === 'ER_NO_SUCH_TABLE' ||
      /relation "__tweaktags__/i.test(message) ||
      /no such table: __tweaktags__/i.test(message),
    hint:
      'The TweakTags tables are not in this database yet. Run "npx tweaktags migrate" against the same ' +
      'config the server uses.',
  },
  {
    reason: 'database_unreachable',
    matches: (message, code) =>
      code === 'ECONNRESET' || /connection terminated/i.test(message) || /server closed the connection/i.test(message),
    hint:
      'The database closed the connection mid request. This often means a connection limit was reached, ' +
      'or a proxy timed the connection out.',
  },
];

//Looks at a thrown value and, when it is a failure we recognise, explains what
//it usually means. The hint goes into the log for whoever is troubleshooting.
//It never reaches the browser, so it can name config fields and internals.
export const diagnoseFailure = (error: unknown): FailureDiagnosis => {
  const message = messageOf(error);
  const code = codeOf(error);

  for (const rule of RULES) {
    if (rule.matches(message, code)) {
      return { reason: rule.reason, hint: rule.hint, driverCode: code };
    }
  }

  return { reason: 'unknown', driverCode: code };
};
