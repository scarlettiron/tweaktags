//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACTIONS,
  conflict,
  createHandler,
  notFound,
  type Actor,
  type AuthAdapter,
  type AuthUser,
  type ContentInput,
  type ContentRecord,
  type CreateUserInput,
  type DbAdapter,
  type RefreshTokenRecord,
  type Role,
  type StorageAdapter,
  type StoredUser,
  type TagType,
  type TweakTagsConfig,
  type TweakTagsHandler,
} from '@tweaktags/core';

//A superuser actor used to seed content in the tests.
const superActor: Actor = { userId: '1', role: 'superuser' };

//A tiny in memory database so we can test the handler without a real database.
//It mirrors the real adapters closely enough to exercise the handler branches,
//including the conflict on a duplicate tag and the not found on a missing one.
class FakeDb implements DbAdapter {
  //Keyed by "tenant|tag" so two tenants can hold the same tag independently,
  //the same way the real adapters key on the pair of tenant and tag.
  public content = new Map<string, ContentRecord>();

  private key(tenant: string, tag: string): string {
    return `${tenant}|${tag}`;
  }

  async runMigrations(): Promise<void> {}

  async getContentByTags(tenant: string, tags: string[]): Promise<ContentRecord[]> {
    const records: ContentRecord[] = [];

    for (const tag of tags) {
      const record = this.content.get(this.key(tenant, tag));

      if (record) {
        records.push(record);
      }
    }

    return records;
  }

  async createTag(tenant: string, tag: string, type: TagType, actor: Actor): Promise<ContentRecord> {
    const key = this.key(tenant, tag);

    if (this.content.has(key)) {
      throw conflict(`The tag "${tag}" already exists`);
    }

    const record: ContentRecord = {
      tag,
      type,
      body: '',
      mediaUrl: null,
      updatedAt: null,
      updatedBy: actor.userId,
    };

    this.content.set(key, record);

    return record;
  }

  async upsertContent(tenant: string, input: ContentInput, actor: Actor): Promise<ContentRecord> {
    const key = this.key(tenant, input.tag);

    const record: ContentRecord = {
      tag: input.tag,
      type: this.content.get(key)?.type ?? 'plain',
      body: input.body,
      mediaUrl: input.mediaUrl ?? null,
      updatedAt: '2026-01-01T00:00:00.000Z',
      updatedBy: actor.userId,
    };

    this.content.set(key, record);

    return record;
  }

  async setTagType(tenant: string, tag: string, type: TagType): Promise<ContentRecord> {
    const key = this.key(tenant, tag);
    const existing = this.content.get(key);

    if (!existing) {
      throw notFound(`The tag "${tag}" does not exist`);
    }

    const record: ContentRecord = { ...existing, type };
    this.content.set(key, record);

    return record;
  }

  async deleteTag(tenant: string, tag: string): Promise<void> {
    const key = this.key(tenant, tag);

    if (!this.content.has(key)) {
      throw notFound(`The tag "${tag}" does not exist`);
    }

    this.content.delete(key);
  }

