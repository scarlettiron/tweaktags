//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { assertValidTenant } from '@tweaktags/core';
import { createTweakTagsServerFromConfig } from '@tweaktags/server';

//Prints every tag in the database for one tenant.
//Uses the config tenant by default, or --tenant to inspect another one.
export const runListTags = async (flags: Record<string, string>): Promise<number> => {
  const server = await createTweakTagsServerFromConfig({ path: flags.config });
  const tenant = assertValidTenant(flags.tenant ?? server.config.tenant);

  try {
    const tags = await server.db.listTags(tenant);

    if (tags.length === 0) {
      console.log(`There are no tags yet for tenant "${tenant}".`);

      return 0;
    }

    console.log(`${tags.length} tag${tags.length === 1 ? '' : 's'} for tenant "${tenant}":`);

    for (const tag of tags) {
      console.log(`  ${tag}`);
    }

    return 0;
  } finally {
    await server.close();
  }
};
