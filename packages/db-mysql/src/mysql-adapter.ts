//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import mysql from 'mysql2/promise';
import type { Pool, PoolOptions, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

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

import { DUPLICATE_ENTRY, MIGRATIONS_TABLE } from './constants/index.js';
import { MIGRATIONS } from './migrations/migrations.js';
import { mapContentRow, mapUserRow } from './utilities/row-mappers.js';

//Builds the pool options from the separate connection parts.
const buildPoolOptions = (config: DatabaseConfig): PoolOptions => ({
  host: config.host,
  port: config.port,
  user: config.user,
  password: config.password,
  database: config.database,
  ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
});

//Reads a MySQL error code in a type safe way.
const errorCode = (error: unknown): string | undefined => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code: unknown }).code);
  }

  return undefined;
};

//The MySQL and MariaDB implementation of the TweakTags database adapter.
//MariaDB speaks the MySQL protocol, so the same code serves both.
export class MysqlAdapter implements DbAdapter {
  private readonly pool: Pool;

  constructor(config: DatabaseConfig) {
    //A connection string and an options object use different overloads,
    //so we call the right one for each case.
    this.pool = config.connectionString
      ? mysql.createPool(config.connectionString)
      : mysql.createPool(buildPoolOptions(config));
  }

  public async runMigrations(): Promise<void> {
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS \`${MIGRATIONS_TABLE}\` (
        id VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`,
    );

    const [appliedRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT id FROM \`${MIGRATIONS_TABLE}\`;`,
    );
    const appliedIds = new Set(appliedRows.map((row) => String(row.id)));

    for (const migration of MIGRATIONS) {
      if (appliedIds.has(migration.id)) {
        continue;
      }

      const connection = await this.pool.getConnection();

      try {
        await connection.beginTransaction();
        await connection.query(migration.sql);
        await connection.query(`INSERT INTO \`${MIGRATIONS_TABLE}\` (id) VALUES (?);`, [
          migration.id,
        ]);
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
  }

  public async getContentByTags(tenant: string, tags: string[]): Promise<ContentRecord[]> {
    if (tags.length === 0) {
      return [];
    }

    const placeholders = tags.map(() => '?').join(', ');

    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT tag, type, body, media_url, updated_at, updated_by
       FROM \`${CONTENT_TABLE}\`
       WHERE tenant = ? AND tag IN (${placeholders});`,
      [tenant, ...tags],
    );

    return rows.map((row) => mapContentRow(row as never));
  }

  public async createTag(
    tenant: string,
    tag: string,
    type: TagType,
    actor: Actor,
  ): Promise<ContentRecord> {
    try {
      await this.pool.execute(
        `INSERT INTO \`${CONTENT_TABLE}\` (tenant, tag, type, body, media_url, updated_by)
         VALUES (?, ?, ?, '', NULL, ?);`,
        [tenant, tag, type, actor.userId],
      );
    } catch (error) {
      if (errorCode(error) === DUPLICATE_ENTRY) {
        throw conflict(`The tag "${tag}" already exists`);
      }

      throw error;
    }

    const [record] = await this.getContentByTags(tenant, [tag]);

    if (!record) {
      throw new Error('The tag could not be read back after it was created');
    }

    return record;
  }

  public async upsertContent(
    tenant: string,
    input: ContentInput,
    actor: Actor,
  ): Promise<ContentRecord> {
    await this.pool.execute(
      `INSERT INTO \`${CONTENT_TABLE}\` (tenant, tag, body, media_url, updated_by)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         body = VALUES(body),
         media_url = VALUES(media_url),
         updated_at = CURRENT_TIMESTAMP,
         updated_by = VALUES(updated_by);`,
      [tenant, input.tag, input.body, input.mediaUrl ?? null, actor.userId],
    );

    const [record] = await this.getContentByTags(tenant, [input.tag]);

    if (!record) {
      throw new Error('The content could not be read back after it was saved');
    }

    return record;
  }

