//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

//A child that can be appended, or a falsy value that is skipped.
export type Child = Node | string | null | undefined | false;

//The attributes el understands. Most map to real attributes, with a few helpers:
//class, style (object), text, html, dataset, and on* event handlers.
export interface Attrs {
  class?: string;
  style?: Partial<CSSStyleDeclaration>;
  text?: string;
  html?: string;
  dataset?: Record<string, string>;
  [key: string]: unknown;
}

//A tiny helper that builds an element, sets attributes, and appends children.
//It keeps the vanilla UI readable without a framework.
export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) {
      continue;
    }

    if (key === 'class') {
      node.className = String(value);
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(node.style, value);
    } else if (key === 'text') {
      node.textContent = String(value);
    } else if (key === 'html') {
      node.innerHTML = String(value);
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(node.dataset, value as Record<string, string>);
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, String(value));
    }
  }

  for (const child of children) {
    if (child === null || child === undefined || child === false) {
      continue;
    }

    node.append(child);
  }

  return node;
};

//Removes every child from a node, used when we redraw a section in place.
export const clear = (node: Node): void => {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
};
