//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { describe, expect, it } from 'vitest';

import { ACTIONS, resolveConfig } from '@tweaktags/core';
import {
  buildClearCookies,
  buildTokenCookies,
  parseCookies,
  resolveAuthCookie,
} from '@tweaktags/server';

//A fully resolved auth config in the default cookie mode.
const auth = resolveConfig({
  database: { provider: 'postgres', connectionString: 'postgres://localhost/tweaktags' },
  auth: { provider: 'jwt', jwtSecret: 'a-secret-that-is-long-enough' },
}).auth;

describe('parseCookies', () => {
  it('parses a cookie header into a map', () => {
    expect(parseCookies('a=1; b=two')).toEqual({ a: '1', b: 'two' });
  });

  it('decodes url encoded values', () => {
    expect(parseCookies('greeting=two%20words')).toEqual({ greeting: 'two words' });
  });

  it('returns an empty object for a missing or empty header', () => {
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies('')).toEqual({});
  });
});

describe('buildTokenCookies', () => {
  it('builds secure httpOnly cookies for both tokens', () => {
    const [access, refresh] = buildTokenCookies(auth, 'access-value', 'refresh-value');

    expect(access).toContain('tweaktags_token=access-value');
    expect(access).toContain('HttpOnly');
    expect(access).toContain('SameSite=lax');
    expect(access).toContain('Max-Age=900');
    expect(access).toContain('Secure');

    expect(refresh).toContain('tweaktags_refresh=refresh-value');
    expect(refresh).toContain('Max-Age=604800');
  });

  it('leaves off Secure when cookieSecure is false', () => {
    const [access] = buildTokenCookies({ ...auth, cookieSecure: false }, 'a', 'r');

    expect(access).not.toContain('Secure');
  });
});

describe('buildClearCookies', () => {
  it('clears all three auth cookies', () => {
    const cookies = buildClearCookies(auth);

    expect(cookies).toHaveLength(3);
    expect(cookies.every((cookie) => cookie.includes('Max-Age=0'))).toBe(true);
  });
});

describe('resolveAuthCookie', () => {
  const loginResponse = {
    status: 200,
    body: {
      accessToken: 'access-value',
      refreshToken: 'refresh-value',
      user: { id: '1', email: 'user@example.com', role: 'superuser' },
    },
  };

  it('moves the tokens into cookies on login and strips them from the body', () => {
    const result = resolveAuthCookie(auth, ACTIONS.LOGIN, loginResponse);

    //Two token cookies plus the csrf cookie.
    expect(result.setCookies).toHaveLength(3);
    expect('accessToken' in result.body).toBe(false);
    expect('refreshToken' in result.body).toBe(false);
    expect(result.body.user).toBeDefined();
  });

  it('does not add a csrf cookie when csrf protection is off', () => {
    const result = resolveAuthCookie({ ...auth, csrfProtection: false }, ACTIONS.LOGIN, loginResponse);

    expect(result.setCookies).toHaveLength(2);
  });

  it('leaves the tokens in the body in header mode', () => {
    const result = resolveAuthCookie(
      { ...auth, tokenStorage: 'header' as const },
      ACTIONS.LOGIN,
      loginResponse,
    );

    expect(result.setCookies).toHaveLength(0);
    expect(result.body.accessToken).toBe('access-value');
  });

  it('clears the cookies on logout', () => {
    const result = resolveAuthCookie(auth, ACTIONS.LOGOUT, { status: 200, body: { ok: true } });

    expect(result.setCookies).toHaveLength(3);
    expect(result.setCookies.every((cookie) => cookie.includes('Max-Age=0'))).toBe(true);
  });

  it('sets no cookies for a plain read', () => {
    const result = resolveAuthCookie(auth, ACTIONS.GET_CONTENT, {
      status: 200,
      body: { content: [] },
    });

    expect(result.setCookies).toHaveLength(0);
  });

  it('sets no cookies when the login failed', () => {
    const result = resolveAuthCookie(auth, ACTIONS.LOGIN, {
      status: 401,
      body: { error: 'unauthorized', message: 'bad login' },
    });

    expect(result.setCookies).toHaveLength(0);
  });
});
