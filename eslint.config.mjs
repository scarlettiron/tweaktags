//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

//Flat ESLint config for the whole workspace.
//The stylistic spaced-comment rule enforces the project comment style
//where there is no space between the slashes and the first letter.
export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.next/**', '**/coverage/**'],
  },
  ...tseslint.configs.recommended,
  {
    plugins: {
      '@stylistic': stylistic,
    },
    rules: {
      '@stylistic/spaced-comment': ['error', 'never', { markers: ['/'] }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
);
