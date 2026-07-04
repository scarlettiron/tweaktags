//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { DEFAULT_TENANT, TENANT_PATTERN } from '../constants/index.js';
import type { TenantContext, TweakTagsConfig } from '../types/index.js';
import { badRequest } from './errors.js';

//Checks a tenant name is safe to use, and returns it. Throws a clear error when
//it is not, so a strange value never reaches the database.
export const assertValidTenant = (tenant: string): string => {
  if (!TENANT_PATTERN.test(tenant)) {
    throw badRequest(
      `The tenant "${tenant}" is not valid. Use letters, numbers, hyphens, and underscores.`,
    );
  }

  return tenant;
};

//Works out which tenant a request belongs to. When a resolver is set it decides
//from the host or headers, and anything it does not answer falls back to the
//config tenant, then to the default. The result is validated, which matters when
//the tenant comes from a host name a caller could have spoofed.
export const resolveTenant = (config: TweakTagsConfig, context: TenantContext): string => {
  const chosen = config.resolveTenant?.(context) ?? config.tenant ?? DEFAULT_TENANT;

  return assertValidTenant(chosen);
};
