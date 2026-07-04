//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { assertNoSqlInjection } from '@tweaktags/core';
import { createTweakTagsServerFromConfig } from '@tweaktags/server';

//Updates the password for an existing user.
//The email goes into a parameterized query, and is also checked for injection.
export const runUpdatePassword = async (flags: Record<string, string>): Promise<number> => {
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
    const user = await server.db.findUserByEmail(email);

    if (!user) {
      console.error(`No user was found with the email "${email}".`);

      return 1;
    }

    const passwordHash = await server.auth.hashPassword(password);
    await server.db.updateUserPassword(email, passwordHash);
    console.log(`Updated the password for "${email}".`);

    return 0;
  } finally {
    await server.close();
  }
};
