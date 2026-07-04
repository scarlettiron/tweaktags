//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { config as loadEnvFile } from 'dotenv';

//Loads environment variables from the common dotenv files.
//This means the cli sees the same DATABASE_URL and secret that your app uses.
//Values in .env.local win over values in .env, which matches how Next works.
export const loadEnv = (): void => {
  loadEnvFile({ path: '.env' });
  loadEnvFile({ path: '.env.local', override: true });
};
