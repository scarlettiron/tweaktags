//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import {
  EMAIL_PATTERN,
  MAX_EMAIL_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  ROLES,
} from '../constants/index.js';
import type { Role } from '../types/index.js';
import { badRequest } from './errors.js';
import { assertNoSqlInjection } from './safety.js';

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

//Reads an email field and checks it looks like an address.
//The pattern is loose on purpose, see EMAIL_PATTERN. The value is trimmed but
//deliberately NOT lowercased: lowercasing on write without also lowercasing at
//login would store an address the person cannot sign in with.
export const requireEmail = (payload: unknown, field: string): string => {
  const value = requireString(payload, field).trim();

  if (value.length > MAX_EMAIL_LENGTH) {
    throw badRequest(`The field "${field}" is too long to be an email address`);
  }

  if (!EMAIL_PATTERN.test(value)) {
    throw badRequest('Enter a valid email address');
  }

  //The same check the cli runs before creating a user.
  assertNoSqlInjection(value, field);

  return value;
};

//Reads a password field and checks its length.
//It runs none of the safety checks the other fields get: a password is hashed
//and never interpolated anywhere, so refusing one for looking like sql would
//reject a perfectly strong password and shrink the space people can choose from.
export const requirePassword = (payload: unknown, field: string): string => {
  const value = requireString(payload, field);

  if (value.length < MIN_PASSWORD_LENGTH) {
    throw badRequest(`The password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  if (value.length > MAX_PASSWORD_LENGTH) {
    throw badRequest(`The password must be ${MAX_PASSWORD_LENGTH} characters or fewer`);
  }

  return value;
};

//Reads a role field, which may only be one of the two roles that exist.
export const requireRole = (payload: unknown, field: string): Role => {
  const value = requireString(payload, field);

  if (value !== ROLES.SUPERUSER && value !== ROLES.EDITOR) {
    throw badRequest('The role must be either superuser or editor');
  }

  return value;
};

//The same email check the server runs, for a form that wants to say something
//before making a request. The server checks again regardless.
export const isValidEmail = (email: string): boolean => {
  const value = email.trim();

  return value.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(value);
};
