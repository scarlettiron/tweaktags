# @tweaktags/vanillajs

The full edit in place UI for plain HTML and JavaScript. No framework, no build step.

Part of **[TweakTags](https://github.com/scarlettiron/tweaktags)**, a lightweight edit in place content layer for React, Next,
and plain HTML sites. Mark any element with a `data-tweaktags-*` attribute, and signed in editors
change its text, rich text, or media right on the live page. Everyone else just sees the saved content.

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

Pass `whiteLabel: true` to remove every bit of TweakTags branding from the UI, including the admin
panel, so the editor carries only your own name:

```js
TweakTags.init({ apiBasePath: '/api/tweaktags', whiteLabel: true });
```

## Links

- **Documentation and guides:** https://scarlettiron.github.io/tweaktags/
- **Every config setting:** [config type reference](https://github.com/scarlettiron/tweaktags/blob/main/packages/core/src/types/index.ts)
- **Source and issues:** [github.com/scarlettiron/tweaktags](https://github.com/scarlettiron/tweaktags)

## License

MIT