  async listTags(tenant: string): Promise<string[]> {
    const prefix = `${tenant}|`;

    return Array.from(this.content.keys())
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length))
      .sort();
  }

  //Real rows rather than canned answers, because the user management rules are
  //all about what the database says: who else is a superuser, whether a target
  //exists, and whether the caller's own row still says what their token says.
  //The seeded ids match the ones fakeAuth.verify hands out for its two tokens.
  public users = new Map<string, StoredUser>([
        [
      '1',
      {
        id: '1',
        email: 'super@example.com',
        role: 'superuser',
        passwordHash: 'hash:secret',
        externalId: null,
      },
    ],
    [
      '2',
      {
        id: '2',
        email: 'editor@example.com',
        role: 'editor',
        passwordHash: 'hash:secret',
        externalId: null,
      },
    ],
  ]);

  private nextUserId = 3;

  //Every refresh token deletion the handler asks for, so tests can assert that
  //sessions were ended and that a self password change spared its own family.
  public revoked: Array<{ userId: string; exceptFamilyId?: string }> = [];

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    return this.users.get(id) ?? null;
  }

  async createUser(input: CreateUserInput): Promise<StoredUser> {
    if (await this.findUserByEmail(input.email)) {
      throw conflict(`A user with the email "${input.email}" already exists`);
    }

    const user: StoredUser = {
      id: String(this.nextUserId++),
      email: input.email,
      role: input.role,
      passwordHash: input.passwordHash,
      externalId: input.externalId ?? null,
    };

    this.users.set(user.id, user);

    return user;
  }

  async updateUserPassword(): Promise<boolean> {
    return true;
  }

  async listUsers(): Promise<AuthUser[]> {
    return [...this.users.values()]
      .map(({ id, email, role }) => ({ id, email, role }))
      .sort((a, b) => a.email.localeCompare(b.email));
  }

  async setUserRole(id: string, role: Role): Promise<boolean> {
    const user = this.users.get(id);

    if (!user) {
      return false;
    }

    this.users.set(id, { ...user, role });

    return true;
  }

  async setUserPassword(id: string, passwordHash: string): Promise<boolean> {
    const user = this.users.get(id);

    if (!user) {
      return false;
    }

    this.users.set(id, { ...user, passwordHash });

    return true;
  }

  async setUserEmail(id: string, email: string): Promise<boolean> {
    const user = this.users.get(id);

    if (!user) {
      return false;
    }

    const taken = [...this.users.values()].some(
      (other) => other.email === email && other.id !== id,
    );

    if (taken) {
      throw conflict(`A user with the email "${email}" already exists`);
    }

    this.users.set(id, { ...user, email });

    return true;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async findUserByExternalId(externalId: string): Promise<StoredUser | null> {
    return [...this.users.values()].find((user) => user.externalId === externalId) ?? null;
  }

  async setUserExternalId(id: string, externalId: string | null): Promise<boolean> {
    const user = this.users.get(id);

    if (!user) {
      return false;
    }

    const taken =
      externalId !== null &&
      [...this.users.values()].some(
        (other) => other.externalId === externalId && other.id !== id,
      );

    if (taken) {
      throw conflict('That identity provider account is already linked to another user');
    }

    this.users.set(id, { ...user, externalId });

    return true;
  }

  async deleteRefreshTokensForUser(userId: string, exceptFamilyId?: string): Promise<void> {
    this.revoked.push({ userId, exceptFamilyId });
  }

  async saveRefreshToken(): Promise<void> {}

  async findRefreshToken(): Promise<RefreshTokenRecord | null> {
    return null;
  }

  async revokeRefreshToken(): Promise<void> {}

  async revokeRefreshFamily(): Promise<void> {}

  async isRefreshFamilyActive(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {}
}

//A logout spy we can assert against.
const logoutSpy = vi.fn(async (_token: string) => {});
const endSessionsSpy = vi.fn();

//A fake auth adapter that maps known tokens to actors.
const fakeAuth: AuthAdapter = {
  async login() {
    return {
      accessToken: 'super',
      refreshToken: 'super-refresh',
      user: { id: '1', email: 'user@example.com', role: 'superuser' },
    };
  },
  async verify(token: string): Promise<Actor | null> {
    if (token === 'super') {
      return { userId: '1', role: 'superuser', familyId: 'super-family' };
    }

    if (token === 'editor') {
      return { userId: '2', role: 'editor', familyId: 'editor-family' };
    }

    return null;
  },
  async refresh(refreshToken: string) {
    if (refreshToken === 'super-refresh') {
      return {
        accessToken: 'super',
        refreshToken: 'super-refresh',
        user: { id: '1', email: 'user@example.com', role: 'superuser' },
      };
    }

    return null;
  },
  logout: logoutSpy,
  async hashPassword(password: string) {
    return `hash:${password}`;
  },
  async createUser() {
    return { userId: '1', role: 'superuser' };
  },
  //hashPassword above returns `hash:${password}`, so the seeded rows hold
  //"hash:secret" and this agrees with them without any special casing.
  async verifyPassword(email: string, password: string) {
    return password === 'secret' && email.includes('@');
  },
  //The real jwt adapter delegates this straight to the refresh token store, so
  //the fake records it the same way the store used to.
  async endSessions(userId: string, exceptFamilyId?: string) {
    endSessionsSpy(userId, exceptFamilyId);
  },
};

//The same fake auth, plus a people directory. It stands in for any provider that
//keeps logins outside TweakTags, which is what the handler actually branches on:
//it never learns that Cognito exists.
const pool = new Map<string, { externalId: string; email: string }>([
  ['taken@example.com', { externalId: 'sub-taken', email: 'taken@example.com' }],
]);

const setPasswordSpy = vi.fn();

const directoryAuth: AuthAdapter = {
  ...fakeAuth,
  directory: {
    //Takes no password: an account that already exists keeps the one it has,
    //and a new one here is only ever made by the fake below.
    async createOrLink(email: string) {
      const existing = pool.get(email);

      //The case the whole feature exists for. An address already in the pool is
      //linked rather than created, and its password is deliberately untouched.
      if (existing) {
        return { ...existing, alreadyExisted: true };
      }

      const made = { externalId: `sub-${pool.size + 1}`, email };
      pool.set(email, made);

      return { ...made, alreadyExisted: false };
    },
    async findByExternalId(externalId: string) {
      const found = [...pool.values()].find((entry) => entry.externalId === externalId);

      return found ? { ...found, alreadyExisted: true } : null;
    },
    async setPassword(externalId: string, password: string) {
      setPasswordSpy(externalId, password);
    },
  },
};

//A fake storage adapter that echoes the key back in the urls, so tests can check
//the key is namespaced by tenant.
const fakeStorage: StorageAdapter = {
  async createUploadUrl({ key, contentType }) {
    return {
      uploadUrl: `https://s3.test/upload/${key}`,
      publicUrl: `https://cdn.test/${key}`,
      headers: { 'Content-Type': contentType },
    };
  },
};

describe('request handler', () => {
  let db: FakeDb;
  let handle: TweakTagsHandler;

  beforeEach(() => {
    db = new FakeDb();
    handle = createHandler({ db, auth: fakeAuth, config: {} as TweakTagsConfig });
    logoutSpy.mockClear();
    endSessionsSpy.mockClear();
  });

  describe('reading content', () => {
    it('reads content without a token', async () => {
      await db.createTag('default', 'hero-title', 'plain', superActor);

      const response = await handle({
        action: ACTIONS.GET_CONTENT,
        payload: { tags: ['hero-title'] },
      });

      expect(response.status).toBe(200);
      expect((response.body.content as ContentRecord[]).length).toBe(1);
    });

    it('returns only the tags that exist', async () => {
      await db.createTag('default', 'a', 'plain', superActor);

      const response = await handle({
        action: ACTIONS.GET_CONTENT,
        payload: { tags: ['a', 'missing'] },
      });

      expect((response.body.content as ContentRecord[]).map((record) => record.tag)).toEqual(['a']);
    });

    it('rejects a getContent call with no tags array', async () => {
      const response = await handle({ action: ACTIONS.GET_CONTENT, payload: {} });

      expect(response.status).toBe(400);
    });
  });

  describe('login, refresh, logout, and me', () => {
    it('signs a user in and returns the tokens and user', async () => {
      const response = await handle({
        action: ACTIONS.LOGIN,
        payload: { email: 'user@example.com', password: 'secret' },
      });

      expect(response.status).toBe(200);
      expect(response.body.accessToken).toBe('super');
      expect(response.body.refreshToken).toBe('super-refresh');
      expect((response.body.user as AuthUser).email).toBe('user@example.com');
    });

    it('rejects a login with missing fields', async () => {
      const response = await handle({ action: ACTIONS.LOGIN, payload: { email: 'user@x.com' } });

      expect(response.status).toBe(400);
    });

    it('refreshes with the refresh token from the request', async () => {
      const response = await handle({ action: ACTIONS.REFRESH, refreshToken: 'super-refresh' });

      expect(response.status).toBe(200);
      expect(response.body.accessToken).toBe('super');
    });

    it('refreshes with the refresh token from the body in header mode', async () => {
      const response = await handle({
        action: ACTIONS.REFRESH,
        payload: { refreshToken: 'super-refresh' },
      });

      expect(response.status).toBe(200);
    });

    it('rejects a refresh with a bad token', async () => {
      const response = await handle({ action: ACTIONS.REFRESH, refreshToken: 'nope' });

      expect(response.status).toBe(401);
    });

    it('rejects a refresh with no token at all', async () => {
      const response = await handle({ action: ACTIONS.REFRESH });

      expect(response.status).toBe(401);
    });

    it('logs out using the refresh token', async () => {
      const response = await handle({
        action: ACTIONS.LOGOUT,
        authToken: 'super',
        refreshToken: 'super-refresh',
      });

      expect(response.status).toBe(200);
      expect(logoutSpy).toHaveBeenCalledWith('super-refresh');
    });

    it('returns the current user for a valid token', async () => {
      const response = await handle({ action: ACTIONS.ME, authToken: 'super' });

      expect(response.status).toBe(200);
      expect((response.body.user as AuthUser).id).toBe('1');
    });

    it('rejects me with no token', async () => {
      const response = await handle({ action: ACTIONS.ME });

      expect(response.status).toBe(401);
    });

    it('rejects me with an invalid token', async () => {
      const response = await handle({ action: ACTIONS.ME, authToken: 'garbage' });

      expect(response.status).toBe(401);
    });
  });

  describe('listing tags', () => {
    it('lists tags for a signed in user', async () => {
      await db.createTag('default', 'b', 'plain', superActor);
      await db.createTag('default', 'a', 'plain', superActor);

      const response = await handle({ action: ACTIONS.LIST_TAGS, authToken: 'editor' });

      expect(response.status).toBe(200);
      expect(response.body.tags).toEqual(['a', 'b']);
    });

    it('refuses to list tags without a token', async () => {
      const response = await handle({ action: ACTIONS.LIST_TAGS });

      expect(response.status).toBe(401);
    });
  });

  describe('creating tags', () => {
    it('refuses tag creation without a token', async () => {
      const response = await handle({ action: ACTIONS.CREATE_TAG, payload: { tag: 'new-tag' } });

      expect(response.status).toBe(401);
    });

    it('refuses tag creation for an editor', async () => {
      const response = await handle({
        action: ACTIONS.CREATE_TAG,
        payload: { tag: 'new-tag' },
        authToken: 'editor',
      });

      expect(response.status).toBe(403);
    });

    it('allows tag creation for a superuser', async () => {
      const response = await handle({
        action: ACTIONS.CREATE_TAG,
        payload: { tag: 'new-tag' },
        authToken: 'super',
      });

      expect(response.status).toBe(201);
      expect(db.content.has('default|new-tag')).toBe(true);
    });

    it('creates a tag with the requested type', async () => {
      const response = await handle({
        action: ACTIONS.CREATE_TAG,
        payload: { tag: 'hero', type: 'rich' },
        authToken: 'super',
      });

      expect((response.body.content as ContentRecord).type).toBe('rich');
    });

    it('rejects an invalid tag name', async () => {
      const response = await handle({
        action: ACTIONS.CREATE_TAG,
        payload: { tag: 'Not A Tag' },
        authToken: 'super',
      });

      expect(response.status).toBe(400);
    });

    it('rejects an invalid tag type', async () => {
      const response = await handle({
        action: ACTIONS.CREATE_TAG,
        payload: { tag: 'hero', type: 'fancy' },
        authToken: 'super',
      });

      expect(response.status).toBe(400);
    });

    it('returns a conflict when the tag already exists', async () => {
      await db.createTag('default', 'hero', 'plain', superActor);

      const response = await handle({
        action: ACTIONS.CREATE_TAG,
        payload: { tag: 'hero' },
        authToken: 'super',
      });

      expect(response.status).toBe(409);
    });
  });

  describe('updating content', () => {
    it('stops an editor from editing a tag that does not exist', async () => {
      const response = await handle({
        action: ACTIONS.UPDATE_CONTENT,
        payload: { tag: 'missing-tag', body: 'hello' },
        authToken: 'editor',
      });

      expect(response.status).toBe(403);
    });

    it('lets an editor edit a tag that already exists', async () => {
      await db.createTag('default', 'hero-title', 'plain', superActor);

      const response = await handle({
        action: ACTIONS.UPDATE_CONTENT,
        payload: { tag: 'hero-title', body: 'updated' },
        authToken: 'editor',
      });

      expect(response.status).toBe(200);
      expect(db.content.get('default|hero-title')?.body).toBe('updated');
    });

    it('lets a superuser create the row while updating', async () => {
      const response = await handle({
        action: ACTIONS.UPDATE_CONTENT,
        payload: { tag: 'brand-new', body: 'hello' },
        authToken: 'super',
      });

      expect(response.status).toBe(200);
      expect(db.content.get('default|brand-new')?.body).toBe('hello');
    });

    it('rejects body text that looks like sql injection', async () => {
      await db.createTag('default', 'hero-title', 'plain', superActor);

      const response = await handle({
        action: ACTIONS.UPDATE_CONTENT,
        payload: { tag: 'hero-title', body: "'; DROP TABLE users; --" },
        authToken: 'super',
      });

      expect(response.status).toBe(400);
    });

    it('rejects body text that contains a script tag', async () => {
      await db.createTag('default', 'hero-title', 'plain', superActor);

      const response = await handle({
        action: ACTIONS.UPDATE_CONTENT,
        payload: { tag: 'hero-title', body: '<script>alert(1)</script>' },
        authToken: 'super',
      });

      expect(response.status).toBe(400);
    });

    it('rejects a media url that contains dangerous html', async () => {
      await db.createTag('default', 'hero-image', 'media', superActor);

      const response = await handle({
        action: ACTIONS.UPDATE_CONTENT,
        payload: { tag: 'hero-image', body: 'alt text', mediaUrl: 'javascript:alert(1)' },
        authToken: 'super',
      });

      expect(response.status).toBe(400);
    });
  });

  describe('changing tag type', () => {
    it('lets a superuser change a tag type', async () => {
      await db.createTag('default', 'hero-title', 'plain', superActor);

      const response = await handle({
        action: ACTIONS.UPDATE_TAG_TYPE,
        payload: { tag: 'hero-title', type: 'rich' },
        authToken: 'super',
      });

      expect(response.status).toBe(200);
      expect(db.content.get('default|hero-title')?.type).toBe('rich');
    });

    it('refuses a tag type change for an editor', async () => {
      await db.createTag('default', 'hero-title', 'plain', superActor);

      const response = await handle({
        action: ACTIONS.UPDATE_TAG_TYPE,
        payload: { tag: 'hero-title', type: 'rich' },
        authToken: 'editor',
      });

      expect(response.status).toBe(403);
    });

    it('returns not found when the tag is missing', async () => {
      const response = await handle({
        action: ACTIONS.UPDATE_TAG_TYPE,
        payload: { tag: 'missing', type: 'rich' },
        authToken: 'super',
      });

      expect(response.status).toBe(404);
    });
  });

  describe('deleting tags', () => {
    it('lets a superuser delete a tag', async () => {
      await db.createTag('default', 'hero-title', 'plain', superActor);

      const response = await handle({
        action: ACTIONS.DELETE_TAG,
        payload: { tag: 'hero-title' },
        authToken: 'super',
      });

      expect(response.status).toBe(200);
      expect(db.content.has('default|hero-title')).toBe(false);
    });

    it('refuses a delete for an editor', async () => {
      await db.createTag('default', 'hero-title', 'plain', superActor);

      const response = await handle({
        action: ACTIONS.DELETE_TAG,
        payload: { tag: 'hero-title' },
        authToken: 'editor',
      });

      expect(response.status).toBe(403);
    });

    it('returns not found when deleting a missing tag', async () => {
      const response = await handle({
        action: ACTIONS.DELETE_TAG,
        payload: { tag: 'missing' },
        authToken: 'super',
      });

      expect(response.status).toBe(404);
    });
  });

  describe('unknown actions', () => {
    it('rejects an action it does not understand', async () => {
      const response = await handle({ action: 'explode' as unknown as typeof ACTIONS.ME });

      expect(response.status).toBe(400);
    });
  });

  describe('multi-tenant', () => {
    it('scopes created tags to the request tenant', async () => {
      await handle({
        action: ACTIONS.CREATE_TAG,
        payload: { tag: 'hero' },
        authToken: 'super',
        tenant: 'drystrip',
      });

      const drystrip = await handle({ action: ACTIONS.LIST_TAGS, authToken: 'editor', tenant: 'drystrip' });
      const other = await handle({ action: ACTIONS.LIST_TAGS, authToken: 'editor', tenant: 'other' });

      expect(drystrip.body.tags).toEqual(['hero']);
      expect(other.body.tags).toEqual([]);
    });

    it('lets two tenants hold the same tag name independently', async () => {
      await db.createTag('drystrip', 'hero', 'plain', superActor);
      await db.createTag('other', 'hero', 'plain', superActor);

      await handle({
        action: ACTIONS.UPDATE_CONTENT,
        payload: { tag: 'hero', body: 'drystrip copy' },
        authToken: 'super',
        tenant: 'drystrip',
      });

      const drystrip = await handle({
        action: ACTIONS.GET_CONTENT,
        payload: { tags: ['hero'] },
        tenant: 'drystrip',
      });
      const other = await handle({
        action: ACTIONS.GET_CONTENT,
        payload: { tags: ['hero'] },
        tenant: 'other',
      });

      expect((drystrip.body.content as ContentRecord[])[0]?.body).toBe('drystrip copy');
      expect((other.body.content as ContentRecord[])[0]?.body).toBe('');
    });

    it('does not return another tenant content', async () => {
      await db.createTag('drystrip', 'hero', 'plain', superActor);

      const response = await handle({
        action: ACTIONS.GET_CONTENT,
        payload: { tags: ['hero'] },
        tenant: 'other',
      });

      expect((response.body.content as ContentRecord[]).length).toBe(0);
    });

    it('falls back to the default tenant when the request has none', async () => {
      await db.createTag('default', 'hero', 'plain', superActor);

      const response = await handle({ action: ACTIONS.GET_CONTENT, payload: { tags: ['hero'] } });

      expect((response.body.content as ContentRecord[]).length).toBe(1);
    });
  });

  describe('media uploads', () => {
    it('rejects an upload when no storage is set up', async () => {
      const response = await handle({
        action: ACTIONS.SIGN_UPLOAD,
        payload: { filename: 'a.png', contentType: 'image/png' },
        authToken: 'super',
      });

      expect(response.status).toBe(400);
    });

    it('requires a signed in user to sign an upload', async () => {
      const withStorage = createHandler({ db, auth: fakeAuth, storage: fakeStorage, config: {} as TweakTagsConfig });

      const response = await withStorage({
        action: ACTIONS.SIGN_UPLOAD,
        payload: { filename: 'a.png', contentType: 'image/png' },
      });

      expect(response.status).toBe(401);
    });

    it('signs an upload and namespaces the key by tenant', async () => {
      const withStorage = createHandler({ db, auth: fakeAuth, storage: fakeStorage, config: {} as TweakTagsConfig });

      const response = await withStorage({
        action: ACTIONS.SIGN_UPLOAD,
        payload: { filename: 'hero.png', contentType: 'image/png' },
        authToken: 'super',
        tenant: 'drystrip',
      });

      expect(response.status).toBe(200);
      expect(String(response.body.uploadUrl)).toContain('drystrip/');
      expect(String(response.body.publicUrl)).toContain('drystrip/');
    });
  });

  describe('managing users', () => {
    it('refuses to list users without a token', async () => {
      const response = await handle({ action: ACTIONS.LIST_USERS });

      expect(response.status).toBe(401);
    });

    it('refuses to list users for an editor', async () => {
      const response = await handle({ action: ACTIONS.LIST_USERS, authToken: 'editor' });

      expect(response.status).toBe(403);
    });

    it('lists every user for a superuser', async () => {
      const response = await handle({ action: ACTIONS.LIST_USERS, authToken: 'super' });

      expect(response.status).toBe(200);
      expect(response.body.users).toEqual([
        { id: '2', email: 'editor@example.com', role: 'editor' },
        { id: '1', email: 'super@example.com', role: 'superuser' },
      ]);
    });

    //The freshness check. The token still claims superuser, but the row behind it
    //says editor, so the demotion has to bite straight away rather than at the end
    //of the access token life.
    it('refuses a superuser token whose row has since been demoted', async () => {
      db.users.set('1', {
        id: '1',
        email: 'super@example.com',
        role: 'editor',
        passwordHash: 'hash:secret',
      });

      const list = await handle({ action: ACTIONS.LIST_USERS, authToken: 'super' });
      const create = await handle({
        action: ACTIONS.CREATE_USER,
        payload: { email: 'new@example.com', password: 'password1', role: 'editor' },
        authToken: 'super',
      });
      const remove = await handle({
        action: ACTIONS.DELETE_USER,
        payload: { userId: '2' },
        authToken: 'super',
      });

      expect(list.status).toBe(403);
      expect(create.status).toBe(403);
      expect(remove.status).toBe(403);
      expect(db.users.has('2')).toBe(true);
    });

    it('creates a user', async () => {
      const response = await handle({
        action: ACTIONS.CREATE_USER,
        payload: { email: 'new@example.com', password: 'password1', role: 'editor' },
        authToken: 'super',
      });

      expect(response.status).toBe(201);
      expect(response.body.user).toEqual({ id: '3', email: 'new@example.com', role: 'editor' });
      expect(db.users.get('3')?.passwordHash).toBe('hash:password1');
    });

    it('refuses to create a user with an address somebody already has', async () => {
      const response = await handle({
        action: ACTIONS.CREATE_USER,
        payload: { email: 'editor@example.com', password: 'password1', role: 'editor' },
        authToken: 'super',
      });

      expect(response.status).toBe(409);
    });

    it('refuses a bad email, a short password and an unknown role', async () => {
      const base = { password: 'password1', role: 'editor' };

      const badEmail = await handle({
        action: ACTIONS.CREATE_USER,
        payload: { ...base, email: 'not-an-email' },
        authToken: 'super',
      });
      const shortPassword = await handle({
        action: ACTIONS.CREATE_USER,
        payload: { ...base, email: 'new@example.com', password: 'short' },
        authToken: 'super',
      });
      const badRole = await handle({
        action: ACTIONS.CREATE_USER,
        payload: { ...base, email: 'new@example.com', role: 'admin' },
        authToken: 'super',
      });

      expect(badEmail.status).toBe(400);
      expect(shortPassword.status).toBe(400);
      expect(badRole.status).toBe(400);
    });

    it('refuses to change your own role', async () => {
      const response = await handle({
        action: ACTIONS.UPDATE_USER_ROLE,
        payload: { userId: '1', role: 'editor' },
        authToken: 'super',
      });

      expect(response.status).toBe(403);
      expect(db.users.get('1')?.role).toBe('superuser');
    });

    it('changes the role of somebody else and ends their sessions', async () => {
      const response = await handle({
        action: ACTIONS.UPDATE_USER_ROLE,
        payload: { userId: '2', role: 'superuser' },
        authToken: 'super',
      });

      expect(response.status).toBe(200);
      expect(db.users.get('2')?.role).toBe('superuser');
      expect(endSessionsSpy).toHaveBeenCalledWith('2', undefined);
    });

    it('reports a missing user when changing a role', async () => {
      const response = await handle({
        action: ACTIONS.UPDATE_USER_ROLE,
        payload: { userId: '99', role: 'editor' },
        authToken: 'super',
      });

      expect(response.status).toBe(404);
    });

    it('resets the password of somebody else and ends their sessions', async () => {
      const response = await handle({
        action: ACTIONS.UPDATE_USER_PASSWORD,
        payload: { userId: '2', password: 'brand-new-one' },
        authToken: 'super',
      });

      expect(response.status).toBe(200);
      expect(db.users.get('2')?.passwordHash).toBe('hash:brand-new-one');
      expect(endSessionsSpy).toHaveBeenCalledWith('2', undefined);
    });

    it('refuses to delete your own account', async () => {
      const response = await handle({
        action: ACTIONS.DELETE_USER,
        payload: { userId: '1' },
        authToken: 'super',
      });

      expect(response.status).toBe(403);
      expect(db.users.has('1')).toBe(true);
    });

    //The whole two step rule end to end: a superuser cannot be deleted outright,
    //but demoting them first turns it into an ordinary delete.
    it('deletes a superuser only after they have been demoted', async () => {
      const created = await handle({
        action: ACTIONS.CREATE_USER,
        payload: { email: 'second@example.com', password: 'password1', role: 'superuser' },
        authToken: 'super',
      });

      const userId = (created.body.user as AuthUser).id;

      const refused = await handle({
        action: ACTIONS.DELETE_USER,
        payload: { userId },
        authToken: 'super',
      });

      expect(refused.status).toBe(403);
      expect(db.users.has(userId)).toBe(true);

      await handle({
        action: ACTIONS.UPDATE_USER_ROLE,
        payload: { userId, role: 'editor' },
        authToken: 'super',
      });

      const deleted = await handle({
        action: ACTIONS.DELETE_USER,
        payload: { userId },
        authToken: 'super',
      });

      expect(deleted.status).toBe(200);
      expect(deleted.body).toEqual({ ok: true, userId });
      expect(db.users.has(userId)).toBe(false);
      expect(endSessionsSpy).toHaveBeenCalledWith(userId, undefined);
    });

    it('reports a missing user when deleting', async () => {
      const response = await handle({
        action: ACTIONS.DELETE_USER,
        payload: { userId: '99' },
        authToken: 'super',
      });

      expect(response.status).toBe(404);
    });
  });

  describe('managing your own account', () => {
    it('lets an editor change their own email', async () => {
      const response = await handle({
        action: ACTIONS.UPDATE_MY_EMAIL,
        payload: { currentPassword: 'secret', email: 'new-editor@example.com' },
        authToken: 'editor',
      });

      expect(response.status).toBe(200);
      expect(response.body.user).toEqual({
        id: '2',
        email: 'new-editor@example.com',
        role: 'editor',
      });
      expect(db.users.get('2')?.email).toBe('new-editor@example.com');
      expect(endSessionsSpy).not.toHaveBeenCalled();
    });

    //403 rather than 401, because the api client replays a 401 after refreshing
    //and would submit the wrong password a second time.
    it('refuses an email change with the wrong current password', async () => {
      const response = await handle({
        action: ACTIONS.UPDATE_MY_EMAIL,
        payload: { currentPassword: 'wrong', email: 'new-editor@example.com' },
        authToken: 'editor',
      });

      expect(response.status).toBe(403);
      expect(db.users.get('2')?.email).toBe('editor@example.com');
    });

    it('refuses an email somebody else already has', async () => {
      const response = await handle({
        action: ACTIONS.UPDATE_MY_EMAIL,
        payload: { currentPassword: 'secret', email: 'super@example.com' },
        authToken: 'editor',
      });

      expect(response.status).toBe(409);
    });

    it('lets an editor change their own password and keeps them signed in here', async () => {
      const response = await handle({
        action: ACTIONS.UPDATE_MY_PASSWORD,
        payload: { currentPassword: 'secret', password: 'password1' },
        authToken: 'editor',
      });

      expect(response.status).toBe(200);
      expect(db.users.get('2')?.passwordHash).toBe('hash:password1');
      expect(endSessionsSpy).toHaveBeenCalledWith('2', 'editor-family');
    });

    it('refuses a password change with the wrong current password', async () => {
      const response = await handle({
        action: ACTIONS.UPDATE_MY_PASSWORD,
        payload: { currentPassword: 'wrong', password: 'password1' },
        authToken: 'editor',
      });

      expect(response.status).toBe(403);
      expect(db.users.get('2')?.passwordHash).toBe('hash:secret');
    });

    it('needs a token to change your own details', async () => {
      const email = await handle({
        action: ACTIONS.UPDATE_MY_EMAIL,
        payload: { currentPassword: 'secret', email: 'nobody@example.com' },
      });
      const password = await handle({
        action: ACTIONS.UPDATE_MY_PASSWORD,
        payload: { currentPassword: 'secret', password: 'password1' },
      });

      expect(email.status).toBe(401);
      expect(password.status).toBe(401);
    });
  });

  //Everything here goes through auth.directory, which is the seam that keeps the
  //handler from knowing which identity provider is underneath.
  describe('managing users with an identity provider', () => {
    let withDirectory: TweakTagsHandler;

    beforeEach(() => {
      pool.clear();
      pool.set('taken@example.com', { externalId: 'sub-taken', email: 'taken@example.com' });
      setPasswordSpy.mockClear();
      withDirectory = createHandler({
        db,
        auth: directoryAuth,
        config: {} as TweakTagsConfig,
      });
    });

    it('creates a new account at the provider and links it', async () => {
      const response = await withDirectory({
        action: ACTIONS.CREATE_USER,
        payload: { email: 'new@example.com', password: 'password1', role: 'editor' },
        authToken: 'super',
      });

      expect(response.status).toBe(201);
      expect(response.body.notice).toBeUndefined();

      const created = response.body.user as AuthUser;

      expect(db.users.get(created.id)?.externalId).toBe('sub-2');
      //No password of ours is kept for somebody whose login lives elsewhere.
      expect(db.users.get(created.id)?.passwordHash).toBe('');
    });

    //The headline case: adding somebody who already has an account in a pool
    //shared with another application.
    it('links an address the provider already knows, and says so', async () => {
      const response = await withDirectory({
        action: ACTIONS.CREATE_USER,
        payload: { email: 'taken@example.com', password: 'password1', role: 'editor' },
        authToken: 'super',
      });

      expect(response.status).toBe(201);
      expect(String(response.body.notice)).toContain('already had an account');
      expect(String(response.body.notice)).toContain('existing password still works');

      const created = response.body.user as AuthUser;

      expect(db.users.get(created.id)?.externalId).toBe('sub-taken');
    });

    it('links an account named by its provider id, with no password at all', async () => {
      const response = await withDirectory({
        action: ACTIONS.CREATE_USER,
        payload: { email: 'linked@example.com', role: 'editor', externalId: 'sub-taken' },
        authToken: 'super',
      });

      expect(response.status).toBe(201);

      const created = response.body.user as AuthUser;

      expect(db.users.get(created.id)?.externalId).toBe('sub-taken');
      //No notice here. Somebody who typed an id asked to link, so telling them
      //it was linked is noise. The notice is for the surprising case only.
      expect(response.body.notice).toBeUndefined();
    });

    it('reports an id the provider does not have', async () => {
      const response = await withDirectory({
        action: ACTIONS.CREATE_USER,
        payload: { email: 'nobody@example.com', role: 'editor', externalId: 'sub-nobody' },
        authToken: 'super',
      });

      expect(response.status).toBe(404);
    });

    //Writing a hash to our own table would change nothing and still look like it
    //had worked, which is the failure worth being loud about.
    it('resets a password at the provider rather than in our table', async () => {
      db.users.set('2', {
        id: '2',
        email: 'editor@example.com',
        role: 'editor',
        passwordHash: '',
        externalId: 'sub-taken',
      });

      const response = await withDirectory({
        action: ACTIONS.UPDATE_USER_PASSWORD,
        payload: { userId: '2', password: 'brand-new-one' },
        authToken: 'super',
      });

      expect(response.status).toBe(200);
      expect(setPasswordSpy).toHaveBeenCalledWith('sub-taken', 'brand-new-one');
      expect(db.users.get('2')?.passwordHash).toBe('');
    });

    it('refuses a password change for a user nobody linked', async () => {
      const response = await withDirectory({
        action: ACTIONS.UPDATE_USER_PASSWORD,
        payload: { userId: '2', password: 'brand-new-one' },
        authToken: 'super',
      });

      expect(response.status).toBe(409);
      expect(setPasswordSpy).not.toHaveBeenCalled();
    });

    //Deleting somebody here must not delete their login for whatever else the
    //pool serves, so the directory is never asked to remove anything.
    it('deletes the TweakTags user without touching the provider', async () => {
      const response = await withDirectory({
        action: ACTIONS.DELETE_USER,
        payload: { userId: '2' },
        authToken: 'super',
      });

      expect(response.status).toBe(200);
      expect(db.users.has('2')).toBe(false);
      expect(pool.has('taken@example.com')).toBe(true);
    });
  });
});
