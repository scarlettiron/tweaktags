# @tweaktags/auth-jwt

Email and password auth for TweakTags, with bcrypt hashing and rotating JWTs.

Part of [TweakTags](https://github.com/scarlettiron/tweaktags), a lightweight edit in place content layer for React, Next, and
plain HTML sites. Mark content with a `data-tweaktags-*` attribute and signed in editors change
it right on the page.

## Install

```sh
npm install @tweaktags/auth-jwt
```

The default auth adapter. `@tweaktags/server` uses it automatically when your config sets
`auth.provider: 'jwt'`, so you rarely install it directly.

## Documentation

Full setup and guides: https://scarlettiron.github.io/tweaktags

## License

MIT
