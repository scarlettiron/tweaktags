# Contributing to TweakTags

## Code conventions

These rules are partly enforced by ESLint and Prettier, and partly by review.

### Comments

- Write comments so that people with less software experience can follow them. This is so begginner engineers contributing will be able to decipher the code more easily. 

### Layout and style

- Keep logic readable with a reasonable amount of blank lines between blocks.
- Put values that could be reused anywhere into a constants file under a `constants` folder.
- Put reusable helpers into a utilities file under a `utilities` folder.
- Prefer classes or const functions.
- Separate things into appropriate folders.
- Everything must be strictly typed.

## License watermark

TweakTags is published under the MIT License. See the [LICENSE](LICENSE) file for the full text.

Every source file must start with the license watermark. It names the license and lists the
people who have worked on the project. The watermark looks like this:

```ts
//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)
```

Rules for the watermark:

- Do not remove or change the license line or the copyright line.
- If a file has a shebang like `#!/usr/bin/env node`, keep the shebang on the first line and
  put the watermark right below it.
- When you edit a file, add your name to the bottom of the `Contributors:` list in that file.
  Add it after the names that are already there, so the order shows who worked on the file first.
  Keep Scarlett A. Scott (codescarlett) at the top of the list.
- Use the format `Full Name (handle)`, one contributor per line.
- Only add your name once per file. If it is already in the list, leave it as it is.

For example, after a second person edits a file, the contributors section would look like this:

```ts
//Contributors:
//Scarlett A. Scott (codescarlett)
//Jordan Lee (jlee)
```

## Tooling

- Node 16 or newer is supported, so do not use syntax newer than ES2021.
- Each package builds dual ESM and CommonJS output with tsup.
- Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` before opening a pull request.
- Use `pnpm changeset` to record a version bump for any user facing change.
