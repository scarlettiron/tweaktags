//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

//Names of the database tables that TweakTags owns.
//They all start with __TweakTags__ so they are easy to spot and do not clash
//with host application tables.
export const CONTENT_TABLE = '__TweakTags__Content';
export const AUTH_TABLE = '__TweakTags__Users';
export const REFRESH_TABLE = '__TweakTags__Refresh_Tokens';

//The two roles a user can have.
//A superuser can create new tags and edit any content.
//An editor can only edit content for tags that already exist.
export const ROLES = {
  SUPERUSER: 'superuser',
  EDITOR: 'editor',
} as const;

//The kinds of content a tag can hold.
//plain is normal text, rich is formatted html, and media is an image or file url.
export const TAG_TYPES = {
  PLAIN: 'plain',
  RICH: 'rich',
  MEDIA: 'media',
} as const;

//Every action the request handler understands.
//The client and the handler both refer to these by name.
export const ACTIONS = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  REFRESH: 'refresh',
  ME: 'me',
  GET_CONTENT: 'getContent',
  LIST_TAGS: 'listTags',
  CREATE_TAG: 'createTag',
  UPDATE_CONTENT: 'updateContent',
  UPDATE_TAG_TYPE: 'updateTagType',
  DELETE_TAG: 'deleteTag',
  //Asks the server for a presigned url to upload a media file to.
  SIGN_UPLOAD: 'signUpload',
} as const;

//Stable error codes the client can branch on.
export const ERROR_CODES = {
  BAD_REQUEST: 'bad_request',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  INTERNAL: 'internal_error',
} as const;

//Editable elements carry an attribute that bakes the tag name into the name itself.
//A tag named "hero-title" becomes the attribute "data-tweaktags-hero-title".
export const DATA_ATTRIBUTE_PREFIX = 'data-tweaktags-';

//Tag names live inside an html attribute name, so they may only use
//lowercase letters, numbers, and single hyphens between groups.
export const TAG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

//The tenant used when a config does not name one, so single site installs and
//existing content keep working with no changes.
export const DEFAULT_TENANT = 'default';

//A tenant name may only use letters, numbers, hyphens, and underscores. This is
//checked when a tenant comes from a host name, so a spoofed Host header cannot
//smuggle anything odd into a query.
export const TENANT_PATTERN = /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/i;

//Default values used when the user config leaves a field out.
export const DEFAULT_MODE = 'embedded';
export const DEFAULT_API_BASE_PATH = '/api/tweaktags';
export const DEFAULT_EDIT_IN_VIEW = false;
//The access token is short lived, the refresh token lasts longer.
//When the access token expires, the refresh token quietly gets a new one.
//When the refresh token expires, the user is signed out and logs back in.
export const DEFAULT_ACCESS_TTL_SECONDS = 60 * 15;
export const DEFAULT_REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7;

//File names the config loader will look for, in order.
export const CONFIG_FILE_NAMES = [
  'tweaktags.config.ts',
  'tweaktags.config.mts',
  'tweaktags.config.js',
  'tweaktags.config.mjs',
  'tweaktags.config.cjs',
];
