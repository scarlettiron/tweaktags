//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { Pool } from 'pg';
import type { PoolConfig } from 'pg';

import {
  conflict,
  notFound,
  type Actor,
  type AuthUser,
  type ContentInput,
  type ContentRecord,
  type CreateUserInput,
  type DatabaseConfig,
  type DbAdapter,
  type RefreshTokenRecord,
  type StoredUser,
  type TagType,
  AUTH_TABLE,
  CONTENT_TABLE,
  REFRESH_TABLE,
} from '@tweaktags/core';

import { MIGRATIONS_TABLE, UNIQUE_VIOLATION } from './constants/index.js';
import { MIGRATIONS } from './migrations/migrations.js';
import { mapContentRow, mapUserRow } from './utilities/row-mappers.js';

//Builds the settings the pg Pool needs from the user database config.
//Supports either a full connection string or the separate parts.
const buildPoolConfig = (config: DatabaseConfig): PoolConfig => {
  if (config.connectionString) {
    return {
      connectionString: config.connectionString,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    };
  }

  return {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
  };
};

//Reads a Postgres error code in a type safe way.
const errorCode = (error: unknown): string | undefined => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code: unknown }).code);
  }

  return undefined;
};

//The Postgres implementation of the TweakTags database adapter.
//It owns a connection pool and knows how to run migrations,
//read and write content, and read and write users.
export class PostgresAdapter implements DbAdapter {
  private readonly pool: Pool;

  constructor(config: DatabaseConfig) {
    this.pool = new Pool(buildPoolConfig(config));
  }

