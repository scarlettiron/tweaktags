//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { ERROR_CODES } from '../constants/index.js';
import type { ErrorCode } from '../types/index.js';

//Maps each error code to the http status it should produce.
const STATUS_BY_CODE: Record<ErrorCode, number> = {
  [ERROR_CODES.BAD_REQUEST]: 400,
  [ERROR_CODES.UNAUTHORIZED]: 401,
  [ERROR_CODES.FORBIDDEN]: 403,
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.CONFLICT]: 409,
  [ERROR_CODES.INTERNAL]: 500,
};

//A single error type used across the whole system.
//It carries a stable code so the handler can pick the right status
//and the client can branch on the reason.
export class TweakTagsError extends Error {
  public readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'TweakTagsError';
    this.code = code;
  }

  //The http status that matches this error.
  public get status(): number {
    return STATUS_BY_CODE[this.code];
  }
}

//Small helpers so call sites read clearly.
export const badRequest = (message: string): TweakTagsError =>
  new TweakTagsError(ERROR_CODES.BAD_REQUEST, message);

export const unauthorized = (message: string): TweakTagsError =>
  new TweakTagsError(ERROR_CODES.UNAUTHORIZED, message);

export const forbidden = (message: string): TweakTagsError =>
  new TweakTagsError(ERROR_CODES.FORBIDDEN, message);

export const notFound = (message: string): TweakTagsError =>
  new TweakTagsError(ERROR_CODES.NOT_FOUND, message);

export const conflict = (message: string): TweakTagsError =>
  new TweakTagsError(ERROR_CODES.CONFLICT, message);
