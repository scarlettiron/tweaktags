//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import type { DatabaseConfig, DbAdapter } from '@tweaktags/core';
import { AUTH_TABLE, CONTENT_TABLE, REFRESH_TABLE } from '@tweaktags/core';
//A type only import, erased at runtime, so it does not load the native binding
//that the probe below is checking for.
import type { SqliteAdapter as SqliteAdapterClass } from '@tweaktags/db-sqlite';

import { describeDatabaseAdapter } from './support/adapter-contract';

//Every adapter runs the same contract. A database that is not reachable skips,
//so this file is safe to run with nothing installed: SQLite covers itself, and
//the three server databases come from docker compose or from CI service
//containers through these environment variables.
const POSTGRES_URL = process.env.TWEAKTAGS_TEST_POSTGRES_URL;
const MYSQL_URL = process.env.TWEAKTAGS_TEST_MYSQL_URL;
const MARIADB_URL = process.env.TWEAKTAGS_TEST_MARIADB_URL;

//The migrations table is owned by each adapter package rather than core, and
//dropping it is what makes a run repeatable.
const MIGRATIONS_TABLE = '__TweakTags__Migrations';
const ALL_TABLES = [CONTENT_TABLE, AUTH_TABLE, REFRESH_TABLE, MIGRATIONS_TABLE];

//── sqlite ────────────────────────────────────────────────────────────────────
//An in memory database is a clean schema by definition, so there is nothing to
//tear down between tests.
let sqliteAvailable = false;
let SqliteAdapter: typeof SqliteAdapterClass | undefined;

try {
  ({ SqliteAdapter } = await import('@tweaktags/db-sqlite'));
  //The native binding only loads when a database is opened, not on import.
  const probe = new SqliteAdapter({ provider: 'sqlite', filename: ':memory:' });
  await probe.close();
  sqliteAvailable = true;
} catch {
  //better-sqlite3 has no binding here. Run "pnpm rebuild better-sqlite3".
}

describeDatabaseAdapter('sqlite', {
  available: sqliteAvailable,
  connect: async () => {
    const Adapter = SqliteAdapter as NonNullable<typeof SqliteAdapter>;
    const db = new Adapter({ provider: 'sqlite', filename: ':memory:' });
    await db.runMigrations();

    return db;
  },
});

//── postgres ──────────────────────────────────────────────────────────────────
const postgresHarness = async (): Promise<{ available: boolean; connect: () => Promise<DbAdapter> }> => {
  if (!POSTGRES_URL) {
    return { available: false, connect: async () => ({}) as DbAdapter };
  }

  const { PostgresAdapter } = await import('@tweaktags/db-postgres');
  const { Pool } = await import('pg');
  const config: DatabaseConfig = { provider: 'postgres', connectionString: POSTGRES_URL };

  let available = false;

  try {
    const probe = new Pool({ connectionString: POSTGRES_URL, connectionTimeoutMillis: 4_000 });
    await probe.query('SELECT 1');
    await probe.end();
    available = true;
  } catch {
    //Nothing listening, so this adapter's suite skips.
  }

  return {
    available,
    connect: async () => {
      //Start from nothing, so a previous run cannot change the result of this one.
      const admin = new Pool({ connectionString: POSTGRES_URL });

      for (const table of ALL_TABLES) {
        await admin.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
      }

      await admin.end();

      const db = new PostgresAdapter(config);
      await db.runMigrations();

      return db;
    },
  };
};

//── mysql and mariadb ─────────────────────────────────────────────────────────
const mysqlHarness = async (
  url: string | undefined,
): Promise<{ available: boolean; connect: () => Promise<DbAdapter> }> => {
  if (!url) {
    return { available: false, connect: async () => ({}) as DbAdapter };
  }

  const { MysqlAdapter } = await import('@tweaktags/db-mysql');
  const mysql = await import('mysql2/promise');
  const config: DatabaseConfig = { provider: 'mysql', connectionString: url };

  let available = false;

  try {
    const probe = await mysql.createConnection({ uri: url, connectTimeout: 4_000 });
    await probe.query('SELECT 1');
    await probe.end();
    available = true;
  } catch {
    //Nothing listening, so this adapter's suite skips.
  }

  return {
    available,
    connect: async () => {
      const admin = await mysql.createConnection({ uri: url, multipleStatements: true });

      //Foreign keys are not used here, but the order still matters for humans
      //reading the log, so drop children first.
      for (const table of ALL_TABLES) {
        await admin.query(`DROP TABLE IF EXISTS \`${table}\``);
      }

      await admin.end();

      const db = new MysqlAdapter(config);
      await db.runMigrations();

      return db;
    },
  };
};

const postgres = await postgresHarness();
describeDatabaseAdapter('postgres', postgres);

const mysqlSuite = await mysqlHarness(MYSQL_URL);
describeDatabaseAdapter('mysql', mysqlSuite);

const mariadbSuite = await mysqlHarness(MARIADB_URL);
describeDatabaseAdapter('mariadb', mariadbSuite);
