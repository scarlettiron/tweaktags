//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

// @vitest-environment happy-dom

import { existsSync, readFileSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

//Vitest runs from the repository root, and the happy-dom environment does not
//give this file a file: url to resolve against.
const root = process.cwd();

const PAGE = `${root}/docs/demo/index.html`;
const MOCK_API = `${root}/examples/vanilla-demo/mock-api.js`;
const BUNDLE = `${root}/packages/vanillajs/dist/index.global.js`;

//The published demo is assembled from three files by the pages workflow. The
//bundle is build output, so a checkout that has not been built cannot run this.
const built = existsSync(BUNDLE);

const settle = async (): Promise<void> => {
  for (let index = 0; index < 4; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

//What the script tag build exposes.
interface TweakTagsGlobal {
  init: (options: unknown) => {
    engine: {
      login: (email: string, password: string) => Promise<void>;
      setEditing: (on: boolean) => void;
      saveEdits: () => Promise<void>;
      loadContent: (tags: string[]) => Promise<Array<{ body: string }>>;
      user: { email: string } | null;
      isEditing: boolean;
    };
    destroy: () => void;
  };
}

//Puts the demo page in the document and runs the two scripts it loads by path,
//in the same order the browser would.
const mountDemo = (): TweakTagsGlobal => {
  const page = readFileSync(PAGE, 'utf8');
  const body = page.slice(page.indexOf('<body>') + 6, page.indexOf('</body>'));

  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, '');

  const globalEval = eval;

  //The demo backend patches window.fetch, so the editor has something to talk to.
  globalEval(readFileSync(MOCK_API, 'utf8'));

  //The bundle opens with "use strict" and declares `var TweakTags`. A real
  //script tag makes that a global; a strict mode eval keeps it in its own scope,
  //so ask for the value back rather than reading it off globalThis. The newline
  //matters: the bundle's last line is a sourceMappingURL comment, and without it
  //the trailing expression is swallowed by that comment.
  return globalEval(`${readFileSync(BUNDLE, 'utf8')}\n;TweakTags`) as TweakTagsGlobal;
};

describe.skipIf(!built)('the live demo page', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('marks the same tags the demo backend seeds', () => {
    const page = readFileSync(PAGE, 'utf8');
    const seeded = readFileSync(MOCK_API, 'utf8');

    for (const tag of ['hero-title', 'hero-subtitle', 'hero-banner']) {
      //Both halves have to agree, or the demo shows empty boxes.
      expect(page, `page is missing data-tweaktags-${tag}`).toContain(`data-tweaktags-${tag}`);
      expect(seeded, `backend does not seed ${tag}`).toContain(`'${tag}'`);
    }
  });

  it('loads the saved content onto the page for an anonymous visitor', async () => {
    const instance = mountDemo().init({ apiBasePath: '/api/tweaktags', richText: true });

    await settle();

    const title = document.querySelector('[data-tweaktags-hero-title]');
    const banner = document.querySelector('[data-tweaktags-hero-banner]') as HTMLElement;

    //The markup says "Acme Lumber"; the store says something else, and the store wins.
    expect(title?.textContent?.trim()).toBe('Welcome to TweakTags');
    expect(banner.style.backgroundImage).toContain('picsum');
    //A visitor who is not signed in gets the sign in card, not the edit bar.
    expect(document.querySelector('.tt-login')).toBeTruthy();
    expect(document.querySelector('.tt-bar')).toBeFalsy();

    instance.destroy();
  });

  it('lets the demo account sign in and edit, and the edit round trips', async () => {
    const instance = mountDemo().init({ apiBasePath: '/api/tweaktags', richText: true });

    await settle();

    //The credentials printed on the demo page have to actually work.
    const page = readFileSync(PAGE, 'utf8');
    expect(page).toContain('admin@example.com');

    await instance.engine.login('admin@example.com', 'password');
    await settle();

    expect(instance.engine.user?.email).toBe('admin@example.com');
    expect(document.querySelector('.tt-bar')).toBeTruthy();

    instance.engine.setEditing(true);
    await settle();
    expect(instance.engine.isEditing).toBe(true);

    const title = document.querySelector('[data-tweaktags-hero-title]') as HTMLElement;
    title.innerText = 'Acme Hardwoods';
    title.dispatchEvent(new window.Event('input', { bubbles: true }));
    await settle();

    await instance.engine.saveEdits();
    await settle();

    const [record] = await instance.engine.loadContent(['hero-title']);
    expect(record.body).toBe('Acme Hardwoods');

    instance.destroy();
  });
});
