//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

//The project is published under the @tweaktags scope, but the name people type
//first is the plain one. This package exists so "npm install tweaktags" lands
//on the real thing instead of a dead end.
//It installs @tweaktags/core and re-exports all of it, so importing this name
//is the same as importing the core package: defineConfig, the request handler,
//the adapter interfaces, and every shared type.
//The editing UI is not here, because which one you want depends on your stack.
//Install @tweaktags/next, @tweaktags/react, or @tweaktags/vanillajs for that.
export * from '@tweaktags/core';
