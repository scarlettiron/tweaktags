# @tweaktags/server

The Node backend for TweakTags, the self-hosted inline CMS for Next.js, React, and plain HTML.

A framework agnostic request handler you mount on any route in your own backend, or run standalone. It owns the database, the login, and the content API.

Built and maintained by [Scarlett A. Scott (@scarlettiron)](https://github.com/scarlettiron).

**Full documentation and guides:** https://scarlettiron.github.io/tweaktags/

## Install

```sh
npm install @tweaktags/server
```
Postgres and JWT auth are built in. On Next.js use [@tweaktags/next](https://github.com/scarlettiron/tweaktags/tree/main/packages/next), which wraps this.

## Step by step

### 1. Write your config

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

### 2. Create the tables and your first admin

Point the CLI at the same config to create the tables and your first admin. Run these from your
project root:

```sh
npx tweaktags migrate
npx tweaktags create-superuser --email you@example.com --password "a-strong-password"
```

### 3. Mount the handler

It gives you a Node `(req, res)` handler you can mount anywhere. Standalone:

```ts
import { startStandaloneServer } from '@tweaktags/server';
import config from './tweaktags.config';

await startStandaloneServer(config, { port: 4000 });
```

Or mount the handler inside your own server (Express, Connect, plain http):

```ts
import { createTweakTagsServer } from '@tweaktags/server';
import config from './tweaktags.config';

const tweaktags = createTweakTagsServer(config);

// forward every /api/tweaktags request to tweaktags.nodeHandler(req, res)
app.all('/api/tweaktags', tweaktags.nodeHandler);
```

### 4. Add a frontend

Point [@tweaktags/react](https://github.com/scarlettiron/tweaktags/tree/main/packages/react) or
[@tweaktags/vanillajs](https://github.com/scarlettiron/tweaktags/tree/main/packages/vanillajs) at the same `apiBasePath`.

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
- **Documentation:** [Embedded and standalone modes](https://scarlettiron.github.io/tweaktags/#modes) on the docs site
- **UI for your stack:** [@tweaktags/next](https://www.npmjs.com/package/@tweaktags/next) · [@tweaktags/react](https://www.npmjs.com/package/@tweaktags/react) · [@tweaktags/vanillajs](https://www.npmjs.com/package/@tweaktags/vanillajs)
- **Backend:** **@tweaktags/server** (this package) · [@tweaktags/auth-jwt](https://www.npmjs.com/package/@tweaktags/auth-jwt) · [@tweaktags/cli](https://www.npmjs.com/package/@tweaktags/cli)
- **Databases:** [@tweaktags/db-postgres](https://www.npmjs.com/package/@tweaktags/db-postgres) · [@tweaktags/db-mysql](https://www.npmjs.com/package/@tweaktags/db-mysql) · [@tweaktags/db-mariadb](https://www.npmjs.com/package/@tweaktags/db-mariadb) · [@tweaktags/db-sqlite](https://www.npmjs.com/package/@tweaktags/db-sqlite)
- **Media uploads:** [@tweaktags/storage-s3](https://www.npmjs.com/package/@tweaktags/storage-s3)
- **Internals:** [@tweaktags/core](https://www.npmjs.com/package/@tweaktags/core) · [@tweaktags/browser](https://www.npmjs.com/package/@tweaktags/browser)

## Author

TweakTags is created and maintained by
**[Scarlett A. Scott (@scarlettiron)](https://github.com/scarlettiron)**, and published as the
[@tweaktags](https://www.npmjs.com/org/tweaktags) packages on npm.

## License

MIT
