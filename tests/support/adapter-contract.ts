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

//An id no adapter will ever hand out, and still a number so that the Postgres
//and MySQL bigint columns accept it rather than failing to parse it.
const UNKNOWN_ID = '987654';

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

      it('changes a role by id and reports a miss for an unknown one', async () => {
        const created = await db.createUser({
          email: 'promoted@example.com',
          passwordHash: 'a',
          role: 'editor',
        });

        expect(await db.setUserRole(created.id, 'superuser')).toBe(true);
        expect((await db.findUserById(created.id))?.role).toBe('superuser');

        expect(await db.setUserRole(UNKNOWN_ID, 'superuser')).toBe(false);
      });

      it('changes a password by id for that user only', async () => {
        const target = await db.createUser({
          email: 'target@example.com',
          passwordHash: 'old',
          role: 'editor',
        });
        const bystander = await db.createUser({
          email: 'bystander@example.com',
          passwordHash: 'untouched',
          role: 'editor',
        });

        expect(await db.setUserPassword(target.id, 'new-hash')).toBe(true);

        expect((await db.findUserById(target.id))?.passwordHash).toBe('new-hash');
        expect((await db.findUserById(bystander.id))?.passwordHash).toBe('untouched');

        expect(await db.setUserPassword(UNKNOWN_ID, 'new-hash')).toBe(false);
      });

      it('changes an email so the new address is the one that finds them', async () => {
        const created = await db.createUser({
          email: 'before@example.com',
          passwordHash: 'a',
          role: 'editor',
        });

        expect(await db.setUserEmail(created.id, 'after@example.com')).toBe(true);

        expect((await db.findUserByEmail('after@example.com'))?.id).toBe(created.id);
        expect(await db.findUserByEmail('before@example.com')).toBeNull();

        expect(await db.setUserEmail(UNKNOWN_ID, 'nobody@example.com')).toBe(false);
      });

      it('refuses an email another user already has', async () => {
        await db.createUser({ email: 'taken@example.com', passwordHash: 'a', role: 'editor' });
        const created = await db.createUser({
          email: 'mine@example.com',
          passwordHash: 'b',
          role: 'editor',
        });

        //Each driver raises a different code for this. What matters is that all
        //of them reject, and that the adapter turns it into a thrown error.
        await expect(db.setUserEmail(created.id, 'taken@example.com')).rejects.toThrow();
      });

      it('keeps an external id given at creation', async () => {
        const created = await db.createUser({
          email: 'linked@example.com',
          passwordHash: 'a',
          role: 'editor',
          externalId: 'idp-user-1',
        });

        expect(created.externalId).toBe('idp-user-1');
        expect((await db.findUserByEmail('linked@example.com'))?.externalId).toBe('idp-user-1');
      });

      it('stores null when a user is created without an external id', async () => {
        //Null and undefined both read as falsy, and only null is what an
        //unlinked user is supposed to hold, so this asserts the exact value.
        const created = await db.createUser({
          email: 'unlinked@example.com',
          passwordHash: 'a',
          role: 'editor',
        });

        expect(created.externalId).toBeNull();
        expect((await db.findUserByEmail('unlinked@example.com'))?.externalId).toBeNull();
      });

      it('finds a user by external id and reports a miss for an unknown one', async () => {
        const created = await db.createUser({
          email: 'linked@example.com',
          passwordHash: 'a',
          role: 'editor',
          externalId: 'idp-user-1',
        });

        expect((await db.findUserByExternalId('idp-user-1'))?.id).toBe(created.id);
        expect(await db.findUserByExternalId('idp-nobody')).toBeNull();
      });

      it('links an external id by id for that user only', async () => {
        const target = await db.createUser({
          email: 'target@example.com',
          passwordHash: 'a',
          role: 'editor',
        });
        const bystander = await db.createUser({
          email: 'bystander@example.com',
          passwordHash: 'b',
          role: 'editor',
        });

        expect(await db.setUserExternalId(target.id, 'idp-user-1')).toBe(true);

        expect((await db.findUserById(target.id))?.externalId).toBe('idp-user-1');
        expect((await db.findUserById(bystander.id))?.externalId).toBeNull();
      });

      it('unlinks a user when the external id is set to null', async () => {
        const created = await db.createUser({
          email: 'linked@example.com',
          passwordHash: 'a',
          role: 'editor',
          externalId: 'idp-user-1',
        });

        expect(await db.setUserExternalId(created.id, null)).toBe(true);

        expect((await db.findUserById(created.id))?.externalId).toBeNull();
        expect(await db.findUserByExternalId('idp-user-1')).toBeNull();
      });

      it('reports a miss when linking an external id to an unknown user', async () => {
        expect(await db.setUserExternalId(UNKNOWN_ID, 'idp-user-1')).toBe(false);
      });

      it('refuses an external id another user already has', async () => {
        await db.createUser({
          email: 'taken@example.com',
          passwordHash: 'a',
          role: 'editor',
          externalId: 'idp-user-1',
        });
        const created = await db.createUser({
          email: 'mine@example.com',
          passwordHash: 'b',
          role: 'editor',
        });

        //Each driver raises a different code for this. What matters is that all
        //of them reject, and that the adapter turns it into a thrown error.
        await expect(db.setUserExternalId(created.id, 'idp-user-1')).rejects.toThrow();
      });

      it('deletes a user by id and reports a miss for an unknown one', async () => {
        const created = await db.createUser({
          email: 'departing@example.com',
          passwordHash: 'a',
          role: 'editor',
        });

        expect(await db.deleteUser(created.id)).toBe(true);
        expect(await db.findUserById(created.id)).toBeNull();

        expect(await db.deleteUser(UNKNOWN_ID)).toBe(false);
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

      it('deletes every token one user owns and leaves another user alone', async () => {
        //The ids have to come from createUser: Postgres, MySQL, and SQLite each
        //mint them differently, and a literal would match on none of them.
        const mine = await db.createUser({
          email: 'mine@example.com',
          passwordHash: 'a',
          role: 'editor',
        });
        const theirs = await db.createUser({
          email: 'theirs@example.com',
          passwordHash: 'b',
          role: 'editor',
        });

        await db.saveRefreshToken({ ...record, id: 'mine-1', familyId: 'mine-a', userId: mine.id });
        await db.saveRefreshToken({ ...record, id: 'mine-2', familyId: 'mine-b', userId: mine.id });
        await db.saveRefreshToken({
          ...record,
          id: 'theirs-1',
          familyId: 'theirs-a',
          userId: theirs.id,
        });

        await db.deleteRefreshTokensForUser(mine.id);

        expect(await db.findRefreshToken('mine-1')).toBeNull();
        expect(await db.findRefreshToken('mine-2')).toBeNull();
        expect(await db.isRefreshFamilyActive('mine-a')).toBe(false);
        expect(await db.isRefreshFamilyActive('mine-b')).toBe(false);

        expect((await db.findRefreshToken('theirs-1'))?.userId).toBe(theirs.id);
        expect(await db.isRefreshFamilyActive('theirs-a')).toBe(true);
      });

      it('spares one family so the session doing the signing out survives', async () => {
        const user = await db.createUser({
          email: 'keeper@example.com',
          passwordHash: 'a',
          role: 'editor',
        });

        await db.saveRefreshToken({ ...record, id: 'here', familyId: 'here-a', userId: user.id });
        await db.saveRefreshToken({ ...record, id: 'phone', familyId: 'phone-a', userId: user.id });

        await db.deleteRefreshTokensForUser(user.id, 'here-a');

        expect((await db.findRefreshToken('here'))?.familyId).toBe('here-a');
        expect(await db.isRefreshFamilyActive('here-a')).toBe(true);

        expect(await db.findRefreshToken('phone')).toBeNull();
        expect(await db.isRefreshFamilyActive('phone-a')).toBe(false);
      });
    });
  });
};
