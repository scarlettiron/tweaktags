//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { createHmac } from 'node:crypto';

import {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminInitiateAuthCommand,
  AdminSetUserPasswordCommand,
  AdminUserGlobalSignOutCommand,
  CognitoIdentityProviderClient,
  type AdminGetUserCommandOutput,
  type AttributeType,
} from '@aws-sdk/client-cognito-identity-provider';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import {
  badRequest,
  conflict,
  unauthorized,
  type Actor,
  type AuthAdapter,
  type AuthResult,
  type AwsCognitoConfig,
  type DirectoryUser,
  type Role,
  type StoredUser,
  type UserDirectory,
  type UserStore,
} from '@tweaktags/core';

import { REFRESH_SEPARATOR } from './constants/index.js';

//The Cognito adapter only ever reads and links users. It never writes a password
//hash, so the narrow store is all it needs.
type AuthStore = UserStore;

//Just enough of the SDK client to send a command. Structural rather than the
//SDK's own type because that one is overloaded per command, and because this is
//the seam a test replaces: mocking the SDK module does not reach a built
//package, and a real client goes looking for AWS credentials the moment it is
//asked to do anything.
export interface AwsCognitoCommandClient {
  send(command: unknown): Promise<Record<string, unknown>>;
}

//Just enough of the token verifier, for the same reason.
export interface AccessTokenVerifier {
  verify(token: string): Promise<Record<string, unknown>>;
}

//Replacements for the two things that talk to AWS. Production passes neither.
export interface AwsCognitoAdapterOverrides {
  client?: AwsCognitoCommandClient;
  verifier?: AccessTokenVerifier;
}

//The shape of an auth response, narrowed from the plain record the seam returns.
interface AuthCommandOutput {
  ChallengeName?: string;
  AuthenticationResult?: { AccessToken?: string; RefreshToken?: string };
}

//Cognito's own name for "this account is already here", which is the whole point
//of the create-or-link behaviour rather than an error to pass on.
const USER_EXISTS = 'UsernameExistsException';
const USER_NOT_FOUND = 'UserNotFoundException';

//The SDK puts the code in different places depending on the error, so check both.
const errorName = (error: unknown): string => {
  if (typeof error !== 'object' || error === null) {
    return '';
  }

  const candidate = error as { name?: unknown; __type?: unknown };

  return String(candidate.name ?? candidate.__type ?? '');
};

//Pulls one attribute out of the list Cognito returns them in.
const attribute = (attributes: AttributeType[] | undefined, name: string): string | undefined =>
  attributes?.find((entry) => entry.Name === name)?.Value;

//Turns a Cognito account into the shape the handler works in.
const toDirectoryUser = (
  account: AdminGetUserCommandOutput,
  fallbackEmail: string,
  alreadyExisted: boolean,
): DirectoryUser => ({
  //The sub, not the username. A pool can be configured to let people change
  //their username, and aliases mean the username is not always the email, but
  //the sub is assigned once and never changes. It is the only safe thing to
  //store as a link.
  externalId: attribute(account.UserAttributes, 'sub') ?? String(account.Username),
  email: attribute(account.UserAttributes, 'email') ?? fallbackEmail,
  alreadyExisted,
});

//Authenticates against an AWS Cognito user pool instead of the TweakTags users
//table. Cognito holds the passwords and issues the tokens; TweakTags keeps the
//row that says who somebody is here, which is where their role lives.
//
//A user can only sign in once their TweakTags row carries their Cognito sub.
//That link is made by an administrator, or from the command line for the first
//one, and it is what stops anybody in a shared pool from having an editor
//account here simply by existing.
export class AwsCognitoAuthAdapter implements AuthAdapter {
  private readonly client: AwsCognitoCommandClient;

  private readonly verifier: AccessTokenVerifier;

  private readonly store: AuthStore;

  private readonly config: AwsCognitoConfig;

