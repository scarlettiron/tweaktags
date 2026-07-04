//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { describe, expect, it } from 'vitest';

import { assertNoDangerousHtml, assertNoSqlInjection, assertSafeInput } from '@tweaktags/core';

describe('assertNoSqlInjection', () => {
  it('rejects classic injection attempts', () => {
    expect(() => assertNoSqlInjection("' OR 1=1", 'email')).toThrow();
    expect(() => assertNoSqlInjection("'; DROP TABLE users; --", 'email')).toThrow();
    expect(() => assertNoSqlInjection('UNION SELECT password FROM users', 'email')).toThrow();
    expect(() => assertNoSqlInjection('please DROP TABLE accounts now', 'note')).toThrow();
  });

  it('allows normal writing, including apostrophes', () => {
    expect(() => assertNoSqlInjection("It's a lovely day, don't worry.", 'note')).not.toThrow();
    expect(() => assertNoSqlInjection("O'Brien", 'name')).not.toThrow();
    expect(() => assertNoSqlInjection('Meet me at 5 and bring snacks', 'note')).not.toThrow();
  });
});

describe('assertNoDangerousHtml', () => {
  it('rejects html that could run code', () => {
    expect(() => assertNoDangerousHtml('<script>alert(1)</script>', 'body')).toThrow();
    expect(() => assertNoDangerousHtml('<img src=x onerror=alert(1)>', 'body')).toThrow();
    expect(() => assertNoDangerousHtml('<a href="javascript:alert(1)">x</a>', 'body')).toThrow();
    expect(() => assertNoDangerousHtml('<iframe src="https://evil.test"></iframe>', 'body')).toThrow();
  });

  it('allows safe formatting html', () => {
    expect(() => assertNoDangerousHtml('<b>Hello</b> <i>there</i>', 'body')).not.toThrow();
    expect(() => assertNoDangerousHtml('<a href="/about">About us</a>', 'body')).not.toThrow();
    expect(() => assertNoDangerousHtml('A plain paragraph of text.', 'body')).not.toThrow();
  });
});

describe('assertSafeInput', () => {
  it('runs both checks and throws on either kind of problem', () => {
    expect(() => assertSafeInput("' OR 1=1", 'body')).toThrow();
    expect(() => assertSafeInput('<script>bad()</script>', 'body')).toThrow();
  });

  it('lets ordinary content through', () => {
    expect(() => assertSafeInput('Welcome to our homepage!', 'body')).not.toThrow();
  });
});