  public async setTagType(
    tenant: string,
    tag: string,
    type: TagType,
    actor: Actor,
  ): Promise<ContentRecord> {
    await this.pool.execute(
      `UPDATE \`${CONTENT_TABLE}\`
       SET type = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
       WHERE tenant = ? AND tag = ?;`,
      [type, actor.userId, tenant, tag],
    );

    //Read the row back to confirm it exists and return the new values.
    const [record] = await this.getContentByTags(tenant, [tag]);

    if (!record) {
      throw notFound(`The tag "${tag}" does not exist`);
    }

    return record;
  }

  public async deleteTag(tenant: string, tag: string): Promise<void> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `DELETE FROM \`${CONTENT_TABLE}\` WHERE tenant = ? AND tag = ?;`,
      [tenant, tag],
    );

    if (result.affectedRows === 0) {
      throw notFound(`The tag "${tag}" does not exist`);
    }
  }

  public async listTags(tenant: string): Promise<string[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT tag FROM \`${CONTENT_TABLE}\` WHERE tenant = ? ORDER BY tag ASC;`,
      [tenant],
    );

    return rows.map((row) => String(row.tag));
  }

  public async findUserByEmail(email: string): Promise<StoredUser | null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT id, email, password_hash, role FROM \`${AUTH_TABLE}\` WHERE email = ?;`,
      [email],
    );

    const row = rows[0];

    return row ? mapUserRow(row as never) : null;
  }

  public async findUserById(id: string): Promise<StoredUser | null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT id, email, password_hash, role FROM \`${AUTH_TABLE}\` WHERE id = ?;`,
      [id],
    );

    const row = rows[0];

    return row ? mapUserRow(row as never) : null;
  }

  public async createUser(input: CreateUserInput): Promise<StoredUser> {
    try {
      const [result] = await this.pool.execute<ResultSetHeader>(
        `INSERT INTO \`${AUTH_TABLE}\` (email, password_hash, role) VALUES (?, ?, ?);`,
        [input.email, input.passwordHash, input.role],
      );

      return {
        id: String(result.insertId),
        email: input.email,
        role: input.role,
        passwordHash: input.passwordHash,
      };
    } catch (error) {
      if (errorCode(error) === DUPLICATE_ENTRY) {
        throw conflict(`A user with the email "${input.email}" already exists`);
      }

      throw error;
    }
  }

  public async updateUserPassword(email: string, passwordHash: string): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE \`${AUTH_TABLE}\` SET password_hash = ? WHERE email = ?;`,
      [passwordHash, email],
    );

    return result.affectedRows > 0;
  }

  public async listUsers(): Promise<AuthUser[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT id, email, role FROM \`${AUTH_TABLE}\` ORDER BY email ASC;`,
    );

    return rows.map((row) => ({
      id: String(row.id),
      email: String(row.email),
      role: row.role === 'superuser' ? 'superuser' : 'editor',
    }));
  }

  public async saveRefreshToken(record: RefreshTokenRecord): Promise<void> {
    await this.pool.execute(
      `INSERT INTO \`${REFRESH_TABLE}\` (id, family_id, user_id, expires_at, revoked)
       VALUES (?, ?, ?, ?, ?);`,
      [record.id, record.familyId, record.userId, record.expiresAt, record.revoked ? 1 : 0],
    );
  }

  public async findRefreshToken(id: string): Promise<RefreshTokenRecord | null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT id, family_id, user_id, expires_at, revoked FROM \`${REFRESH_TABLE}\` WHERE id = ?;`,
      [id],
    );

    const row = rows[0];

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
    await this.pool.execute(`UPDATE \`${REFRESH_TABLE}\` SET revoked = 1 WHERE id = ?;`, [id]);
  }

  public async revokeRefreshFamily(familyId: string): Promise<void> {
    await this.pool.execute(`UPDATE \`${REFRESH_TABLE}\` SET revoked = 1 WHERE family_id = ?;`, [
      familyId,
    ]);
  }

  public async isRefreshFamilyActive(familyId: string): Promise<boolean> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT 1 FROM \`${REFRESH_TABLE}\` WHERE family_id = ? AND revoked = 0 LIMIT 1;`,
      [familyId],
    );

    return rows.length > 0;
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
