//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import type {
  Actor,
  AuthUser,
  ContentInput,
  ContentRecord,
  CreateUserInput,
  RefreshTokenRecord,
  StoredUser,
  TagType,
} from '../types/index.js';

//The part of the database adapter that deals with users.
//The auth adapter is given one of these so it can read and write users
//without knowing which database is underneath.
export interface UserStore {
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findUserById(id: string): Promise<StoredUser | null>;
  createUser(input: CreateUserInput): Promise<StoredUser>;

  //Change the stored password hash for the user with this email.
  //Returns true when a user was updated, or false when no user matched.
  updateUserPassword(email: string, passwordHash: string): Promise<boolean>;
}

//The part of the database adapter that stores refresh tokens.
//The auth adapter uses this to rotate tokens and catch a stolen one being reused.
export interface RefreshTokenStore {
  //Save a newly issued refresh token.
  saveRefreshToken(record: RefreshTokenRecord): Promise<void>;

  //Look up a refresh token by its id, or return null when it is not stored.
  findRefreshToken(id: string): Promise<RefreshTokenRecord | null>;

  //Mark a single refresh token as used or revoked.
  revokeRefreshToken(id: string): Promise<void>;

  //Revoke every refresh token in a family, ending that session everywhere.
  revokeRefreshFamily(familyId: string): Promise<void>;

  //Whether a family still has a live token. Used by strict revocation to check
  //that an access token's session has not been logged out or revoked.
  isRefreshFamilyActive(familyId: string): Promise<boolean>;
}

//The full database adapter.
//A concrete adapter, like the Postgres one, implements every method here.
export interface DbAdapter extends UserStore, RefreshTokenStore {
  //Create the TweakTags tables if they do not exist yet.
  runMigrations(): Promise<void>;

  //Read the content rows for a set of tags within one tenant.
  //Tags with no row simply do not appear in the result.
  getContentByTags(tenant: string, tags: string[]): Promise<ContentRecord[]>;

  //Create a brand new tag with empty content and the given type, in one tenant.
  //Only a superuser should reach this method.
  createTag(tenant: string, tag: string, type: TagType, actor: Actor): Promise<ContentRecord>;

  //Save the body and media url for a tag in one tenant.
  //The handler decides who is allowed to call this.
  upsertContent(tenant: string, input: ContentInput, actor: Actor): Promise<ContentRecord>;

  //Change a tag's type within one tenant. Only a superuser should reach this.
  setTagType(tenant: string, tag: string, type: TagType, actor: Actor): Promise<ContentRecord>;

  //Delete a tag and its content within one tenant.
  //Only a superuser should reach this method.
  deleteTag(tenant: string, tag: string, actor: Actor): Promise<void>;

  //List every tag that currently has a row in one tenant.
  listTags(tenant: string): Promise<string[]>;

  //List every user, without their password hashes.
  listUsers(): Promise<AuthUser[]>;

  //Close any open database connections.
  close(): Promise<void>;
}
