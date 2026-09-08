//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { ACTIONS, DEFAULT_TENANT, ERROR_CODES, ROLES, TAG_TYPES } from '../constants/index.js';
import type { AuthAdapter } from '../adapters/auth-adapter.js';
import type { DbAdapter } from '../adapters/db-adapter.js';
import type { StorageAdapter } from '../adapters/storage-adapter.js';
import type {
  Actor,
  Logger,
  StoredUser,
  TagType,
  TweakTagsConfig,
  TweakTagsRequest,
  TweakTagsResponse,
} from '../types/index.js';
import {
  TweakTagsError,
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized,
} from '../utilities/errors.js';
import { createDefaultLogger, isProduction, newTraceId, toLoggedError } from '../utilities/logger.js';
import { diagnoseFailure } from '../utilities/diagnose.js';
import {
  optionalString,
  requireEmail,
  requirePassword,
  requireRole,
  requireString,
  requireStringArray,
} from '../utilities/validation.js';
import { assertValidTag } from '../utilities/tag.js';
import { assertNoDangerousHtml, assertSafeInput } from '../utilities/safety.js';

//Reads an optional tag type from the payload, defaulting to plain text.
const readTagType = (payload: unknown): TagType => {
  if (typeof payload !== 'object' || payload === null) {
    return TAG_TYPES.PLAIN;
  }

  const value = (payload as Record<string, unknown>).type;

  if (value === undefined || value === null) {
    return TAG_TYPES.PLAIN;
  }

  if (value === TAG_TYPES.PLAIN || value === TAG_TYPES.RICH || value === TAG_TYPES.MEDIA) {
    return value;
  }

  throw badRequest('The tag type must be one of: plain, rich, media');
};

//The pieces the handler needs to do its job.
//The server and Next packages build these and pass them in.
export interface HandlerDependencies {
  db: DbAdapter;
  auth: AuthAdapter;
  config: TweakTagsConfig;
  //Optional storage for media uploads. Absent means uploads are turned off.
  storage?: StorageAdapter;
}

//Cleans a filename down to safe characters for an object key, and keeps it short.
const safeFilename = (name: string): string => {
  const base = name.replace(/^.*[\\/]/, '').replace(/[^a-zA-Z0-9._-]/g, '-');

  return (base || 'file').slice(-100);
};

//A short unique id for an upload key. Not a secret, just a collision guard, so a
//plain timestamp and random suffix is enough and avoids any node only imports.
const uploadId = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

//A function that takes a normalized request and returns a normalized response.
export type TweakTagsHandler = (request: TweakTagsRequest) => Promise<TweakTagsResponse>;

//What the caller needs to log one failed request and tie it back to a report.
interface FailureContext {
  traceId: string;
  action: string;
  tenant: string;
  durationMs: number;
  logger: Logger;
}

//Turns any thrown value into a clean response, and leaves a trace behind.
//
//A TweakTagsError is something the caller did, like a bad tag name or a missing
//login. Its message is written for the person using the editor, so it goes back
//as it is and is logged as a warning.
//
//Anything else is the server or its database falling over. The real message can
//name internals, so in production the caller gets a generic line and the trace
//id, while the log keeps the message, the stack, and a hint about what usually
//causes this failure. In development the message comes back too, since whoever
//sees it is the person who can fix it.
const toErrorResponse = (error: unknown, context: FailureContext): TweakTagsResponse => {
  const { traceId, action, tenant, durationMs, logger } = context;

  if (error instanceof TweakTagsError) {
    logger({
      level: 'warn',
      event: 'request.rejected',
      message: error.message,
      traceId,
      action,
      tenant,
      status: error.status,
      code: error.code,
      durationMs,
    });

    return {
      status: error.status,
      body: { error: error.code, message: error.message, traceId },
    };
  }

  const detail = error instanceof Error ? error.message : 'Unknown error';
  const diagnosis = diagnoseFailure(error);

  logger({
    level: 'error',
    event: 'request.failed',
    message: detail,
    traceId,
    action,
    tenant,
    status: 500,
    code: ERROR_CODES.INTERNAL,
    durationMs,
    reason: diagnosis.reason,
    hint: diagnosis.hint,
    error: toLoggedError(error),
  });

  const message = isProduction()
    ? `Something went wrong on the server. Trace id: ${traceId}`
    : `${detail} (trace id: ${traceId})`;

  return {
    status: 500,
    body: { error: 'internal_error', message, traceId },
  };
};

