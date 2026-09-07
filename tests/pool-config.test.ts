//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { describe, expect, it } from 'vitest';

import { resolveConfig, type DatabaseConfig } from '@tweaktags/core';
import { buildPoolConfig } from '@tweaktags/db-postgres';
import { buildPoolOptions, buildPoolOptionsFromUri } from '@tweaktags/db-mysql';

const base = (pool?: DatabaseConfig['pool']): DatabaseConfig => ({
  provider: 'postgres',
  host: 'localhost',
  database: 'app',
  pool,
});

const withDatabase = (database: DatabaseConfig) => ({
  database,
  auth: { provider: 'jwt' as const, jwtSecret: 'a-secret-that-is-long-enough' },
});

describe('pool settings, postgres', () => {
  it('passes nothing when no pool block is given, so driver defaults stand', () => {
    const built = buildPoolConfig(base());

    expect('max' in built).toBe(false);
    expect('idleTimeoutMillis' in built).toBe(false);
    expect('connectionTimeoutMillis' in built).toBe(false);
  });

  it('passes through only the fields that were set', () => {
    const built = buildPoolConfig(base({ max: 2, connectionTimeoutMillis: 5_000 }));

    expect(built.max).toBe(2);
    expect(built.connectionTimeoutMillis).toBe(5_000);
    //Not set, so pg keeps its own default rather than receiving undefined.
    expect('idleTimeoutMillis' in built).toBe(false);
    expect('min' in built).toBe(false);
  });

  it('applies the pool to a connection string config too', () => {
    const built = buildPoolConfig({
      provider: 'postgres',
      connectionString: 'postgres://user:pass@host:5432/app',
      pool: { max: 3, idleTimeoutMillis: 10_000 },
    });

    expect(built.connectionString).toContain('postgres://');
    expect(built.max).toBe(3);
    expect(built.idleTimeoutMillis).toBe(10_000);
  });

  it('leaves the ssl handling alone', () => {
    const built = buildPoolConfig({ ...base({ max: 1 }), ssl: true });

    expect(built.ssl).toEqual({ rejectUnauthorized: false });
    expect(built.max).toBe(1);
  });
});

describe('pool settings, mysql', () => {
  it('maps onto the names mysql2 uses', () => {
    const built = buildPoolOptions({
      ...base({ max: 4, idleTimeoutMillis: 20_000, connectionTimeoutMillis: 3_000 }),
      provider: 'mysql',
    });

    expect(built.connectionLimit).toBe(4);
    expect(built.idleTimeout).toBe(20_000);
    expect(built.connectTimeout).toBe(3_000);
  });

  it('carries the pool through a connection string', () => {
    const built = buildPoolOptionsFromUri({
      provider: 'mysql',
      connectionString: 'mysql://user:pass@host:3306/app',
      pool: { max: 5 },
    });

    expect(built.uri).toContain('mysql://');
    expect(built.connectionLimit).toBe(5);
  });

  it('sets nothing when there is no pool block', () => {
    const built = buildPoolOptions({ ...base(), provider: 'mysql' });

    expect('connectionLimit' in built).toBe(false);
    expect('idleTimeout' in built).toBe(false);
  });
});

describe('pool settings, validation at startup', () => {
  it('accepts a config with no pool block at all', () => {
    expect(() => resolveConfig(withDatabase(base()))).not.toThrow();
  });

  it('accepts sensible serverless numbers', () => {
    const config = resolveConfig(
      withDatabase(base({ max: 2, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000 })),
    );

    expect(config.database.pool?.max).toBe(2);
  });

  it.each([
    ['max', { max: 0 }],
    ['a negative timeout', { idleTimeoutMillis: -1 }],
    ['a non number', { max: '10' as unknown as number }],
    ['NaN', { connectionTimeoutMillis: Number.NaN }],
  ])('rejects %s instead of letting the driver fail later', (_label, pool) => {
    expect(() => resolveConfig(withDatabase(base(pool)))).toThrow();
  });

  it('rejects a min larger than max', () => {
    expect(() => resolveConfig(withDatabase(base({ min: 5, max: 2 })))).toThrow(/cannot be larger/);
  });
});
