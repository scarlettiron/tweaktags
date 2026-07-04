//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

//Note: loadConfig is intentionally not exported here.
//It uses Node's file system, so it lives in its own entry, "@tweaktags/core/loader",
//to keep this main entry safe to import in the browser.
export { defineConfig } from './define-config.js';
export { resolveConfig } from './resolve-config.js';
