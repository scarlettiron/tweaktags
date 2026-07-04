//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { describe, expect, it } from 'vitest';

import {
  assertValidTag,
  dataAttributeForTag,
  isValidTag,
  normalizeTag,
  tagFromDataAttribute,
} from '@tweaktags/core';

describe('tag utilities', () => {
  it('accepts lowercase, numbers, and hyphens', () => {
    expect(isValidTag('hero-title')).toBe(true);
    expect(isValidTag('section-2')).toBe(true);
  });

  it('rejects uppercase, spaces, and bad hyphens', () => {
    expect(isValidTag('HeroTitle')).toBe(false);
    expect(isValidTag('hero title')).toBe(false);
    expect(isValidTag('-hero')).toBe(false);
    expect(isValidTag('hero--title')).toBe(false);
  });

  it('rejects an empty tag', () => {
    expect(isValidTag('')).toBe(false);
  });

  it('normalizes messy input into a valid tag', () => {
    expect(normalizeTag('  Hero Title!  ')).toBe('hero-title');
    expect(normalizeTag('Price: $5 (each)')).toBe('price-5-each');
    expect(isValidTag(normalizeTag('Hero Title!'))).toBe(true);
  });

  it('accepts a valid tag through assertValidTag and returns it', () => {
    expect(assertValidTag('hero-title')).toBe('hero-title');
  });

  it('throws from assertValidTag on an invalid tag', () => {
    expect(() => assertValidTag('Not A Tag')).toThrow();
    expect(() => assertValidTag('hero--title')).toThrow();
  });

  it('builds and reads the data attribute', () => {
    const attribute = dataAttributeForTag('hero-title');

    expect(attribute).toBe('data-tweaktags-hero-title');
    expect(tagFromDataAttribute(attribute)).toBe('hero-title');
    expect(tagFromDataAttribute('class')).toBeNull();
    expect(tagFromDataAttribute('data-other-thing')).toBeNull();
  });
});
