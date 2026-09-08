//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { vi } from 'vitest';

//A user the mock backend will accept for login.
export interface SeedUser {
  email: string;
  password: string;
  role: 'superuser' | 'editor';
}

//A content record to seed, with only the parts a test cares about.
export interface SeedContent {
  type?: 'plain' | 'rich' | 'media';
  body?: string;
  mediaUrl?: string | null;
}

//The starting state for the mock backend.
export interface Seed {
  users: SeedUser[];
  content: Record<string, SeedContent>;
}

interface StoredUser {
  id: string;
  email: string;
  password: string;
  role: string;
}

interface StoredRecord {
  tag: string;
  type: string;
  body: string;
  mediaUrl: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

//Builds an in memory backend as a fetch mock, matching the TweakTags handler.
//Give it to a test with vi.stubGlobal('fetch', makeFetch(seed)).
export const makeFetch = (seed: Seed) => {
  let session: { id: string; email: string; role: string } | null = null;

  //The seeded users get ids in the order they were given, which is also the
  //order the panels list them in. Passwords stay in the clear here because
  //nothing hashes: the mock only ever compares them.
  const users = new Map<string, StoredUser>(
    seed.users.map((user, index) => [
      String(index + 1),
      { id: String(index + 1), email: user.email, password: user.password, role: user.role },
    ]),
  );

  let nextUserId = seed.users.length + 1;

  const publicUser = ({ id, email, role }: StoredUser) => ({ id, email, role });

  const byEmail = (email: string): StoredUser | undefined =>
    [...users.values()].find((user) => user.email === email);

  //Every user management action is superuser only, and the mock reads the role
  //from the stored row rather than the session, the same way the handler does.
  const currentUser = (): StoredUser | null => (session ? (users.get(session.id) ?? null) : null);

  const content = new Map<string, StoredRecord>(
    Object.entries(seed.content).map(([tag, record]) => [
      tag,
      {
        tag,
        type: record.type ?? 'plain',
        body: record.body ?? '',
        mediaUrl: record.mediaUrl ?? null,
        updatedAt: null,
        updatedBy: null,
      },
    ]),
  );

  const res = (status: number, data: unknown) => ({
    ok: status < 400,
    status,
    json: async () => data,
  });

  return vi.fn(async (_url: string, init: { body: string }) => {
    const { action, payload } = JSON.parse(init.body) as { action: string; payload?: Record<string, unknown> };
    const p = (payload ?? {}) as Record<string, string> & { tags?: string[] };

    switch (action) {
      case 'login': {
        const user = byEmail(p.email);

        if (!user || user.password !== p.password) {
          return res(401, { message: 'Wrong email or password.' });
        }

        session = publicUser(user);

        return res(200, { accessToken: 'a', refreshToken: 'r', user: session });
      }

      case 'me': {
        const user = currentUser();

        return user ? res(200, { user: publicUser(user) }) : res(401, { message: 'Not signed in' });
      }

      case 'logout':
        session = null;

        return res(200, { ok: true });

      case 'refresh':
        return session
          ? res(200, { accessToken: 'a', refreshToken: 'r', user: session })
          : res(401, { message: 'Session expired' });

      case 'getContent':
        return res(200, {
          content: (p.tags ?? []).map((tag) => content.get(tag)).filter(Boolean),
        });

      case 'listTags':
        return res(200, { tags: [...content.keys()].sort() });

      case 'createTag': {
        if (content.has(p.tag)) {
          return res(409, { message: 'The tag already exists' });
        }

        const record: StoredRecord = {
          tag: p.tag,
          type: p.type ?? 'plain',
          body: '',
          mediaUrl: null,
          updatedAt: null,
          updatedBy: '1',
        };
        content.set(p.tag, record);

        return res(201, { content: record });
      }

      case 'updateContent': {
        const existing = content.get(p.tag);
        const record: StoredRecord = {
          tag: p.tag,
          type: existing?.type ?? 'plain',
          body: p.body,
          mediaUrl: (p.mediaUrl as string | null | undefined) ?? null,
          updatedAt: 'now',
          updatedBy: '1',
        };
        content.set(p.tag, record);

        return res(200, { content: record });
      }

      case 'updateTagType': {
        const existing = content.get(p.tag);

        if (!existing) {
          return res(404, { message: 'The tag does not exist' });
        }

        const record = { ...existing, type: p.type };
        content.set(p.tag, record);

        return res(200, { content: record });
      }

      case 'deleteTag':
        content.delete(p.tag);

        return res(200, { ok: true, tag: p.tag });

      case 'listUsers': {
        const me = currentUser();

        if (!me) {
          return res(401, { message: 'You must be signed in to do this' });
        }

        if (me.role !== 'superuser') {
          return res(403, { message: 'Only a superuser can manage users' });
        }

        return res(200, {
          users: [...users.values()]
            .map(publicUser)
            .sort((a, b) => a.email.localeCompare(b.email)),
        });
      }

      case 'createUser': {
        const me = currentUser();

        if (!me) {
          return res(401, { message: 'You must be signed in to do this' });
        }

        if (me.role !== 'superuser') {
          return res(403, { message: 'Only a superuser can manage users' });
        }

        if (byEmail(p.email)) {
          return res(409, { message: `A user with the email "${p.email}" already exists` });
        }

        const user: StoredUser = {
          id: String(nextUserId++),
          email: p.email,
          password: p.password,
          role: p.role,
        };
        users.set(user.id, user);

        return res(201, { user: publicUser(user) });
      }

      case 'updateUserRole': {
        const me = currentUser();

        if (!me) {
          return res(401, { message: 'You must be signed in to do this' });
        }

        if (me.role !== 'superuser') {
          return res(403, { message: 'Only a superuser can manage users' });
        }

        if (p.userId === me.id) {
          return res(403, { message: 'You cannot change your own role' });
        }

        const target = users.get(p.userId);

        if (!target) {
          return res(404, { message: 'That user could not be found' });
        }

        const updated = { ...target, role: p.role };
        users.set(target.id, updated);

        return res(200, { user: publicUser(updated) });
      }

      case 'updateUserPassword': {
        const me = currentUser();

        if (!me) {
          return res(401, { message: 'You must be signed in to do this' });
        }

        if (me.role !== 'superuser') {
          return res(403, { message: 'Only a superuser can manage users' });
        }

        const target = users.get(p.userId);

        if (!target) {
          return res(404, { message: 'That user could not be found' });
        }

        users.set(target.id, { ...target, password: p.password });

        return res(200, { ok: true });
      }

      case 'deleteUser': {
        const me = currentUser();

        if (!me) {
          return res(401, { message: 'You must be signed in to do this' });
        }

        if (me.role !== 'superuser') {
          return res(403, { message: 'Only a superuser can manage users' });
        }

        if (p.userId === me.id) {
          return res(403, { message: 'You cannot delete your own account' });
        }

        const target = users.get(p.userId);

        if (!target) {
          return res(404, { message: 'That user could not be found' });
        }

        if (target.role === 'superuser') {
          return res(403, {
            message: 'A superuser cannot be deleted. Change their role to editor first.',
          });
        }

        users.delete(target.id);

        return res(200, { ok: true, userId: target.id });
      }

      case 'updateMyEmail': {
        const me = currentUser();

        if (!me) {
          return res(401, { message: 'You must be signed in to do this' });
        }

        //403 rather than 401, matching the handler, so the api client does not
        //treat a wrong password as an expired session and replay the request.
        if (me.password !== p.currentPassword) {
          return res(403, { message: 'Your current password is not correct' });
        }

        const taken = byEmail(p.email);

        if (taken && taken.id !== me.id) {
          return res(409, { message: `A user with the email "${p.email}" already exists` });
        }

        const updated = { ...me, email: p.email };
        users.set(me.id, updated);
        session = publicUser(updated);

        return res(200, { user: session });
      }

      case 'updateMyPassword': {
        const me = currentUser();

        if (!me) {
          return res(401, { message: 'You must be signed in to do this' });
        }

        if (me.password !== p.currentPassword) {
          return res(403, { message: 'Your current password is not correct' });
        }

        users.set(me.id, { ...me, password: p.password });

        return res(200, { ok: true });
      }

      default:
        return res(400, { message: `Unknown action ${action}` });
    }
  });
};

//happy-dom does not always provide matchMedia, which the edit bar needs, so give
//it a simple stub that reports a wide screen.
export const installMatchMedia = (): void => {
  if (typeof window !== 'undefined' && !window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
};
