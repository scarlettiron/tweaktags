# TweakTags

**Documentation website: [scarlettiron.github.io/tweaktags](https://scarlettiron.github.io/tweaktags/)**

TweakTags is a lightweight way to make the text and images on your website editable, right on the
page, without a separate admin dashboard. You mark the parts you want to edit, sign in, flip on
edit mode, change the content in place, and it saves to your database.

This guide walks you through setting it up in a Next.js app, step by step. If you have never done
this kind of thing before, that is fine. Follow each step in order and copy the code exactly.

## Table of contents

1. [How it works in plain words](#how-it-works-in-plain-words)
2. [Client side and server side](#client-side-and-server-side)
3. [Before you start](#before-you-start)
4. [Step 1, install TweakTags](#step-1-install-tweaktags)
5. [Step 2, get a database](#step-2-get-a-database)
6. [Step 3, add your secrets](#step-3-add-your-secrets)
7. [Step 4, create the config file](#step-4-create-the-config-file)
8. [Step 5, add the backend route](#step-5-add-the-backend-route)
9. [Step 6, create the database tables](#step-6-create-the-database-tables)
10. [Step 7, create your login](#step-7-create-your-login)
11. [Step 8, wrap your app](#step-8-wrap-your-app)
12. [Step 9, mark content as editable](#step-9-mark-content-as-editable)
13. [Step 10, run it and edit](#step-10-run-it-and-edit)
14. [Creating and managing tags](#creating-and-managing-tags)
15. [Tag naming rules](#tag-naming-rules)
16. [Settings reference](#settings-reference)
17. [Command reference](#command-reference)
18. [Troubleshooting](#troubleshooting)
19. [App Router or Pages Router](#app-router-or-pages-router)
20. [Using TweakTags without Next](#using-tweaktags-without-next)
21. [Packages](#packages)

## How it works in plain words

- A **tag** is a name for one managed spot on your site, like `hero-title` or `footer-note`.
- You put a tag on an HTML element using an attribute named `data-tweaktags-{tag}`. For a tag called
  `hero-title` the attribute is `data-tweaktags-hero-title`.
- When a page loads, TweakTags **crawls it for every `data-tweaktags-` attribute**, loads the saved
  content from your database, and shows it to **all visitors**. For text elements it fills in the
  text. For a **media** tag it uses the saved url: on an `<img>` (or anything with a `src`, like a
  `<video>`) it sets the source, and on a container like a `<div>` it sets the url as a cover
  background image.
- It keeps watching the page, so content on pages you navigate to, and anything added later, is
  filled in automatically. You do not have to do anything special for routing.
- When a **superuser** or **editor** signs in and turns on edit mode, those same spots become
  editable in place. You change as many as you like, then click **Save** to store them all. A
  popup confirms the result.
- The `<Editable>` component is **optional**. The attribute alone is all TweakTags needs, whether it
  is on plain HTML or produced by the component.
- There are two kinds of users. A **superuser** can create new tags and edit everything. An
  **editor** can only change tags that already exist.

## Client side and server side

TweakTags has two halves. Knowing which half a file belongs to tells you where it runs and why your
secrets stay safe. The browser never touches your database and never sees your secrets.

**Server side.** This runs in Node, on your machine while developing or on your host in
production. It can reach the database and it holds your secrets.

- Files: your `tweaktags.config.ts`, your `.env.local` secrets, and the backend route at
  `app/api/tweaktags/route.ts`.
- Packages: `@tweaktags/server` (the handler), `@tweaktags/db-postgres` (the database), `@tweaktags/auth-jwt`
  (login and tokens), and `@tweaktags/cli` (the terminal command).

**Client side.** This runs in the browser, on the page your visitors see. It has no database
access and no secrets.

- Files: your pages and layout, the `data-tweaktags-` attributes, the provider, and the edit bar.
- Package: `@tweaktags/react` (the provider, the page scanner, the `<Editable>` component, the hooks).

**Both sides.**

- `@tweaktags/core` holds shared types and the request handling rules. The types are used on both
  sides. The handler itself only runs on the server.
- `@tweaktags/next` is a convenience bundle. The route handler it gives you is server side, and the
  React pieces it re-exports are client side. You import from one package, but each piece still
  runs on its proper side.

**The things the client asks the server to do are called actions.** They are: sign in, sign out,
check who is signed in, read content, create a tag, and save content. The client never does these
itself, it asks the server, and the server decides who is allowed to do each one.

**How a save travels, end to end.**

1. In the browser you edit a spot and click away. (client)
2. The client sends the new text as a save action to the backend route at `/api/tweaktags`. (client
   to server)
3. The route checks your login and your role, then writes to the database. (server)
4. The route sends the saved content back, and the page shows it. (server to client)

This is why the browser never needs your database password. Only the server side ever has it.

## Before you start

You need these things ready first.

- **Node.js version 16 or newer.** Check your version by running `node --version` in a terminal.
- **A Next.js app** to add TweakTags to. If you do not have one yet, create one with
  `npx create-next-app@latest` and choose the App Router and TypeScript when it asks.
- **A Postgres database.** Step 2 shows the easiest way to get one if you do not have one.
- **A terminal** open in the root folder of your Next.js app. The root folder is the one that
  has your `package.json` file in it.

## Step 1, install TweakTags

In your terminal, in the root of your Next.js app, run one of these depending on which package
manager you use.

Using npm:

```sh
npm install @tweaktags/next @tweaktags/core @tweaktags/cli
```

Using pnpm:

```sh
pnpm add @tweaktags/next @tweaktags/core @tweaktags/cli
```

Using yarn:

```sh
yarn add @tweaktags/next @tweaktags/core @tweaktags/cli
```

What these are:

- `@tweaktags/next` is the main package for Next.js. It includes the backend handler and the React
  pieces you put on the page.
- `@tweaktags/core` gives you a small helper for writing your config file.
- `@tweaktags/cli` gives you the `tweaktags` command you use to set up the database.

## Step 2, get a database

TweakTags stores your editable content in Postgres. If you already have a Postgres database, skip to
the next step and use its connection details.

The quickest way to get one on your own machine is Docker. If you have Docker installed, run this
single command. It starts a database named `tweaktags` with the username and password both set to
`tweaktags`.

```sh
docker run --name tweaktags-pg -e POSTGRES_USER=tweaktags -e POSTGRES_PASSWORD=tweaktags \
  -e POSTGRES_DB=tweaktags -p 5432:5432 -d postgres:16
```

Your connection string for this database is:

```
postgres://tweaktags:tweaktags@localhost:5432/tweaktags
```

A connection string is just one line that holds the username, password, address, and database
name all together. If you use a hosted database from a provider, they will give you a connection
string that looks similar.

## Step 3, add your secrets

Secrets are values you do not want to write directly in your code, like your database password.
Next.js reads them from a file named `.env.local` in the root of your app.

Create a file named `.env.local` and put these two lines in it. Change the database line if your
database is different, and change the secret to a long random string of your own.

```
DATABASE_URL=postgres://tweaktags:tweaktags@localhost:5432/tweaktags
TWEAKTAGS_JWT_SECRET=replace-this-with-a-long-random-secret-string
```

The `TWEAKTAGS_JWT_SECRET` is used to keep logins secure. It must be at least 16 characters. A good
way to make a random one is to run this command and paste the result:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Make sure `.env.local` is listed in your `.gitignore` file so your secrets are never committed.
Next.js apps already ignore it by default.

## Step 4, create the config file

_This is server side. It holds your database details and secret, and is never sent to the
browser._

This one file tells TweakTags how to reach your database and how logins work. Create a file named
`tweaktags.config.ts` in the root of your app with exactly this content.

```ts
import { defineConfig } from '@tweaktags/core';

export default defineConfig({
  //Turn the edit in place feature on.
  editInView: true,

  //Where the backend route lives. Keep this as is unless you change Step 5.
  apiBasePath: '/api/tweaktags',

  //Your database. The connection string is read from your .env.local file.
  database: {
    provider: 'postgres',
    connectionString: process.env.DATABASE_URL,
  },

  //Login settings. The secret is read from your .env.local file.
  auth: {
    provider: 'jwt',
    jwtSecret: process.env.TWEAKTAGS_JWT_SECRET ?? '',
  },
});
```

## Step 5, add the backend route

_This is server side. It is the only part that talks to your database._

The browser cannot talk to your database directly, that would not be safe. Instead it talks to a
small backend route, and the route talks to the database. Next.js calls these route handlers.

Create a file at this exact path: `app/api/tweaktags/route.ts`. Put this in it.

```ts
import { createTweakTagsRouteHandler } from '@tweaktags/next';

import tweaktagsConfig from '../../../tweaktags.config';

//This builds the backend handler from your config file.
const { POST } = createTweakTagsRouteHandler(tweaktagsConfig);

//TweakTags needs the Node runtime because it connects to Postgres.
export const runtime = 'nodejs';

export { POST };
```

## Step 6, create the database tables

_This runs in your terminal, on the server side, and reaches the database directly._

TweakTags needs a couple of tables in your database to store content and users. The cli creates them
for you. Run this in your terminal from the root of your app.

```sh
npx tweaktags migrate
```

You should see a message that says the migrations are up to date. The cli reads your database
details from the same `.env.local` file, so there is nothing else to set up. If you get an error
here, see [Troubleshooting](#troubleshooting).

## Step 7, create your login

_This runs in your terminal, on the server side._

Now create your first user. Make this one a superuser so you can create tags. Replace the email
and password with your own.

```sh
npx tweaktags create-superuser --email you@example.com --password choose-a-strong-password
```

You will use this email and password to sign in on the page in a moment.

To add a regular editor later, who can change existing content but cannot create, retype, or delete
tags, use `create-user` instead:

```sh
npx tweaktags create-user --email editor@example.com --password choose-a-strong-password
```

## Step 8, wrap your app

_This is client side. It runs in the browser._

TweakTags needs to wrap your app so it can load content and manage edit mode. Open your root layout
file at `app/layout.tsx` and wrap your content with the provider, and add the edit bar.

```tsx
import type { ReactNode } from 'react';

import { TweakTagsProvider, TweakTagsEditBar } from '@tweaktags/next';

export default function RootLayout({ children }: { children: ReactNode }) {
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

The `TweakTagsEditBar` is a small bar in the corner of the page where you sign in and turn edit mode
on and off. You can remove it later and build your own controls, but it is the easy way to start.

**Three ways to edit.** TweakTags gives you three editing styles, so you can pick the one that fits
your site.

1. **Edit in place (default).** Editing happens right on the page, where you click a spot and type.
   This is on by default.

2. **Popup form.** Pass `editInView={false}` to the provider to edit through a form instead:

   ```tsx
   <TweakTagsProvider apiBasePath="/api/tweaktags" editInView={false}>
   ```

   Clicking **Edit page** opens a full screen, scrollable popup that lists every tag with its own
   labeled inputs, prefilled with the saved content. You change what you want and click **Save**. A
   loading spinner shows while the content is fetched. This is handy when the editable spots are
   hard to click on the page, or when you want to edit many tags at once.

3. **Full page admin panel.** For a traditional admin panel on its own page, render
   `TweakTagsAdminPanel` on a dedicated route instead of the `TweakTagsEditBar`. See
   [Full page admin panel](#full-page-admin-panel) below.

**Reacting to edit mode in your own code.** If you want your own components to know when someone is
editing, read it from the context. The `useIsEditing` hook returns a single boolean that is true
only while edit mode is on:

```tsx
import { useIsEditing } from '@tweaktags/react';

function Banner() {
  const isEditing = useIsEditing();

  return isEditing ? <div>You are editing this page</div> : null;
}
```

The full context is also available through `useTweakTags()`, which includes `isEditing`, `canEdit`,
the current `user`, and the actions.

### Full page admin panel

If you would rather manage your content from a traditional admin panel, instead of on top of your
live site, render `TweakTagsAdminPanel` on its own route. It is a full page view that does not need
the `TweakTagsEditBar`. Give it a route your visitors will not stumble onto, like `/admin`, and wrap
it in the same `TweakTagsProvider`.

For the Next.js app router, create `app/admin/page.tsx`:

```tsx
'use client';

import { TweakTagsProvider, TweakTagsAdminPanel } from '@tweaktags/next';

export default function AdminPage() {
  return (
    <TweakTagsProvider apiBasePath="/api/tweaktags" richText>
      <TweakTagsAdminPanel />
    </TweakTagsProvider>
  );
}
```

Here is what you get:

- **A full page login.** When nobody is signed in, the whole page is a sign in form. There is no
  floating bar and nothing from your site behind it.
- **Navigation tabs.** Once signed in, a top bar shows your email and a sign out button, with tabs
  to switch between **View tags**, **Create tag**, and **Edit tags**. The Create tab only shows for
  superusers, since only they can create tags.
- **View tags.** A read only list of every tag with a short preview of its content. It has a search
  box and pages ten tags at a time.
- **Create tag.** A form to add a new tag, with a type dropdown when `richText` is on.
- **Edit tags.** A searchable list, again ten per page, where each tag opens an inline editor
  prefilled with its saved content. Superusers can also change a tag's type or delete it here.

This mode works well when your editors want a dashboard to work from, rather than editing on the
page itself. You can use it on its own, or alongside the in place editor on your main site.

## Step 9, mark content as editable

_This is client side. These are the elements in your pages._

Pick the spots on your site you want TweakTags to manage and give each one a tag. You do this by
adding a `data-tweaktags-{tag}` attribute to any normal HTML element. That is all that is needed.
TweakTags will show the saved content there to everyone, and make it editable for signed in editors.

```tsx
export default function HomePage() {
  return (
    <main>
      <h1 data-tweaktags-hero-title>Welcome to my site</h1>
      <p data-tweaktags-hero-body>This text can be edited right on the page.</p>

      {/* On an image, a media tag sets the src from the saved url. */}
      <img data-tweaktags-hero-image src="/placeholder.png" alt="Hero" />

      {/* On a container, a media tag sets the url as a cover background image.
          Give it a size, since a background image has none on its own. */}
      <div data-tweaktags-hero-banner style={{ height: 320 }} />
    </main>
  );
}
```

**Image and media tags.** A tag whose type is **media** holds an image url instead of text. Put the
attribute on whatever element should show the image:

- On an `<img>` (or anything with a `src`, like a `<video>`), TweakTags sets the `src`.
- On a container like a `<div>`, it sets the url as a **cover background image**. Give that element
  a height or aspect ratio in your own CSS, since a background image does not size the element.

To set a media tag's image, an editor either **pastes an image url** or, if you have turned on
[media uploads](#media-uploads), clicks **Upload a file**. Either way it ends up as the saved url.
Media tags are edited through the Tags panel, the popup editor, or the admin panel, not by typing on
the page. Tag types (plain, rich, media) need `richText` turned on, so add `richText` to your
provider to create media tags.

A few things worth knowing:

- **The content inside the element is the fallback.** It shows until something is saved for that
  tag. Once content is saved, TweakTags shows the saved content to every visitor.
- **You do not need a component.** Plain HTML with the attribute is the main way to use TweakTags.
- **It works on pages you navigate to.** Because TweakTags watches the page, tags on other routes are
  filled in automatically as you move around the site.

If you would rather write a component than a raw attribute, the optional `<Editable>` component
produces the same attribute for you:

```tsx
import { Editable } from '@tweaktags/next';

export default function HomePage() {
  return (
    <main>
      <h1>
        <Editable tag="hero-title">Welcome to my site</Editable>
      </h1>
    </main>
  );
}
```

Both ways behave the same. Use whichever you like, or mix them.

## Step 10, run it and edit

Start your app the normal way.

```sh
npm run dev
```

Open your site in the browser. Then:

1. Find the dark bar in the bottom corner of the page.
2. Sign in with the email and password you made in Step 7.
3. Click **Edit page**. Your editable spots get a dashed outline.
4. Click into one or more spots and change the text.
5. Click **Save**. It asks you to confirm, saves every change at once, and shows a popup with the
   result.
6. Reload the page. Your changes are still there because they were saved to the database.

Two buttons control editing while it is on:

- **Save** stores all your changes. It asks you to confirm first.
- **Close** leaves edit mode. If you have changes you have not saved, it warns you first so you do
  not lose them by accident.

There is also a **?** button in the bar. Click it any time for a short in page help popup with
tips on finding editable spots, saving, closing, and, for a superuser, creating and deleting tags.
Close the popup with its **X** or by pressing the **?** again.

That is the whole loop. You are now editing your static site in place.

## Creating and managing tags

Only a superuser can create tags. An editor can only change tags that already exist. There are two
ways for a superuser to create one.

**By editing (the simple way).** When you are signed in as a superuser and you edit a
`data-tweaktags-` spot that has never been saved before, that first save creates the tag in the
database. After that, editors can change it too. So for most cases you do not need to do anything
special, just edit and save.

**With the Tags panel.** When you sign in as a superuser, the edit bar shows a **Tags** button.
Click it to open a panel where you can:

- Create a tag by name, with an optional starting text.
- See the list of tags that already exist.
- Delete a tag. A confirm popup asks you first, because deleting a tag removes its saved content
  and cannot be undone.

This is useful when you want to set up a tag ahead of time so an editor can fill it in later. Keep
in mind a tag only appears on a page where an element actually has that `data-tweaktags-{tag}`
attribute, so creating a tag here does not put anything on a page by itself. It just registers the
tag so it exists and can be edited.

Only a superuser can create or delete tags. After you delete a tag, any element that still has its
attribute goes back to showing its fallback text the next time the page loads.

## Tag naming rules

Because the tag becomes part of an HTML attribute name, tag names can only use:

- lowercase letters
- numbers
- hyphens between words

So `hero-title` and `section-2` are fine. `HeroTitle`, `hero title`, and `hero_title` are not.

## Databases

TweakTags supports Postgres, MySQL, MariaDB, and SQLite. Postgres comes built in. For the others,
install the matching adapter package so you only pull in the driver you actually use.

| Database        | Install                          | Example config                                                        |
| --------------- | -------------------------------- | --------------------------------------------------------------------- |
| Postgres        | nothing extra                    | `{ provider: 'postgres', connectionString: process.env.DATABASE_URL }` |
| MySQL           | `npm install @tweaktags/db-mysql`   | `{ provider: 'mysql', connectionString: process.env.DATABASE_URL }`    |
| MariaDB         | `npm install @tweaktags/db-mariadb` | `{ provider: 'mariadb', connectionString: process.env.DATABASE_URL }`  |
| SQLite          | `npm install @tweaktags/db-sqlite`  | `{ provider: 'sqlite', filename: './tweaktags.db' }`                      |

MariaDB uses the MySQL protocol, so `@tweaktags/db-mariadb` is a thin package that just installs and
re-exports `@tweaktags/db-mysql` for you. You can install either one for MariaDB, but the MariaDB
named package saves you the confusion of installing something called MySQL. SQLite stores
everything in a single file, which is handy for small sites and local development. The
`tweaktags migrate` and `tweaktags create-superuser` commands work the same no matter which one you use.

## Settings reference

These are the settings you can put in `tweaktags.config.ts`.

| Setting                   | Required | What it does                                                       |
| ------------------------- | -------- | ----------------------------------------------------------------- |
| `database.provider`       | yes      | The database type: `'postgres'`, `'mysql'`, `'mariadb'`, or `'sqlite'`. |
| `database.connectionString` | yes if no host | The one line connection string, for the server databases.  |
| `database.host` and `database.database` | yes if no string | The separate parts, if you do not use a connection string. |
| `database.filename`       | sqlite only | The path to the sqlite database file.                          |
| `auth.provider`           | yes      | The login type. Use `'jwt'`.                                      |
| `auth.jwtSecret`          | yes      | A secret string of at least 16 characters that secures logins.   |
| `auth.accessTtlSeconds`   | no       | How long the short access token lasts. Defaults to 15 minutes.   |
| `auth.refreshTtlSeconds`  | no       | How long the refresh token lasts. Defaults to 7 days. When it expires the user is signed out. |
| `auth.strictRevocation`   | no       | When true, every request checks the session is still active, so logout revokes access at once. Costs one database read per request. Defaults to false. |
| `auth.tokenStorage`       | no       | `'cookie'` (default, a secure httpOnly cookie) or `'header'` (token in the browser, for a separate origin app). |
| `auth.cookieSecure`       | no       | Whether cookies are marked Secure (https only). Defaults to true. Set false for local http dev. |
| `auth.cookieSameSite`     | no       | `'lax'` (default), `'strict'`, or `'none'`. Use `'none'` with a separate origin app. |
| `auth.csrfProtection`     | no       | Turns the csrf check on or off. Defaults to true. Set false only if it causes problems and you understand the risk. |
| `editInView`              | no       | Turns the edit in place feature on. Defaults to off.             |
| `apiBasePath`             | no       | Where the backend route lives. Defaults to `/api/tweaktags`.        |
| `mode`                    | no       | `'embedded'` for adding to an existing site. This is the default. |
| `cors.origins`            | no       | Allowed origins when the server runs separately. A list of urls, or `'*'`. |
| `tenant`                  | no       | The site this server's tags belong to, for sharing one database across many sites. Defaults to `'default'`. See [Multi-tenant](#multi-tenant-one-database-many-sites). |
| `resolveTenant`           | no       | A function `({ host }) => string` to pick the tenant per request, for one server that serves many domains. |
| `storage`                 | no       | Where media uploads go. Leave it out to only allow pasted media urls. See [Media uploads](#media-uploads). |

## Multi-tenant, one database, many sites

You can run several sites from a single TweakTags database. Each site is a **tenant**. A tag belongs
to a tenant, so a site only ever sees and edits its own tags, even though they share one database
and one set of users.

The important part: **the tenant is decided by the server, never by the browser.** A visitor cannot
choose or fake a tenant, so a site can only ever touch its own content.

**The common case, one config per site.** If each site has its own deployment, give each one a
`tenant` in its config:

```ts
//drystrip's tweaktags.config.ts
export default defineConfig({
  tenant: 'drystrip',
  database: { provider: 'postgres', connectionString: process.env.DATABASE_URL }, //shared
  auth: { provider: 'jwt', jwtSecret: process.env.TWEAKTAGS_JWT_SECRET },
});
```

Now `hero-title` on the drystrip site is a different tag from `hero-title` on another site, and an
editor signed in on drystrip can only create and change drystrip's tags.

**One server, many domains.** If a single deployment serves several domains, use `resolveTenant` to
map the request to a tenant instead:

```ts
export default defineConfig({
  resolveTenant: ({ host }) => (host?.endsWith('drystrip.com') ? 'drystrip' : 'default'),
  database: { provider: 'postgres', connectionString: process.env.DATABASE_URL },
  auth: { provider: 'jwt', jwtSecret: process.env.TWEAKTAGS_JWT_SECRET },
});
```

Notes:
- Users are **shared** across tenants. A superuser signs in on any site and manages that site's tags.
- Nothing changes on the client. Your pages, the provider, and the vanilla build are the same.
- Existing single site installs keep working: with no `tenant` set, everything is the `'default'`
  tenant, and the migration backfills old rows to `'default'`.
- The CLI works within your config's tenant. Use `npx tweaktags list-tags --tenant other` to inspect
  another tenant in the shared database.

## Media uploads

A media tag holds an image url. By default you paste that url in. If you would rather upload files,
point TweakTags at an S3 bucket (or any S3 compatible store) and editors get an **Upload a file**
button next to the url box. You choose: paste a url, or upload.

The nice part is TweakTags never handles the file bytes. The server hands the browser a short lived
presigned url, and the file goes **straight from the browser to your bucket**. TweakTags only signs.

**1. Install the storage adapter** in your app:

```sh
npm install @tweaktags/storage-s3
```

**2. Add a `storage` block to your config.** Keep the keys in your environment, like your other
secrets.

```ts
export default defineConfig({
  database: { provider: 'postgres', connectionString: process.env.DATABASE_URL },
  auth: { provider: 'jwt', jwtSecret: process.env.TWEAKTAGS_JWT_SECRET },
  storage: {
    provider: 's3',
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    //Optional, for Cloudflare R2, DigitalOcean Spaces, Backblaze B2, MinIO:
    endpoint: process.env.S3_ENDPOINT,
    //Optional, a cdn or custom domain in front of the bucket:
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
  },
});
```

The same adapter works for **Amazon S3, Cloudflare R2, DigitalOcean Spaces, Backblaze B2, and
MinIO**. Set `endpoint` for anything other than AWS.

**3. Turn on the button on the client** by adding `mediaUpload` where you set up the provider:

```tsx
<TweakTagsProvider apiBasePath="/api/tweaktags" richText mediaUpload>
```

For the vanilla build, pass it to `init`: `TweakTags.init({ apiBasePath: '/api/tweaktags', mediaUpload: true })`.

Two things to set on the bucket, both one time:

- **CORS**: allow a `PUT` from your site's origin, since the browser uploads directly. In S3, add a
  CORS rule permitting the `PUT` method from your domain.
- **Public read**: uploaded files must be readable at their url, so either make the bucket or the
  key prefix public, or put a cdn in front and set `publicBaseUrl`.

Uploads are namespaced by tenant, so in a multi-tenant setup each site's uploads stay separate. If
you skip storage entirely, media still works, you just paste urls.

## Sessions and security

TweakTags uses two tokens. A short lived **access token** authenticates each request, and a longer
lived **refresh token** quietly gets a new access token when it expires. When the refresh token
itself expires, the user is signed out and simply logs back in. Both lifetimes are set with
`auth.accessTtlSeconds` and `auth.refreshTtlSeconds`.

### Token blocking and revocation, step by step

This is how TweakTags stops old or stolen tokens from being used.

1. **On login**, the server starts a token family. It signs an access token and a refresh token,
   and saves a row for the refresh token in the `__TweakTags__Refresh_Tokens` table with a family id
   and `revoked = false`.
2. **On a normal request**, the server verifies the access token by its signature and expiry. This
   is fast and needs no database read.
3. **When the access token expires**, the client sends the refresh token. The server checks the
   saved row, then **rotates**: it marks the old refresh token used, issues a brand new access and
   refresh token, and saves a new row in the same family.
4. **If an old, already used refresh token is sent again**, that is a strong sign it was stolen.
   The server **revokes the whole family**, which blocks every token from that login. The real
   user just signs in again.
5. **On logout**, the server revokes the family too, so the refresh token can never be used again.

By default, access tokens are stateless, so a token that was revoked keeps working until it expires
on its own, which is at most `auth.accessTtlSeconds` (15 minutes by default). If you need a logout
or a revoked session to block access **right away**, set `auth.strictRevocation: true`. Then every
request also checks that the session's family is still active, at the cost of one database read per
request. This is the strongest setting and the tradeoff is a little speed.

By default the tokens are kept in **secure httpOnly cookies**, which JavaScript on the page cannot
read, so they are protected from cross site scripting. This is the recommended setup and works for
a Next app served on the same origin as its api.

If your frontend and api are on **different origins** (for example a separate React app), you have
two choices:

- Keep cookie mode, set `auth.cookieSameSite: 'none'` with `auth.cookieSecure: true` (https only),
  and list the app origin in `cors.origins`. The browser then sends the cookie across origins.
- Or set `auth.tokenStorage: 'header'` and pass the matching `tokenStorage="header"` prop to the
  provider. The token is then held by the browser and sent as a bearer header. This is simpler for
  local development but less protected against cross site scripting.

### CSRF protection, step by step

Cross site request forgery is when another website tricks a visitor's browser into making a request
to your site using their logged in cookie. TweakTags blocks this with a double submit token.

1. **On login and refresh**, the server sets a second cookie named `tweaktags_csrf` with a random
   value. Unlike the token cookies, this one is **readable** by JavaScript on your own page.
2. **On every action that changes data** (create tag, save content, change a tag type, delete a
   tag, and logout), the TweakTags client reads that cookie and sends the value back in an
   `X-TweakTags-Csrf` header.
3. **The server checks** that the header value matches the cookie value. If they do not match, or
   the header is missing, it rejects the request.
4. **Why this works:** another website cannot read your `tweaktags_csrf` cookie, because browsers only
   let a page read cookies from its own site. So an attacker cannot put the right value in the
   header, and their forged request is rejected. Requiring a custom header also forces the browser
   to ask permission first for cross origin requests, which blocks the simple ones outright.

A few notes:

- **Reads are not affected.** Showing content and signing in do not need the token, so public pages
  and the login form work normally.
- **Header mode does not use this**, because the bearer token is never sent by the browser on its
  own, so there is nothing to forge.
- If you rename the cookie with `auth.csrfCookieName`, pass the same value as the provider's
  `csrfCookieName` prop so the client reads the right cookie.
- If the check ever gets in your way, you can turn it off with `auth.csrfProtection: false`, but it
  is safer to leave it on.

On top of this, the server rejects script tags and obvious database attacks in saved content,
passwords are stored as bcrypt hashes (never plaintext), and every database query is parameterized.

## Command reference

Run these from the root of your app.

| Command                                                       | What it does                          |
| ------------------------------------------------------------ | ------------------------------------- |
| `npx tweaktags migrate`                                         | Creates or updates the database tables. |
| `npx tweaktags create-superuser --email EMAIL --password PASS` | Creates a superuser who can make tags.  |
| `npx tweaktags create-user --email EMAIL --password PASS`      | Creates a regular editor who can only change existing content. |
| `npx tweaktags update-password --email EMAIL --password PASS`  | Sets a new password for an existing user. |
| `npx tweaktags list-tags`                                      | Lists every tag in the database.        |
| `npx tweaktags list-users`                                     | Lists every user and their role.        |
| `npx tweaktags help`                                           | Shows the available commands.          |

## Troubleshooting

**`npx tweaktags migrate` cannot connect to the database.**
Check that your database is running and that `DATABASE_URL` in `.env.local` is correct. If you
used the Docker command in Step 2, make sure the container is still running with `docker ps`.

**The cli says it cannot find a config file.**
Run the command from the root folder of your app, the folder that has `tweaktags.config.ts` in it.

**I signed in but nothing is editable.**
Make sure you clicked **Edit page** in the bar, and that the user you signed in with exists. Also
check that your elements have a `data-tweaktags-` attribute with a valid tag name.

**The secret is too short error.**
`TWEAKTAGS_JWT_SECRET` must be at least 16 characters. Make a longer one with the command in Step 3.

**My content does not save.**
Open your browser developer tools and look at the Network tab while you edit. The request to
`/api/tweaktags` will show the error message from the backend.

**My saved content is not showing to visitors.**
Check that the element's `data-tweaktags-` tag exactly matches the tag you saved, that the
`/api/tweaktags` route is reachable (look for its request in the Network tab), and that the content
was actually saved. Remember the text inside the element is only the fallback until something is
saved for that tag.

## App Router or Pages Router

TweakTags works with both. The client side is identical, only the backend route and the wrapper
file differ.

The main guide above uses the **App Router**. If your app uses the **Pages Router**, change two
things.

**1. The API route.** Instead of `app/api/tweaktags/route.ts`, create `pages/api/tweaktags.ts`:

```ts
import { createTweakTagsPagesApiRoute } from '@tweaktags/next';

import tweaktagsConfig from '../../tweaktags.config';

//TweakTags reads the raw request body, so turn off Next's body parser here.
export const config = {
  api: {
    bodyParser: false,
  },
};

export default createTweakTagsPagesApiRoute(tweaktagsConfig);
```

**2. The wrapper.** Instead of `app/layout.tsx`, wrap your app in `pages/_app.tsx`:

```tsx
import type { AppProps } from 'next/app';

import { TweakTagsProvider, TweakTagsEditBar } from '@tweaktags/next';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <TweakTagsProvider apiBasePath="/api/tweaktags">
      <Component {...pageProps} />
      <TweakTagsEditBar />
    </TweakTagsProvider>
  );
}
```

Everything else, the config file, the `data-tweaktags-{tag}` attributes, the cli commands, and the
edit bar, is exactly the same. The crawler also keeps working as you move between pages in either
router.

## Using TweakTags without Next

You do not have to use Next. A plain React app, like one made with Vite, works too. The client
side is exactly the same. The only difference is that you run the TweakTags backend as its own small
server, and point your app at it.

TweakTags's React support works with **React 16.14 and up**, including 17, 18, and 19. It uses only
basic hooks and does not depend on react-dom, so it fits into old and new React apps alike. React
older than 16.8 is not supported, because TweakTags uses hooks.

For plain React, install these:

```sh
npm install @tweaktags/react @tweaktags/server @tweaktags/core @tweaktags/cli
```

**1. Run a standalone TweakTags server.** Create a file, for example `tweaktags-server.ts`, and start
the server. It reads your `tweaktags.config` just like the Next route did.

```ts
import { startStandaloneServer } from '@tweaktags/server';

import tweaktagsConfig from './tweaktags.config';

startStandaloneServer(tweaktagsConfig, { port: 4000 }).then(() => {
  console.log('TweakTags API running on http://localhost:4000');
});
```

Run it with a TypeScript runner such as `npx tsx tweaktags-server.ts`. Use the same `tweaktags migrate`
and `tweaktags create-superuser` commands as before to set up the database.

**2. Allow your app's origin.** If your React app and this server run on different addresses, for
example the app on `http://localhost:5173` and the server on `http://localhost:4000`, the browser
will block the calls unless you allow them. Add a `cors` section to your `tweaktags.config`:

```ts
cors: {
  origins: ['http://localhost:5173'],
},
```

If they run on the same address, through a dev proxy or a reverse proxy, you do not need `cors`.

**3. Wrap your app and point it at the server.** In your React entry file, wrap your app in the
provider and set `apiBasePath` to the server's url.

```tsx
import { TweakTagsProvider, TweakTagsEditBar } from '@tweaktags/react';

export function Root() {
  return (
    <TweakTagsProvider apiBasePath="http://localhost:4000">
      <App />
      <TweakTagsEditBar />
    </TweakTagsProvider>
  );
}
```

Everything else is the same. Add `data-tweaktags-{tag}` attributes to your HTML, and content is
displayed and made editable exactly as it is in Next.

If you already have your own Node backend, like Express, you can skip the standalone server and
mount `@tweaktags/server`'s handler yourself. `createTweakTagsServer(config).nodeHandler` is a plain
`(req, res)` handler you can attach to any route.

## Types for TypeScript

All of TweakTags's shared types are exported so you can use them in your own code. They come from
`@tweaktags/core`, and are also re-exported from `@tweaktags/react` and `@tweaktags/next` so you can import
them from whichever package you already use.

```ts
import type {
  TagType, // 'plain' | 'rich' | 'media'
  ContentRecord, // a saved tag and its content
  Role, // 'superuser' | 'editor'
  AuthUser,
  TweakTagsUserConfig,
  DatabaseConfig,
} from '@tweaktags/next';

//The enums are exported as values too, for comparisons.
import { TAG_TYPES, ROLES } from '@tweaktags/next';
```

Adapter authors can also import the `DbAdapter` and `AuthAdapter` interfaces from `@tweaktags/core`
to build a new database or auth backend.

## Plain JavaScript, no framework

You do not need React. `@tweaktags/vanillajs` gives you the same edit in place experience, the
draggable and mobile friendly edit bar, the popup editor, and the full admin panel, on any site.
The backend is set up exactly as above, with your `tweaktags.config`, the route, `migrate`, and
`create-superuser`. Only the browser side changes.

With a bundler:

```js
import { init } from '@tweaktags/vanillajs';

init({ apiBasePath: '/api/tweaktags', richText: true });
```

Or with a plain script tag from a CDN, no build step at all. The script is one self contained file
that also injects its own styles, so this is everything you need on the page:

```html
<!-- jsDelivr, pinned to a version -->
<script src="https://cdn.jsdelivr.net/npm/@tweaktags/vanillajs@1.0.0/dist/index.global.js"></script>
<script>
  TweakTags.init({ apiBasePath: '/api/tweaktags' });
</script>
```

unpkg works the same way, and the short form resolves to the script build for you:

```html
<script src="https://unpkg.com/@tweaktags/vanillajs@1.0.0"></script>
<script>
  TweakTags.init({ apiBasePath: '/api/tweaktags', richText: true });
</script>
```

The CDN link is automatic once the package is published to npm, there is nothing to set up. Pin a
version like `@1.0.0` rather than using the latest, so a future release cannot change your site by
surprise. Put the script before `</body>`, or add `defer`, so the page has loaded before it runs.

Then mark content the same way, with `data-tweaktags-{tag}` attributes on your HTML. To recolor
everything, pass a `theme`, and for finer control pass a `css` string. For a full page dashboard
on its own route, use `TweakTags.mountAdmin('#admin', { apiBasePath: '/api/tweaktags' })` instead
of `init`.

## Packages

| Package            | Runs on  | What it does                                                          |
| ------------------ | -------- | -------------------------------------------------------------------- |
| `@tweaktags/core`       | Both     | Shared types, the config helper and loader, the adapter interfaces, and the request handler |
| `@tweaktags/server`     | Server   | A framework agnostic Node backend handler you mount in your own backend |
| `@tweaktags/db-postgres` | Server  | The Postgres database adapter and migrations                        |
| `@tweaktags/db-mysql`   | Server   | The MySQL and MariaDB database adapter and migrations               |
| `@tweaktags/db-mariadb` | Server   | A thin alias that installs and re-exports `@tweaktags/db-mysql` for MariaDB |
| `@tweaktags/db-sqlite`  | Server   | The SQLite database adapter and migrations                          |
| `@tweaktags/auth-jwt`   | Server   | Email and password login that issues secure tokens                 |
| `@tweaktags/storage-s3` | Server   | Optional media uploads to S3 or any S3 compatible store, using presigned uploads |
| `@tweaktags/cli`        | Terminal | The `tweaktags` command for migrations and creating users             |
| `@tweaktags/browser`    | Browser  | The framework agnostic engine that crawls the page, loads content, and runs editing. Both the React and vanilla UIs sit on top of it |
| `@tweaktags/react`      | Browser  | The provider and page scanner that power `data-tweaktags-*` editing, plus an optional `<Editable>` component and hooks |
| `@tweaktags/vanillajs`  | Browser  | The full edit in place UI with no framework, for plain HTML and JavaScript sites |
| `@tweaktags/next`       | Both     | The server side route handler plus the browser side React pieces, in one package |

## More

- The full plan for this project is in [plans/tweaktags-plan-v1.md](plans/tweaktags-plan-v1.md).
- Code conventions for working on TweakTags itself are in [CONTRIBUTING.md](CONTRIBUTING.md).
- A working example app is in [examples/next-app](examples/next-app).
