# @tweaktags/browser

The framework agnostic browser engine that powers TweakTags editing.

Built and maintained by [Scarlett A. Scott (@scarlettiron)](https://github.com/scarlettiron).

Part of **[TweakTags](https://github.com/scarlettiron/tweaktags)**, a lightweight edit in place content layer for React, Next,
and plain HTML sites. Mark any element with a `data-tweaktags-*` attribute, and signed in editors
change its text, rich text, or media right on the live page. Everyone else just sees the saved content.

**Full documentation and guides:** https://scarlettiron.github.io/tweaktags/

## Install

```sh
npm install @tweaktags/browser
```
You rarely install this directly. [@tweaktags/react](https://github.com/scarlettiron/tweaktags/tree/main/packages/react) and
[@tweaktags/vanillajs](https://github.com/scarlettiron/tweaktags/tree/main/packages/vanillajs) sit on top of it and give you a
ready made UI. Reach for the engine only when building your own editing interface.

## What it does

The engine scans the page for `data-tweaktags-*` attributes, loads saved content from your backend,
shows it to every visitor, and runs the in place editing and session for signed in editors.

```ts
import { createTweakTagsEngine } from '@tweaktags/browser';

const engine = createTweakTagsEngine({ apiBasePath: '/api/tweaktags' });
engine.start();
```

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
- **Documentation:** [Overview](https://scarlettiron.github.io/tweaktags/#overview) on the docs site
- **UI for your stack:** [@tweaktags/next](https://www.npmjs.com/package/@tweaktags/next) · [@tweaktags/react](https://www.npmjs.com/package/@tweaktags/react) · [@tweaktags/vanillajs](https://www.npmjs.com/package/@tweaktags/vanillajs)
- **Backend:** [@tweaktags/server](https://www.npmjs.com/package/@tweaktags/server) · [@tweaktags/auth-jwt](https://www.npmjs.com/package/@tweaktags/auth-jwt) · [@tweaktags/cli](https://www.npmjs.com/package/@tweaktags/cli)
- **Databases:** [@tweaktags/db-postgres](https://www.npmjs.com/package/@tweaktags/db-postgres) · [@tweaktags/db-mysql](https://www.npmjs.com/package/@tweaktags/db-mysql) · [@tweaktags/db-mariadb](https://www.npmjs.com/package/@tweaktags/db-mariadb) · [@tweaktags/db-sqlite](https://www.npmjs.com/package/@tweaktags/db-sqlite)
- **Media uploads:** [@tweaktags/storage-s3](https://www.npmjs.com/package/@tweaktags/storage-s3)
- **Internals:** [@tweaktags/core](https://www.npmjs.com/package/@tweaktags/core) · **@tweaktags/browser** (this package)

## Author

TweakTags is created and maintained by
**[Scarlett A. Scott (@scarlettiron)](https://github.com/scarlettiron)**, and published as the
[@tweaktags](https://www.npmjs.com/org/tweaktags) packages on npm.

## License

MIT
