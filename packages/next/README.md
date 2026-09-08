# @tweaktags/next

A self-hosted inline CMS and visual content editor for Next.js.

Add a CMS to a Next.js site you already have, without rebuilding it around one. Signed in editors change text, rich text, and images directly on the live page. Works with the App Router and the Pages Router, and ships the route handler and the React bindings in one package.

Built and maintained by [Scarlett A. Scott (@scarlettiron)](https://github.com/scarlettiron).

**Full documentation and guides:** https://scarlettiron.github.io/tweaktags/

## Install

```sh
npm install @tweaktags/next
```
Postgres and JWT auth are built in, so nothing else is needed for the default setup. For a different
database install its adapter (see [Databases](#databases) below).

## Step by step

### 1. Create `tweaktags.config.ts` in your project root

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

Set `DATABASE_URL` and `TWEAKTAGS_JWT_SECRET` in your environment (`.env.local`). The secret should
be a long random string.

### 2. Create the tables and your first admin

Point the CLI at the same config to create the tables and your first admin. Run these from your
project root:

```sh
npx tweaktags migrate
npx tweaktags create-superuser --email you@example.com --password "a-strong-password"
```

### 3. Mount the backend

Create `app/api/tweaktags/route.ts`:

```ts
import { createTweakTagsRouteHandler } from '@tweaktags/next';
import config from '../../../tweaktags.config';

const { POST } = createTweakTagsRouteHandler(config);

export const runtime = 'nodejs';
export { POST };
```

On the Pages Router, use `createTweakTagsPagesApiRoute(config)` in `pages/api/tweaktags/[...tweaktags].ts` instead.

### 4. Add the provider and edit bar

Wrap your app once, usually in `app/layout.tsx`:

```tsx
import { TweakTagsProvider, TweakTagsEditBar } from '@tweaktags/next';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TweakTagsProvider apiBasePath="/api/tweaktags">
          {children}
          <TweakTagsEditBar />
        </TweakTagsProvider>
      </body>
    </html>
  );
}
```

### 5. Mark content as editable

Give any element a `data-tweaktags-<name>` attribute. The name becomes the tag you edit on the page:

```tsx
<h1 data-tweaktags-hero-title>Welcome to my site</h1>
<p data-tweaktags-hero-subtitle>The default text lives right here</p>
```

The text between the tags is the default. Once an editor saves a change, the saved content shows to
everyone instead.

Open your site, click **Sign in** in the edit bar, and start editing. That is the whole loop.

## Databases

Postgres works out of the box. For another database, install its adapter and change the `database`
block in your config:

| Database | Install | `provider` |
| --- | --- | --- |
| Postgres | built in | `postgres` |
| MySQL | `npm i @tweaktags/db-mysql` | `mysql` |
| MariaDB | `npm i @tweaktags/db-mariadb` | `mariadb` |
| SQLite | `npm i @tweaktags/db-sqlite` | `sqlite` |

## Media uploads (optional)

To let editors upload images instead of pasting a url, install `@tweaktags/storage-s3`, add a
`storage` block to your config, and pass `mediaUpload` to the provider. See the
[@tweaktags/storage-s3](https://github.com/scarlettiron/tweaktags/tree/main/packages/storage-s3) readme.

## White label (on by default)

`whiteLabel` is on out of the box, so no TweakTags branding shows anywhere in the UI, including the
admin panel, and the editor carries only your own name. Nothing to set up.

To show the TweakTags name instead, turn it off in both places, the config and the provider:

```ts
// tweaktags.config.ts
export default defineConfig({
  whiteLabel: false,
  // ...the rest of your config
});
```

```tsx
<TweakTagsProvider apiBasePath="/api/tweaktags" whiteLabel={false}>
  {children}
</TweakTagsProvider>
```

## Links

- **Documentation and guides:** https://scarlettiron.github.io/tweaktags/
- **Every config setting:** [config type reference](https://github.com/scarlettiron/tweaktags/blob/main/packages/core/src/types/index.ts)
- **Source and issues:** [github.com/scarlettiron/tweaktags](https://github.com/scarlettiron/tweaktags)
- **React bindings:** re-exported here, documented in [@tweaktags/react](https://github.com/scarlettiron/tweaktags/tree/main/packages/react)

## Logging and failures

When something goes wrong on the server, TweakTags writes one line about it and hands the caller a
trace id. There is nothing to set up: with no `logger` in your config, entries go to the console
your server already has.

```
[tweaktags] ERROR request.failed trace=mtqj54hvf4av7g action=listTags status=500 code=internal_error
  connect ECONNREFUSED 127.0.0.1:5432
  { hint: 'Nothing answered at the database host and port...', error: { code: 'ECONNREFUSED', stack: '...' } }
```

The browser gets the same trace id back, so a report that saving failed can be matched to the line
that explains it. For the failures a self hosted install actually hits, the entry carries a hint in
plain language: a database asked for SSL that it does not support or one that requires it, nothing
listening at the host and port, rejected credentials, a missing database, or tables that were never
migrated.

To send entries somewhere else, set `logger` in your config:

```ts
export default defineConfig({
  logger: (entry) => myLogger[entry.level](entry.message, entry),
  // ...the rest of your config
});
```

In production the internal message stays on the server and the response carries only the trace id,
so database details never reach a visitor. In development the message comes back too.

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
- **UI for your stack:** **@tweaktags/next** (this package) · [@tweaktags/react](https://www.npmjs.com/package/@tweaktags/react) · [@tweaktags/vanillajs](https://www.npmjs.com/package/@tweaktags/vanillajs)
- **Backend:** [@tweaktags/server](https://www.npmjs.com/package/@tweaktags/server) · [@tweaktags/auth-jwt](https://www.npmjs.com/package/@tweaktags/auth-jwt) · [@tweaktags/auth-aws-cognito](https://www.npmjs.com/package/@tweaktags/auth-aws-cognito) · [@tweaktags/cli](https://www.npmjs.com/package/@tweaktags/cli)
- **Databases:** [@tweaktags/db-postgres](https://www.npmjs.com/package/@tweaktags/db-postgres) · [@tweaktags/db-mysql](https://www.npmjs.com/package/@tweaktags/db-mysql) · [@tweaktags/db-mariadb](https://www.npmjs.com/package/@tweaktags/db-mariadb) · [@tweaktags/db-sqlite](https://www.npmjs.com/package/@tweaktags/db-sqlite)
- **Media uploads:** [@tweaktags/storage-s3](https://www.npmjs.com/package/@tweaktags/storage-s3)
- **Internals:** [@tweaktags/core](https://www.npmjs.com/package/@tweaktags/core) · [@tweaktags/browser](https://www.npmjs.com/package/@tweaktags/browser)

## Author

TweakTags is created and maintained by
**[Scarlett A. Scott (@scarlettiron)](https://github.com/scarlettiron)**, and published as the
[@tweaktags](https://www.npmjs.com/org/tweaktags) packages on npm.

## License

MIT
