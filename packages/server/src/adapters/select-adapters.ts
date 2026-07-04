//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { createRequire } from 'node:module';

import { JwtAuthAdapter } from '@tweaktags/auth-jwt';
import { PostgresAdapter } from '@tweaktags/db-postgres';
import {
  badRequest,
  type AuthAdapter,
  type DbAdapter,
  type StorageAdapter,
  type StorageConfig,
  type TweakTagsConfig,
} from '@tweaktags/core';

//Lets us load an optional adapter package by name at runtime, so a project only
//needs to install the database package it actually uses.
const requirePackage = createRequire(import.meta.url);

//Loads an optional adapter package and gives a clear error when it is missing.
//installName is the package to tell people to install, which can differ from
//the one we load. MariaDB installs @tweaktags/db-mariadb but loads @tweaktags/db-mysql.
const loadAdapter = (
  packageName: string,
  provider: string,
  installName: string = packageName,
): Record<string, unknown> => {
  try {
    return requirePackage(packageName) as Record<string, unknown>;
  } catch {
    throw badRequest(
      `The "${installName}" package is needed for "${provider}". ` +
        `Install it in your project to use this feature.`,
    );
  }
};

//Builds the database adapter that matches the config provider.
//Postgres ships with the server. MySQL, MariaDB, and SQLite are loaded from
//their own packages when you use them, so you only install what you need.
export const buildDbAdapter = (config: TweakTagsConfig): DbAdapter => {
  const provider = config.database.provider;

  if (provider === 'postgres') {
    return new PostgresAdapter(config.database);
  }

  if (provider === 'mysql' || provider === 'mariadb') {
    //MariaDB uses the same driver, so we always load @tweaktags/db-mysql, but we
    //point MariaDB users at the @tweaktags/db-mariadb package to install.
    const installName = provider === 'mariadb' ? '@tweaktags/db-mariadb' : '@tweaktags/db-mysql';
    const module = loadAdapter('@tweaktags/db-mysql', provider, installName);
    const MysqlAdapter = module.MysqlAdapter as new (config: TweakTagsConfig['database']) => DbAdapter;

    return new MysqlAdapter(config.database);
  }

  if (provider === 'sqlite') {
    const module = loadAdapter('@tweaktags/db-sqlite', provider);
    const SqliteAdapter = module.SqliteAdapter as new (
      config: TweakTagsConfig['database'],
    ) => DbAdapter;

    return new SqliteAdapter(config.database);
  }

  throw badRequest(`Unsupported database provider "${String(provider)}"`);
};

//Builds the storage adapter when media uploads are configured, or returns
//undefined when they are not. The S3 package is loaded only when it is used, so
//projects that only paste media urls never need to install it.
export const buildStorageAdapter = (config: TweakTagsConfig): StorageAdapter | undefined => {
  if (!config.storage) {
    return undefined;
  }

  const provider = config.storage.provider;

  if (provider === 's3') {
    const module = loadAdapter('@tweaktags/storage-s3', `${provider} storage`);
    const S3StorageAdapter = module.S3StorageAdapter as new (config: StorageConfig) => StorageAdapter;

    return new S3StorageAdapter(config.storage);
  }

  throw badRequest(`Unsupported storage provider "${String(provider)}"`);
};

//Builds the auth adapter that matches the config provider.
//The auth adapter needs the database adapter so it can read and write users.
export const buildAuthAdapter = (config: TweakTagsConfig, db: DbAdapter): AuthAdapter => {
  if (config.auth.provider === 'jwt') {
    return new JwtAuthAdapter(db, {
      secret: config.auth.jwtSecret,
      accessTtlSeconds: config.auth.accessTtlSeconds,
      refreshTtlSeconds: config.auth.refreshTtlSeconds,
      strictRevocation: config.auth.strictRevocation,
    });
  }

  throw badRequest(`Unsupported auth provider "${String(config.auth.provider)}"`);
};
