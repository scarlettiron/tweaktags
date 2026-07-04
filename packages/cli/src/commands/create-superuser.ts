//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { ROLES, assertNoSqlInjection } from '@tweaktags/core';
import { createTweakTagsServerFromConfig } from '@tweaktags/server';

//Creates a new user, defaulting to the superuser role.
//Use this once to make your first superuser, who can then create tags.
export const runCreateSuperuser = async (flags: Record<string, string>): Promise<number> => {
  const email = flags.email;
  const password = flags.password;

  if (!email || !password) {
    console.error('Both --email and --password are required.');

    return 1;
  }

  //A second layer of defense on top of the parameterized query.
  assertNoSqlInjection(email, 'email');

  //Allow making an editor too, but default to superuser since that is the common case.
  const role = flags.role === ROLES.EDITOR ? ROLES.EDITOR : ROLES.SUPERUSER;

  const server = await createTweakTagsServerFromConfig({ path: flags.config });

  try {
    const actor = await server.auth.createUser(email, password, role);
    console.log(`Created ${role} "${email}" with id ${actor.userId}.`);

    return 0;
  } finally {
    await server.close();
  }
};
