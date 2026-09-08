# @tweaktags/vanillajs

A self-hosted inline CMS and visual content editor for plain HTML and JavaScript.

Add editable content to a static site with one script tag. No framework, no build step. Signed in editors change text, rich text, and images directly on the live page, and everyone else sees the saved content.

Built and maintained by [Scarlett A. Scott (@scarlettiron)](https://github.com/scarlettiron).

**Full documentation and guides:** https://scarlettiron.github.io/tweaktags/

## Install

Drop in a script tag:

```html
<script src="https://unpkg.com/@tweaktags/vanillajs@1"></script>
```

Or install it and bundle it yourself:

```sh
npm install @tweaktags/vanillajs
```

## Step by step

### 1. Boot TweakTags on the page

```html
<script src="https://unpkg.com/@tweaktags/vanillajs@1"></script>
<script>
  TweakTags.init({ apiBasePath: '/api/tweaktags' });
</script>
```

With a bundler:

```js
import { init } from '@tweaktags/vanillajs';

init({ apiBasePath: '/api/tweaktags' });
```

`init` injects the styles, loads saved content, and mounts the floating edit bar. For a dedicated
admin route, use `TweakTags.mountAdmin('#admin', { apiBasePath })` instead.

### 2. Mark content as editable

Give any element a `data-tweaktags-<name>` attribute. The name becomes the tag you edit on the page:

```html
<h1 data-tweaktags-hero-title>Welcome to my site</h1>
<p data-tweaktags-hero-subtitle>The default text lives right here</p>
```

The text between the tags is the default. Once an editor saves a change, the saved content shows to
everyone instead.

### 3. Stand up the backend

The UI needs a TweakTags backend at `apiBasePath`. Mount one with
[@tweaktags/server](https://github.com/scarlettiron/tweaktags/tree/main/packages/server), then run `npx tweaktags migrate` and
`npx tweaktags create-superuser` against your `tweaktags.config`.

### Theming

Pass a `theme` and extra `css` to recolor the UI:

```js
TweakTags.init({ apiBasePath: '/api/tweaktags', theme: { accent: '#0a84ff' } });
```

### White label

White label is the default, so no TweakTags branding shows anywhere in the UI, including the admin
panel, and the editor carries only your own name. Pass `whiteLabel: false` to show the TweakTags
name instead:

```js
TweakTags.init({ apiBasePath: '/api/tweaktags', whiteLabel: false });
```

## Managing users

Superusers get a **Users** panel and everybody signed in gets an **Account** panel, both in the edit
bar and as tabs in the full page admin panel. A superuser can add users, change roles, reset
passwords and delete people; anybody, editors included, can change their own email and password
after confirming their current one.

Four rules are enforced on the server rather than only hidden here, so they hold even for somebody
calling the API directly: you cannot change your own role, you cannot delete yourself, you cannot
delete a user who is currently a superuser (change them to an editor first), and changing your own
email or password needs your current password. See
[Managing users](https://scarlettiron.github.io/tweaktags/#users) for the whole picture.

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
- **Documentation:** [Vanilla JavaScript guide](https://scarlettiron.github.io/tweaktags/#vanilla) on the docs site
- **UI for your stack:** [@tweaktags/next](https://www.npmjs.com/package/@tweaktags/next) · [@tweaktags/react](https://www.npmjs.com/package/@tweaktags/react) · **@tweaktags/vanillajs** (this package)
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
