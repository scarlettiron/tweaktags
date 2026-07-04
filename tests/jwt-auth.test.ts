//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { afterEach, describe, expect, it, vi } from 'vitest';

import { JwtAuthAdapter } from '@tweaktags/auth-jwt';
import { conflict } from '@tweaktags/core';
import type {
  CreateUserInput,
  RefreshTokenRecord,
  RefreshTokenStore,
  StoredUser,
  UserStore,
} from '@tweaktags/core';

//A simple in memory store for the auth tests, holding users and refresh tokens.
class MemoryStore implements UserStore, RefreshTokenStore {
  private users: StoredUser[] = [];

  private refreshTokens = new Map<string, RefreshTokenRecord>();

  private nextId = 1;

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    return this.users.find((user) => user.email === email) ?? null;
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async createUser(input: CreateUserInput): Promise<StoredUser> {
    //Mirror the real adapters, which reject a duplicate email with a conflict.
    if (this.users.some((user) => user.email === input.email)) {
      throw conflict(`A user with the email "${input.email}" already exists`);
    }

    const user: StoredUser = {
      id: String(this.nextId),
      email: input.email,
      role: input.role,
      passwordHash: input.passwordHash,
    };

    this.nextId += 1;
    this.users.push(user);

    return user;
  }

  async updateUserPassword(): Promise<boolean> {
    return true;
  }

  async saveRefreshToken(record: RefreshTokenRecord): Promise<void> {
    this.refreshTokens.set(record.id, { ...record });
  }

  async findRefreshToken(id: string): Promise<RefreshTokenRecord | null> {
    return this.refreshTokens.get(id) ?? null;
  }

  async revokeRefreshToken(id: string): Promise<void> {
    const record = this.refreshTokens.get(id);

    if (record) {
      record.revoked = true;
    }
  }

  async revokeRefreshFamily(familyId: string): Promise<void> {
    for (const record of this.refreshTokens.values()) {
      if (record.familyId === familyId) {
        record.revoked = true;
      }
    }
  }

  async isRefreshFamilyActive(familyId: string): Promise<boolean> {
    for (const record of this.refreshTokens.values()) {
      if (record.familyId === familyId && !record.revoked) {
        return true;
      }
    }

    return false;
  }
}

const buildAdapter = (): { store: MemoryStore; adapter: JwtAuthAdapter } => {
  const store = new MemoryStore();
  const adapter = new JwtAuthAdapter(store, {
    secret: 'a-secret-that-is-long-enough',
    accessTtlSeconds: 900,
    refreshTtlSeconds: 604800,
    strictRevocation: true,
  });

  return { store, adapter };
};

describe('jwt auth adapter', () => {
  it('creates a user, signs them in, and verifies the token', async () => {
    const { adapter } = buildAdapter();

    await adapter.createUser('admin@example.com', 'supersecret', 'superuser');

    const result = await adapter.login('admin@example.com', 'supersecret');

    expect(result.user.email).toBe('admin@example.com');
    expect(result.user.role).toBe('superuser');

    const actor = await adapter.verify(result.accessToken);

    expect(actor).not.toBeNull();
    expect(actor?.role).toBe('superuser');
  });

  it('refreshes with a valid refresh token and rejects an access token there', async () => {
    const { adapter } = buildAdapter();

    await adapter.createUser('admin@example.com', 'supersecret', 'superuser');
    const result = await adapter.login('admin@example.com', 'supersecret');

    //A refresh token gives a new pair of tokens.
    const refreshed = await adapter.refresh(result.refreshToken);
    expect(refreshed).not.toBeNull();
    expect(refreshed?.user.email).toBe('admin@example.com');

    //An access token must not work as a refresh token.
    expect(await adapter.refresh(result.accessToken)).toBeNull();

    //A refresh token must not work as an access token.
    expect(await adapter.verify(result.refreshToken)).toBeNull();
  });

  it('rotates the refresh token and revokes the family when an old one is reused', async () => {
    const { adapter } = buildAdapter();

    await adapter.createUser('admin@example.com', 'supersecret', 'superuser');
    const login = await adapter.login('admin@example.com', 'supersecret');

    //Use the refresh token once to rotate it.
    const rotated = await adapter.refresh(login.refreshToken);
    expect(rotated).not.toBeNull();

    //Reusing the original, now rotated, refresh token is treated as theft.
    expect(await adapter.refresh(login.refreshToken)).toBeNull();

    //The reuse revoked the whole family, so the newer token no longer works either.
    expect(await adapter.refresh(rotated?.refreshToken ?? '')).toBeNull();
  });

  it('rejects an access token after logout when strict revocation is on', async () => {
    const { adapter } = buildAdapter();

    await adapter.createUser('admin@example.com', 'supersecret', 'superuser');
    const login = await adapter.login('admin@example.com', 'supersecret');

    //The access token works while the session is active.
    expect(await adapter.verify(login.accessToken)).not.toBeNull();

    //After logging out, the same access token is rejected right away.
    await adapter.logout(login.refreshToken);
    expect(await adapter.verify(login.accessToken)).toBeNull();
  });

  it('rejects a wrong password', async () => {
    const { adapter } = buildAdapter();

    await adapter.createUser('admin@example.com', 'supersecret', 'superuser');

    await expect(adapter.login('admin@example.com', 'wrong')).rejects.toThrow();
  });

  it('returns null for a token that is not valid', async () => {
    const { adapter } = buildAdapter();

    const actor = await adapter.verify('not-a-real-token');

    expect(actor).toBeNull();
  });

  it('hashes the password instead of storing it in plain text', async () => {
    const { store, adapter } = buildAdapter();

    await adapter.createUser('admin@example.com', 'supersecret', 'superuser');

    const stored = await store.findUserByEmail('admin@example.com');

    expect(stored).not.toBeNull();
    expect(stored?.passwordHash).not.toBe('supersecret');
    //bcrypt hashes start with a $2 version marker.
    expect(stored?.passwordHash.startsWith('$2')).toBe(true);
  });

  it('rejects creating a second user with the same email', async () => {
    const { adapter } = buildAdapter();

    await adapter.createUser('admin@example.com', 'supersecret', 'superuser');

    await expect(
      adapter.createUser('admin@example.com', 'another', 'editor'),
    ).rejects.toThrow();
  });

  describe('token expiry', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('rejects an access token once it has expired', async () => {
      const { adapter } = buildAdapter();

      await adapter.createUser('admin@example.com', 'supersecret', 'superuser');
      const login = await adapter.login('admin@example.com', 'supersecret');

      //It works right now.
      expect(await adapter.verify(login.accessToken)).not.toBeNull();

      //Jump past the 900 second access token lifetime.
      const later = Date.now() + 901 * 1000;
      vi.spyOn(Date, 'now').mockReturnValue(later);

      expect(await adapter.verify(login.accessToken)).toBeNull();
    });

    it('rejects a refresh token once it has expired', async () => {
      const { adapter } = buildAdapter();

      await adapter.createUser('admin@example.com', 'supersecret', 'superuser');
      const login = await adapter.login('admin@example.com', 'supersecret');

      //Jump past the 604800 second refresh token lifetime, so the user is
      //signed out and has to log in again.
      const later = Date.now() + (604800 + 10) * 1000;
      vi.spyOn(Date, 'now').mockReturnValue(later);

      expect(await adapter.refresh(login.refreshToken)).toBeNull();
    });
  });
});
