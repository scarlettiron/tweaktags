//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { init } from '@tweaktags/vanillajs';

import { installMatchMedia, makeFetch, type Seed } from './support/mock-backend';

const flush = async (): Promise<void> => {
  for (let index = 0; index < 6; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

//A saved plain tag, a saved rich tag, a saved media tag, and a tag whose only
//content is the text sitting on the page.
const seed: Seed = {
  users: [{ email: 'admin@example.com', password: 'password', role: 'superuser' }],
  content: {
    title: { body: 'The saved headline' },
    intro: { type: 'rich', body: '<p>Some <strong>rich</strong> copy</p>' },
    hero: { type: 'media', mediaUrl: 'https://example.com/hero.png' },
    tagline: { body: '' },
  },
};

const openPopup = async (): Promise<{ destroy: () => void }> => {
  installMatchMedia();
  document.body.innerHTML = `
    <h1 data-tweaktags-title>fallback headline</h1>
    <div data-tweaktags-intro>fallback intro</div>
    <img data-tweaktags-hero />
    <p data-tweaktags-tagline>the page default nobody saved</p>
  `;
  vi.stubGlobal('fetch', makeFetch(seed));

  const instance = init({ apiBasePath: '/api/tweaktags', editInView: false, richText: true });
  await flush();
  await instance.engine.login('admin@example.com', 'password');
  await flush();

  instance.engine.setEditing(true);
  await flush();

  return instance;
};

//Finds the popup row for one tag, by the tag name in its label.
const rowFor = (tag: string): Element => {
  const rows = [...document.querySelectorAll('.tt-modal-body .tt-row')];
  const row = rows.find((item) => item.querySelector('.tt-mono')?.textContent?.startsWith(tag));

  if (!row) {
    throw new Error(`No popup row for "${tag}"`);
  }

  return row;
};

describe('popup editor content', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('prefills each field with the saved content', async () => {
    const instance = await openPopup();

    expect(rowFor('title').querySelector('textarea')?.value).toBe('The saved headline');
    expect(rowFor('intro').querySelector('[contenteditable]')?.innerHTML).toBe(
      '<p>Some <strong>rich</strong> copy</p>',
    );
    expect(rowFor('hero').querySelector('input')?.value).toBe('https://example.com/hero.png');

    instance.destroy();
  });

  it('falls back to what the page shows when a tag has nothing saved', async () => {
    const instance = await openPopup();

    const row = rowFor('tagline');

    //Without the fallback this box is empty, and the popup covers the page, so
    //there is no way to see what the tag holds.
    expect(row.querySelector('textarea')?.value).toBe('the page default nobody saved');
    expect(row.textContent).toContain('Nothing saved yet');

    instance.destroy();
  });

  it('says so when an unsaved tag is not on the page at all', async () => {
    installMatchMedia();
    //The tag exists in the database, but no element on this page carries it.
    document.body.innerHTML = '<h1 data-tweaktags-title>fallback headline</h1>';
    vi.stubGlobal('fetch', makeFetch(seed));

    const instance = init({ apiBasePath: '/api/tweaktags', editInView: false });
    await flush();
    await instance.engine.login('admin@example.com', 'password');
    await flush();
    instance.engine.setEditing(true);
    await flush();

    const row = rowFor('tagline');
    expect(row.querySelector('textarea')?.value).toBe('');
    expect(row.textContent).toContain('not on the current page');

    instance.destroy();
  });

  it('does not write a page fallback to the database when the editor saves', async () => {
    installMatchMedia();
    document.body.innerHTML = `
      <h1 data-tweaktags-title>fallback headline</h1>
      <p data-tweaktags-tagline>the page default nobody saved</p>
    `;

    //Watch every request, so we can tell exactly what a save sends.
    const backend = makeFetch(seed);
    const sent: Array<{ action: string; payload?: Record<string, unknown> }> = [];
    vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
      sent.push(JSON.parse(init.body));

      return backend(url, init);
    });

    const instance = init({ apiBasePath: '/api/tweaktags', editInView: false });
    await flush();
    await instance.engine.login('admin@example.com', 'password');
    await flush();
    instance.engine.setEditing(true);
    await flush();

    //The fallback is showing, and it is the field's starting value.
    expect(rowFor('tagline').querySelector('textarea')?.value).toBe('the page default nobody saved');

    //Save everything without touching a field, confirming the popup.
    const saveButton = [...document.querySelectorAll('.tt-modal-top button')].find(
      (button) => button.textContent === 'Save',
    ) as HTMLButtonElement;
    saveButton.click();
    await flush();

    const confirmButton = [...document.querySelectorAll('.tt-confirm-actions button')].find(
      (button) => button.textContent === 'Save',
    ) as HTMLButtonElement;
    confirmButton.click();
    await flush();

    //Nothing was edited, so nothing may be written. Without this the page's own
    //text would be silently copied into the database for every unsaved tag.
    expect(sent.filter((request) => request.action === 'updateContent')).toEqual([]);

    //Now edit the fallback and save again. This half proves the save path really
    //does fire, so the empty result above means "skipped", not "never ran".
    const textarea = rowFor('tagline').querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'an edit the editor actually made';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    saveButton.click();
    await flush();
    (
      [...document.querySelectorAll('.tt-confirm-actions button')].find(
        (button) => button.textContent === 'Save',
      ) as HTMLButtonElement
    ).click();
    await flush();

    const writes = sent.filter((request) => request.action === 'updateContent');
    expect(writes).toHaveLength(1);
    expect(writes[0]?.payload).toMatchObject({
      tag: 'tagline',
      body: 'an edit the editor actually made',
    });

    instance.destroy();
  });
});
