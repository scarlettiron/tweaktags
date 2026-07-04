//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { forbidden, requiresCsrf, type ResolvedAuthConfig, type TweakTagsAction } from '@tweaktags/core';

//Checks the double submit csrf token for actions that change data.
//The client sends a header that must match the readable csrf cookie. A cross
//site attacker cannot read that cookie, so they cannot send the right header.
//This only applies in cookie mode. In header mode the bearer token already
//stops cross site forgery, because the browser does not send it on its own.
export const assertCsrf = (
  auth: ResolvedAuthConfig,
  action: TweakTagsAction,
  cookies: Record<string, string>,
  csrfHeader: string | undefined,
): void => {
  if (!auth.csrfProtection || auth.tokenStorage !== 'cookie' || !requiresCsrf(action)) {
    return;
  }

  const cookieValue = cookies[auth.csrfCookieName];

  if (!cookieValue || !csrfHeader || cookieValue !== csrfHeader) {
    throw forbidden('The request could not be verified. Please refresh the page and try again.');
  }
};
