//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Actor, RefreshTokenRecord } from '@tweaktags/core';

//Load the adapter and probe the native better-sqlite3 binding. The binding only
//loads when a database is opened, not when the module is imported, so we open a
//throwaway in memory database here. If it is missing, the whole suite skips
//cleanly instead of failing every test. Run "pnpm rebuild better-sqlite3" to
//build the binding and turn these tests on.
let SqliteAdapter: (typeof import('@tweaktags/db-sqlite'))['SqliteAdapter'] | undefined;
let available = false;

try {
  ({ SqliteAdapter } = await import('@tweaktags/db-sqlite'));
  const probe = new SqliteAdapter({ provider: 'sqlite', filename: ':memory:' });
  await probe.close();
  available = true;
} catch {
  //better-sqlite3 is not available in this environment, so the suite is skipped.
}

const describeSqlite = available ? describe : describe.skip;

//A superuser actor used as the writer for the content rows.
const actor: Actor = { userId: '7', role: 'superuser' };

//The tenant the content tests use.
const TENANT = 'default';

//This runs the real adapter and the real migrations against an in memory SQLite
//database, so it exercises the actual SQL and the renamed __TweakTags__ tables
//without needing any external database.
describeSqlite('sqlite adapter', () => {
  let db: InstanceType<NonNullable<typeof SqliteAdapter>>;

  beforeEach(async () => {
    const Adapter = SqliteAdapter as NonNullable<typeof SqliteAdapter>;
    db = new Adapter({ provider: 'sqlite', filename: ':memory:' });
    await db.runMigrations();
  });

  afterEach(async () => {
    await db.close();
  });

  it('runs the migrations and can run them again safely', async () => {
    //A second run must be a no op, not an error.
    await expect(db.runMigrations()).resolves.toBeUndefined();

    //An empty content table proves the migration created it.
    expect(await db.listTags(TENANT)).toEqual([]);
  });

  describe('content', () => {
    it('creates a tag and reads it back', async () => {
      const created = await db.createTag(TENANT, 'hero-title', 'plain', actor);

      expect(created.tag).toBe('hero-title');
      expect(created.type).toBe('plain');

      const [record] = await db.getContentByTags(TENANT, ['hero-title']);
      expect(record?.body).toBe('');
      expect(record?.updatedBy).toBe('7');
    });

    it('refuses to create the same tag twice', async () => {
      await db.createTag(TENANT, 'hero-title', 'plain', actor);

      await expect(db.createTag(TENANT, 'hero-title', 'plain', actor)).rejects.toThrow();
    });

    it('lists tags in alphabetical order', async () => {
      await db.createTag(TENANT, 'beta', 'plain', actor);
      await db.createTag(TENANT, 'alpha', 'plain', actor);

      expect(await db.listTags(TENANT)).toEqual(['alpha', 'beta']);
    });

    it('inserts then updates content with upsert', async () => {
      await db.createTag(TENANT, 'hero-title', 'plain', actor);

      await db.upsertContent(TENANT, { tag: 'hero-title', body: 'first' }, actor);
      expect((await db.getContentByTags(TENANT, ['hero-title']))[0]?.body).toBe('first');

      await db.upsertContent(TENANT, { tag: 'hero-title', body: 'second' }, actor);
      expect((await db.getContentByTags(TENANT, ['hero-title']))[0]?.body).toBe('second');
    });

    it('stores a media url when given one', async () => {
      await db.createTag(TENANT, 'hero-image', 'media', actor);
      await db.upsertContent(TENANT, { tag: 'hero-image', body: '', mediaUrl: 'https://x.test/a.png' }, actor);

      expect((await db.getContentByTags(TENANT, ['hero-image']))[0]?.mediaUrl).toBe('https://x.test/a.png');
    });

    it('changes a tag type', async () => {
      await db.createTag(TENANT, 'hero-title', 'plain', actor);
      const updated = await db.setTagType(TENANT, 'hero-title', 'rich', actor);

      expect(updated.type).toBe('rich');
    });

    it('throws when changing the type of a missing tag', async () => {
      await expect(db.setTagType(TENANT, 'missing', 'rich', actor)).rejects.toThrow();
    });

    it('deletes a tag', async () => {
      await db.createTag(TENANT, 'hero-title', 'plain', actor);
      await db.deleteTag(TENANT, 'hero-title', actor);

      expect(await db.getContentByTags(TENANT, ['hero-title'])).toEqual([]);
    });

    it('throws when deleting a missing tag', async () => {
      await expect(db.deleteTag(TENANT, 'missing', actor)).rejects.toThrow();
    });

    it('returns nothing for an empty tag list', async () => {
      expect(await db.getContentByTags(TENANT, [])).toEqual([]);
    });
  });

  describe('tenants', () => {
    it('keeps each tenant content separate and allows the same tag name', async () => {
      await db.createTag('drystrip', 'hero', 'plain', actor);
      await db.createTag('other', 'hero', 'plain', actor);
      await db.upsertContent('drystrip', { tag: 'hero', body: 'drystrip copy' }, actor);
      await db.upsertContent('other', { tag: 'hero', body: 'other copy' }, actor);

      expect((await db.getContentByTags('drystrip', ['hero']))[0]?.body).toBe('drystrip copy');
      expect((await db.getContentByTags('other', ['hero']))[0]?.body).toBe('other copy');

      expect(await db.listTags('drystrip')).toEqual(['hero']);
      expect(await db.listTags('other')).toEqual(['hero']);
    });

    it('never lists or reads another tenant tags', async () => {
      await db.createTag('drystrip', 'only-here', 'plain', actor);

      expect(await db.listTags('other')).toEqual([]);
      expect(await db.getContentByTags('other', ['only-here'])).toEqual([]);
    });

    it('deletes within a tenant without touching the other', async () => {
      await db.createTag('drystrip', 'hero', 'plain', actor);
      await db.createTag('other', 'hero', 'plain', actor);

      await db.deleteTag('drystrip', 'hero', actor);

      expect(await db.getContentByTags('drystrip', ['hero'])).toEqual([]);
      expect((await db.getContentByTags('other', ['hero'])).length).toBe(1);
    });
  });

  describe('users', () => {
    it('creates a user and finds them by email and id', async () => {
      const created = await db.createUser({
        email: 'admin@example.com',
        passwordHash: 'hashed',
        role: 'superuser',
      });

      const byEmail = await db.findUserByEmail('admin@example.com');
      const byId = await db.findUserById(created.id);

      expect(byEmail?.role).toBe('superuser');
      expect(byId?.email).toBe('admin@example.com');
    });

    it('returns null for a user that does not exist', async () => {
      expect(await db.findUserByEmail('nobody@example.com')).toBeNull();
    });

    it('refuses a duplicate email', async () => {
      await db.createUser({ email: 'admin@example.com', passwordHash: 'a', role: 'superuser' });

      await expect(
        db.createUser({ email: 'admin@example.com', passwordHash: 'b', role: 'editor' }),
      ).rejects.toThrow();
    });

    it('updates a password only for a user that exists', async () => {
      await db.createUser({ email: 'admin@example.com', passwordHash: 'a', role: 'superuser' });

      expect(await db.updateUserPassword('admin@example.com', 'new-hash')).toBe(true);
      expect(await db.updateUserPassword('nobody@example.com', 'new-hash')).toBe(false);

      expect((await db.findUserByEmail('admin@example.com'))?.passwordHash).toBe('new-hash');
    });

    it('lists users in email order with their roles', async () => {
      await db.createUser({ email: 'zoe@example.com', passwordHash: 'a', role: 'editor' });
      await db.createUser({ email: 'amy@example.com', passwordHash: 'b', role: 'superuser' });

      const users = await db.listUsers();

      expect(users.map((user) => user.email)).toEqual(['amy@example.com', 'zoe@example.com']);
      expect(users[0]?.role).toBe('superuser');
      expect(users[1]?.role).toBe('editor');
    });
  });

  describe('refresh tokens', () => {
    const record: RefreshTokenRecord = {
      id: 'token-1',
      familyId: 'family-1',
      userId: '7',
      expiresAt: '2099-01-01T00:00:00.000Z',
      revoked: false,
    };

    it('saves and reads a refresh token', async () => {
      await db.saveRefreshToken(record);

      const found = await db.findRefreshToken('token-1');
      expect(found?.familyId).toBe('family-1');
      expect(found?.revoked).toBe(false);
      expect(await db.isRefreshFamilyActive('family-1')).toBe(true);
    });

    it('revokes a single token', async () => {
      await db.saveRefreshToken(record);
      await db.revokeRefreshToken('token-1');

      expect((await db.findRefreshToken('token-1'))?.revoked).toBe(true);
      expect(await db.isRefreshFamilyActive('family-1')).toBe(false);
    });

    it('revokes a whole family at once', async () => {
      await db.saveRefreshToken(record);
      await db.saveRefreshToken({ ...record, id: 'token-2' });

      await db.revokeRefreshFamily('family-1');

      expect(await db.isRefreshFamilyActive('family-1')).toBe(false);
      expect((await db.findRefreshToken('token-2'))?.revoked).toBe(true);
    });

    it('returns null for a token that does not exist', async () => {
      expect(await db.findRefreshToken('nope')).toBeNull();
    });
  });
});
