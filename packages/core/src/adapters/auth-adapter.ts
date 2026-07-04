//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import type { Actor, AuthResult, Role } from '../types/index.js';

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
}