//Builds the request handler from its dependencies.
//This is where the auth and role rules live.
export const createHandler = (deps: HandlerDependencies): TweakTagsHandler => {
  const { db, auth } = deps;

  //resolveConfig fills this in, but a hand built config may not have, and a
  //failure with nowhere to go is exactly what we are trying to fix here.
  const logger = deps.config.logger ?? createDefaultLogger();

  //The tenant is set by the server from the config, never by the client, so
  //scoping cannot be spoofed. It falls back to the config default, then to the
  //shared default, which keeps single tenant installs working.
  const tenantOf = (request: TweakTagsRequest): string =>
    request.tenant ?? deps.config.tenant ?? DEFAULT_TENANT;

  //Verifies the token on the request and returns the actor.
  //Throws when there is no token or the token is not valid.
  const requireActor = async (request: TweakTagsRequest): Promise<Actor> => {
    if (!request.authToken) {
      throw unauthorized('You must be signed in to do this');
    }

    const actor = await auth.verify(request.authToken);

    if (!actor) {
      throw unauthorized('Your session is not valid, please sign in again');
    }

    return actor;
  };

  //The signed in user, read fresh from the database rather than taken from the
  //token. Also gives us their email, which the self service handlers need since
  //an Actor only carries an id.
  const requireCurrentUser = async (request: TweakTagsRequest): Promise<StoredUser> => {
    const actor = await requireActor(request);
    const user = await db.findUserById(actor.userId);

    if (!user) {
      throw unauthorized('Your account could not be found');
    }

    return user;
  };

  //Every user management action goes through here. The role check reads the
  //database on purpose: verify() trusts the role baked into the token, so a
  //superuser who was just demoted would otherwise keep their powers until that
  //token expired, which is long enough to promote themselves back or to delete
  //the person who demoted them. One extra read on a handful of rare actions
  //closes that. The content actions are untouched, and strictRevocation is still
  //the answer for an install that wants the same guarantee everywhere.
  const requireSuperuser = async (request: TweakTagsRequest): Promise<StoredUser> => {
    const user = await requireCurrentUser(request);

    if (user.role !== ROLES.SUPERUSER) {
      throw forbidden('Only a superuser can manage users');
    }

    return user;
  };

  //How many superusers exist. Built on listUsers rather than a dedicated count
  //query: these tables hold a handful of rows, and a count method would need
  //writing four times without making the check below any less racy.
  const countSuperusers = async (): Promise<number> => {
    const users = await db.listUsers();

    return users.filter((user) => user.role === ROLES.SUPERUSER).length;
  };

  const handleLogin = async (request: TweakTagsRequest): Promise<TweakTagsResponse> => {
    const email = requireString(request.payload, 'email');
    const password = requireString(request.payload, 'password');
    const result = await auth.login(email, password);

    return {
      status: 200,
      body: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      },
    };
  };

  const handleRefresh = async (request: TweakTagsRequest): Promise<TweakTagsResponse> => {
    //The refresh token comes from its cookie, or from the body in header mode.
    const refreshToken = request.refreshToken ?? optionalString(request.payload, 'refreshToken');

    if (!refreshToken) {
      throw unauthorized('No refresh token was provided');
    }

    const result = await auth.refresh(refreshToken);

    if (!result) {
      throw unauthorized('Your session has expired, please sign in again');
    }

    return {
      status: 200,
      body: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      },
    };
  };

  const handleLogout = async (request: TweakTagsRequest): Promise<TweakTagsResponse> => {
    //Prefer the refresh token so the whole session family can be revoked.
    const token = request.refreshToken ?? request.authToken;

    if (token) {
      await auth.logout(token);
    }

    return { status: 200, body: { ok: true } };
  };

  const handleMe = async (request: TweakTagsRequest): Promise<TweakTagsResponse> => {
    const actor = await requireActor(request);
    const user = await db.findUserById(actor.userId);

    if (!user) {
      throw unauthorized('Your account could not be found');
    }

    return {
      status: 200,
      body: { user: { id: user.id, email: user.email, role: user.role } },
    };
  };

  const handleGetContent = async (request: TweakTagsRequest): Promise<TweakTagsResponse> => {
    const tags = requireStringArray(request.payload, 'tags');
    const content = await db.getContentByTags(tenantOf(request), tags);

    return { status: 200, body: { content } };
  };

  const handleListTags = async (request: TweakTagsRequest): Promise<TweakTagsResponse> => {
    await requireActor(request);
    const tags = await db.listTags(tenantOf(request));

    return { status: 200, body: { tags } };
  };

  const handleCreateTag = async (request: TweakTagsRequest): Promise<TweakTagsResponse> => {
    const actor = await requireActor(request);

    if (actor.role !== ROLES.SUPERUSER) {
      throw forbidden('Only a superuser can create new tags');
    }

    const tag = assertValidTag(requireString(request.payload, 'tag'));
    const type = readTagType(request.payload);
    const content = await db.createTag(tenantOf(request), tag, type, actor);

    return { status: 201, body: { content } };
  };

  const handleUpdateContent = async (request: TweakTagsRequest): Promise<TweakTagsResponse> => {
    const actor = await requireActor(request);
    const tenant = tenantOf(request);
    const tag = assertValidTag(requireString(request.payload, 'tag'));
    const body = requireString(request.payload, 'body');
    const mediaUrl = optionalString(request.payload, 'mediaUrl');

    //Check the text for database attacks and for code like script tags,
    //and deny the save with a clear message when something is found.
    assertSafeInput(body, 'text you are saving');

    if (mediaUrl) {
      assertNoDangerousHtml(mediaUrl, 'media url');
    }

    //An editor is only allowed to change tags that already exist in this tenant.
    //A superuser may create the row as part of the update.
    if (actor.role !== ROLES.SUPERUSER) {
      const existing = await db.getContentByTags(tenant, [tag]);

      if (existing.length === 0) {
        throw forbidden('Editors can only change tags that already exist');
      }
    }

    const content = await db.upsertContent(tenant, { tag, body, mediaUrl }, actor);

    return { status: 200, body: { content } };
  };

  const handleUpdateTagType = async (request: TweakTagsRequest): Promise<TweakTagsResponse> => {
    const actor = await requireActor(request);

    if (actor.role !== ROLES.SUPERUSER) {
      throw forbidden('Only a superuser can change a tag type');
    }

    const tag = assertValidTag(requireString(request.payload, 'tag'));
    const type = readTagType(request.payload);
    const content = await db.setTagType(tenantOf(request), tag, type, actor);

    return { status: 200, body: { content } };
  };

  const handleDeleteTag = async (request: TweakTagsRequest): Promise<TweakTagsResponse> => {
    const actor = await requireActor(request);

    if (actor.role !== ROLES.SUPERUSER) {
      throw forbidden('Only a superuser can delete tags');
    }

    const tag = assertValidTag(requireString(request.payload, 'tag'));
    await db.deleteTag(tenantOf(request), tag, actor);

    return { status: 200, body: { ok: true, tag } };
  };

  const handleSignUpload = async (request: TweakTagsRequest): Promise<TweakTagsResponse> => {
    //Any signed in editor may upload, the same as saving content.
    await requireActor(request);

    if (!deps.storage) {
      throw badRequest('Media uploads are not set up on this server');
    }

    const filename = requireString(request.payload, 'filename');
    const contentType = optionalString(request.payload, 'contentType') ?? 'application/octet-stream';

    //The key is namespaced by tenant, so one site's uploads never mix with
    //another's, and the browser never chooses where the file lands.
    const key = `${tenantOf(request)}/${uploadId()}-${safeFilename(filename)}`;
    const target = await deps.storage.createUploadUrl({ key, contentType });

    return {
      status: 200,
      body: {
        uploadUrl: target.uploadUrl,
        publicUrl: target.publicUrl,
        headers: target.headers ?? {},
      },
    };
  };

  const handleListUsers = async (request: TweakTagsRequest): Promise<TweakTagsResponse> => {
    await requireSuperuser(request);

    return { status: 200, body: { users: await db.listUsers() } };
  };

  const handleCreateUser = async (request: TweakTagsRequest): Promise<TweakTagsResponse> => {
    await requireSuperuser(request);

    const email = requireEmail(request.payload, 'email');
    const password = requirePassword(request.payload, 'password');
    const role = requireRole(request.payload, 'role');

    //Hash and insert directly rather than going through auth.createUser, which
    //hands back only an id and a role. The panel needs the whole user to add a
    //row to its list, and the duplicate email conflict comes free from the
    //database adapters.
    const passwordHash = await auth.hashPassword(password);
    const user = await db.createUser({ email, role, passwordHash });

    return {
      status: 201,
      body: { user: { id: user.id, email: user.email, role: user.role } },
    };
  };

  const handleUpdateUserRole = async (request: TweakTagsRequest): Promise<TweakTagsResponse> => {
    const actor = await requireSuperuser(request);
    const userId = requireString(request.payload, 'userId');
    const role = requireRole(request.payload, 'role');

    //Changing your own role is the one way a lone superuser could lock everybody
    //out of user management, with no way back except editing the database by
    //hand. Promote somebody else and let them do it.
    if (userId === actor.id) {
      throw forbidden('You cannot change your own role');
    }

    const target = await db.findUserById(userId);

    if (!target) {
      throw notFound('That user could not be found');
    }

    //A backstop against leaving nobody able to manage users. Nothing can reach it
    //today: the caller is a superuser by the row above, so a second superuser
    //target means two, and demoting the only one is your own row, refused above.
    //It stays because it is the rule itself rather than a consequence of one, and
    //relaxing self demotion later would otherwise reopen the lockout quietly.
    if (target.role === ROLES.SUPERUSER && role === ROLES.EDITOR && (await countSuperusers()) <= 1) {
      throw conflict(
        'This is the only superuser left, so their role cannot be changed. Make somebody else a superuser first.',
      );
    }

    await db.setUserRole(userId, role);

    //A role lives inside the access token, so end their sessions and make them
    //sign in again rather than leave them holding the old one.
    await db.deleteRefreshTokensForUser(userId);

    return {
      status: 200,
      body: { user: { id: target.id, email: target.email, role } },
    };
  };

  const handleUpdateUserPassword = async (
    request: TweakTagsRequest,
  ): Promise<TweakTagsResponse> => {
    await requireSuperuser(request);

    const userId = requireString(request.payload, 'userId');
    const password = requirePassword(request.payload, 'password');
    const target = await db.findUserById(userId);

    if (!target) {
      throw notFound('That user could not be found');
    }

    await db.setUserPassword(userId, await auth.hashPassword(password));

    //A reset that left the old sessions signed in would not be a reset.
    await db.deleteRefreshTokensForUser(userId);

    return { status: 200, body: { ok: true } };
  };

  const handleDeleteUser = async (request: TweakTagsRequest): Promise<TweakTagsResponse> => {
    const actor = await requireSuperuser(request);
    const userId = requireString(request.payload, 'userId');

    //Checked before the lookup, so deleting yourself always says so, even in the
    //odd case where your own row has gone missing.
    if (userId === actor.id) {
      throw forbidden('You cannot delete your own account');
    }

    const target = await db.findUserById(userId);

    if (!target) {
      throw notFound('That user could not be found');
    }

    //Judged on the role the target holds right now. Demote them first, which is
    //deliberate friction: it makes removing an administrator two decisions.
    if (target.role === ROLES.SUPERUSER) {
      throw forbidden('A superuser cannot be deleted. Change their role to editor first.');
    }

    //The user row goes first. If the token cleanup then fails their sessions are
    //already dead, because refreshing looks the user up and finds nobody. The
    //other order would sign somebody out for a delete that did not happen.
    await db.deleteUser(userId);
    await db.deleteRefreshTokensForUser(userId);

    return { status: 200, body: { ok: true, userId } };
  };

  const handleUpdateMyEmail = async (request: TweakTagsRequest): Promise<TweakTagsResponse> => {
    const user = await requireCurrentUser(request);
    const currentPassword = requireString(request.payload, 'currentPassword');
    const email = requireEmail(request.payload, 'email');

    //403 rather than 401 on purpose: the api client treats a 401 as an expired
    //session, refreshes, and replays the request, which would submit the wrong
    //password a second time.
    if (!(await auth.verifyPassword(user.email, currentPassword))) {
      throw forbidden('Your current password is not correct');
    }

    //Throws a conflict when somebody else already has that address.
    await db.setUserEmail(user.id, email);

    //No sessions are ended here. The password did not change, only the name they
    //sign in with, so the client just needs the new user back.
    return {
      status: 200,
      body: { user: { id: user.id, email, role: user.role } },
    };
  };

  const handleUpdateMyPassword = async (request: TweakTagsRequest): Promise<TweakTagsResponse> => {
    const actor = await requireActor(request);
    const user = await db.findUserById(actor.userId);

    if (!user) {
      throw unauthorized('Your account could not be found');
    }

    const currentPassword = requireString(request.payload, 'currentPassword');
    const password = requirePassword(request.payload, 'password');

    if (!(await auth.verifyPassword(user.email, currentPassword))) {
      throw forbidden('Your current password is not correct');
    }

    await db.setUserPassword(user.id, await auth.hashPassword(password));

    //Signs out their other devices but not this one, so changing a password does
    //not throw the person doing it back to the login screen.
    await db.deleteRefreshTokensForUser(user.id, actor.familyId);

    return { status: 200, body: { ok: true } };
  };

  //Routes each action to the function that handles it. Every request carries a
  //trace id, so a failure the caller reports can be found in the log.
  return async (request: TweakTagsRequest): Promise<TweakTagsResponse> => {
    const traceId = newTraceId();
    const startedAt = Date.now();

    try {
      switch (request.action) {
        case ACTIONS.LOGIN:
          return await handleLogin(request);

        case ACTIONS.LOGOUT:
          return await handleLogout(request);

        case ACTIONS.REFRESH:
          return await handleRefresh(request);

        case ACTIONS.ME:
          return await handleMe(request);

        case ACTIONS.GET_CONTENT:
          return await handleGetContent(request);

        case ACTIONS.LIST_TAGS:
          return await handleListTags(request);

        case ACTIONS.CREATE_TAG:
          return await handleCreateTag(request);

        case ACTIONS.UPDATE_CONTENT:
          return await handleUpdateContent(request);

        case ACTIONS.UPDATE_TAG_TYPE:
          return await handleUpdateTagType(request);

        case ACTIONS.DELETE_TAG:
          return await handleDeleteTag(request);

        case ACTIONS.SIGN_UPLOAD:
          return await handleSignUpload(request);

        case ACTIONS.LIST_USERS:
          return await handleListUsers(request);

        case ACTIONS.CREATE_USER:
          return await handleCreateUser(request);

        case ACTIONS.UPDATE_USER_ROLE:
          return await handleUpdateUserRole(request);

        case ACTIONS.UPDATE_USER_PASSWORD:
          return await handleUpdateUserPassword(request);

        case ACTIONS.DELETE_USER:
          return await handleDeleteUser(request);

        case ACTIONS.UPDATE_MY_EMAIL:
          return await handleUpdateMyEmail(request);

        case ACTIONS.UPDATE_MY_PASSWORD:
          return await handleUpdateMyPassword(request);

        default:
          throw badRequest(`Unknown action "${String(request.action)}"`);
      }
    } catch (error) {
      return toErrorResponse(error, {
        traceId,
        action: String(request.action),
        tenant: tenantOf(request),
        durationMs: Date.now() - startedAt,
        logger,
      });
    }
  };
};
