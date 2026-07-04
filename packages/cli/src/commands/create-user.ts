//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { ROLES, assertNoSqlInjection } from '@tweaktags/core';
import { createTweakTagsServerFromConfig } from '@tweaktags/server';

//Creates a regular user with the editor role.
//An editor can only change the content of tags that already exist. They cannot
//create, retype, or delete tags. Use create-superuser for an admin who can.
export const runCreateUser = async (flags: Record<string, string>): Promise<number> => {
  const email = flags.email;
  const password = flags.password;

  if (!email || !password) {
    console.error('Both --email and --password are required.');

    return 1;
  }

  //A second layer of defense on top of the parameterized query.
  assertNoSqlInjection(email, 'email');

  const server = await createTweakTagsServerFromConfig({ path: flags.config });

  try {
    const actor = await server.auth.createUser(email, password, ROLES.EDITOR);
    console.log(`Created editor "${email}" with id ${actor.userId}.`);

    return 0;
  } finally {
    await server.close();
  }
};
