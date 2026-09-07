# @tweaktags/core

Shared types, the config helper, the request handler, and adapter interfaces for TweakTags.

Built and maintained by [Scarlett A. Scott (@scarlettiron)](https://github.com/scarlettiron).

Part of **[TweakTags](https://github.com/scarlettiron/tweaktags)**, a lightweight edit in place content layer for React, Next,
and plain HTML sites. Mark any element with a `data-tweaktags-*` attribute, and signed in editors
change its text, rich text, or media right on the live page. Everyone else just sees the saved content.

**Full documentation and guides:** https://scarlettiron.github.io/tweaktags/

## Install

```sh
npm install @tweaktags/core
```
You usually do not install this directly. `@tweaktags/next`, `@tweaktags/react`, and
`@tweaktags/server` pull it in and re-export what you need. Install it on its own only to write a
`tweaktags.config` in a package that has none of those, or to build your own adapter.

## Writing a config

`defineConfig` is just an identity helper that gives you type checking and autocomplete on the config
shape:

```ts
// tweaktags.config.ts
import { defineConfig } from '@tweaktags/core';

export default defineConfig({
  apiBasePath: '/api/tweaktags',
  database: {
    provider: 'postgres',
    connectionString: process.env.DATABASE_URL,
  },
  auth: {
    provider: 'jwt',
    jwtSecret: process.env.TWEAKTAGS_JWT_SECRET,
  },
});
```

Every field, with its defaults, is documented in the
[config type reference](https://github.com/scarlettiron/tweaktags/blob/main/packages/core/src/types/index.ts). The main blocks are `database`, `auth`, optional
`storage` for media uploads, optional `cors`, and `tenant` / `resolveTenant` for multi tenancy.

## Links

- **Documentation and guides:** https://scarlettiron.github.io/tweaktags/
- **Every config setting:** [config type reference](https://github.com/scarlettiron/tweaktags/blob/main/packages/core/src/types/index.ts)
- **Source and issues:** [github.com/scarlettiron/tweaktags](https://github.com/scarlettiron/tweaktags)

## Logging and failures

When something goes wrong on the server, TweakTags writes one line about it and hands the caller a
trace id. There is nothing to set up: with no `logger` in your config, entries go to the console
your server already has.

```
[tweaktags] ERROR request.failed trace=mtqj54hvf4av7g action=listTags status=500 code=internal_error
  connect ECONNREFUSED 127.0.0.1:5432
  { hint: 'Nothing answered at the database host and port...', error: { code: 'ECONNREFUSED', stack: '...' } }
```

The browser gets the same trace id back, so a report that saving failed can be matched to the line
that explains it. For the failures a self hosted install actually hits, the entry carries a hint in
plain language: a database asked for SSL that it does not support or one that requires it, nothing
listening at the host and port, rejected credentials, a missing database, or tables that were never
migrated.

To send entries somewhere else, set `logger` in your config:

```ts
export default defineConfig({
  logger: (entry) => myLogger[entry.level](entry.message, entry),
  // ...the rest of your config
});
```

In production the internal message stays on the server and the response carries only the trace id,
so database details never reach a visitor. In development the message comes back too.

## Requirements

- **Node 16 or newer** to run the server side pieces.
- **TypeScript 4.5 or newer**, if you use TypeScript. The published type declarations use inline
  `type` modifiers on export specifiers, which 4.4 and older cannot parse. TypeScript is not
  required: the packages work from plain JavaScript too.
- For `moduleResolution`, anything works. `node16` and `nodenext` (TypeScript 4.7+) and `bundler`
  (5.0+) pick up the separate ESM and CommonJS declarations; older setups resolve through the
  `types` field and get the same API.

## The rest of TweakTags

Every package in the project, so you can jump straight to the piece you need:

- **Start here:** [tweaktags](https://www.npmjs.com/package/tweaktags) — the front door, with a map of the whole project
- **Documentation:** [Install and config](https://scarlettiron.github.io/tweaktags/#install) on the docs site
- **UI for your stack:** [@tweaktags/next](https://www.npmjs.com/package/@tweaktags/next) · [@tweaktags/react](https://www.npmjs.com/package/@tweaktags/react) · [@tweaktags/vanillajs](https://www.npmjs.com/package/@tweaktags/vanillajs)
- **Backend:** [@tweaktags/server](https://www.npmjs.com/package/@tweaktags/server) · [@tweaktags/auth-jwt](https://www.npmjs.com/package/@tweaktags/auth-jwt) · [@tweaktags/cli](https://www.npmjs.com/package/@tweaktags/cli)
- **Databases:** [@tweaktags/db-postgres](https://www.npmjs.com/package/@tweaktags/db-postgres) · [@tweaktags/db-mysql](https://www.npmjs.com/package/@tweaktags/db-mysql) · [@tweaktags/db-mariadb](https://www.npmjs.com/package/@tweaktags/db-mariadb) · [@tweaktags/db-sqlite](https://www.npmjs.com/package/@tweaktags/db-sqlite)
- **Media uploads:** [@tweaktags/storage-s3](https://www.npmjs.com/package/@tweaktags/storage-s3)
- **Internals:** **@tweaktags/core** (this package) · [@tweaktags/browser](https://www.npmjs.com/package/@tweaktags/browser)

## Author

TweakTags is created and maintained by
**[Scarlett A. Scott (@scarlettiron)](https://github.com/scarlettiron)**, and published as the
[@tweaktags](https://www.npmjs.com/org/tweaktags) packages on npm.

## License

MIT
