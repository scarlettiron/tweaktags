# @tweaktags/auth-aws-cognito

Sign in with AWS Cognito for TweakTags, the self-hosted inline CMS for Next.js, React, and plain HTML.

Authenticates editors against an AWS Cognito user pool you already have, instead of the TweakTags
users table. Cognito holds the passwords and issues the tokens. TweakTags keeps the row that says who
somebody is here, which is where their role lives.

Built and maintained by [Scarlett A. Scott (@scarlettiron)](https://github.com/scarlettiron).

**Full documentation and guides:** https://scarlettiron.github.io/tweaktags/

## Install

```sh
npm install @tweaktags/auth-aws-cognito
```

Add it when the people who edit the site already have logins somewhere central, so they sign in to
the editor with the same email and password they use for everything else, and leaving the company
takes the editor away with it. Without this package TweakTags keeps its own users table and its own
passwords, which needs nothing installed and is still the right answer for most sites.

## Step by step

### 1. Get the pool ready

Three things have to be true of the AWS Cognito pool before TweakTags can use it.

- **The app client must allow the `ADMIN_USER_PASSWORD_AUTH` flow.** The password is checked on the
  server, not in the browser, so this is the flow TweakTags signs in with. It is off by default on a
  new app client: turn it on under the client's authentication flows.
- **AWS credentials come from the environment**, not from the config file. The SDK finds them the
  normal way, from an instance role, a profile, or the usual environment variables, which is the
  same choice `@tweaktags/storage-s3` makes and keeps secrets out of the config. The credentials need
  the admin user pool actions: `AdminInitiateAuth`, `AdminGetUser`, `AdminCreateUser`,
  `AdminSetUserPassword` and `AdminUserGlobalSignOut`.
- **A client secret is optional.** Only set `clientSecret` if the app client was created with one.
  Every call then needs a `SECRET_HASH` built from it, which the adapter does for you.

### 2. Add an `awsCognito` auth block to your config

```ts
  auth: {
    provider: 'aws-cognito',
    awsCognito: {
      region: 'us-east-1',
      userPoolId: 'us-east-1_AbCdEfGhI',
      clientId: process.env.COGNITO_CLIENT_ID,
      //Only if the app client has one.
      clientSecret: process.env.COGNITO_CLIENT_SECRET,
    },
    //The cookie, csrf and token storage settings are shared with the jwt provider.
    cookieSecure: true,
  },
```

There is no `jwtSecret` here, and the type will not let you add one: `auth` is a union, so a config
names one provider and gets that provider's fields.

### 3. Link your first user, or you are locked out

**This is the step people miss.** Being in the pool is not access to the editor. A user can only sign
in once their TweakTags row carries their AWS Cognito `sub`, which is deliberate: the pool is usually
shared with your own application, and everybody in it having an editor account would be a surprise.

On a fresh install the command line does both halves at once. `create-superuser` makes the account in
the pool, or links the one already there when the address exists, and writes the link on the row it
creates:

```sh
npx tweaktags migrate
npx tweaktags create-superuser --email you@example.com --password choose-a-strong-password
```

When the TweakTags row already exists with no link, which is what an install moving from the jwt
provider to Cognito looks like, link it by hand:

```sh
npx tweaktags link-user --email you@example.com --external-id <their aws cognito sub>
```

That is the bootstrap for an install like this, and the only way out of it. Nobody can sign in until
they are linked, and nobody can link somebody from the panel until they have signed in, so the first
link has to happen out here. The `sub` is the user's id in the pool, shown on their page in the AWS
console; `--sub` is accepted as a spelling of the same flag. The id is checked against the pool before
it is written, so a typo fails here rather than at the next sign in.

Somebody who is in the pool but not linked gets exactly the same "email or password is incorrect"
message as somebody typing the wrong password, so the login form cannot be used to find out who has
access. That is also what it looks like when you skip this step, and why it is worth doing first.

`npx tweaktags update-password` works too, and for a linked user it sets the password in Cognito
rather than writing a hash into a column nobody reads.

### 4. Tell the client which provider it is talking to

```tsx
<TweakTagsProvider apiBasePath="/api/tweaktags" authProvider="aws-cognito">
  {children}
</TweakTagsProvider>
```

Or, without a framework, `TweakTags.init({ authProvider: 'aws-cognito' })`. The **Add a user** form then
offers **Create a new user** or **Link an existing account**, where linking takes an email and a
`sub` and asks for no password. This is presentation only: the server enforces every rule whatever
the client says, so getting it wrong makes the panel wrong, never the permissions.

### 5. Know what is different under AWS Cognito

| | |
| --- | --- |
| Adding a user whose email is already in the pool | Links that account instead of failing, and says so. Their existing password is left alone: on a shared pool it is their live login for another application. |
| Adding a brand new user | Created with the invitation suppressed and given a permanent password, so there is no `FORCE_CHANGE_PASSWORD` challenge to answer. |
| Deleting a TweakTags user | Leaves the Cognito account alone. Losing the CMS must not delete the login your main app depends on. |
| Changing your own email | Changes the TweakTags row only. The link is on the `sub`, which never changes. |
| Ending sessions | AWS Cognito's global sign-out, which is all or nothing. Changing your own password does not spare the device you are on the way the jwt provider does. |
| Refresh tokens | Cognito does not rotate them, so the jwt provider's stolen token reuse detection has no equivalent here. This is a real trade. |
| Roles | Stay in the TweakTags users table. Cognito groups are never read or written, so every request costs one database read to resolve the role. |
| `auth.strictRevocation` | Does nothing. Cognito already revokes at the source. |

Every auth option is in the
[config type reference](https://github.com/scarlettiron/tweaktags/blob/main/packages/core/src/types/index.ts).

## Links

- **Documentation and guides:** https://scarlettiron.github.io/tweaktags/
- **Every config setting:** [config type reference](https://github.com/scarlettiron/tweaktags/blob/main/packages/core/src/types/index.ts)
- **Source and issues:** [github.com/scarlettiron/tweaktags](https://github.com/scarlettiron/tweaktags)

## Requirements

- **Node 20 or newer** to run the server side pieces. This is the one TweakTags package with a
  floor above Node 16, and the floor is not ours to choose:
  `@aws-sdk/client-cognito-identity-provider` declares `node >= 20.0.0`, so that is the SDK's
  requirement passed straight through. Every other TweakTags package still runs on Node 16.
- **TypeScript 4.5 or newer**, if you use TypeScript. The published type declarations use inline
  `type` modifiers on export specifiers, which 4.4 and older cannot parse. TypeScript is not
  required: the packages work from plain JavaScript too.
- For `moduleResolution`, anything works. `node16` and `nodenext` (TypeScript 4.7+) and `bundler`
  (5.0+) pick up the separate ESM and CommonJS declarations; older setups resolve through the
  `types` field and get the same API.

### Supported versions

The AWS pieces are ordinary dependencies of this package, not peer dependencies, so
`npm install @tweaktags/auth-aws-cognito` brings them with it and there is nothing else for you to
install. The versions below are the declared minimums.

| Thing | Version | Notes |
| --- | --- | --- |
| **Node** | 20 or newer | The AWS SDK's floor, not ours. Node 16 everywhere else in TweakTags |
| **`@aws-sdk/client-cognito-identity-provider`** | 3.600.0 or newer | A normal dependency of this package, installed for you |
| **`aws-jwt-verify`** | 4.0.1 or newer | Verifies the pool's tokens against its JWKS. Also installed for you |
| **AWS Cognito itself** | Nothing to match | A managed service. There is no server version to pin |
| **TypeScript** | 4.5 or newer | Only if you use TypeScript at all |

**There is no minimum AWS Cognito version.** If that is what you came here for, this is the answer
rather than something left out of the table. Cognito is a managed AWS service: AWS run one version
of it for everybody, so the thing you pin is the SDK, not the service. The API these calls speak is
the Cognito Identity Provider API, `2016-04-18`, which is the version the SDK client targets.

### What the user pool has to allow

Not a version, but the other half of "will this work against my pool". These are the same three
requirements as [Get the pool ready](#1-get-the-pool-ready), gathered here so the answer is in one
place:

- **The app client must allow `ADMIN_USER_PASSWORD_AUTH`.** It is off by default on a new app
  client, and the password is checked on your server rather than in the browser, so this is the
  flow TweakTags signs in with.
- **MFA must not be enforced, and nothing else in the pool may ask the user a question.** TweakTags
  answers no challenges: a sign-in that comes back with MFA or `NEW_PASSWORD_REQUIRED` fails naming
  it, and a pool with MFA enforced cannot be used at all.
- **AWS credentials come from the environment or an instance role**, never from the config file,
  and need the admin user pool actions listed under [Get the pool ready](#1-get-the-pool-ready).

## The rest of TweakTags

Every package in the project, so you can jump straight to the piece you need:

- **Start here:** [tweaktags](https://www.npmjs.com/package/tweaktags) — the front door, with a map of the whole project
- **Documentation:** [AWS Cognito authentication](https://scarlettiron.github.io/tweaktags/#cognito) on the docs site
- **UI for your stack:** [@tweaktags/next](https://www.npmjs.com/package/@tweaktags/next) · [@tweaktags/react](https://www.npmjs.com/package/@tweaktags/react) · [@tweaktags/vanillajs](https://www.npmjs.com/package/@tweaktags/vanillajs)
- **Backend:** [@tweaktags/server](https://www.npmjs.com/package/@tweaktags/server) · [@tweaktags/auth-jwt](https://www.npmjs.com/package/@tweaktags/auth-jwt) · **@tweaktags/auth-aws-cognito** (this package) · [@tweaktags/cli](https://www.npmjs.com/package/@tweaktags/cli)
- **Databases:** [@tweaktags/db-postgres](https://www.npmjs.com/package/@tweaktags/db-postgres) · [@tweaktags/db-mysql](https://www.npmjs.com/package/@tweaktags/db-mysql) · [@tweaktags/db-mariadb](https://www.npmjs.com/package/@tweaktags/db-mariadb) · [@tweaktags/db-sqlite](https://www.npmjs.com/package/@tweaktags/db-sqlite)
- **Media uploads:** [@tweaktags/storage-s3](https://www.npmjs.com/package/@tweaktags/storage-s3)
- **Internals:** [@tweaktags/core](https://www.npmjs.com/package/@tweaktags/core) · [@tweaktags/browser](https://www.npmjs.com/package/@tweaktags/browser)

## Author

TweakTags is created and maintained by
**[Scarlett A. Scott (@scarlettiron)](https://github.com/scarlettiron)**, and published as the
[@tweaktags](https://www.npmjs.com/org/tweaktags) packages on npm.

## License

MIT
