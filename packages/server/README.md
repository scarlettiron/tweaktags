# @tweaktags/server

A framework agnostic Node backend handler for TweakTags.

Part of [TweakTags](https://github.com/scarlettiron/tweaktags), a lightweight edit in place content layer for React, Next, and
plain HTML sites. Mark content with a `data-tweaktags-*` attribute and signed in editors change
it right on the page.

## Install

```sh
npm install @tweaktags/server
```

Mount the handler on any Node route. It loads your `tweaktags.config`, wires up the
database and auth adapters, and handles every TweakTags action. On Next.js, use `@tweaktags/next`
instead, which wraps this.

## Documentation

Full setup and guides: https://scarlettiron.github.io/tweaktags

## License

MIT
