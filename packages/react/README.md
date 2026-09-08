# @tweaktags/react

A self-hosted inline CMS and visual content editor for React.

Let authenticated editors change text, rich text, images, and other website content directly on the live React app, without a separate CMS dashboard. Pair it with a backend from @tweaktags/next or @tweaktags/server.

Built and maintained by [Scarlett A. Scott (@scarlettiron)](https://github.com/scarlettiron).

**Full documentation and guides:** https://scarlettiron.github.io/tweaktags/

## Install

```sh
npm install @tweaktags/react
```
On **Next.js** you do not need this package directly, `@tweaktags/next` re-exports all of it. Use this
package for a React app with its own Node backend from [@tweaktags/server](https://github.com/scarlettiron/tweaktags/tree/main/packages/server).

## Step by step

### 1. Wrap your app with the provider

```tsx
import { TweakTagsProvider, TweakTagsEditBar } from '@tweaktags/react';

export function App({ children }: { children: React.ReactNode }) {
  return (
    <TweakTagsProvider apiBasePath="/api/tweaktags">
      {children}
      <TweakTagsEditBar />
    </TweakTagsProvider>
  );
}
```

The `apiBasePath` must match where your backend handler is mounted.

### 2. Mark content as editable

Give any element a `data-tweaktags-<name>` attribute. The name becomes the tag you edit on the page:

```tsx
<h1 data-tweaktags-hero-title>Welcome to my site</h1>
<p data-tweaktags-hero-subtitle>The default text lives right here</p>
```

The text between the tags is the default. Once an editor saves a change, the saved content shows to
everyone instead.

### 3. Stand up the backend

The provider talks to a TweakTags backend. Mount one with [@tweaktags/server](https://github.com/scarlettiron/tweaktags/tree/main/packages/server)
(any Node framework) or [@tweaktags/next](https://github.com/scarlettiron/tweaktags/tree/main/packages/next) (Next.js), then run
`npx tweaktags migrate` and `npx tweaktags create-superuser` against your `tweaktags.config`.

## What is included

Providers and components: `TweakTagsProvider`, `TweakTagsEditBar`, `TweakTagsAdminPanel`, `Editable`,
`UploadButton`, `RichTextEditor`. Hooks: `useTweakTags`, `useEditableTag`, `useIsEditing`. The shared
types and the `@tweaktags/browser` engine are re-exported too, so you can import them from here.

### Managing users

Superusers get a **Users** panel and everybody signed in gets an **Account** panel, both in the edit
bar and as tabs in the full page admin panel. A superuser can add users, change roles, reset
passwords and delete people; anybody, editors included, can change their own email and password
after confirming their current one.

Four rules are enforced on the server rather than only hidden here, so they hold even for somebody
calling the API directly: you cannot change your own role, you cannot delete yourself, you cannot
delete a user who is currently a superuser (change them to an editor first), and changing your own
email or password needs your current password. See
[Managing users](https://scarlettiron.github.io/tweaktags/#users) for the whole picture.

### Provider options

| Prop | Default | What it does |
| --- | --- | --- |
| `apiBasePath` | `/api/tweaktags` | Where your backend is mounted |
| `editInView` | `true` | Edit in place, or in a popup that lists every tag |
| `richText` | `false` | Turn on the rich text editor and tag types |
| `mediaUpload` | `false` | Show the upload button for media tags (needs server storage) |
| `whiteLabel` | `true` | Hide all TweakTags branding from the UI, including the admin panel. Pass `whiteLabel={false}` to show it |
| `tokenStorage` | `cookie` | `cookie` (same origin) or `header` (separate origin), must match the server |

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
- **UI for your stack:** [@tweaktags/next](https://www.npmjs.com/package/@tweaktags/next) · **@tweaktags/react** (this package) · [@tweaktags/vanillajs](https://www.npmjs.com/package/@tweaktags/vanillajs)
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
