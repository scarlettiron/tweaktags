//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { ACTIONS, DEFAULT_TENANT, ROLES, TAG_TYPES } from '../constants/index.js';
import type { AuthAdapter } from '../adapters/auth-adapter.js';
import type { DbAdapter } from '../adapters/db-adapter.js';
import type { StorageAdapter } from '../adapters/storage-adapter.js';
import type {
  Actor,
  TagType,
  TweakTagsConfig,
  TweakTagsRequest,
  TweakTagsResponse,
} from '../types/index.js';
import {
  TweakTagsError,
  badRequest,
  forbidden,
  unauthorized,
} from '../utilities/errors.js';
import { optionalString, requireString, requireStringArray } from '../utilities/validation.js';
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

//Turns any thrown value into a clean response.
//Known TweakTags errors keep their status and code, anything else becomes a 500.
const toErrorResponse = (error: unknown): TweakTagsResponse => {
  if (error instanceof TweakTagsError) {
    return {
      status: error.status,
      body: { error: error.code, message: error.message },
    };
  }

  const message = error instanceof Error ? error.message : 'Unknown error';

  return {
    status: 500,
    body: { error: 'internal_error', message },
  };
};

//Builds the request handler from its dependencies.
//This is where the auth and role rules live.
export const createHandler = (deps: HandlerDependencies): TweakTagsHandler => {
  const { db, auth } = deps;

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

  //Routes each action to the function that handles it.
  return async (request: TweakTagsRequest): Promise<TweakTagsResponse> => {
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

        default:
          throw badRequest(`Unknown action "${String(request.action)}"`);
      }
    } catch (error) {
      return toErrorResponse(error);
    }
  };
};