  constructor(store: AuthStore, config: AwsCognitoConfig, overrides: AwsCognitoAdapterOverrides = {}) {
    this.store = store;
    this.config = config;
    this.client =
      overrides.client ??
      (new CognitoIdentityProviderClient({
        region: config.region,
      }) as unknown as AwsCognitoCommandClient);

    //Fetches the pool's public keys once and caches them, and checks the issuer,
    //the client id and that this is an access token rather than an id token.
    //Writing that by hand is exactly the sort of thing that is subtly wrong for
    //a year, so it is worth the dependency.
    this.verifier =
      overrides.verifier ??
      (CognitoJwtVerifier.create({
        userPoolId: config.userPoolId,
        clientId: config.clientId,
        tokenUse: 'access',
      }) as unknown as AccessTokenVerifier);
  }

  //Cognito wants a hash of the username and client id whenever the app client
  //was created with a secret. Clients without one must not send it at all.
  private secretHash(username: string): Record<string, string> {
    if (!this.config.clientSecret) {
      return {};
    }

    const hash = createHmac('sha256', this.config.clientSecret)
      .update(`${username}${this.config.clientId}`)
      .digest('base64');

    return { SECRET_HASH: hash };
  }

  //The refresh token handed to the browser is Cognito's, with the user's sub in
  //front of it.
  //
  //Refreshing needs the username to rebuild SECRET_HASH, and Cognito's refresh
  //tokens are opaque, so there is nothing to read it back out of. Carrying it
  //alongside is the usual answer. It is done for every install rather than only
  //the ones with a client secret, so there is one code path instead of two, and
  //it is no secret in any case: the sub is already in every access token.
  private packRefreshToken(sub: string, refreshToken: string): string {
    return `${sub}${REFRESH_SEPARATOR}${refreshToken}`;
  }

  private unpackRefreshToken(packed: string): { sub: string; refreshToken: string } | null {
    const at = packed.indexOf(REFRESH_SEPARATOR);

    if (at <= 0) {
      return null;
    }

    return {
      sub: packed.slice(0, at),
      refreshToken: packed.slice(at + REFRESH_SEPARATOR.length),
    };
  }

  //Checks an email and password with Cognito and hands back its tokens.
  //Every failure returns the same message, so this cannot be used to work out
  //which addresses exist in the pool.
  private async authenticate(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string } | null> {
    try {
      const result = (await this.client.send(
        new AdminInitiateAuthCommand({
          UserPoolId: this.config.userPoolId,
          ClientId: this.config.clientId,
          AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
          AuthParameters: {
            USERNAME: email,
            PASSWORD: password,
            ...this.secretHash(email),
          },
        }),
      )) as AuthCommandOutput;

      //A challenge means the password was right but Cognito wants something more,
      //like a new password or an MFA code. TweakTags has no screen for that, so
      //say so plainly rather than failing as if the password were wrong.
      if (result.ChallengeName) {
        throw badRequest(
          `This account needs to finish "${result.ChallengeName}" in Cognito before it can be ` +
            `used with TweakTags.`,
        );
      }

      const accessToken = result.AuthenticationResult?.AccessToken;
      const refreshToken = result.AuthenticationResult?.RefreshToken;

      if (!accessToken || !refreshToken) {
        return null;
      }

      return { accessToken, refreshToken };
    } catch (error) {
      //A challenge is our own error and must not be swallowed as a bad password.
      if (error instanceof Error && error.name === 'TweakTagsError') {
        throw error;
      }

      return null;
    }
  }

  //The TweakTags row behind a Cognito sub. Missing means the account exists in
  //the pool but nobody has been given access to the editor, which is the normal
  //case for a pool shared with another application.
  private async linkedUser(sub: string): Promise<StoredUser | null> {
    return this.store.findUserByExternalId(sub);
  }

