//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

export {
  TweakTagsError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
} from './errors.js';

export {
  requireString,
  optionalString,
  requireStringArray,
  requireEmail,
  requirePassword,
  requireRole,
  isValidEmail,
} from './validation.js';

export {
  isValidTag,
  normalizeTag,
  assertValidTag,
  dataAttributeForTag,
  tagFromDataAttribute,
} from './tag.js';

export { assertNoSqlInjection, assertNoDangerousHtml, assertSafeInput } from './safety.js';

export { CSRF_HEADER, requiresCsrf } from './csrf.js';

export { resolveTenant, assertValidTenant } from './tenant.js';

export { createDefaultLogger, newTraceId, toLoggedError } from './logger.js';

export { diagnoseFailure } from './diagnose.js';
