# @tweaktags/server

The framework agnostic Node backend for TweakTags. Mount it on any route, or run it standalone.

Part of **[TweakTags](https://github.com/scarlettiron/tweaktags)**, a lightweight edit in place content layer for React, Next,
and plain HTML sites. Mark any element with a `data-tweaktags-*` attribute, and signed in editors
change its text, rich text, or media right on the live page. Everyone else just sees the saved content.

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

## License

MIT
