//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

//The Next package gives you the route handler for the backend
//and re-exports the React bindings so you can import everything from one place.

export { createTweakTagsRouteHandler, createTweakTagsPagesApiRoute } from './route-handler.js';
export type { TweakTagsRouteHandlers } from './route-handler.js';

//Re-export the config helpers so you can keep all imports in one place.
export { defineConfig, resolveConfig } from '@tweaktags/core';
export type { TweakTagsConfig, TweakTagsUserConfig } from '@tweaktags/core';

//Re-export the server factory for hosts that want direct access.
export { createTweakTagsServer, createTweakTagsServerFromConfig } from '@tweaktags/server';
export type { TweakTagsServer } from '@tweaktags/server';

//Re-export all of the React bindings.
export * from '@tweaktags/react';
