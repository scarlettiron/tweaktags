//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Actor, DbAdapter, RefreshTokenRecord } from '@tweaktags/core';

//Every database adapter has to behave the same way. This is that behaviour,
//written once and run against each of them, so a difference between Postgres,
//MySQL, MariaDB, and SQLite shows up as a failing test rather than as a
//surprise in somebody's production install.
export interface AdapterHarness {
  //Builds an adapter on a clean schema and runs the migrations.
  connect: () => Promise<DbAdapter>;

  //Whether this database is reachable. Vitest decides to skip before it can
  //await anything, so the caller resolves this and passes the answer in. When
  //it is false the suite skips, which is what lets a checkout with no Docker
  //still run everything else.
  available: boolean;
}

const actor: Actor = { userId: '7', role: 'superuser' };
const TENANT = 'default';

export const describeDatabaseAdapter = (name: string, harness: AdapterHarness): void => {
  const suite = harness.available ? describe : describe.skip;

  suite(`${name} adapter`, () => {
    let db: DbAdapter;

    beforeEach(async () => {
      db = await harness.connect();
    });

    afterEach(async () => {
      await db.close();
    });

    it('runs the migrations and can run them again safely', async () => {
      //A second run must be a no op, not an error.
      await expect(db.runMigrations()).resolves.toBeUndefined();

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

        //Each driver raises a different code for this. What matters is that all
        //of them reject, and that the adapter turns it into a thrown error.
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
        await db.upsertContent(
          TENANT,
          { tag: 'hero-image', body: '', mediaUrl: 'https://x.test/a.png' },
          actor,
        );

        expect((await db.getContentByTags(TENANT, ['hero-image']))[0]?.mediaUrl).toBe(
          'https://x.test/a.png',
        );
      });

      it('returns null rather than a blank string for missing media', async () => {
        await db.createTag(TENANT, 'plain-tag', 'plain', actor);

        expect((await db.getContentByTags(TENANT, ['plain-tag']))[0]?.mediaUrl).toBeNull();
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

      it('round trips rich text markup unchanged', async () => {
        await db.createTag(TENANT, 'rich-tag', 'rich', actor);
        const body = '<p>Some <strong>bold</strong> &amp; "quoted" copy</p>';

        await db.upsertContent(TENANT, { tag: 'rich-tag', body }, actor);

        expect((await db.getContentByTags(TENANT, ['rich-tag']))[0]?.body).toBe(body);
      });

      it('round trips unicode and emoji', async () => {
        await db.createTag(TENANT, 'unicode-tag', 'plain', actor);
        const body = 'Ünïcödé — ok? ✅ 日本語';

        await db.upsertContent(TENANT, { tag: 'unicode-tag', body }, actor);

        expect((await db.getContentByTags(TENANT, ['unicode-tag']))[0]?.body).toBe(body);
      });

      it('hands back an updatedAt that is a parseable date', async () => {
        await db.createTag(TENANT, 'stamped', 'plain', actor);

        const [record] = await db.getContentByTags(TENANT, ['stamped']);

        //Every adapter types this as a string, so every adapter has to produce
        //one, and it has to be a date a client can actually read.
        expect(typeof record?.updatedAt).toBe('string');
        expect(Number.isNaN(Date.parse(String(record?.updatedAt)))).toBe(false);
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

      it('gives back an id that findUserById accepts', async () => {
        //Postgres returns it from RETURNING, MySQL from insertId, SQLite from
        //lastInsertRowid. All three have to be usable as an id afterwards.
        const created = await db.createUser({
          email: 'roundtrip@example.com',
          passwordHash: 'hashed',
          role: 'editor',
        });

        expect(typeof created.id).toBe('string');
        expect(created.id).not.toBe('');
        expect((await db.findUserById(created.id))?.email).toBe('roundtrip@example.com');
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
        //Postgres stores a real boolean, MySQL a TINYINT, SQLite an INTEGER.
        //The adapter has to hand back an actual false either way.
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

      it('keeps the expiry it was given', async () => {
        await db.saveRefreshToken(record);

        const found = await db.findRefreshToken('token-1');

        //Stored as a string on every adapter, and it has to come back readable.
        expect(Number.isNaN(Date.parse(String(found?.expiresAt)))).toBe(false);
      });
    });
  });
};
