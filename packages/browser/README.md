# @tweaktags/browser

The framework agnostic browser engine that powers TweakTags editing.

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

## License

MIT
