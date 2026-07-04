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
});
