//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import type { Actor, AuthResult, Role } from '../types/index.js';

//One person as the identity provider knows them, for providers that keep the
//logins outside TweakTags.
export interface DirectoryUser {
  //Their id at the provider, which is what a TweakTags row links to.
  externalId: string;
  email: string;

  //True when they were already in the provider and got linked, rather than
  //created just now. The panel turns this into the "already existed" wording,
  //and it is also the flag that says their password was left alone.
  alreadyExisted: boolean;
}

//The people directory of an identity provider, for the providers that have one.
//It is deliberately small: TweakTags only ever needs to add somebody, find
//somebody, and reset a password.
export interface UserDirectory {
  //Create this person at the provider, or hand back the one already there.
  //An existing account keeps its password: on a pool shared with another
  //application that password is somebody's live login, not ours to overwrite.
  createOrLink(email: string, password: string): Promise<DirectoryUser>;

  //Look somebody up by the provider's own id, for linking an account by hand.
  findByExternalId(externalId: string): Promise<DirectoryUser | null>;

  //Set somebody's password as an administrator, without knowing the old one.
  setPassword(externalId: string, password: string): Promise<void>;
}

//The auth adapter hides how login and tokens actually work.
//The jwt adapter is one implementation, and other providers can be added later.
export interface AuthAdapter {
  //Check an email and password and return access and refresh tokens plus the
  //public user. Throws a TweakTagsError when the details are wrong.
  login(email: string, password: string): Promise<AuthResult>;

  //Turn an access token back into an actor, or return null when it is invalid
  //or has expired.
  verify(token: string): Promise<Actor | null>;

  //Take a valid refresh token and return fresh access and refresh tokens plus
  //the user. Returns null when the refresh token is invalid or has expired,
  //which means the user has to sign in again.
  refresh(refreshToken: string): Promise<AuthResult | null>;

  //End a session.
  //Stateless tokens cannot really be revoked, so this may do nothing for now.
  logout(token: string): Promise<void>;

  //Hash a plain password so it can be stored safely.
  //The CLI uses this when it creates the first superuser.
  hashPassword(password: string): Promise<string>;

  //Create a user record using the underlying user store.
  //The role decides what the user is allowed to do.
  createUser(email: string, password: string, role: Role): Promise<Actor>;

  //Check a password without starting a session, for the moments where somebody
  //has to prove who they are again: changing their own email or password.
  //Calling login for this would work, but it writes a refresh token row every
  //time and would count as a login anywhere we later add rate limiting.
  verifyPassword(email: string, password: string): Promise<boolean>;

  //End a user's sessions, so a deleted or demoted person stops being signed in.
  //The jwt adapter deletes their refresh token rows; a provider that owns its
  //own sessions signs them out at the source instead. One family can be spared,
  //which only means anything for tokens TweakTags issued itself: a provider
  //that can only sign somebody out everywhere ignores it, and says so.
  endSessions(userId: string, exceptFamilyId?: string): Promise<void>;

  //The provider's people directory, on the providers that keep logins outside
  //TweakTags. Absent for the ordinary email and password case, and that absence
  //is what the handler branches on. It never learns which provider it is.
  directory?: UserDirectory;
}
