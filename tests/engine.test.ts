//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { TweakTagsEngine } from '@tweaktags/browser';

import { makeFetch, type Seed } from './support/mock-backend';

//Let the batched tag requests and their responses settle.
const flush = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

//A superuser the auth tests can sign in as.
const superuser: Seed['users'] = [{ email: 'admin@example.com', password: 'password', role: 'superuser' }];

describe('browser engine', () => {
  let engine: TweakTagsEngine | null = null;

  afterEach(() => {
    engine?.stop();
    engine = null;
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  const start = (html: string, seed: Seed): TweakTagsEngine => {
    document.body.innerHTML = html;
    vi.stubGlobal('fetch', makeFetch(seed));
    engine = new TweakTagsEngine({ apiBasePath: '/api/tweaktags' });
    engine.start();

    return engine;
  };

  describe('showing content', () => {
    it('shows saved plain text to everyone on load', async () => {
      start('<h1 data-tweaktags-title>fallback</h1>', { users: [], content: { title: { body: 'Hello world' } } });
      await flush();

      expect(document.querySelector('h1')?.textContent).toBe('Hello world');
    });

    it('renders rich html', async () => {
      start('<div data-tweaktags-body></div>', { users: [], content: { body: { type: 'rich', body: '<b>bold</b>' } } });
      await flush();

      expect(document.querySelector('div')?.innerHTML).toBe('<b>bold</b>');
    });

    it('sets the src for a media tag on an img', async () => {
      start('<img data-tweaktags-photo />', { users: [], content: { photo: { type: 'media', mediaUrl: 'https://x.test/p.png' } } });
      await flush();

      expect(document.querySelector('img')?.getAttribute('src')).toBe('https://x.test/p.png');
    });

    it('sets a background image for a media tag on a div', async () => {
      start('<div data-tweaktags-banner></div>', {
        users: [],
        content: { banner: { type: 'media', mediaUrl: 'https://x.test/a.png' } },
      });
      await flush();

      const div = document.querySelector('div') as HTMLElement;
      expect(div.style.backgroundImage).toContain('https://x.test/a.png');
    });

    it('picks up elements added to the page later', async () => {
      const engineInstance = start('<div id="root"></div>', { users: [], content: { late: { body: 'Later content' } } });
      await flush();

      const added = document.createElement('p');
      added.setAttribute('data-tweaktags-late', '');
      document.getElementById('root')?.appendChild(added);
      //The observer runs on a microtask, and the content is already cached.
      await flush();

      expect(added.textContent).toBe('Later content');
      expect(engineInstance.getContent('late')?.body).toBe('Later content');
    });
  });

  describe('sessions', () => {
    it('signs a user in and out', async () => {
      const engineInstance = start('<div></div>', { users: superuser, content: {} });
      await flush();
      expect(engineInstance.user).toBeNull();

      await engineInstance.login('admin@example.com', 'password');
      expect(engineInstance.user?.email).toBe('admin@example.com');
      expect(engineInstance.canEdit).toBe(true);

      await engineInstance.logout();
      expect(engineInstance.user).toBeNull();
      expect(engineInstance.canEdit).toBe(false);
    });

    it('rejects a wrong password', async () => {
      const engineInstance = start('<div></div>', { users: superuser, content: {} });
      await flush();

      await expect(engineInstance.login('admin@example.com', 'nope')).rejects.toThrow();
    });
  });

  describe('editing', () => {
    it('makes elements editable only while editing', async () => {
      const engineInstance = start('<p data-tweaktags-title>hi</p>', { users: superuser, content: { title: { body: 'Hi' } } });
      await flush();
      await engineInstance.login('admin@example.com', 'password');

      const paragraph = document.querySelector('p') as HTMLElement;
      expect(paragraph.getAttribute('contenteditable')).toBeNull();

      engineInstance.setEditing(true);
      expect(paragraph.getAttribute('contenteditable')).toBe('true');

      engineInstance.setEditing(false);
      expect(paragraph.getAttribute('contenteditable')).toBeNull();
    });

    it('never makes a media element editable', async () => {
      const engineInstance = start('<div data-tweaktags-banner></div>', {
        users: superuser,
        content: { banner: { type: 'media', mediaUrl: 'https://x.test/a.png' } },
      });
      await flush();
      await engineInstance.login('admin@example.com', 'password');
      engineInstance.setEditing(true);

      expect(document.querySelector('div')?.getAttribute('contenteditable')).toBeNull();
    });

    it('saves edits and clears the unsaved flag', async () => {
      const fetchMock = makeFetch({ users: superuser, content: { body: { type: 'rich', body: '<i>old</i>' } } });
      document.body.innerHTML = '<div data-tweaktags-body></div>';
      vi.stubGlobal('fetch', fetchMock);
      engine = new TweakTagsEngine({ apiBasePath: '/api/tweaktags' });
      engine.start();
      await flush();
      await engine.login('admin@example.com', 'password');

      engine.setEditing(true);
      const div = document.querySelector('div') as HTMLElement;
      div.innerHTML = '<i>new</i>';
      div.dispatchEvent(new Event('input'));
      expect(engine.hasUnsavedChanges).toBe(true);

      await engine.saveEdits();
      expect(engine.hasUnsavedChanges).toBe(false);
      expect(engine.getContent('body')?.body).toBe('<i>new</i>');

      const actions = fetchMock.mock.calls.map((call) => JSON.parse((call[1] as { body: string }).body).action);
      expect(actions).toContain('updateContent');
    });
  });

  describe('tags', () => {
    it('creates, retypes, and deletes tags through the api', async () => {
      const engineInstance = start('<div></div>', { users: superuser, content: {} });
      await flush();
      await engineInstance.login('admin@example.com', 'password');

      await engineInstance.createTag('hero-title', 'Hi there', 'plain');
      expect(await engineInstance.listTags()).toContain('hero-title');

      await engineInstance.setTagType('hero-title', 'rich');
      expect(engineInstance.getContent('hero-title')?.type).toBe('rich');

      await engineInstance.deleteTag('hero-title');
      expect(engineInstance.getContent('hero-title')).toBeNull();
    });
  });

  describe('events', () => {
    it('emits toasts and ticks the version on change', async () => {
      const engineInstance = start('<div></div>', { users: superuser, content: {} });
      await flush();

      const toasts = vi.fn();
      engineInstance.onToast(toasts);
      engineInstance.notify('hello', 'success');
      expect(toasts).toHaveBeenCalledWith(expect.objectContaining({ message: 'hello', type: 'success' }));

      const before = engineInstance.version;
      await engineInstance.login('admin@example.com', 'password');
      expect(engineInstance.version).toBeGreaterThan(before);
    });
  });
});
