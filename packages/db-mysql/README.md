# @tweaktags/db-mysql

The MySQL and MariaDB adapter for TweakTags, the self-hosted inline CMS for Next.js, React, and plain HTML.

Stores your editable content in MySQL or MariaDB, and owns the migrations that create the tables.

Built and maintained by [Scarlett A. Scott (@scarlettiron)](https://github.com/scarlettiron).

**Full documentation and guides:** https://scarlettiron.github.io/tweaktags/

## Install

```sh
npm install @tweaktags/db-mysql
```
Install it alongside `@tweaktags/server` or `@tweaktags/next` when your config uses this database.

## Use it

Set the `database` block of your `tweaktags.config` to `mysql`:

```ts
import { defineConfig } from '@tweaktags/core';

export default defineConfig({
  database: {
    provider: 'mysql',
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

MariaDB users can install [@tweaktags/db-mariadb](https://github.com/scarlettiron/tweaktags/tree/main/packages/db-mariadb) instead, which re-exports this adapter.

All connection options are listed in the [config type reference](https://github.com/scarlettiron/tweaktags/blob/main/packages/core/src/types/index.ts).

## Links

- **Documentation and guides:** https://scarlettiron.github.io/tweaktags/
- **Every config setting:** [config type reference](https://github.com/scarlettiron/tweaktags/blob/main/packages/core/src/types/index.ts)
- **Source and issues:** [github.com/scarlettiron/tweaktags](https://github.com/scarlettiron/tweaktags)

## SSL

`ssl: true` in the database config, and `?sslmode=require` on the end of a connection string, both
ask for an encrypted connection. A plain local database, like one started with `docker run postgres`,
does not offer one, and refuses with **"The server does not support SSL connections"**. A hosted
database is usually the opposite and refuses a connection without SSL.

Set `ssl: true` for a hosted database, and leave it unset with no `sslmode` parameter for a local
one. When the config and the connection string disagree, TweakTags says so at startup rather than
letting one of them silently win, and explains the failure in the log if the connection then fails.

## Supported MySQL and MariaDB versions

Every version below runs the full adapter contract in CI on each pull request,
so the tested list and the supported list are the same list.

| Version | Status |
| --- | --- |
| MySQL 8.4 | Tested |
| MySQL 8.0 | Tested |
| MySQL 5.7 | Works, but not supported: it reached end of life in October 2023 |
| MariaDB 11.8, 11.4 | Tested |
| MariaDB 10.11, 10.6 | Tested |
| MariaDB 10.5 | Works, past its end of life |

The tables are created as `utf8mb4` with an explicit collation rather than
inheriting the server default. That matters: MySQL 5.7 defaults to `latin1`,
and so does any 8.x server configured that way, which rejects four byte
characters such as emoji outright. If you are on a database created before this
was pinned, and emoji are being rejected, convert the tables once:

```sql
ALTER TABLE `__TweakTags__Content`        CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `__TweakTags__Users`          CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `__TweakTags__Refresh_Tokens` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## Connection pooling

On a normal Node server there is one process and one pool, so there is nothing to configure. Leave
`database.pool` out and mysql2's defaults apply.

On serverless, every instance that wakes up builds its own pool, so the connection count multiplies
by the number of warm instances: **50 instances × 10 connections = 500 connections**, which is more
than a small managed database will accept. Keep each pool small:

```ts
database: {
  provider: 'mysql',
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
- **Databases:** [@tweaktags/db-postgres](https://www.npmjs.com/package/@tweaktags/db-postgres) · **@tweaktags/db-mysql** (this package) · [@tweaktags/db-mariadb](https://www.npmjs.com/package/@tweaktags/db-mariadb) · [@tweaktags/db-sqlite](https://www.npmjs.com/package/@tweaktags/db-sqlite)
- **Media uploads:** [@tweaktags/storage-s3](https://www.npmjs.com/package/@tweaktags/storage-s3)
- **Internals:** [@tweaktags/core](https://www.npmjs.com/package/@tweaktags/core) · [@tweaktags/browser](https://www.npmjs.com/package/@tweaktags/browser)

## Author

TweakTags is created and maintained by
**[Scarlett A. Scott (@scarlettiron)](https://github.com/scarlettiron)**, and published as the
[@tweaktags](https://www.npmjs.com/org/tweaktags) packages on npm.

## License

MIT
