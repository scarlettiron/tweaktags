//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { badRequest } from './errors.js';

//Patterns that look like an attempt at SQL injection.
//TweakTags already uses parameterized queries, so these are a second layer of
//defense, and they also stop obviously bad input from being stored at all.
//The patterns are kept specific so normal writing, like an apostrophe in a
//word, does not trip them.
const SQL_INJECTION_PATTERNS: RegExp[] = [
  //Classic tautology, like ' OR 1=1 or " or 'a'='a'.
  /['"]\s*(or|and)\s+['"]?\w+['"]?\s*=\s*['"]?\w+/i,
  //A statement separator followed by a destructive keyword.
  /;\s*(drop|delete|truncate|alter|update|insert|create)\s+/i,
  //A union based injection.
  /\bunion\s+select\b/i,
  //Dropping or truncating a table anywhere.
  /\b(drop|truncate)\s+table\b/i,
  //An inline SQL comment used to cut off the rest of a query.
  /(--|#).*(\bor\b|\band\b|=)/i,
];

//Patterns for html that could run code in the browser.
const DANGEROUS_HTML_PATTERNS: RegExp[] = [
  //A script tag, opening or closing.
  /<\s*\/?\s*script/i,
  //An inline event handler, like onclick= or onerror=.
  /\son\w+\s*=/i,
  //A javascript url used in a link or image source.
  /javascript\s*:/i,
  //An iframe, which can load anything.
  /<\s*iframe/i,
];

//Throws a clear error when the value looks like SQL injection.
export const assertNoSqlInjection = (value: string, fieldLabel: string): void => {
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(value)) {
      throw badRequest(
        `The ${fieldLabel} was rejected because it looks like a database attack. ` +
          `Please remove any SQL code and try again.`,
      );
    }
  }
};

//Throws a clear error when the value contains script tags or other code.
export const assertNoDangerousHtml = (value: string, fieldLabel: string): void => {
  for (const pattern of DANGEROUS_HTML_PATTERNS) {
    if (pattern.test(value)) {
      throw badRequest(
        `The ${fieldLabel} was rejected because it contains code that is not allowed, ` +
          `such as a script tag.`,
      );
    }
  }
};

//Runs both safety checks on a value that a user is trying to save.
export const assertSafeInput = (value: string, fieldLabel: string): void => {
  assertNoSqlInjection(value, fieldLabel);
  assertNoDangerousHtml(value, fieldLabel);
};
