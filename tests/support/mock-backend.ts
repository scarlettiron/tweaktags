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
        const user = seed.users.find((candidate) => candidate.email === p.email && candidate.password === p.password);

        if (!user) {
          return res(401, { message: 'Wrong email or password.' });
        }

        session = { id: '1', email: user.email, role: user.role };

        return res(200, { accessToken: 'a', refreshToken: 'r', user: session });
      }

      case 'me':
        return session ? res(200, { user: session }) : res(401, { message: 'Not signed in' });

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
