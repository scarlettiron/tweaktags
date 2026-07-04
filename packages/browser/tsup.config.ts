//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  target: 'es2021',
  dts: true,
  clean: true,
  sourcemap: true,
  //This package runs in the browser, so mark it as client code for frameworks
  //like Next that split server and client components.
  banner: {
    js: '"use client";',
  },
});
