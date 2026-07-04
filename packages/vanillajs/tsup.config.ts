//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { defineConfig } from 'tsup';

export default defineConfig([
  //The npm build. Keeps the TweakTags packages external so they are shared.
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    target: 'es2021',
    dts: true,
    clean: true,
    sourcemap: true,
    external: ['@tweaktags/core', '@tweaktags/browser'],
    banner: {
      js: '"use client";',
    },
  },
  //The script tag build. Bundles everything into one self contained file that
  //exposes a global named TweakTags, for use without a bundler.
  {
    entry: ['src/index.ts'],
    format: ['iife'],
    target: 'es2021',
    globalName: 'TweakTags',
    platform: 'browser',
    minify: true,
    sourcemap: true,
    dts: false,
    clean: false,
    noExternal: [/.*/],
  },
]);
