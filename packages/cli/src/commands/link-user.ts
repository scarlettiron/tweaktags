//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { assertNoSqlInjection } from '@tweaktags/core';
import { createTweakTagsServerFromConfig } from '@tweaktags/server';

//Links an existing TweakTags user to their account at an identity provider,
//which for Cognito is the user's "sub".
//
//This is the way in on an install that authenticates against a provider. Nobody
//can sign in until their row carries the id, and nobody can link a row from the
//panel until somebody has signed in, so the first link has to happen out here.
export const runLinkUser = async (flags: Record<string, string>): Promise<number> => {
  const email = flags.email;
  //Accepts either spelling, because "sub" is what the AWS console shows.
  const externalId = flags['external-id'] ?? flags.sub;

  if (!email || !externalId) {
    console.error('Both --email and --external-id are required.');

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

    //Checked against the provider first, so a typo fails here rather than at the
    //next sign in, where it would look like a wrong password.
    const directory = server.auth.directory;

    if (directory) {
      const account = await directory.findByExternalId(externalId);

      if (!account) {
        console.error(`No account with the id "${externalId}" exists at the identity provider.`);

        return 1;
      }

      if (account.email !== email) {
        console.warn(
          `Warning: that account's email at the provider is "${account.email}", ` +
            `not "${email}". Linking anyway, since the id is what signs them in.`,
        );
      }
    }

    await server.db.setUserExternalId(user.id, externalId);
    console.log(`Linked "${email}" to the identity provider account "${externalId}".`);

    return 0;
  } finally {
    await server.close();
  }
};
