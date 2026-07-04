//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import Database from 'better-sqlite3';

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

import { CONSTRAINT_ERROR_PREFIX, MIGRATIONS_TABLE } from './constants/index.js';
import { MIGRATIONS, type Migration } from './migrations/migrations.js';
import { mapContentRow, mapUserRow } from './utilities/row-mappers.js';

//Works out the database file path from the config.
//Accepts a plain path, or a filename with a file: or sqlite: prefix.
const resolveFilename = (config: DatabaseConfig): string => {
  const raw = config.filename ?? config.connectionString;

  if (!raw) {
    throw new Error('The sqlite adapter needs a "filename" in the database config');
  }

  return raw.replace(/^sqlite:/, '').replace(/^file:/, '');
};

//Reads a SQLite error code in a type safe way.
const errorCode = (error: unknown): string | undefined => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code: unknown }).code);
  }

  return undefined;
};

//Whether an error is a broken unique or primary key constraint.
const isConstraintError = (error: unknown): boolean =>
  (errorCode(error) ?? '').startsWith(CONSTRAINT_ERROR_PREFIX);

//The SQLite implementation of the TweakTags database adapter.
//better-sqlite3 is synchronous, so each method wraps a quick synchronous call.
export class SqliteAdapter implements DbAdapter {
  private readonly db: Database.Database;

  constructor(config: DatabaseConfig) {
    this.db = new Database(resolveFilename(config));

    //Write ahead logging gives better behavior when reads and writes overlap.
    this.db.pragma('journal_mode = WAL');
  }

