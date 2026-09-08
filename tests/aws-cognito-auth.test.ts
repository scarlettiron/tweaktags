//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AwsCognitoAuthAdapter } from '@tweaktags/auth-aws-cognito';
import type { CreateUserInput, StoredUser, UserStore } from '@tweaktags/core';

//Nothing here talks to AWS. The adapter takes a client and a verifier, so the
//tests hand it fakes rather than mocking the SDK module, which does not reach a
//package once it is built. What this proves is the decision making: who gets
//refused, whose password is left alone, and which commands are sent. The calls
//themselves need a real pool, and the manual checklist in the docs covers those.

//A tiny user table. Only the lookups matter here.
class FakeStore implements UserStore {
  public users: StoredUser[] = [];

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    return this.users.find((user) => user.email === email) ?? null;
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async findUserByExternalId(externalId: string): Promise<StoredUser | null> {
    return this.users.find((user) => user.externalId === externalId) ?? null;
  }

  async createUser(input: CreateUserInput): Promise<StoredUser> {
    const user: StoredUser = {
      id: String(this.users.length + 1),
      email: input.email,
      role: input.role,
      passwordHash: input.passwordHash,
      externalId: input.externalId ?? null,
    };

    this.users.push(user);

    return user;
  }

  async updateUserPassword(): Promise<boolean> {
    return true;
  }
}

const CONFIG = {
  region: 'us-east-1',
  userPoolId: 'us-east-1_TestPool',
  clientId: 'test-client-id',
};

//An account as AdminGetUser returns one.
const account = (sub: string, email: string, username = email) => ({
  Username: username,
  UserAttributes: [
    { Name: 'sub', Value: sub },
    { Name: 'email', Value: email },
  ],
});

//An error shaped the way the SDK raises one.
const awsError = (name: string): Error => Object.assign(new Error(name), { name });

const signedIn = { AuthenticationResult: { AccessToken: 'access', RefreshToken: 'refresh' } };

//Builds an adapter over fakes. The send function decides what each command
//answers, keyed by the command class name.
const build = (
  send: (name: string, input: Record<string, unknown>) => unknown,
  verify: () => Record<string, unknown> = () => ({ sub: 'sub-7' }),
) => {
  const store = new FakeStore();
  const sent: Array<{ name: string; input: Record<string, unknown> }> = [];

  const client = {
    send: vi.fn(async (command: unknown) => {
      const shaped = command as { constructor: { name: string }; input: Record<string, unknown> };

      sent.push({ name: shaped.constructor.name, input: shaped.input });

      return (send(shaped.constructor.name, shaped.input) ?? {}) as Record<string, unknown>;
    }),
  };

  const verifier = { verify: vi.fn(async () => verify()) };
  const adapter = new AwsCognitoAuthAdapter(store, CONFIG, { client, verifier });

  return {
    store,
    adapter,
    sent,
    names: () => sent.map((entry) => entry.name),
    inputOf: (name: string) => sent.find((entry) => entry.name === name)?.input,
  };
};

const linkedUser = (store: FakeStore, role: 'superuser' | 'editor' = 'editor'): void => {
  store.users.push({
    id: '7',
    email: 'editor@example.com',
    role,
    passwordHash: '',
    externalId: 'sub-7',
  });
};

