//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { createTweakTagsServerFromConfig } from '@tweaktags/server';

//Prints every user with their role, but never their password.
export const runListUsers = async (flags: Record<string, string>): Promise<number> => {
  const server = await createTweakTagsServerFromConfig({ path: flags.config });

  try {
    const users = await server.db.listUsers();

    if (users.length === 0) {
      console.log('There are no users yet.');

      return 0;
    }

    console.log(`${users.length} user${users.length === 1 ? '' : 's'}:`);

    for (const user of users) {
      console.log(`  ${user.email}  (${user.role})`);
    }

    return 0;
  } finally {
    await server.close();
  }
};
