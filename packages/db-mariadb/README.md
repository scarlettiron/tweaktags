# @tweaktags/db-mariadb

A thin MariaDB alias that installs and re-exports @tweaktags/db-mysql.

Part of **[TweakTags](https://github.com/scarlettiron/tweaktags)**, a lightweight edit in place content layer for React, Next,
and plain HTML sites. Mark any element with a `data-tweaktags-*` attribute, and signed in editors
change its text, rich text, or media right on the live page. Everyone else just sees the saved content.

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

## License

MIT
