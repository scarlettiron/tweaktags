//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { init, mountAdmin } from '@tweaktags/vanillajs';

import { installMatchMedia, makeFetch, type Seed } from './support/mock-backend';

const flush = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const seed: Seed = {
  users: [{ email: 'admin@example.com', password: 'password', role: 'superuser' }],
  content: { title: { body: 'Hi' } },
};

describe('vanilla init', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('mounts a login card, then the edit bar after signing in', async () => {
    installMatchMedia();
    document.body.innerHTML = '<h1 data-tweaktags-title>hi</h1>';
    vi.stubGlobal('fetch', makeFetch(seed));

    const instance = init({ apiBasePath: '/api/tweaktags' });
    await flush();

    //Signed out shows the login card and no toolbar.
    expect(document.querySelector('.tt-login')).toBeTruthy();
    expect(document.querySelector('.tt-bar')).toBeFalsy();

    await instance.engine.login('admin@example.com', 'password');
    await flush();

    //Signed in swaps to the toolbar and drops the login card.
    expect(document.querySelector('.tt-bar')).toBeTruthy();
    expect(document.querySelector('.tt-login')).toBeFalsy();

    instance.destroy();
    expect(document.querySelector('.tt-bar')).toBeFalsy();
  });

  it('shows the popup editor when editInView is off and editing turns on', async () => {
    installMatchMedia();
    document.body.innerHTML = '<h1 data-tweaktags-title>hi</h1>';
    vi.stubGlobal('fetch', makeFetch(seed));

    const instance = init({ apiBasePath: '/api/tweaktags', editInView: false });
    await flush();
    await instance.engine.login('admin@example.com', 'password');
    await flush();

    expect(document.querySelector('.tt-modal-overlay')).toBeFalsy();

    instance.engine.setEditing(true);
    await flush();
    expect(document.querySelector('.tt-modal-overlay')).toBeTruthy();

    instance.engine.setEditing(false);
    expect(document.querySelector('.tt-modal-overlay')).toBeFalsy();

    instance.destroy();
  });
});

describe('vanilla mountAdmin', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('shows the login, then the dashboard with tabs after signing in', async () => {
    installMatchMedia();
    const target = document.createElement('div');
    document.body.appendChild(target);
    vi.stubGlobal('fetch', makeFetch(seed));

    const instance = mountAdmin(target, { apiBasePath: '/api/tweaktags' });
    await flush();
    expect(target.querySelector('.tt-login-page')).toBeTruthy();

    await instance.engine.login('admin@example.com', 'password');
    await flush();

    expect(target.querySelector('.tt-admin')).toBeTruthy();
    expect(target.querySelector('.tt-tabs')).toBeTruthy();

    instance.destroy();
  });
});

//The bar used to be draggable only by a ten pixel dotted grip, which is a target
//most people never find. These pin the fix: the whole bar drags, except where a
//drag would swallow a click.
describe('dragging the edit bar', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  const signIn = async (): Promise<HTMLElement> => {
    installMatchMedia();
    document.body.innerHTML = '<h1 data-tweaktags-title>hi</h1>';
    vi.stubGlobal('fetch', makeFetch(seed));

    const instance = init({ apiBasePath: '/api/tweaktags' });
    await flush();
    await instance.engine.login('admin@example.com', 'password');
    await flush();

    const bar = document.querySelector('.tt-bar');

    if (!(bar instanceof HTMLElement)) {
      throw new Error('the edit bar did not mount');
    }

    return bar;
  };

  const drag = (from: HTMLElement, target: Element, toX: number, toY: number): void => {
    const options = { bubbles: true, pointerId: 1, clientX: 10, clientY: 10 };

    target.dispatchEvent(new PointerEvent('pointerdown', options));
    from.dispatchEvent(new PointerEvent('pointermove', { ...options, clientX: toX, clientY: toY }));
    from.dispatchEvent(new PointerEvent('pointerup', { ...options }));
  };

  it('moves when dragged by the bar itself, not only by the grip', async () => {
    const bar = await signIn();

    drag(bar, bar, 400, 300);

    expect(bar.style.left).not.toBe('');
    expect(bar.style.top).not.toBe('');
  });

  it('still moves when dragged by the grip', async () => {
    const bar = await signIn();
    const grip = bar.querySelector('.tt-grip');

    expect(grip).not.toBeNull();

    drag(bar, grip as Element, 250, 180);

    expect(bar.style.left).not.toBe('');
  });

  //A drag that started on a button would swallow the click, so buttons are left
  //alone and the bar stays where it is.
  it('does not move when the drag starts on a button', async () => {
    const bar = await signIn();
    const button = bar.querySelector('button');

    expect(button).not.toBeNull();

    drag(bar, button as Element, 400, 300);

    expect(bar.style.left).toBe('');
    expect(bar.style.top).toBe('');
  });
});
