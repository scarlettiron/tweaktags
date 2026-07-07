# @tweaktags/cli

The tweaktags command line tool for migrations and users.

Part of [TweakTags](https://github.com/scarlettiron/tweaktags), a lightweight edit in place content layer for React, Next, and
plain HTML sites. Mark content with a `data-tweaktags-*` attribute and signed in editors change
it right on the page.

## Install

```sh
npm install @tweaktags/cli
```

Run these from the root of your app, driven by your `tweaktags.config`:

```sh
npx tweaktags migrate
npx tweaktags create-superuser --email you@example.com --password secret
npx tweaktags create-user --email editor@example.com --password secret
npx tweaktags list-tags [--tenant name]
npx tweaktags list-users
```

## Documentation

Full setup and guides: https://scarlettiron.github.io/tweaktags

## License

MIT
