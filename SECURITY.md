# Security policy

TweakTags puts an editing surface and a login on a live website, so a bug here can expose a
customer's content or their database. Reports are welcome and taken seriously.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Use GitHub's private reporting instead:
[**Report a vulnerability**](https://github.com/scarlettiron/tweaktags/security/advisories/new).
It opens a private thread with the maintainer, and nothing is visible publicly until there is a fix.

What helps most in a report:

- which package and version, for example `@tweaktags/server@1.2.1`
- what an attacker can do with it, and what they need first (a login? a tag name? nothing?)
- the smallest set of steps that shows it, ideally against the demo or a fresh install
- your database and host, if they are part of the picture

You will get a first reply within **7 days**. If a report is confirmed, the fix ships in a patch
release and the advisory credits you unless you would rather stay anonymous.

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.2.x   | Yes       |
| 1.1.x   | Security fixes only |
| < 1.1   | No        |

This is a young project with one maintainer, so support means the current minor line. Upgrading
within a minor version is meant to be safe: the packages move together and share a version.

## What is in scope

The published `@tweaktags/*` packages and the unscoped `tweaktags` package. In particular:

- **Authentication.** Sign in, JSON Web Token issue and rotation, refresh token reuse detection,
  and the cookie flags in `@tweaktags/auth-jwt` and `@tweaktags/server`.
- **AWS Cognito authentication.** Access token verification against the pool's JWKS, the link
  between a TweakTags user row and a Cognito `sub`, and the create-or-link path that adds a
  user, in `@tweaktags/auth-aws-cognito`. Two trade-offs are known and deliberate rather than
  bugs: Cognito does not rotate refresh tokens, so there is no reuse detection under this
  provider the way there is under `@tweaktags/auth-jwt`, and every request costs one database
  read to resolve the role, because a Cognito token carries only its own id and the role lives
  in the TweakTags users table. A way to sign in without a linked row, or to reach somebody
  else's row through the link, is in scope.
- **Authorisation.** Anything that lets a signed out visitor read or write content, or lets an
  editor do something only a superuser should, in the request handler in `@tweaktags/core`.
- **Injection.** Tag names, content bodies, and media urls reaching SQL, the DOM, or a file path.
  Rich text is stored as HTML and written to the page, so anything that turns saved content into
  script execution for other visitors is in scope.
- **Tenant isolation.** Anything that lets one tenant read or write another tenant's content.
- **Media uploads.** The presigned upload flow in `@tweaktags/storage-s3`.
- **Leaks.** Config values, connection strings, tokens, or stack traces reaching the browser.

## What is out of scope

- Vulnerabilities in your own database, host, or reverse proxy.
- Anything that needs an attacker to already hold a superuser login, since a superuser is trusted
  with the content by design.
- Running with `auth.csrfProtection: false` or `auth.cookieSecure: false`. Both default to on, and
  turning them off is documented as unsafe.
- Denial of service through sheer request volume. Rate limiting belongs in front of the app.
- Missing hardening that has no exploit attached, unless you can show the impact.

## Things worth knowing when you look

- **Rich text is HTML.** A `rich` tag stores markup and the page renders it. Only signed in editors
  can save it, so the trust boundary is the editor account, not the visitor.
- **The browser never holds database credentials.** The client sends named actions to one route,
  and the server decides what each role may do. A client that can reach the database directly is a
  bug.
- **Failures are logged with a trace id**, and in production the internal message is not returned to
  the browser. A response that leaks a driver error or a stack is a bug.
- **Tables are prefixed** `__TweakTags__`, so TweakTags never touches a host application's tables.

## Keeping your own install safe

- Set a long random `auth.jwtSecret`, and keep it out of version control.
- Leave `auth.csrfProtection` and `auth.cookieSecure` on in production.
- Serve over https. Secure cookies are pointless without it.
- Run `npx tweaktags migrate` with a database user that can create tables, and run the app with one
  that cannot, if your host allows separate credentials.
- Create editors rather than sharing a superuser login. An editor cannot create or delete tags.
