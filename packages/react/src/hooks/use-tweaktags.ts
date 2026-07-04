//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { useContext } from 'react';

import { TweakTagsContext, type TweakTagsContextValue } from '../context/tweaktags-context.js';

//Reads the TweakTags context.
//Throws a clear error when used outside of the provider.
export const useTweakTags = (): TweakTagsContextValue => {
  const context = useContext(TweakTagsContext);

  if (!context) {
    throw new Error('useTweakTags must be used inside a TweakTagsProvider');
  }

  return context;
};
