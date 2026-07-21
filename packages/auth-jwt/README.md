# @tweaktags/auth-jwt

Email and password auth for TweakTags, with bcrypt hashing and rotating JWTs.

Part of **[TweakTags](https://github.com/scarlettiron/tweaktags)**, a lightweight edit in place content layer for React, Next,
and plain HTML sites. Mark any element with a `data-tweaktags-*` attribute, and signed in editors
change its text, rich text, or media right on the live page. Everyone else just sees the saved content.

**Full documentation and guides:** https://scarlettiron.github.io/tweaktags/

## Install

```sh
npm install @tweaktags/auth-jwt
```
This is the default auth adapter and it is built into `@tweaktags/server` and `@tweaktags/next`, so
you usually do not install it directly. Turn it on through the `auth` block of your config:

```ts
  auth: {
    provider: 'jwt',
    jwtSecret: process.env.TWEAKTAGS_JWT_SECRET,

    // optional, these are the defaults
    accessTtlSeconds: 60 * 15,        // 15 minutes
    refreshTtlSeconds: 60 * 60 * 24 * 7, // 7 days
    tokenStorage: 'cookie',           // or 'header' for a separate origin
    cookieSecure: true,               // set false only for local http
  },
```

It issues a short lived access token that refreshes quietly and a longer refresh token, kept in secure
httpOnly cookies by default. See every option in the
[config type reference](https://github.com/scarlettiron/tweaktags/blob/main/packages/core/src/types/index.ts).

## Links

- **Documentation and guides:** https://scarlettiron.github.io/tweaktags/
- **Every config setting:** [config type reference](https://github.com/scarlettiron/tweaktags/blob/main/packages/core/src/types/index.ts)
- **Source and issues:** [github.com/scarlettiron/tweaktags](https://github.com/scarlettiron/tweaktags)

## License

MIT