  //Creates the tracking table and runs any migrations that have not run yet.
  //Each migration runs inside its own transaction so a failure leaves a clean state.
  public async runMigrations(): Promise<void> {
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );`,
    );

    const applied = await this.pool.query<{ id: string }>(
      `SELECT id FROM "${MIGRATIONS_TABLE}";`,
    );
    const appliedIds = new Set(applied.rows.map((row) => row.id));

    for (const migration of MIGRATIONS) {
      if (appliedIds.has(migration.id)) {
        continue;
      }

      const client = await this.pool.connect();

      try {
        await client.query('BEGIN');
        await client.query(migration.sql);
        await client.query(`INSERT INTO "${MIGRATIONS_TABLE}" (id) VALUES ($1);`, [
          migration.id,
        ]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  }

  public async getContentByTags(tenant: string, tags: string[]): Promise<ContentRecord[]> {
    if (tags.length === 0) {
      return [];
    }

    const result = await this.pool.query(
      `SELECT tag, type, body, media_url, updated_at, updated_by
       FROM "${CONTENT_TABLE}"
       WHERE tenant = $1 AND tag = ANY($2);`,
      [tenant, tags],
    );

    return result.rows.map(mapContentRow);
  }

  public async createTag(
    tenant: string,
    tag: string,
    type: TagType,
    actor: Actor,
  ): Promise<ContentRecord> {
    const result = await this.pool.query(
      `INSERT INTO "${CONTENT_TABLE}" (tenant, tag, type, body, media_url, updated_by)
       VALUES ($1, $2, $3, '', NULL, $4)
       ON CONFLICT (tenant, tag) DO NOTHING
       RETURNING tag, type, body, media_url, updated_at, updated_by;`,
      [tenant, tag, type, actor.userId],
    );

    const row = result.rows[0];

    if (!row) {
      throw conflict(`The tag "${tag}" already exists`);
    }

    return mapContentRow(row);
  }

  public async upsertContent(
    tenant: string,
    input: ContentInput,
    actor: Actor,
  ): Promise<ContentRecord> {
    const result = await this.pool.query(
      `INSERT INTO "${CONTENT_TABLE}" (tenant, tag, body, media_url, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant, tag) DO UPDATE SET
         body = EXCLUDED.body,
         media_url = EXCLUDED.media_url,
         updated_at = now(),
         updated_by = EXCLUDED.updated_by
       RETURNING tag, type, body, media_url, updated_at, updated_by;`,
      [tenant, input.tag, input.body, input.mediaUrl ?? null, actor.userId],
    );

    //The insert always returns a row, so this access is safe.
    return mapContentRow(result.rows[0]);
  }

  public async setTagType(
    tenant: string,
    tag: string,
    type: TagType,
    actor: Actor,
  ): Promise<ContentRecord> {
    const result = await this.pool.query(
      `UPDATE "${CONTENT_TABLE}"
       SET type = $3, updated_at = now(), updated_by = $4
       WHERE tenant = $1 AND tag = $2
       RETURNING tag, type, body, media_url, updated_at, updated_by;`,
      [tenant, tag, type, actor.userId],
    );

    const row = result.rows[0];

    if (!row) {
      throw notFound(`The tag "${tag}" does not exist`);
    }

    return mapContentRow(row);
  }

  public async deleteTag(tenant: string, tag: string): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM "${CONTENT_TABLE}" WHERE tenant = $1 AND tag = $2;`,
      [tenant, tag],
    );

    if (result.rowCount === 0) {
      throw notFound(`The tag "${tag}" does not exist`);
    }
  }

  public async listTags(tenant: string): Promise<string[]> {
    const result = await this.pool.query<{ tag: string }>(
      `SELECT tag FROM "${CONTENT_TABLE}" WHERE tenant = $1 ORDER BY tag ASC;`,
      [tenant],
    );

    return result.rows.map((row) => row.tag);
  }

  public async findUserByEmail(email: string): Promise<StoredUser | null> {
    const result = await this.pool.query(
      `SELECT id, email, password_hash, role FROM "${AUTH_TABLE}" WHERE email = $1;`,
      [email],
    );

    const row = result.rows[0];

    return row ? mapUserRow(row) : null;
  }

  public async findUserById(id: string): Promise<StoredUser | null> {
    const result = await this.pool.query(
      `SELECT id, email, password_hash, role FROM "${AUTH_TABLE}" WHERE id = $1;`,
      [id],
    );

    const row = result.rows[0];

    return row ? mapUserRow(row) : null;
  }

  public async createUser(input: CreateUserInput): Promise<StoredUser> {
    try {
      const result = await this.pool.query(
        `INSERT INTO "${AUTH_TABLE}" (email, password_hash, role)
         VALUES ($1, $2, $3)
         RETURNING id, email, password_hash, role;`,
        [input.email, input.passwordHash, input.role],
      );

      return mapUserRow(result.rows[0]);
    } catch (error) {
      if (errorCode(error) === UNIQUE_VIOLATION) {
        throw conflict(`A user with the email "${input.email}" already exists`);
      }

      throw error;
    }
  }

  public async updateUserPassword(email: string, passwordHash: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE "${AUTH_TABLE}" SET password_hash = $2 WHERE email = $1;`,
      [email, passwordHash],
    );

    return (result.rowCount ?? 0) > 0;
  }

  public async listUsers(): Promise<AuthUser[]> {
    const result = await this.pool.query(
      `SELECT id, email, role FROM "${AUTH_TABLE}" ORDER BY email ASC;`,
    );

    return result.rows.map((row) => ({
      id: String(row.id),
      email: String(row.email),
      role: row.role === 'superuser' ? 'superuser' : 'editor',
    }));
  }

  public async saveRefreshToken(record: RefreshTokenRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO "${REFRESH_TABLE}" (id, family_id, user_id, expires_at, revoked)
       VALUES ($1, $2, $3, $4, $5);`,
      [record.id, record.familyId, record.userId, record.expiresAt, record.revoked],
    );
  }

  public async findRefreshToken(id: string): Promise<RefreshTokenRecord | null> {
    const result = await this.pool.query(
      `SELECT id, family_id, user_id, expires_at, revoked FROM "${REFRESH_TABLE}" WHERE id = $1;`,
      [id],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      id: String(row.id),
      familyId: String(row.family_id),
      userId: String(row.user_id),
      expiresAt: String(row.expires_at),
      revoked: Boolean(row.revoked),
    };
  }

  public async revokeRefreshToken(id: string): Promise<void> {
    await this.pool.query(`UPDATE "${REFRESH_TABLE}" SET revoked = true WHERE id = $1;`, [id]);
  }

  public async revokeRefreshFamily(familyId: string): Promise<void> {
    await this.pool.query(`UPDATE "${REFRESH_TABLE}" SET revoked = true WHERE family_id = $1;`, [
      familyId,
    ]);
  }

  public async isRefreshFamilyActive(familyId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM "${REFRESH_TABLE}" WHERE family_id = $1 AND revoked = false LIMIT 1;`,
      [familyId],
    );

    return (result.rowCount ?? 0) > 0;
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
