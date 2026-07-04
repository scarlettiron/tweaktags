//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { describe, expect, it } from 'vitest';

import { defineConfig, resolveConfig, type TweakTagsUserConfig } from '@tweaktags/core';

//A valid base config the tests can tweak.
const baseConfig: TweakTagsUserConfig = {
  database: { provider: 'postgres', connectionString: 'postgres://localhost/tweaktags' },
  auth: { provider: 'jwt', jwtSecret: 'a-secret-that-is-long-enough' },
};

describe('resolveConfig defaults', () => {
  it('fills in the default values', () => {
    const resolved = resolveConfig(baseConfig);

    expect(resolved.mode).toBe('embedded');
    expect(resolved.apiBasePath).toBe('/api/tweaktags');
    expect(resolved.editInView).toBe(false);
    expect(resolved.richText).toBe(false);
  });

  it('fills in the default auth values', () => {
    const { auth } = resolveConfig(baseConfig);

    expect(auth.accessTtlSeconds).toBe(900);
    expect(auth.refreshTtlSeconds).toBe(604800);
    expect(auth.refreshTtlSeconds).toBeGreaterThan(auth.accessTtlSeconds);
    expect(auth.strictRevocation).toBe(false);
    expect(auth.tokenStorage).toBe('cookie');
    expect(auth.cookieName).toBe('tweaktags_token');
    expect(auth.refreshCookieName).toBe('tweaktags_refresh');
    expect(auth.csrfProtection).toBe(true);
    expect(auth.csrfCookieName).toBe('tweaktags_csrf');
    expect(auth.cookieSecure).toBe(true);
    expect(auth.cookieSameSite).toBe('lax');
  });
});

describe('resolveConfig overrides', () => {
  it('keeps the values the user set', () => {
    const resolved = resolveConfig({
      ...baseConfig,
      mode: 'standalone',
      editInView: true,
      richText: true,
      apiBasePath: '/content',
      auth: {
        provider: 'jwt',
        jwtSecret: 'a-secret-that-is-long-enough',
        accessTtlSeconds: 60,
        refreshTtlSeconds: 120,
        strictRevocation: true,
        tokenStorage: 'header',
        csrfProtection: false,
        cookieSameSite: 'strict',
        cookieSecure: false,
      },
    });

    expect(resolved.mode).toBe('standalone');
    expect(resolved.editInView).toBe(true);
    expect(resolved.richText).toBe(true);
    expect(resolved.apiBasePath).toBe('/content');
    expect(resolved.auth.accessTtlSeconds).toBe(60);
    expect(resolved.auth.refreshTtlSeconds).toBe(120);
    expect(resolved.auth.strictRevocation).toBe(true);
    expect(resolved.auth.tokenStorage).toBe('header');
    expect(resolved.auth.csrfProtection).toBe(false);
    expect(resolved.auth.cookieSameSite).toBe('strict');
    expect(resolved.auth.cookieSecure).toBe(false);
  });
});

describe('resolveConfig database providers', () => {
  it('accepts postgres with separate connection parts', () => {
    const resolved = resolveConfig({
      ...baseConfig,
      database: {
        provider: 'postgres',
        host: 'localhost',
        database: 'tweaktags',
        user: 'tweaktags',
        password: 'secret',
      },
    });

    expect(resolved.database.provider).toBe('postgres');
  });

  it('accepts mysql and mariadb with a connection string', () => {
    expect(() =>
      resolveConfig({
        ...baseConfig,
        database: { provider: 'mysql', connectionString: 'mysql://localhost/tweaktags' },
      }),
    ).not.toThrow();

    expect(() =>
      resolveConfig({
        ...baseConfig,
        database: { provider: 'mariadb', connectionString: 'mysql://localhost/tweaktags' },
      }),
    ).not.toThrow();
  });

  it('accepts sqlite with a filename', () => {
    const resolved = resolveConfig({
      ...baseConfig,
      database: { provider: 'sqlite', filename: './tweaktags.db' },
    });

    expect(resolved.database.provider).toBe('sqlite');
  });

  it('rejects sqlite without a filename', () => {
    expect(() => resolveConfig({ ...baseConfig, database: { provider: 'sqlite' } })).toThrow();
  });

  it('rejects a postgres database with no connection details', () => {
    expect(() => resolveConfig({ ...baseConfig, database: { provider: 'postgres' } })).toThrow();
  });

  it('rejects an unknown provider', () => {
    expect(() =>
      resolveConfig({
        ...baseConfig,
        //A provider TweakTags does not support.
        database: { provider: 'mongo' as 'postgres', connectionString: 'mongo://localhost' },
      }),
    ).toThrow();
  });
});

describe('resolveConfig auth validation', () => {
  it('rejects a short jwt secret', () => {
    expect(() =>
      resolveConfig({ ...baseConfig, auth: { provider: 'jwt', jwtSecret: 'short' } }),
    ).toThrow();
  });

  it('rejects a missing auth section', () => {
    expect(() => resolveConfig({ database: baseConfig.database } as TweakTagsUserConfig)).toThrow();
  });

  it('rejects an auth provider that is not jwt', () => {
    expect(() =>
      resolveConfig({
        ...baseConfig,
        auth: { provider: 'cognito' as 'jwt', jwtSecret: 'a-secret-that-is-long-enough' },
      }),
    ).toThrow();
  });
});

describe('defineConfig', () => {
  it('returns the same config object it is given', () => {
    const config = defineConfig(baseConfig);

    expect(config).toEqual(baseConfig);
  });
});

describe('resolveConfig tenants', () => {
  it('defaults the tenant to "default"', () => {
    expect(resolveConfig(baseConfig).tenant).toBe('default');
  });

  it('keeps a custom tenant', () => {
    expect(resolveConfig({ ...baseConfig, tenant: 'drystrip' }).tenant).toBe('drystrip');
  });

  it('passes a resolveTenant function through', () => {
    const resolveTenant = () => 'from-host';
    const resolved = resolveConfig({ ...baseConfig, resolveTenant });

    expect(resolved.resolveTenant).toBe(resolveTenant);
  });

  it('rejects an invalid tenant name', () => {
    expect(() => resolveConfig({ ...baseConfig, tenant: 'not a tenant!' })).toThrow();
  });
});

describe('resolveConfig storage', () => {
  it('keeps a valid storage config', () => {
    const resolved = resolveConfig({
      ...baseConfig,
      storage: { provider: 's3', bucket: 'my-bucket', region: 'us-east-1' },
    });

    expect(resolved.storage?.bucket).toBe('my-bucket');
  });

  it('leaves storage undefined when not given', () => {
    expect(resolveConfig(baseConfig).storage).toBeUndefined();
  });

  it('rejects a storage config with no bucket', () => {
    expect(() =>
      resolveConfig({ ...baseConfig, storage: { provider: 's3' } as { provider: 's3'; bucket: string } }),
    ).toThrow();
  });

  it('rejects an unknown storage provider', () => {
    expect(() =>
      resolveConfig({
        ...baseConfig,
        storage: { provider: 'gcs' as 's3', bucket: 'b' },
      }),
    ).toThrow();
  });
});
