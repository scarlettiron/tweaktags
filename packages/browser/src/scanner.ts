//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { DATA_ATTRIBUTE_PREFIX, tagFromDataAttribute } from '@tweaktags/core';

//Marks elements that a component already controls, so the plain html crawler
//knows to leave them alone.
export const MANAGED_ATTRIBUTE = 'data-tweaktags-managed';

//A plain html element on the page that carries a TweakTags tag.
export interface ScannedElement {
  element: HTMLElement;
  tag: string;
}

//Reads the TweakTags tag from a single element.
//Returns null when the element has no TweakTags attribute or is already managed.
export const tweaktagsTagOf = (element: HTMLElement): string | null => {
  if (element.hasAttribute(MANAGED_ATTRIBUTE)) {
    return null;
  }

  for (const attribute of Array.from(element.attributes)) {
    if (attribute.name.startsWith(DATA_ATTRIBUTE_PREFIX)) {
      return tagFromDataAttribute(attribute.name);
    }
  }

  return null;
};

//Finds every descendant of the given root that carries a TweakTags tag.
//Pass a single added subtree to scan only what changed, or the whole document
//for the first pass.
export const findTweakTagsElements = (root: ParentNode = document): ScannedElement[] => {
  const found: ScannedElement[] = [];

  root.querySelectorAll<HTMLElement>('*').forEach((element) => {
    const tag = tweaktagsTagOf(element);

    if (tag) {
      found.push({ element, tag });
    }
  });

  return found;
};
