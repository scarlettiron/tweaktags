//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

//The config loader reads files from disk, so it uses Node's file system.
//It is kept in this separate entry, imported as "@tweaktags/core/loader", so that
//browser bundles that import the main "@tweaktags/core" entry never pull in Node
//only modules like fs.
export { loadConfig } from './config/load-config.js';
export type { LoadConfigOptions } from './config/load-config.js';
