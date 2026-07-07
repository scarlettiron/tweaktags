# @tweaktags/next

The Next.js route handler plus the React bindings, in one package.

Part of [TweakTags](https://github.com/scarlettiron/tweaktags), a lightweight edit in place content layer for React, Next, and
plain HTML sites. Mark content with a `data-tweaktags-*` attribute and signed in editors change
it right on the page.

## Install

```sh
npm install @tweaktags/next
```

## Usage

```ts
// app/api/tweaktags/route.ts
import { createTweakTagsRouteHandler } from '@tweaktags/next';
import config from '../../../tweaktags.config.js';

const { POST } = createTweakTagsRouteHandler(config);
export const runtime = 'nodejs';
export { POST };
```

## Documentation

Full setup and guides: https://scarlettiron.github.io/tweaktags

## License

MIT