describe('aws-cognito auth adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signing in', () => {
    //The rule that makes a shared pool safe: being in the pool is not the same
    //as having access to the editor.
    it('refuses somebody who is in the pool but not linked to a TweakTags user', async () => {
      const { adapter } = build(() => signedIn, () => ({ sub: 'sub-nobody' }));

      await expect(adapter.login('stranger@example.com', 'password1')).rejects.toThrow(
        //The same message a wrong password gives, so nobody can use the login
        //form to find out who has editor access.
        /email or password is incorrect/,
      );
    });

    it('signs in a linked user and takes the role from our own table', async () => {
      const { store, adapter } = build(() => signedIn);

      linkedUser(store, 'superuser');

      const result = await adapter.login('editor@example.com', 'password1');

      expect(result.user).toEqual({ id: '7', email: 'editor@example.com', role: 'superuser' });
      expect(result.accessToken).toBe('access');
      //The sub travels with the refresh token, because refreshing needs the
      //username again and Cognito's refresh tokens are opaque.
      expect(result.refreshToken).toBe('sub-7|refresh');
    });

    it('refuses a wrong password', async () => {
      const { adapter } = build(() => {
        throw awsError('NotAuthorizedException');
      });

      await expect(adapter.login('editor@example.com', 'wrong')).rejects.toThrow(
        /email or password is incorrect/,
      );
    });

    //A pool that wants an MFA code or a new password answers with a challenge.
    //None of the four login forms has a screen for one, so say so rather than
    //reporting it as a wrong password and sending somebody hunting.
    it('explains a challenge instead of calling it a wrong password', async () => {
      const { adapter } = build(() => ({ ChallengeName: 'NEW_PASSWORD_REQUIRED' }));

      await expect(adapter.login('editor@example.com', 'password1')).rejects.toThrow(
        /NEW_PASSWORD_REQUIRED/,
      );
    });
  });

  describe('verifying a token', () => {
    it('returns null when the token does not verify', async () => {
      const { adapter } = build(
        () => ({}),
        () => {
          //Stands in for every reason the verifier rejects one: a wrong issuer,
          //an id token where an access token belongs, another pool's client id,
          //or an expired token. All of them arrive here as a throw.
          throw new Error('JwtInvalidClaimError');
        },
      );

      expect(await adapter.verify('nonsense')).toBeNull();
    });

    it('returns null for a valid token with no user behind it', async () => {
      const { adapter } = build(() => ({}), () => ({ sub: 'sub-deleted' }));

      expect(await adapter.verify('access')).toBeNull();
    });

    //The role is ours, so a demotion bites at once rather than when the token
    //expires, and a group in the pool cannot promote anybody here.
    it('reads the role from the database and ignores any group in the token', async () => {
      const { store, adapter } = build(
        () => ({}),
        () => ({ sub: 'sub-7', 'cognito:groups': ['superuser'] }),
      );

      linkedUser(store, 'editor');

      expect(await adapter.verify('access')).toEqual({ userId: '7', role: 'editor' });
    });
  });

  describe('adding somebody', () => {
    it('links an account that already exists and leaves its password alone', async () => {
      const { adapter, names } = build((name) => {
        if (name === 'AdminCreateUserCommand') {
          throw awsError('UsernameExistsException');
        }

        return account('sub-existing', 'existing@example.com', 'existing-username');
      });

      const result = await adapter.directory.createOrLink('existing@example.com', 'password1');

      expect(result).toEqual({
        externalId: 'sub-existing',
        email: 'existing@example.com',
        alreadyExisted: true,
      });

      //The whole point of linking rather than failing. On a pool shared with
      //another application that password is somebody's live login there, and
      //resetting it would lock them out of it.
      expect(names()).not.toContain('AdminSetUserPasswordCommand');
    });

    it('creates a new account with a permanent password and no invitation email', async () => {
      const { adapter, inputOf } = build(() => account('sub-new', 'new@example.com'));

      const result = await adapter.directory.createOrLink('new@example.com', 'password1');

      expect(result.alreadyExisted).toBe(false);
      expect(result.externalId).toBe('sub-new');

      //Suppressed, because TweakTags already showed the password to whoever
      //typed it and Cognito must not email a different one.
      expect(inputOf('AdminCreateUserCommand')?.MessageAction).toBe('SUPPRESS');

      //Permanent, so the account skips FORCE_CHANGE_PASSWORD and the first sign
      //in does not come back as a challenge nothing can answer.
      expect(inputOf('AdminSetUserPasswordCommand')?.Permanent).toBe(true);
    });

    //A pool can be set up to let people change their username, and with aliases
    //the username is not always the email. The sub never changes.
    it('links by the sub rather than the username', async () => {
      const { adapter } = build(() =>
        account('sub-stable', 'someone@example.com', 'not-the-sub'),
      );

      expect((await adapter.directory.findByExternalId('sub-stable'))?.externalId).toBe(
        'sub-stable',
      );
    });

    it('gives back null for an account the pool does not have', async () => {
      const { adapter } = build(() => {
        throw awsError('UserNotFoundException');
      });

      expect(await adapter.directory.findByExternalId('sub-nobody')).toBeNull();
    });
  });

  describe('ending sessions', () => {
    //The handler calls endSessions after a role change, a password reset and a
    //delete. Only the password reset needs it, and that one signs out from
    //setPassword instead. Doing it here would be a pool wide sign out, so
    //demoting an editor would also log them out of every other application the
    //pool backs.
    it('does not sign anybody out of the pool', async () => {
      const { store, adapter, sent } = build(() => ({}));

      linkedUser(store);

      await adapter.endSessions('7');

      expect(sent).toEqual([]);
    });

    //A demotion still bites at once, because the role is read from the TweakTags
    //table on every request rather than carried in the token.
    it('is not what makes a role change take effect', async () => {
      const { store, adapter } = build(() => ({}), () => ({ sub: 'sub-7' }));

      linkedUser(store, 'superuser');

      expect(await adapter.verify('access')).toEqual({ userId: '7', role: 'superuser' });

      const demoted = store.users[0];

      if (demoted) {
        demoted.role = 'editor';
      }

      expect(await adapter.verify('access')).toEqual({ userId: '7', role: 'editor' });
    });
  });

  describe('resetting a password', () => {
    //A reset that left the old sessions running would not be a reset, and here
    //the password changed for every application the pool backs, so reaching all
    //of them is right.
    it('signs the user out everywhere, by their sub', async () => {
      const { adapter, names, inputOf } = build(() => ({}));

      await adapter.directory.setPassword('sub-7', 'brand-new-one');

      expect(names()).toEqual(['AdminSetUserPasswordCommand', 'AdminUserGlobalSignOutCommand']);
      expect(inputOf('AdminSetUserPasswordCommand')?.Permanent).toBe(true);
      expect(inputOf('AdminUserGlobalSignOutCommand')?.Username).toBe('sub-7');
    });
  });

  //A caller that reaches for this has a bug. Returning something would write to
  //a column nobody reads and look like it had worked.
  it('refuses to hash a password', async () => {
    const { adapter } = build(() => ({}));

    await expect(adapter.hashPassword()).rejects.toThrow(/managed in Cognito/);
  });
});
