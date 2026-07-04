//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { randomUUID } from 'node:crypto';

import { ACTIONS, type ResolvedAuthConfig, type TweakTagsAction, type TweakTagsResponse } from '@tweaktags/core';

//Reads the cookies from a Cookie header into a simple name to value map.
export const parseCookies = (header: string | undefined): Record<string, string> => {
  const cookies: Record<string, string> = {};

  if (!header) {
    return cookies;
  }

  for (const part of header.split(';')) {
    const index = part.indexOf('=');

    if (index === -1) {
      continue;
    }

    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    if (name) {
      cookies[name] = decodeURIComponent(value);
    }
  }

  return cookies;
};

//Builds one httpOnly Set-Cookie value. A max age of zero clears the cookie.
const buildCookie = (
  auth: ResolvedAuthConfig,
  name: string,
  value: string,
  maxAgeSeconds: number,
): string => {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    `SameSite=${auth.cookieSameSite}`,
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (auth.cookieSecure) {
    parts.push('Secure');
  }

  return parts.join('; ');
};

//The Set-Cookie values that store the access and refresh tokens.
export const buildTokenCookies = (
  auth: ResolvedAuthConfig,
  accessToken: string,
  refreshToken: string,
): string[] => [
  buildCookie(auth, auth.cookieName, accessToken, auth.accessTtlSeconds),
  buildCookie(auth, auth.refreshCookieName, refreshToken, auth.refreshTtlSeconds),
];

//Builds the csrf cookie. It is NOT httpOnly on purpose, so the client can read
//the value and send it back in a header for the double submit csrf check.
const buildCsrfCookie = (auth: ResolvedAuthConfig, value: string, maxAgeSeconds: number): string => {
  const parts = [
    `${auth.csrfCookieName}=${encodeURIComponent(value)}`,
    'Path=/',
    `SameSite=${auth.cookieSameSite}`,
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (auth.cookieSecure) {
    parts.push('Secure');
  }

  return parts.join('; ');
};

//The Set-Cookie values that clear all auth cookies on logout.
export const buildClearCookies = (auth: ResolvedAuthConfig): string[] => [
  buildCookie(auth, auth.cookieName, '', 0),
  buildCookie(auth, auth.refreshCookieName, '', 0),
  buildCsrfCookie(auth, '', 0),
];

//Decides how the response should handle the auth cookies.
//In cookie mode, a successful login or refresh stores the tokens in Set-Cookie
//headers and removes them from the response body, and a logout clears them. In
//header mode nothing changes, and the tokens stay in the body for the client.
export const resolveAuthCookie = (
  auth: ResolvedAuthConfig,
  action: TweakTagsAction,
  response: TweakTagsResponse,
): { setCookies: string[]; body: Record<string, unknown> } => {
  if (auth.tokenStorage !== 'cookie') {
    return { setCookies: [], body: response.body };
  }

  const issues = action === ACTIONS.LOGIN || action === ACTIONS.REFRESH;

  const accessToken = response.body.accessToken;
  const refreshToken = response.body.refreshToken;

  if (
    issues &&
    response.status === 200 &&
    typeof accessToken === 'string' &&
    typeof refreshToken === 'string'
  ) {
    const { accessToken: _access, refreshToken: _refresh, ...rest } = response.body;

    const setCookies = buildTokenCookies(auth, accessToken, refreshToken);

    //Issue a fresh csrf value alongside the tokens, unless csrf is turned off.
    if (auth.csrfProtection) {
      setCookies.push(buildCsrfCookie(auth, randomUUID(), auth.refreshTtlSeconds));
    }

    return { setCookies, body: rest };
  }

  if (action === ACTIONS.LOGOUT) {
    return { setCookies: buildClearCookies(auth), body: response.body };
  }

  return { setCookies: [], body: response.body };
};
