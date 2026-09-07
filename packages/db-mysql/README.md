# @tweaktags/db-mysql

The MySQL and MariaDB database adapter and migrations for TweakTags.

Built and maintained by [Scarlett A. Scott (@scarlettiron)](https://github.com/scarlettiron).

Part of **[TweakTags](https://github.com/scarlettiron/tweaktags)**, a lightweight edit in place content layer for React, Next,
and plain HTML sites. Mark any element with a `data-tweaktags-*` attribute, and signed in editors
change its text, rich text, or media right on the live page. Everyone else just sees the saved content.

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
