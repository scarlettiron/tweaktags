//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { DATA_ATTRIBUTE_PREFIX, TAG_PATTERN } from '../constants/index.js';
import { badRequest } from './errors.js';

//Checks whether a tag name has a shape that is safe to put in an attribute name.
export const isValidTag = (tag: string): boolean => TAG_PATTERN.test(tag);

//Cleans up a raw tag name into the lowercase hyphen form TweakTags expects.
//This does not guarantee the result is valid, so callers should still check.
export const normalizeTag = (raw: string): string =>
  raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

//Returns the tag name when it is valid, otherwise throws a clear error.
//Use this anywhere a tag arrives from outside the system.
export const assertValidTag = (tag: string): string => {
  if (!isValidTag(tag)) {
    throw badRequest(
      `The tag "${tag}" is not valid. Use lowercase letters, numbers, and hyphens only.`,
    );
  }

  return tag;
};

//Builds the html attribute name for a tag, like "data-tweaktags-hero-title".
export const dataAttributeForTag = (tag: string): string => `${DATA_ATTRIBUTE_PREFIX}${tag}`;

//Reads the tag name back out of a data attribute name.
//Returns null when the attribute is not one of ours.
export const tagFromDataAttribute = (attributeName: string): string | null => {
  if (!attributeName.startsWith(DATA_ATTRIBUTE_PREFIX)) {
    return null;
  }

  const tag = attributeName.slice(DATA_ATTRIBUTE_PREFIX.length);

  return tag.length > 0 ? tag : null;
};
