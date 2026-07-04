//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import type { IncomingMessage, ServerResponse } from 'node:http';

import type { CorsConfig } from '@tweaktags/core';

//Adds the cross origin headers when cors is configured, and answers the
//browser's preflight request. Returns true when the request was a preflight
//that has been fully handled, so the caller should stop.
export const applyCors = (
  req: IncomingMessage,
  res: ServerResponse,
  cors: CorsConfig | undefined,
): boolean => {
  if (!cors) {
    return false;
  }

  const requestOrigin = req.headers.origin;
  let allowOrigin: string | null = null;

  //We echo the exact request origin rather than a star, because cookies are only
  //sent on credentialed requests, and those are not allowed with a star origin.
  if (cors.origins === '*') {
    allowOrigin = requestOrigin ?? null;
  } else if (requestOrigin && cors.origins.includes(requestOrigin)) {
    allowOrigin = requestOrigin;
  }

  if (allowOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-TweakTags-Csrf');
  }

  //The browser sends an OPTIONS request first to check permission.
  //We answer it here with no body.
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();

    return true;
  }

  return false;
};
