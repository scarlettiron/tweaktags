# @tweaktags/react

React provider, components, and hooks for TweakTags. Pair it with a backend from @tweaktags/next or @tweaktags/server.

Part of **[TweakTags](https://github.com/scarlettiron/tweaktags)**, a lightweight edit in place content layer for React, Next,
and plain HTML sites. Mark any element with a `data-tweaktags-*` attribute, and signed in editors
change its text, rich text, or media right on the live page. Everyone else just sees the saved content.

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

### Provider options

| Prop | Default | What it does |
| --- | --- | --- |
| `apiBasePath` | `/api/tweaktags` | Where your backend is mounted |
| `editInView` | `true` | Edit in place, or in a popup that lists every tag |
| `richText` | `false` | Turn on the rich text editor and tag types |
| `mediaUpload` | `false` | Show the upload button for media tags (needs server storage) |
| `whiteLabel` | `false` | Hide all TweakTags branding from the UI, including the admin panel |
| `tokenStorage` | `cookie` | `cookie` (same origin) or `header` (separate origin), must match the server |

## Links

- **Documentation and guides:** https://scarlettiron.github.io/tweaktags/
- **Every config setting:** [config type reference](https://github.com/scarlettiron/tweaktags/blob/main/packages/core/src/types/index.ts)
- **Source and issues:** [github.com/scarlettiron/tweaktags](https://github.com/scarlettiron/tweaktags)

## License

MIT