  public async runMigrations(): Promise<void> {
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );`,
    );

    const applied = this.db
      .prepare(`SELECT id FROM "${MIGRATIONS_TABLE}";`)
      .all() as Array<{ id: string }>;
    const appliedIds = new Set(applied.map((row) => row.id));

    //Each migration runs inside a transaction so a failure leaves a clean state.
    const runMigration = this.db.transaction((migration: Migration) => {
      this.db.exec(migration.sql);
      this.db.prepare(`INSERT INTO "${MIGRATIONS_TABLE}" (id) VALUES (?);`).run(migration.id);
    });

    for (const migration of MIGRATIONS) {
      if (!appliedIds.has(migration.id)) {
        runMigration(migration);
      }
    }
  }

  public async getContentByTags(tenant: string, tags: string[]): Promise<ContentRecord[]> {
    if (tags.length === 0) {
      return [];
    }

    const placeholders = tags.map(() => '?').join(', ');

    const rows = this.db
      .prepare(
        `SELECT tag, type, body, media_url, updated_at, updated_by
         FROM "${CONTENT_TABLE}"
         WHERE tenant = ? AND tag IN (${placeholders});`,
      )
      .all(tenant, ...tags) as never[];

    return rows.map((row) => mapContentRow(row));
  }

  public async createTag(
    tenant: string,
    tag: string,
    type: TagType,
    actor: Actor,
  ): Promise<ContentRecord> {
    try {
      this.db
        .prepare(
          `INSERT INTO "${CONTENT_TABLE}" (tenant, tag, type, body, media_url, updated_by)
           VALUES (?, ?, ?, '', NULL, ?);`,
        )
        .run(tenant, tag, type, actor.userId);
    } catch (error) {
      if (isConstraintError(error)) {
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
    this.db
      .prepare(
        `INSERT INTO "${CONTENT_TABLE}" (tenant, tag, body, media_url, updated_by)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(tenant, tag) DO UPDATE SET
           body = excluded.body,
           media_url = excluded.media_url,
           updated_at = datetime('now'),
           updated_by = excluded.updated_by;`,
      )
      .run(tenant, input.tag, input.body, input.mediaUrl ?? null, actor.userId);

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
    this.db
      .prepare(
        `UPDATE "${CONTENT_TABLE}"
         SET type = ?, updated_at = datetime('now'), updated_by = ?
         WHERE tenant = ? AND tag = ?;`,
      )
      .run(type, actor.userId, tenant, tag);

    //Read the row back to confirm it exists and return the new values.
    const [record] = await this.getContentByTags(tenant, [tag]);

    if (!record) {
      throw notFound(`The tag "${tag}" does not exist`);
    }

    return record;
  }

  public async deleteTag(tenant: string, tag: string): Promise<void> {
    const result = this.db
      .prepare(`DELETE FROM "${CONTENT_TABLE}" WHERE tenant = ? AND tag = ?;`)
      .run(tenant, tag);

    if (result.changes === 0) {
      throw notFound(`The tag "${tag}" does not exist`);
    }
  }

  public async listTags(tenant: string): Promise<string[]> {
    const rows = this.db
      .prepare(`SELECT tag FROM "${CONTENT_TABLE}" WHERE tenant = ? ORDER BY tag ASC;`)
      .all(tenant) as Array<{ tag: string }>;

    return rows.map((row) => row.tag);
  }

  public async findUserByEmail(email: string): Promise<StoredUser | null> {
    const row = this.db
      .prepare(`SELECT id, email, password_hash, role FROM "${AUTH_TABLE}" WHERE email = ?;`)
      .get(email) as never;

    return row ? mapUserRow(row) : null;
  }

  public async findUserById(id: string): Promise<StoredUser | null> {
    const row = this.db
      .prepare(`SELECT id, email, password_hash, role FROM "${AUTH_TABLE}" WHERE id = ?;`)
      .get(id) as never;

    return row ? mapUserRow(row) : null;
  }

  public async createUser(input: CreateUserInput): Promise<StoredUser> {
    try {
      const result = this.db
        .prepare(`INSERT INTO "${AUTH_TABLE}" (email, password_hash, role) VALUES (?, ?, ?);`)
        .run(input.email, input.passwordHash, input.role);

      return {
        id: String(result.lastInsertRowid),
        email: input.email,
        role: input.role,
        passwordHash: input.passwordHash,
      };
    } catch (error) {
      if (isConstraintError(error)) {
        throw conflict(`A user with the email "${input.email}" already exists`);
      }

      throw error;
    }
  }

  public async updateUserPassword(email: string, passwordHash: string): Promise<boolean> {
    const result = this.db
      .prepare(`UPDATE "${AUTH_TABLE}" SET password_hash = ? WHERE email = ?;`)
      .run(passwordHash, email);

    return result.changes > 0;
  }

  public async listUsers(): Promise<AuthUser[]> {
    const rows = this.db
      .prepare(`SELECT id, email, role FROM "${AUTH_TABLE}" ORDER BY email ASC;`)
      .all() as Array<{ id: number | bigint; email: string; role: string }>;

    return rows.map((row) => ({
      id: String(row.id),
      email: row.email,
      role: row.role === 'superuser' ? 'superuser' : 'editor',
    }));
  }

  public async saveRefreshToken(record: RefreshTokenRecord): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO "${REFRESH_TABLE}" (id, family_id, user_id, expires_at, revoked)
         VALUES (?, ?, ?, ?, ?);`,
      )
      .run(record.id, record.familyId, record.userId, record.expiresAt, record.revoked ? 1 : 0);
  }

  public async findRefreshToken(id: string): Promise<RefreshTokenRecord | null> {
    const row = this.db
      .prepare(
        `SELECT id, family_id, user_id, expires_at, revoked FROM "${REFRESH_TABLE}" WHERE id = ?;`,
      )
      .get(id) as
      | { id: string; family_id: string; user_id: string; expires_at: string; revoked: number }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      familyId: row.family_id,
      userId: row.user_id,
      expiresAt: row.expires_at,
      revoked: Boolean(row.revoked),
    };
  }

  public async revokeRefreshToken(id: string): Promise<void> {
    this.db.prepare(`UPDATE "${REFRESH_TABLE}" SET revoked = 1 WHERE id = ?;`).run(id);
  }

  public async revokeRefreshFamily(familyId: string): Promise<void> {
    this.db.prepare(`UPDATE "${REFRESH_TABLE}" SET revoked = 1 WHERE family_id = ?;`).run(familyId);
  }

  public async isRefreshFamilyActive(familyId: string): Promise<boolean> {
    const row = this.db
      .prepare(`SELECT 1 FROM "${REFRESH_TABLE}" WHERE family_id = ? AND revoked = 0 LIMIT 1;`)
      .get(familyId);

    return row !== undefined;
  }

  public async close(): Promise<void> {
    this.db.close();
  }
}
