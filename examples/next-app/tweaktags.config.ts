//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { defineConfig } from '@tweaktags/core';

//The single source of truth for this app.
//Secrets are read from the environment so they are not committed.
export default defineConfig({
  mode: 'embedded',
  editInView: true,
  apiBasePath: '/api/tweaktags',
  database: {
    provider: 'postgres',
    connectionString: process.env.DATABASE_URL,
  },
  auth: {
    provider: 'jwt',
    jwtSecret: process.env.TWEAKTAGS_JWT_SECRET ?? 'replace-this-with-a-long-random-secret',

    //A short access token that quietly refreshes, and a longer refresh token.
    accessTtlSeconds: 60 * 15,
    refreshTtlSeconds: 60 * 60 * 24 * 7,

    //The token lives in a secure httpOnly cookie. Secure cookies need https,
    //so we turn that off for local http development only.
    cookieSecure: process.env.NODE_ENV === 'production',
  },

  //Leave this out and failures are written to the console, which is all a small
  //install needs. It is here to show the shape: every failed request arrives as
  //one entry with a trace id, the action, a stack, and a hint for the causes
  //TweakTags recognises, such as a database asked for SSL that it does not
  //support. The same trace id goes back to the browser, so a report of "it
  //broke" can be matched to the line that explains it.
  logger: (entry) => {
    if (entry.level === 'error') {
      console.error(`[tweaktags] ${entry.event} ${entry.traceId}`, {
        action: entry.action,
        reason: entry.reason,
        hint: entry.hint,
        error: entry.error,
      });

      return;
    }

    console.log(`[tweaktags] ${entry.event} ${entry.traceId} ${entry.message}`);
  },
});
