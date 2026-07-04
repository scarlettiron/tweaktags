//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

//Public surface of the TweakTags browser engine.
//This is the shared runtime that both the React and vanilla layers sit on top of.

export { TweakTagsEngine, createTweakTagsEngine } from './engine.js';

export type {
  EngineOptions,
  EngineState,
  ToastMessage,
  ToastType,
  ToolbarPosition,
} from './types.js';

export { Emitter } from './emitter.js';
export type { Listener } from './emitter.js';

export { createApiClient } from './api-client.js';
export type { ApiClient, ApiClientOptions, ApiError } from './api-client.js';

export { readStoredTokens, writeStoredTokens, readCookie } from './token-storage.js';
export type { StoredTokens } from './token-storage.js';

export { findTweakTagsElements, tweaktagsTagOf, MANAGED_ATTRIBUTE } from './scanner.js';
export type { ScannedElement } from './scanner.js';

//Re-export the shared types and enums so a UI can import everything it needs
//from one place, for example: import { ROLES, type ContentRecord } from '@tweaktags/browser'.
export type * from '@tweaktags/core';
export { ACTIONS, ERROR_CODES, ROLES, TAG_TYPES, isValidTag } from '@tweaktags/core';
