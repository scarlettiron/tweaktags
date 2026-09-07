//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import {
  DEFAULT_ACCESS_TTL_SECONDS,
  DEFAULT_API_BASE_PATH,
  DEFAULT_EDIT_IN_VIEW,
  DEFAULT_MODE,
  DEFAULT_REFRESH_TTL_SECONDS,
  DEFAULT_TENANT,
  DEFAULT_WHITE_LABEL,
} from '../constants/index.js';
import type { TweakTagsConfig, TweakTagsUserConfig } from '../types/index.js';
import { badRequest } from '../utilities/errors.js';
import { createDefaultLogger } from '../utilities/logger.js';
import { assertValidTenant } from '../utilities/tenant.js';

//Checks that the user config has everything it needs and fills in defaults.
//Returns the fully resolved config the rest of the system relies on.
export const resolveConfig = (input: TweakTagsUserConfig): TweakTagsConfig => {
  if (typeof input !== 'object' || input === null) {
    throw badRequest('The TweakTags config must be an object');
  }

  if (!input.database) {
    throw badRequest('The config needs a database section');
  }

  const supportedProviders = ['postgres', 'mysql', 'mariadb', 'sqlite'];

  if (!supportedProviders.includes(input.database.provider)) {
    throw badRequest(
      `The database provider must be one of: ${supportedProviders.join(', ')}`,
    );
  }

  if (input.database.provider === 'sqlite') {
    if (!input.database.filename && !input.database.connectionString) {
      throw badRequest('The sqlite database needs a "filename" pointing to the database file');
    }
  } else {
    const hasConnectionString = typeof input.database.connectionString === 'string';
    const hasConnectionParts =
      typeof input.database.host === 'string' && typeof input.database.database === 'string';

    if (!hasConnectionString && !hasConnectionParts) {
      throw badRequest(
        'The database config needs either a connectionString or a host and database name',
      );
    }
  }

  //A typo here would otherwise reach the driver as NaN or a negative number and
  //fail much later, as a connection error that says nothing about the config.
  if (input.database.pool) {
    const fields = ['max', 'min', 'idleTimeoutMillis', 'connectionTimeoutMillis'] as const;

    for (const field of fields) {
      const value = input.database.pool[field];

      if (value === undefined) {
        continue;
      }

      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw badRequest(`The database pool "${field}" must be a positive number`);
      }
    }

    const { max, min } = input.database.pool;

    if (typeof max === 'number' && max < 1) {
      throw badRequest('The database pool "max" must be at least 1');
    }

    if (typeof max === 'number' && typeof min === 'number' && min > max) {
      throw badRequest('The database pool "min" cannot be larger than "max"');
    }
  }

  if (!input.auth || input.auth.provider !== 'jwt') {
    throw badRequest('The config needs an auth section with provider set to "jwt"');
  }

  if (typeof input.auth.jwtSecret !== 'string' || input.auth.jwtSecret.length < 16) {
    throw badRequest('The auth config needs a jwtSecret of at least 16 characters');
  }

  if (input.storage) {
    if (input.storage.provider !== 's3') {
      throw badRequest("The storage provider must be 's3', which also covers S3 compatible stores");
    }

    if (!input.storage.bucket) {
      throw badRequest('The storage config needs a bucket name');
    }
  }

  return {
    mode: input.mode ?? DEFAULT_MODE,
    editInView: input.editInView ?? DEFAULT_EDIT_IN_VIEW,
    richText: input.richText ?? false,
    whiteLabel: input.whiteLabel ?? DEFAULT_WHITE_LABEL,
    apiBasePath: input.apiBasePath ?? DEFAULT_API_BASE_PATH,
    database: input.database,
    auth: {
      provider: 'jwt',
      jwtSecret: input.auth.jwtSecret,
      accessTtlSeconds: input.auth.accessTtlSeconds ?? DEFAULT_ACCESS_TTL_SECONDS,
      refreshTtlSeconds: input.auth.refreshTtlSeconds ?? DEFAULT_REFRESH_TTL_SECONDS,
      strictRevocation: input.auth.strictRevocation ?? false,
      tokenStorage: input.auth.tokenStorage ?? 'cookie',
      cookieName: input.auth.cookieName ?? 'tweaktags_token',
      refreshCookieName: input.auth.refreshCookieName ?? 'tweaktags_refresh',
      csrfProtection: input.auth.csrfProtection ?? true,
      csrfCookieName: input.auth.csrfCookieName ?? 'tweaktags_csrf',
      cookieSecure: input.auth.cookieSecure ?? true,
      cookieSameSite: input.auth.cookieSameSite ?? 'lax',
    },
    cors: input.cors,
    storage: input.storage,
    //The tenant is validated now so a bad value fails at startup, not per request.
    tenant: assertValidTenant(input.tenant ?? DEFAULT_TENANT),
    resolveTenant: input.resolveTenant,
    //Falls back to console logging, so a failure always leaves a trace even when
    //nobody configured anything.
    logger: input.logger ?? createDefaultLogger(),
  };
};
