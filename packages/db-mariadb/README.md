# @tweaktags/db-mariadb

The MariaDB adapter for TweakTags, the self-hosted inline CMS for Next.js, React, and plain HTML.

A thin package that installs and re-exports @tweaktags/db-mysql, since MariaDB speaks the MySQL protocol.

Built and maintained by [Scarlett A. Scott (@scarlettiron)](https://github.com/scarlettiron).

**Full documentation and guides:** https://scarlettiron.github.io/tweaktags/

## Install

```sh
npm install @tweaktags/db-mariadb
```
Install it alongside `@tweaktags/server` or `@tweaktags/next` when your config uses this database.

## Use it

Set the `database` block of your `tweaktags.config` to `mariadb`:

```ts
import { defineConfig } from '@tweaktags/core';

export default defineConfig({
  database: {
    provider: 'mariadb',
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: process.env.DB_PASSWORD,
    database: 'tweaktags',
  },
  auth: {
    provider: 'jwt',
    jwtSecret: process.env.TWEAKTAGS_JWT_SECRET,
  },
});
```

Then create the tables:

```sh
npx tweaktags migrate
```

MariaDB speaks the MySQL protocol, so it uses the same adapter under the hood. Install this so the package name matches your database.

All connection options are listed in the [config type reference](https://github.com/scarlettiron/tweaktags/blob/main/packages/core/src/types/index.ts).

## Links

- **Documentation and guides:** https://scarlettiron.github.io/tweaktags/
- **Every config setting:** [config type reference](https://github.com/scarlettiron/tweaktags/blob/main/packages/core/src/types/index.ts)
- **Source and issues:** [github.com/scarlettiron/tweaktags](https://github.com/scarlettiron/tweaktags)

## Supported MariaDB versions

MariaDB speaks the MySQL protocol, so this package re-exports
[@tweaktags/db-mysql](https://www.npmjs.com/package/@tweaktags/db-mysql) and
shares its testing. Every version below runs the full adapter contract in CI on
each pull request.

| Version | Status |
| --- | --- |
| 11.8, 11.4 | Tested |
| 10.11, 10.6 | Tested |
| 10.5 | Works, past its end of life |
| 10.4 and older | Not tested |

## Connection pooling

On a normal Node server there is one process and one pool, so there is nothing to configure. Leave
`database.pool` out and mysql2's defaults apply.

On serverless, every instance that wakes up builds its own pool, so the connection count multiplies
by the number of warm instances: **50 instances × 10 connections = 500 connections**, which is more
than a small managed database will accept. Keep each pool small:

```ts
database: {
  provider: 'mariadb',
  connectionString: process.env.DATABASE_URL,
  pool: {
    max: 2,                        // each instance serves one request at a time
    idleTimeoutMillis: 10_000,     // let a sleeping instance let go
    connectionTimeoutMillis: 5_000, // fail fast instead of hanging
  },
},
```

`max`, `idleTimeoutMillis`, and `connectionTimeoutMillis` apply. `min` is ignored, because mysql2 has no minimum pool size to map it onto.

Every field is optional, and anything you leave out keeps the driver default rather than being
overwritten with a blank. Values are checked when the config is resolved, so a typo fails at startup
with a clear message instead of turning up later as a connection error.

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
- **Documentation:** [Databases](https://scarlettiron.github.io/tweaktags/#databases) on the docs site
- **UI for your stack:** [@tweaktags/next](https://www.npmjs.com/package/@tweaktags/next) · [@tweaktags/react](https://www.npmjs.com/package/@tweaktags/react) · [@tweaktags/vanillajs](https://www.npmjs.com/package/@tweaktags/vanillajs)
- **Backend:** [@tweaktags/server](https://www.npmjs.com/package/@tweaktags/server) · [@tweaktags/auth-jwt](https://www.npmjs.com/package/@tweaktags/auth-jwt) · [@tweaktags/cli](https://www.npmjs.com/package/@tweaktags/cli)
- **Databases:** [@tweaktags/db-postgres](https://www.npmjs.com/package/@tweaktags/db-postgres) · [@tweaktags/db-mysql](https://www.npmjs.com/package/@tweaktags/db-mysql) · **@tweaktags/db-mariadb** (this package) · [@tweaktags/db-sqlite](https://www.npmjs.com/package/@tweaktags/db-sqlite)
- **Media uploads:** [@tweaktags/storage-s3](https://www.npmjs.com/package/@tweaktags/storage-s3)
- **Internals:** [@tweaktags/core](https://www.npmjs.com/package/@tweaktags/core) · [@tweaktags/browser](https://www.npmjs.com/package/@tweaktags/browser)

## Author

TweakTags is created and maintained by
**[Scarlett A. Scott (@scarlettiron)](https://github.com/scarlettiron)**, and published as the
[@tweaktags](https://www.npmjs.com/org/tweaktags) packages on npm.

## License

MIT
