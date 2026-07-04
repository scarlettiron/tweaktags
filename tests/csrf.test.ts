//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { describe, expect, it } from 'vitest';

import { ACTIONS, CSRF_HEADER, requiresCsrf, resolveConfig } from '@tweaktags/core';
import { assertCsrf } from '@tweaktags/server';

//A fully resolved auth config with the default cookie mode and csrf on.
const auth = resolveConfig({
  database: { provider: 'postgres', connectionString: 'postgres://localhost/tweaktags' },
  auth: { provider: 'jwt', jwtSecret: 'a-secret-that-is-long-enough' },
}).auth;

//The cookies a real browser would send, with a matching csrf value.
const goodCookies = { [auth.csrfCookieName]: 'token-123' };

describe('requiresCsrf', () => {
  it('is true for actions that change data', () => {
    expect(requiresCsrf(ACTIONS.CREATE_TAG)).toBe(true);
    expect(requiresCsrf(ACTIONS.UPDATE_CONTENT)).toBe(true);
    expect(requiresCsrf(ACTIONS.UPDATE_TAG_TYPE)).toBe(true);
    expect(requiresCsrf(ACTIONS.DELETE_TAG)).toBe(true);
    expect(requiresCsrf(ACTIONS.LOGOUT)).toBe(true);
  });

  it('is false for reads and the login bootstrap', () => {
    expect(requiresCsrf(ACTIONS.GET_CONTENT)).toBe(false);
    expect(requiresCsrf(ACTIONS.LIST_TAGS)).toBe(false);
    expect(requiresCsrf(ACTIONS.LOGIN)).toBe(false);
    expect(requiresCsrf(ACTIONS.REFRESH)).toBe(false);
    expect(requiresCsrf(ACTIONS.ME)).toBe(false);
  });

  it('exposes the header name the client must send', () => {
    expect(CSRF_HEADER).toBe('x-tweaktags-csrf');
  });
});

describe('assertCsrf in cookie mode', () => {
  it('passes when the header matches the cookie', () => {
    expect(() =>
      assertCsrf(auth, ACTIONS.UPDATE_CONTENT, goodCookies, 'token-123'),
    ).not.toThrow();
  });

  it('throws when the header does not match the cookie', () => {
    expect(() =>
      assertCsrf(auth, ACTIONS.UPDATE_CONTENT, goodCookies, 'wrong-token'),
    ).toThrow();
  });

  it('throws when the header is missing', () => {
    expect(() =>
      assertCsrf(auth, ACTIONS.UPDATE_CONTENT, goodCookies, undefined),
    ).toThrow();
  });

  it('throws when the cookie is missing', () => {
    expect(() => assertCsrf(auth, ACTIONS.UPDATE_CONTENT, {}, 'token-123')).toThrow();
  });

  it('does not check reads', () => {
    expect(() => assertCsrf(auth, ACTIONS.GET_CONTENT, {}, undefined)).not.toThrow();
  });
});

describe('assertCsrf when it does not apply', () => {
  it('skips the check when csrf protection is turned off', () => {
    const relaxed = { ...auth, csrfProtection: false };

    expect(() => assertCsrf(relaxed, ACTIONS.UPDATE_CONTENT, {}, undefined)).not.toThrow();
  });

  it('skips the check in header token mode', () => {
    const headerMode = { ...auth, tokenStorage: 'header' as const };

    expect(() => assertCsrf(headerMode, ACTIONS.UPDATE_CONTENT, {}, undefined)).not.toThrow();
  });
});
