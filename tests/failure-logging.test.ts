//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ACTIONS,
  createHandler,
  diagnoseFailure,
  resolveConfig,
  type LogEntry,
  type TweakTagsConfig,
} from '@tweaktags/core';

//A config with a logger that records everything, so a test can read the trace.
const configWith = (entries: LogEntry[]): TweakTagsConfig =>
  resolveConfig({
    database: { provider: 'sqlite', filename: ':memory:' },
    auth: { provider: 'jwt', jwtSecret: 'a-secret-that-is-long-enough' },
    logger: (entry) => entries.push(entry),
  });

//The error pg throws when the client asks for SSL and the server has none.
const sslError = (): Error => new Error('The server does not support SSL connections');

//A database adapter that fails the way a misconfigured one does.
const brokenDb = (error: Error) =>
  ({
    listTags: async () => {
      throw error;
    },
  }) as never;

const okAuth = () => ({ verify: async () => ({ userId: '1', role: 'superuser' }) }) as never;

describe('diagnoseFailure', () => {
  it('recognises a client asking for SSL that the server does not have', () => {
    const result = diagnoseFailure(sslError());

    expect(result.reason).toBe('database_ssl_not_supported');
    expect(result.hint).toMatch(/ssl/i);
  });

  it('recognises a server that demands SSL', () => {
    const result = diagnoseFailure(new Error('no pg_hba.conf entry for host "1.2.3.4", SSL off'));

    expect(result.reason).toBe('database_ssl_required');
  });

  it('recognises a database nothing is listening on', () => {
    const error = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
      code: 'ECONNREFUSED',
    });

    expect(diagnoseFailure(error).reason).toBe('database_unreachable');
  });

  it('recognises tables that were never migrated', () => {
    const error = Object.assign(new Error('relation "__TweakTags__Content" does not exist'), {
      code: '42P01',
    });

    expect(diagnoseFailure(error).reason).toBe('migrations_missing');
  });

  it('says nothing useful about an error it does not know', () => {
    const result = diagnoseFailure(new Error('something odd'));

    expect(result.reason).toBe('unknown');
    expect(result.hint).toBeUndefined();
  });
});

describe('handler failure logging', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('logs a trace with a hint when the database fails, instead of failing silently', async () => {
    const entries: LogEntry[] = [];
    const handler = createHandler({
      db: brokenDb(sslError()),
      auth: okAuth(),
      config: configWith(entries),
    });

    const response = await handler({ action: ACTIONS.LIST_TAGS, authToken: 'token' });

    expect(response.status).toBe(500);

    const failure = entries.find((entry) => entry.event === 'request.failed');

    expect(failure).toBeDefined();
    expect(failure?.level).toBe('error');
    expect(failure?.action).toBe(ACTIONS.LIST_TAGS);
    expect(failure?.reason).toBe('database_ssl_not_supported');
    expect(failure?.hint).toMatch(/ssl/i);
    //The stack is what makes the log worth having when the hint does not apply.
    expect(failure?.error?.stack).toContain('Error');
    //The same id the caller was handed, so a report can be traced to this line.
    expect(failure?.traceId).toBe(response.body.traceId);
  });

  it('hides the internal message from the caller in production, keeping the trace id', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const entries: LogEntry[] = [];
    const handler = createHandler({
      db: brokenDb(sslError()),
      auth: okAuth(),
      config: configWith(entries),
    });

    const response = await handler({ action: ACTIONS.LIST_TAGS, authToken: 'token' });

    expect(response.body.message).not.toContain('SSL');
    expect(response.body.message).toContain(String(response.body.traceId));
    //The detail is not lost, it is in the log where it belongs.
    expect(entries.find((entry) => entry.event === 'request.failed')?.message).toContain('SSL');
  });

  it('still shows the real message in development, where it helps', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const entries: LogEntry[] = [];
    const handler = createHandler({
      db: brokenDb(sslError()),
      auth: okAuth(),
      config: configWith(entries),
    });

    const response = await handler({ action: ACTIONS.LIST_TAGS, authToken: 'token' });

    expect(response.body.message).toContain('does not support SSL');
  });

  it('logs a rejected request as a warning, not an error', async () => {
    const entries: LogEntry[] = [];
    const handler = createHandler({
      db: brokenDb(sslError()),
      auth: okAuth(),
      config: configWith(entries),
    });

    //No token, so this is the caller's mistake rather than a server failure.
    const response = await handler({ action: ACTIONS.LIST_TAGS });

    expect(response.status).toBe(401);

    const rejected = entries.find((entry) => entry.event === 'request.rejected');

    expect(rejected?.level).toBe('warn');
    expect(rejected?.status).toBe(401);
    //A rejection is not a server fault, so it carries no stack.
    expect(rejected?.error).toBeUndefined();
  });

  it('falls back to the console when the config has no logger', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const config = resolveConfig({
      database: { provider: 'sqlite', filename: ':memory:' },
      auth: { provider: 'jwt', jwtSecret: 'a-secret-that-is-long-enough' },
    });

    //Strip the resolved logger, the way a hand built config object would be.
    const handler = createHandler({
      db: brokenDb(sslError()),
      auth: okAuth(),
      config: { ...config, logger: undefined },
    });

    await handler({ action: ACTIONS.LIST_TAGS, authToken: 'token' });

    expect(spy).toHaveBeenCalled();
    expect(String(spy.mock.calls[0]?.[0])).toContain('request.failed');

    spy.mockRestore();
  });
});
