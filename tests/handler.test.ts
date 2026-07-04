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

  async findUserByEmail(): Promise<StoredUser | null> {
    return null;
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    return { id, email: 'user@example.com', role: 'superuser', passwordHash: 'x' };
  }

  async createUser(input: CreateUserInput): Promise<StoredUser> {
    return { id: '1', email: input.email, role: input.role, passwordHash: input.passwordHash };
  }

  async updateUserPassword(): Promise<boolean> {
    return true;
  }

  async listUsers(): Promise<AuthUser[]> {
    return [];
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
      return { userId: '1', role: 'superuser' };
    }

    if (token === 'editor') {
      return { userId: '2', role: 'editor' };
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
});
