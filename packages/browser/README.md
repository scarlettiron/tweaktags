# @tweaktags/browser

The framework agnostic browser engine that powers TweakTags editing.

Part of [TweakTags](https://github.com/scarlettiron/tweaktags), a lightweight edit in place content layer for React, Next, and
plain HTML sites. Mark content with a `data-tweaktags-*` attribute and signed in editors change
it right on the page.

## Install

```sh
npm install @tweaktags/browser
```

The engine crawls the page for `data-tweaktags-*` attributes, loads saved content, shows
it to every visitor, and runs in place editing. Both `@tweaktags/react` and `@tweaktags/vanillajs`
sit on top of it. Install it directly only if you are building your own UI.

## Documentation

Full setup and guides: https://scarlettiron.github.io/tweaktags

## License

MIT
