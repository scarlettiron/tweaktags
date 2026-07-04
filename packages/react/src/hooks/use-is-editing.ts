//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { useTweakTags } from './use-tweaktags.js';

//A small convenience hook that returns only whether edit mode is currently on.
//Use it in your own components to react to editing, for example to hide a
//section or show a banner while someone is editing.
export const useIsEditing = (): boolean => useTweakTags().isEditing;
