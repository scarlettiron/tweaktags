# @tweaktags/core

Shared types, config, the request handler, and adapter interfaces for TweakTags.

Part of [TweakTags](https://github.com/scarlettiron/tweaktags), a lightweight edit in place content layer for React, Next, and
plain HTML sites. Mark content with a `data-tweaktags-*` attribute and signed in editors change
it right on the page.

## Install

```sh
npm install @tweaktags/core
```

This is the shared foundation the other TweakTags packages build on. You usually do not
install it directly; `@tweaktags/next`, `@tweaktags/react`, and `@tweaktags/server` pull it in.
It also exports `defineConfig` for writing your `tweaktags.config` file.

## Documentation

Full setup and guides: https://scarlettiron.github.io/tweaktags

## License

MIT
