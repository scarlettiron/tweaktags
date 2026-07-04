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
