//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { createTweakTagsServerFromConfig } from '@tweaktags/server';

//Runs any database migrations that have not run yet.
//Reads the database connection from the tweaktags.config file.
export const runMigrate = async (flags: Record<string, string>): Promise<number> => {
  const server = await createTweakTagsServerFromConfig({ path: flags.config });

  try {
    await server.db.runMigrations();
    console.log('TweakTags migrations are up to date.');

    return 0;
  } finally {
    await server.close();
  }
};
