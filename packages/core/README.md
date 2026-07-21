# @tweaktags/core

Shared types, the config helper, the request handler, and adapter interfaces for TweakTags.

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

## License

MIT
