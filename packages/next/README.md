# @tweaktags/next

The Next.js route handler plus the React bindings, in one package. The fastest way to add TweakTags to a Next app.

Part of **[TweakTags](https://github.com/scarlettiron/tweaktags)**, a lightweight edit in place content layer for React, Next,
and plain HTML sites. Mark any element with a `data-tweaktags-*` attribute, and signed in editors
change its text, rich text, or media right on the live page. Everyone else just sees the saved content.

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

## White label (optional)

Turn on `whiteLabel` to remove every bit of TweakTags branding from the UI, including the admin
panel, so the editor carries only your own name. Set it in both places, the config and the provider:

```ts
// tweaktags.config.ts
export default defineConfig({
  whiteLabel: true,
  // ...the rest of your config
});
```

```tsx
<TweakTagsProvider apiBasePath="/api/tweaktags" whiteLabel>
  {children}
</TweakTagsProvider>
```

## Links

- **Documentation and guides:** https://scarlettiron.github.io/tweaktags/
- **Every config setting:** [config type reference](https://github.com/scarlettiron/tweaktags/blob/main/packages/core/src/types/index.ts)
- **Source and issues:** [github.com/scarlettiron/tweaktags](https://github.com/scarlettiron/tweaktags)
- **React bindings:** re-exported here, documented in [@tweaktags/react](https://github.com/scarlettiron/tweaktags/tree/main/packages/react)

## License

MIT