  public async login(email: string, password: string): Promise<AuthResult> {
    const tokens = await this.authenticate(email, password);

    if (!tokens) {
      throw unauthorized('The email or password is incorrect');
    }

    const payload = await this.verifier.verify(tokens.accessToken);
    const sub = String(payload.sub);
    const user = await this.linkedUser(sub);

    //Deliberately the same message as a wrong password. Somebody with a valid
    //pool account but no editor access learns nothing about the editor from
    //trying, and an administrator can link them in a moment.
    if (!user) {
      throw unauthorized('The email or password is incorrect');
    }

    return {
      accessToken: tokens.accessToken,
      refreshToken: this.packRefreshToken(sub, tokens.refreshToken),
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  //One database read per request, because the token carries Cognito's id and the
  //role lives here. That is the same cost as strictRevocation, and unlike that
  //setting it is not optional: there is nowhere else the role could come from.
  public async verify(token: string): Promise<Actor | null> {
    try {
      const payload = await this.verifier.verify(token);
      const user = await this.linkedUser(String(payload.sub));

      if (!user) {
        return null;
      }

      //No familyId. Sessions belong to Cognito here, so there is no family of
      //our own to spare, and endSessions says as much.
      return { userId: user.id, role: user.role };
    } catch {
      return null;
    }
  }

  public async refresh(refreshToken: string): Promise<AuthResult | null> {
    const packed = this.unpackRefreshToken(refreshToken);

    if (!packed) {
      return null;
    }

    try {
      const result = (await this.client.send(
        new AdminInitiateAuthCommand({
          UserPoolId: this.config.userPoolId,
          ClientId: this.config.clientId,
          AuthFlow: 'REFRESH_TOKEN_AUTH',
          AuthParameters: {
            REFRESH_TOKEN: packed.refreshToken,
            ...this.secretHash(packed.sub),
          },
        }),
      )) as AuthCommandOutput;

      const accessToken = result.AuthenticationResult?.AccessToken;

      if (!accessToken) {
        return null;
      }

      const user = await this.linkedUser(packed.sub);

      if (!user) {
        return null;
      }

      //Cognito does not rotate refresh tokens: it answers with a new access token
      //and nothing else, so the same refresh token goes back. This is the one
      //place the jwt adapter is stricter, because it rotates on every use and
      //treats a reused token as theft. Cognito has no equivalent.
      return {
        accessToken,
        refreshToken: this.packRefreshToken(packed.sub, packed.refreshToken),
        user: { id: user.id, email: user.email, role: user.role },
      };
    } catch {
      return null;
    }
  }

  //Signs the user out everywhere, which is broader than the jwt adapter's
  //single family. Cognito's admin API offers all or nothing.
  public async logout(token: string): Promise<void> {
    const packed = this.unpackRefreshToken(token);

    try {
      const sub = packed ? packed.sub : String((await this.verifier.verify(token)).sub);

      await this.client.send(
        new AdminUserGlobalSignOutCommand({
          UserPoolId: this.config.userPoolId,
          Username: sub,
        }),
      );
    } catch {
      //A token that will not verify cannot name a session to end, and somebody
      //signing out should never see an error for already being signed out.
    }
  }

  //Nothing here hashes a password, and a caller that thinks otherwise has a bug
  //worth seeing. Writing a hash to a column nobody reads would look like it had
  //worked, which is the failure that costs somebody their afternoon.
  public async hashPassword(): Promise<string> {
    throw badRequest(
      'Passwords are managed in Cognito, so TweakTags cannot hash one for this install.',
    );
  }

  public async verifyPassword(email: string, password: string): Promise<boolean> {
    return (await this.authenticate(email, password)) !== null;
  }

  //Used by the command line, which is how the first superuser is made.
  public async createUser(email: string, password: string, role: Role): Promise<Actor> {
    const account = await this.directory.createOrLink(email, password);
    const user = await this.store.createUser({
      email,
      role,
      //Empty rather than a placeholder. It satisfies the not null column, and
      //bcrypt never matches an empty string, so this row cannot be signed in to
      //by the password provider if an install is ever switched back to it.
      passwordHash: '',
      externalId: account.externalId,
    });

    return { userId: user.id, role: user.role };
  }

  //Deliberately does nothing, and takes no spared family, because neither has
  //any meaning here.
  //
  //The handler calls this after a role change, a password reset and a delete.
  //Only the password reset actually needs it, and that one signs the user out
  //from setPassword, where the password is the thing that changed.
  //
  //A role change needs no sign out at all: the role lives in the TweakTags table
  //and verify reads it on every request, so a demotion already bites at once.
  //A delete needs none either, because verify refuses anybody with no linked row.
  //
  //Doing it anyway would mean AdminUserGlobalSignOut, which is pool wide. On a
  //pool shared with the customer's own application, demoting an editor would
  //also sign them out of everything else that pool backs. Losing access to the
  //CMS should not log somebody out of payroll.
  public async endSessions(): Promise<void> {}

  public readonly directory: UserDirectory = {
    createOrLink: async (email: string, password: string): Promise<DirectoryUser> => {
      try {
        await this.client.send(
          new AdminCreateUserCommand({
            UserPoolId: this.config.userPoolId,
            Username: email,
            //TweakTags shows the password to the administrator who typed it, so
            //Cognito must not also email an invitation with a different one.
            MessageAction: 'SUPPRESS',
            UserAttributes: [
              { Name: 'email', Value: email },
              //Marked verified because an administrator added them deliberately.
              //Without it the account sits unconfirmed and cannot sign in.
              { Name: 'email_verified', Value: 'true' },
            ],
          }),
        );

        //Set as permanent, which clears the FORCE_CHANGE_PASSWORD state a newly
        //created account starts in. Without this the first sign in answers with
        //a challenge, and none of the four login forms has a screen for one.
        await this.client.send(
          new AdminSetUserPasswordCommand({
            UserPoolId: this.config.userPoolId,
            Username: email,
            Password: password,
            Permanent: true,
          }),
        );
      } catch (error) {
        if (errorName(error) !== USER_EXISTS) {
          throw error;
        }

        //The interesting case. On a pool shared with another application this
        //person already has a login, so linking is the right answer and creating
        //is impossible. Their password is deliberately left alone: it is their
        //live credential for that other application, not ours to reset.
        const existing = await this.adminGet(email);

        if (!existing) {
          throw conflict(
            `Cognito says "${email}" already exists but will not return it. ` +
              `Check the pool for a deleted or disabled account with that address.`,
          );
        }

        return toDirectoryUser(existing, email, true);
      }

      const created = await this.adminGet(email);

      if (!created) {
        throw conflict(`Cognito did not return the account it just created for "${email}".`);
      }

      return toDirectoryUser(created, email, false);
    },

    findByExternalId: async (externalId: string): Promise<DirectoryUser | null> => {
      const account = await this.adminGet(externalId);

      return account ? toDirectoryUser(account, '', true) : null;
    },

    setPassword: async (externalId: string, password: string): Promise<void> => {
      await this.client.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: this.config.userPoolId,
          Username: externalId,
          Password: password,
          Permanent: true,
        }),
      );

      //The sign out belongs to the password change, not to the caller. A reset
      //that left the old sessions running would not be a reset, and this is the
      //one moment where reaching into every other application the pool backs is
      //the right thing: their password changed there too.
      //
      //It is pool wide because Cognito offers nothing narrower, so somebody
      //changing their own password is signed out here as well and has to sign
      //back in. That is the honest cost of the provider owning the sessions.
      await this.client.send(
        new AdminUserGlobalSignOutCommand({
          UserPoolId: this.config.userPoolId,
          Username: externalId,
        }),
      );
    },
  };

  //AdminGetUser takes the username, and a pool accepts the sub there as well,
  //which is what lets one lookup serve both an email and a stored link.
  private async adminGet(username: string): Promise<AdminGetUserCommandOutput | null> {
    try {
      return (await this.client.send(
        new AdminGetUserCommand({
          UserPoolId: this.config.userPoolId,
          Username: username,
        }),
      )) as unknown as AdminGetUserCommandOutput;
    } catch (error) {
      if (errorName(error) === USER_NOT_FOUND) {
        return null;
      }

      throw error;
    }
  }
}
