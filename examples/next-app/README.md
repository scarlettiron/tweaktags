# TweakTags example, Next.js app

This small app shows TweakTags working end to end with Next.js and Postgres.

## What it shows

- A backend handler mounted at `app/api/tweaktags/route.ts`.
- The provider and edit bar wired up in `app/layout.tsx`.
- Two editable spots using the `<Editable>` component and one plain HTML element that only has a
  `data-tweaktags-plain-note` attribute, in `app/page.tsx`.

## Run it

These steps assume you run them from a WSL terminal where Node and pnpm work natively.

1. Start a local Postgres, for example with Docker:

   ```sh
   docker run --name tweaktags-pg -e POSTGRES_USER=tweaktags -e POSTGRES_PASSWORD=tweaktags \
     -e POSTGRES_DB=tweaktags -p 5432:5432 -d postgres:16
   ```

2. From the repo root, install and build the packages:

   ```sh
   pnpm install
   pnpm build
   ```

3. Set the environment variables for this app. Copy `.env.example` to `.env` and adjust if
   needed:

   ```sh
   cp examples/next-app/.env.example examples/next-app/.env
   ```

4. Create the tables and a superuser, using the config in this folder:

   ```sh
   cd examples/next-app
   pnpm tweaktags migrate
   pnpm tweaktags create-superuser --email you@example.com --password supersecret
   ```

5. Start the app:

   ```sh
   pnpm dev
   ```

6. Open the app, sign in with the edit bar in the corner, click "Edit page", change any of the
   three editable spots, then click away to save. Reload the page to confirm the change was
   stored in the database.

## Checking the database

You can confirm the saved rows directly:

```sh
docker exec -it tweaktags-pg psql -U tweaktags -d tweaktags -c 'SELECT tag, body FROM "__TweakTags__Content";'
```
