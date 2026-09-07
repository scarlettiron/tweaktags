# tweak-tags

The unscoped name for **TweakTags**. It installs and re-exports [@tweaktags/core](https://github.com/scarlettiron/tweaktags/tree/main/packages/core), so `npm install tweak-tags` lands on the real project.

Built and maintained by [Scarlett A. Scott (@scarlettiron)](https://github.com/scarlettiron).

Part of **[TweakTags](https://github.com/scarlettiron/tweaktags)**, a lightweight edit in place content layer for React, Next,
and plain HTML sites. Mark any element with a `data-tweaktags-*` attribute, and signed in editors
change its text, rich text, or media right on the live page. Everyone else just sees the saved content.

**Full documentation and guides:** https://scarlettiron.github.io/tweaktags/

## Which package do I actually want?

This one is a signpost. The real setup is one package for your stack, plus a database adapter:

| Your stack | Install |
| --- | --- |
| Next.js (app or pages router) | `npm install @tweaktags/next` |
| React, with your own backend | `npm install @tweaktags/react` + `@tweaktags/server` |
| Plain HTML and JavaScript | `npm install @tweaktags/vanillajs` + `@tweaktags/server` |
| Node backend only, no UI | `npm install @tweaktags/server` |

Postgres and JWT auth come built in with the backend. For another database, add
`@tweaktags/db-mysql`, `@tweaktags/db-mariadb`, or `@tweaktags/db-sqlite`. For media uploads, add
`@tweaktags/storage-s3`.

The [Next.js guide](https://github.com/scarlettiron/tweaktags/tree/main/packages/next) is the fastest
way in, and the [docs site](https://scarlettiron.github.io/tweaktags/) walks through the whole setup
step by step.

## What you get from this package

Everything in `@tweaktags/core`: `defineConfig`, the framework agnostic request handler, the adapter
interfaces, and the shared types. These two imports are the same thing:

```ts
import { defineConfig } from 'tweak-tags';
import { defineConfig } from '@tweaktags/core';
```

The editing UI is **not** here, because which one you need depends on your stack. Install the package
from the table above for that.

## Links

- **Documentation and guides:** https://scarlettiron.github.io/tweaktags/
- **Every config setting:** [config type reference](https://github.com/scarlettiron/tweaktags/blob/main/packages/core/src/types/index.ts)
- **Source and issues:** [github.com/scarlettiron/tweaktags](https://github.com/scarlettiron/tweaktags)

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
- **Documentation:** [Quick start](https://scarlettiron.github.io/tweaktags/#quickstart) on the docs site
- **UI for your stack:** [@tweaktags/next](https://www.npmjs.com/package/@tweaktags/next) · [@tweaktags/react](https://www.npmjs.com/package/@tweaktags/react) · [@tweaktags/vanillajs](https://www.npmjs.com/package/@tweaktags/vanillajs)
- **Backend:** [@tweaktags/server](https://www.npmjs.com/package/@tweaktags/server) · [@tweaktags/auth-jwt](https://www.npmjs.com/package/@tweaktags/auth-jwt) · [@tweaktags/cli](https://www.npmjs.com/package/@tweaktags/cli)
- **Databases:** [@tweaktags/db-postgres](https://www.npmjs.com/package/@tweaktags/db-postgres) · [@tweaktags/db-mysql](https://www.npmjs.com/package/@tweaktags/db-mysql) · [@tweaktags/db-mariadb](https://www.npmjs.com/package/@tweaktags/db-mariadb) · [@tweaktags/db-sqlite](https://www.npmjs.com/package/@tweaktags/db-sqlite)
- **Media uploads:** [@tweaktags/storage-s3](https://www.npmjs.com/package/@tweaktags/storage-s3)
- **Internals:** [@tweaktags/core](https://www.npmjs.com/package/@tweaktags/core) · [@tweaktags/browser](https://www.npmjs.com/package/@tweaktags/browser)

## Author

TweakTags is created and maintained by
**[Scarlett A. Scott (@scarlettiron)](https://github.com/scarlettiron)**, and published as the
[@tweaktags](https://www.npmjs.com/org/tweaktags) packages on npm.

## License

MIT
