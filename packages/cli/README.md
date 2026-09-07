# @tweaktags/cli

The command line tool for TweakTags, the self-hosted inline CMS for Next.js, React, and plain HTML.

Creates the database tables and your first admin user, and lists the tags and users you already have.

Built and maintained by [Scarlett A. Scott (@scarlettiron)](https://github.com/scarlettiron).

**Full documentation and guides:** https://scarlettiron.github.io/tweaktags/

## Install

No install needed, run it with `npx` from a project that has a `tweaktags.config` file:

```sh
npx tweaktags <command>
```

Or add it as a dev dependency: `npm i -D @tweaktags/cli`.

## Commands

Every command reads your `tweaktags.config` (pass `--config <path>` to point elsewhere) so it uses the
same database and settings as your app.

```sh
# create or update the database tables
npx tweaktags migrate

# create the first admin, who can manage everything
npx tweaktags create-superuser --email you@example.com --password secret [--role superuser|editor]

# add another user
npx tweaktags create-user --email editor@example.com --password secret

# change a password
npx tweaktags update-password --email you@example.com --password new-secret

# list every content tag, optionally for one tenant
npx tweaktags list-tags [--tenant name]

# list every user
npx tweaktags list-users
```

A typical first run is `migrate` then `create-superuser`.

## Links

- **Documentation and guides:** https://scarlettiron.github.io/tweaktags/
- **Every config setting:** [config type reference](https://github.com/scarlettiron/tweaktags/blob/main/packages/core/src/types/index.ts)
- **Source and issues:** [github.com/scarlettiron/tweaktags](https://github.com/scarlettiron/tweaktags)

## When a command fails

`tweaktags migrate` is usually the first thing pointed at a new database, so it is where a wrong
host, wrong credentials, or an SSL mismatch shows up first. When a command fails, the driver's
message is printed along with what that message normally means:

```
The server does not support SSL connections

The database was asked for an SSL connection but has SSL turned off. Either remove "ssl: true"
from the database config and drop any "sslmode=require" from the connection string, or turn SSL
on at the database. A local Docker Postgres has no SSL unless you configure it.
```

The same explanations appear in the server's log at runtime. See
[@tweaktags/server](https://github.com/scarlettiron/tweaktags/tree/main/packages/server) for how
failures are logged and traced once your app is running.

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
- **Documentation:** [CLI reference](https://scarlettiron.github.io/tweaktags/#cli) on the docs site
- **UI for your stack:** [@tweaktags/next](https://www.npmjs.com/package/@tweaktags/next) · [@tweaktags/react](https://www.npmjs.com/package/@tweaktags/react) · [@tweaktags/vanillajs](https://www.npmjs.com/package/@tweaktags/vanillajs)
- **Backend:** [@tweaktags/server](https://www.npmjs.com/package/@tweaktags/server) · [@tweaktags/auth-jwt](https://www.npmjs.com/package/@tweaktags/auth-jwt) · **@tweaktags/cli** (this package)
- **Databases:** [@tweaktags/db-postgres](https://www.npmjs.com/package/@tweaktags/db-postgres) · [@tweaktags/db-mysql](https://www.npmjs.com/package/@tweaktags/db-mysql) · [@tweaktags/db-mariadb](https://www.npmjs.com/package/@tweaktags/db-mariadb) · [@tweaktags/db-sqlite](https://www.npmjs.com/package/@tweaktags/db-sqlite)
- **Media uploads:** [@tweaktags/storage-s3](https://www.npmjs.com/package/@tweaktags/storage-s3)
- **Internals:** [@tweaktags/core](https://www.npmjs.com/package/@tweaktags/core) · [@tweaktags/browser](https://www.npmjs.com/package/@tweaktags/browser)

## Author

TweakTags is created and maintained by
**[Scarlett A. Scott (@scarlettiron)](https://github.com/scarlettiron)**, and published as the
[@tweaktags](https://www.npmjs.com/org/tweaktags) packages on npm.

## License

MIT
