# TweakTags vanilla demo

Static pages to try `@tweaktags/vanillajs` with no backend to run. A small mock backend
([mock-api.js](mock-api.js)) patches `fetch` with an in-memory store, so you can really sign in,
edit, create, and delete, all offline.

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
   server prints) and sign in with **admin@example.com** / **password**.

   Opening `index.html` straight from disk with `file://` also works, since the mock backend needs
   no network.

## Pages

- **index.html** &mdash; edit in place, the default. Draggable bar, mobile menu, Tags panel.
- **popup.html** &mdash; the popup form editor (`editInView: false`).
- **admin.html** &mdash; the full page admin dashboard (`mountAdmin`).

Reloading signs you out, since the mock keeps its state in memory.

## Notes

- The pages load the built file at `../../packages/vanillajs/dist/index.global.js`. If you change
  the source, rebuild the package to see it.
- This is exactly what a real site does, except a real site talks to your own
  `/api/tweaktags` route instead of the mock. See the main README for the server setup.
