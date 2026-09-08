# @tweaktags/db-sqlite

The SQLite adapter for TweakTags, the self-hosted inline CMS for Next.js, React, and plain HTML.

Stores your editable content in a SQLite file, which is often all a small site or a local setup needs.

Built and maintained by [Scarlett A. Scott (@scarlettiron)](https://github.com/scarlettiron).

**Full documentation and guides:** https://scarlettiron.github.io/tweaktags/

## Install

```sh
npm install @tweaktags/db-sqlite
```
Install it alongside `@tweaktags/server` or `@tweaktags/next` when your config uses this database.

## Use it

Set the `database` block of your `tweaktags.config` to `sqlite`:

```ts
import { defineConfig } from '@tweaktags/core';

export default defineConfig({
  database: {
    provider: 'sqlite',
    filename: './tweaktags.db',
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

All connection options are listed in the [config type reference](https://github.com/scarlettiron/tweaktags/blob/main/packages/core/src/types/index.ts).

## Links

- **Documentation and guides:** https://scarlettiron.github.io/tweaktags/
- **Every config setting:** [config type reference](https://github.com/scarlettiron/tweaktags/blob/main/packages/core/src/types/index.ts)
- **Source and issues:** [github.com/scarlettiron/tweaktags](https://github.com/scarlettiron/tweaktags)

## Supported SQLite versions

There is no version to choose. SQLite is compiled into
[better-sqlite3](https://www.npmjs.com/package/better-sqlite3), so the version
comes with that dependency rather than from a server you run. The adapter
contract runs against whatever it ships, on every pull request.

The one thing that can vary is the native binding: it is built when the package
installs, and on a machine that cannot build it the SQLite tests skip rather
than fail. `pnpm rebuild better-sqlite3` builds it.

## Connection pooling

SQLite has a single file handle and no connection pool, so a `database.pool` block is accepted and
ignored here. It applies to the Postgres, MySQL, and MariaDB adapters.

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
- **Backend:** [@tweaktags/server](https://www.npmjs.com/package/@tweaktags/server) · [@tweaktags/auth-jwt](https://www.npmjs.com/package/@tweaktags/auth-jwt) · [@tweaktags/auth-aws-cognito](https://www.npmjs.com/package/@tweaktags/auth-aws-cognito) · [@tweaktags/cli](https://www.npmjs.com/package/@tweaktags/cli)
- **Databases:** [@tweaktags/db-postgres](https://www.npmjs.com/package/@tweaktags/db-postgres) · [@tweaktags/db-mysql](https://www.npmjs.com/package/@tweaktags/db-mysql) · [@tweaktags/db-mariadb](https://www.npmjs.com/package/@tweaktags/db-mariadb) · **@tweaktags/db-sqlite** (this package)
- **Media uploads:** [@tweaktags/storage-s3](https://www.npmjs.com/package/@tweaktags/storage-s3)
- **Internals:** [@tweaktags/core](https://www.npmjs.com/package/@tweaktags/core) · [@tweaktags/browser](https://www.npmjs.com/package/@tweaktags/browser)

## Author

TweakTags is created and maintained by
**[Scarlett A. Scott (@scarlettiron)](https://github.com/scarlettiron)**, and published as the
[@tweaktags](https://www.npmjs.com/org/tweaktags) packages on npm.

## License

MIT
