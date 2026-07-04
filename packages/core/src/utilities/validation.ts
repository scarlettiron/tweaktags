//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { badRequest } from './errors.js';

//Reads a field from an unknown payload and makes sure it is a non empty string.
//Throws a clear bad request error when the field is missing or the wrong type.
export const requireString = (payload: unknown, field: string): string => {
  if (typeof payload !== 'object' || payload === null) {
    throw badRequest('The request body must be an object');
  }

  const value = (payload as Record<string, unknown>)[field];

  if (typeof value !== 'string' || value.trim() === '') {
    throw badRequest(`The field "${field}" is required and must be a non empty string`);
  }

  return value;
};

//Reads an optional string field.
//Returns null when the field is missing or explicitly null.
export const optionalString = (payload: unknown, field: string): string | null => {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const value = (payload as Record<string, unknown>)[field];

  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw badRequest(`The field "${field}" must be a string when provided`);
  }

  return value;
};

//Reads a field that must be an array of strings.
export const requireStringArray = (payload: unknown, field: string): string[] => {
  if (typeof payload !== 'object' || payload === null) {
    throw badRequest('The request body must be an object');
  }

  const value = (payload as Record<string, unknown>)[field];

  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw badRequest(`The field "${field}" must be an array of strings`);
  }

  return value as string[];
};
