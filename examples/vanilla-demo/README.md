# TweakTags vanilla demo

Static pages to try `@tweaktags/vanillajs` with no backend to run. A small mock backend
([mock-api.js](mock-api.js)) patches `fetch` with an in-memory store, so you can really sign in,
edit, create, delete, and manage users, all offline.

## Run it

1. Build the packages so the script build exists:

   ```sh
   pnpm --filter @tweaktags/browser build
   pnpm --filter @tweaktags/vanillajs build
   # or just: pnpm build
   ```

   This creates `packages/vanillajs/dist/index.global.js`, which the pages load.

2. Serve from the **repo root** (the pages load the build with a `../../packages/...` path, so the
   server needs to see the whole repo, not just this folder):

   ```sh
   npx serve .
   # or: python3 -m http.server 8080
   ```

3. Open `http://localhost:3000/examples/vanilla-demo/index.html` (adjust the port to what the
   server prints) and sign in with **admin@example.com** / **password**. There is a second seeded
   account, **editor@example.com** / **password**, for seeing what an editor sees.

   Opening `index.html` straight from disk with `file://` also works, since the mock backend needs
   no network.

## Pages

- **index.html** &mdash; edit in place, the default. Draggable bar, mobile menu, Tags panel.
- **popup.html** &mdash; the popup form editor (`editInView: false`).
- **admin.html** &mdash; the full page admin dashboard (`mountAdmin`).

Reloading signs you out, since the mock keeps its state in memory.

## Managing users

Signed in as the admin, the **Users** panel in the edit bar and the **Users** tab in the admin
dashboard both let you add users, change roles, reset passwords and delete people. Clicking your
email address opens **Account**, where anybody signed in changes their own email or password.

The mock enforces the same rules the real server does, so the demo is a fair test of them: you
cannot change your own role, you cannot delete yourself, you cannot delete somebody who is
currently a superuser (change them to an editor first), and changing your own email or password
needs your current password. Sign in as the editor to see the Users panel disappear while Account
stays.

## Notes

- The pages load the built file at `../../packages/vanillajs/dist/index.global.js`. If you change
  the source, rebuild the package to see it.
- This is exactly what a real site does, except a real site talks to your own
  `/api/tweaktags` route instead of the mock. See the main README for the server setup.
