# @tweaktags/cli

The tweaktags command line tool for migrations, users, and inspecting content.

Part of **[TweakTags](https://github.com/scarlettiron/tweaktags)**, a lightweight edit in place content layer for React, Next,
and plain HTML sites. Mark any element with a `data-tweaktags-*` attribute, and signed in editors
change its text, rich text, or media right on the live page. Everyone else just sees the saved content.

**Full documentation and guides:** https://scarlettiron.github.io/tweaktags/

## Install

No install needed, run it with `npx` from a project that has a `tweaktags.config` file:

```sh
npx tweaktags <command>
```

Or add it as a dev dependency: `npm i -D @tweaktags/cli`.

## Commands

Every command reads your `tweaktags.config` (pass `--config <path>` to point elsewhere) so it uses the
same database and settings as your app.

```sh
# create or update the database tables
npx tweaktags migrate

# create the first admin, who can manage everything
npx tweaktags create-superuser --email you@example.com --password secret [--role superuser|editor]

# add another user
npx tweaktags create-user --email editor@example.com --password secret

# change a password
npx tweaktags update-password --email you@example.com --password new-secret

# list every content tag, optionally for one tenant
npx tweaktags list-tags [--tenant name]

# list every user
npx tweaktags list-users
```

A typical first run is `migrate` then `create-superuser`.

## Links

- **Documentation and guides:** https://scarlettiron.github.io/tweaktags/
- **Every config setting:** [config type reference](https://github.com/scarlettiron/tweaktags/blob/main/packages/core/src/types/index.ts)
- **Source and issues:** [github.com/scarlettiron/tweaktags](https://github.com/scarlettiron/tweaktags)

## License

MIT
