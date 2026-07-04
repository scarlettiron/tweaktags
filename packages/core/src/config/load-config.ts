//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { existsSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

import { createJiti } from 'jiti';

import { CONFIG_FILE_NAMES } from '../constants/index.js';
import type { TweakTagsConfig, TweakTagsUserConfig } from '../types/index.js';
import { badRequest } from '../utilities/errors.js';
import { resolveConfig } from './resolve-config.js';

//Options for finding and loading the config file.
export interface LoadConfigOptions {
  //The folder to search in. Defaults to the current working directory.
  cwd?: string;
  //An exact path to the config file. Skips the search when given.
  path?: string;
}

//Looks for a tweaktags.config file in the given folder.
//Returns the first matching path, or null when none are found.
const findConfigFile = (cwd: string): string | null => {
  for (const name of CONFIG_FILE_NAMES) {
    const candidate = join(cwd, name);

    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
};

//Loads and validates the TweakTags config from disk.
//Supports config files written in TypeScript or JavaScript.
export const loadConfig = async (options: LoadConfigOptions = {}): Promise<TweakTagsConfig> => {
  const cwd = options.cwd ?? process.cwd();

  const configPath = options.path
    ? isAbsolute(options.path)
      ? options.path
      : resolve(cwd, options.path)
    : findConfigFile(cwd);

  if (!configPath || !existsSync(configPath)) {
    throw badRequest(
      'Could not find a tweaktags.config file. Create one or pass an explicit path.',
    );
  }

  //jiti can import TypeScript files at runtime, so the host does not need a build step
  //just to load their config.
  const jiti = createJiti(configPath);
  const loaded = await jiti.import<TweakTagsUserConfig>(configPath, { default: true });

  return resolveConfig(loaded);
};
