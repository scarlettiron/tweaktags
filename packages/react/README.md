# @tweaktags/react

React provider, the Editable component, and hooks for TweakTags.

Part of [TweakTags](https://github.com/scarlettiron/tweaktags), a lightweight edit in place content layer for React, Next, and
plain HTML sites. Mark content with a `data-tweaktags-*` attribute and signed in editors change
it right on the page.

## Install

```sh
npm install @tweaktags/react
```

## Usage

```ts
import { TweakTagsProvider, TweakTagsEditBar } from '@tweaktags/react';

export function App({ children }) {
  return (
    <TweakTagsProvider apiBasePath="/api/tweaktags">
      {children}
      <TweakTagsEditBar />
    </TweakTagsProvider>
  );
}
```

## Documentation

Full setup and guides: https://scarlettiron.github.io/tweaktags

## License

MIT
