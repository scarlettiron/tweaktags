//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { randomUUID } from 'node:crypto';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import {
  unauthorized,
  type Actor,
  type AuthAdapter,
  type AuthResult,
  type RefreshTokenStore,
  type Role,
  type StoredUser,
  type UserStore,
} from '@tweaktags/core';

import { SALT_ROUNDS } from './constants/index.js';

//The settings the jwt adapter needs.
export interface JwtAuthOptions {
  secret: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  //When true, verify checks the session is still active on every request.
  strictRevocation: boolean;
}

//The store the adapter needs, both users and refresh tokens.
//The database adapter provides both.
type AuthStore = UserStore & RefreshTokenStore;

//Reads a role value safely, falling back to the editor role.
const toRole = (value: unknown): Role => (value === 'superuser' ? 'superuser' : 'editor');

//The jwt implementation of the TweakTags auth adapter.
//It checks passwords with bcrypt and hands out a short lived access token and a
//longer lived refresh token. Refresh tokens are rotated on every use and are
//tracked in a store, so a stolen token that gets reused is caught and the whole
//session is revoked.
export class JwtAuthAdapter implements AuthAdapter {
  private readonly store: AuthStore;

  private readonly secret: string;

  private readonly accessTtlSeconds: number;

  private readonly refreshTtlSeconds: number;

  private readonly strictRevocation: boolean;

  constructor(store: AuthStore, options: JwtAuthOptions) {
    this.store = store;
    this.secret = options.secret;
    this.accessTtlSeconds = options.accessTtlSeconds;
    this.refreshTtlSeconds = options.refreshTtlSeconds;
    this.strictRevocation = options.strictRevocation;
  }

  //Signs a new pair of tokens for a user and records the refresh token.
  //The kind claim keeps the two tokens from being used in place of each other.
  //The jti and family claims let us rotate tokens and catch reuse.
  private async issueTokenPair(
    user: StoredUser,
    familyId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const jti = randomUUID();

    const accessToken = jwt.sign(
      { sub: user.id, role: user.role, kind: 'access', fam: familyId },
      this.secret,
      { expiresIn: this.accessTtlSeconds },
    );

    const refreshToken = jwt.sign(
      { sub: user.id, kind: 'refresh', jti, fam: familyId },
      this.secret,
      { expiresIn: this.refreshTtlSeconds },
    );

    const expiresAt = new Date(Date.now() + this.refreshTtlSeconds * 1000).toISOString();

    await this.store.saveRefreshToken({
      id: jti,
      familyId,
      userId: user.id,
      expiresAt,
      revoked: false,
    });

    return { accessToken, refreshToken };
  }

  public async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.store.findUserByEmail(email);

    //We use the same error whether the email or the password is wrong,
    //so an attacker cannot tell which part failed.
    if (!user) {
      throw unauthorized('The email or password is incorrect');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      throw unauthorized('The email or password is incorrect');
    }

    //Each login starts a new family of refresh tokens.
    const familyId = randomUUID();
    const { accessToken, refreshToken } = await this.issueTokenPair(user, familyId);

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  public async verify(token: string): Promise<Actor | null> {
    try {
      const decoded = jwt.verify(token, this.secret);

      //Only an access token may authenticate a request.
      if (typeof decoded === 'string' || !decoded.sub || decoded.kind !== 'access') {
        return null;
      }

      //In strict mode, make sure the session has not been logged out or revoked.
      if (this.strictRevocation && decoded.fam) {
        const active = await this.store.isRefreshFamilyActive(String(decoded.fam));

        if (!active) {
          return null;
        }
      }

      return { userId: String(decoded.sub), role: toRole(decoded.role) };
    } catch {
      //Any verify failure, like an expired or tampered token, means no actor.
      return null;
    }
  }

  public async refresh(refreshToken: string): Promise<AuthResult | null> {
    let jti: string;
    let familyId: string;

    try {
      const decoded = jwt.verify(refreshToken, this.secret);

      if (
        typeof decoded === 'string' ||
        decoded.kind !== 'refresh' ||
        !decoded.sub ||
        !decoded.jti ||
        !decoded.fam
      ) {
        return null;
      }

      jti = String(decoded.jti);
      familyId = String(decoded.fam);
    } catch {
      //Expired or tampered refresh token means the session is over.
      return null;
    }

    const record = await this.store.findRefreshToken(jti);

    //A token that is not on file, when it should be, is treated as a possible
    //theft, so we revoke the whole family to be safe.
    if (!record) {
      await this.store.revokeRefreshFamily(familyId);

      return null;
    }

    //A token that was already rotated is being reused, which is a strong sign it
    //was stolen. Revoke the entire family so nobody can keep using it.
    if (record.revoked) {
      await this.store.revokeRefreshFamily(record.familyId);

      return null;
    }

    //The token is valid, so rotate it. Mark this one used and issue a new pair
    //in the same family.
    await this.store.revokeRefreshToken(jti);

    const user = await this.store.findUserById(record.userId);

    if (!user) {
      return null;
    }

    const { accessToken, refreshToken: newRefreshToken } = await this.issueTokenPair(
      user,
      record.familyId,
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  public async logout(token: string): Promise<void> {
    //End the whole session by revoking its refresh token family.
    try {
      const decoded = jwt.verify(token, this.secret);

      if (typeof decoded !== 'string' && decoded.fam) {
        await this.store.revokeRefreshFamily(String(decoded.fam));
      }
    } catch {
      //A missing or invalid token means there is nothing to revoke.
    }
  }

  public async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  public async createUser(email: string, password: string, role: Role): Promise<Actor> {
    const passwordHash = await this.hashPassword(password);
    const user = await this.store.createUser({ email, passwordHash, role });

    return { userId: user.id, role: user.role };
  }
}
