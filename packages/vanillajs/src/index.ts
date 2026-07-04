//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { TweakTagsEngine, type EngineOptions } from '@tweaktags/browser';

import { injectStyles, mergeTheme, type TweakTagsTheme } from './theme.js';
import { mountToasts } from './toast.js';
import { createConfirm } from './confirm.js';
import { mountRichToolbar } from './rich-text.js';
import { mountEditBar } from './edit-bar.js';
import { mountPopupEditor } from './popup-editor.js';
import { mountAdminPanel } from './admin-panel.js';

//The options you can pass to init. It is everything the engine takes, plus a
//theme to recolor the UI and extra css for anything you want to restyle.
export interface InitOptions extends EngineOptions {
  theme?: Partial<TweakTagsTheme>;
  css?: string;
}

//The handle init returns, so you can read the engine or tear everything down.
export interface TweakTagsInstance {
  engine: TweakTagsEngine;
  destroy: () => void;
}

//Boots TweakTags on the current page: injects the styles, starts the engine so
//content loads and shows to everyone, and mounts the floating edit bar with its
//toasts and rich text toolbar. Call the returned destroy to remove it all.
export const init = (options: InitOptions = {}): TweakTagsInstance => {
  if (typeof document === 'undefined') {
    throw new Error('TweakTags.init must run in the browser.');
  }

  const { theme: themeOption, css, ...engineOptions } = options;
  const theme = mergeTheme(themeOption);

  injectStyles(css);

  const engine = new TweakTagsEngine(engineOptions);
  const confirm = createConfirm(theme);

  const cleanups = [
    mountToasts(engine, theme),
    mountRichToolbar(engine, theme),
    mountEditBar(engine, theme, confirm),
    mountPopupEditor(engine, theme, confirm),
  ];

  engine.start();

  return {
    engine,
    destroy: () => {
      engine.stop();

      for (const cleanup of cleanups) {
        cleanup();
      }
    },
  };
};

//Mounts the full page admin panel into a container instead of the floating bar.
//Use this on a dedicated admin route. Pass a css selector or an element.
export const mountAdmin = (
  target: HTMLElement | string,
  options: InitOptions = {},
): TweakTagsInstance => {
  if (typeof document === 'undefined') {
    throw new Error('TweakTags.mountAdmin must run in the browser.');
  }

  const container = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;

  if (!container) {
    throw new Error('TweakTags.mountAdmin could not find the target element.');
  }

  const { theme: themeOption, css, ...engineOptions } = options;
  const theme = mergeTheme(themeOption);

  injectStyles(css);

  const engine = new TweakTagsEngine(engineOptions);
  const confirm = createConfirm(theme);

  const cleanups = [mountToasts(engine, theme), mountAdminPanel(container, engine, theme, confirm)];

  engine.start();

  return {
    engine,
    destroy: () => {
      engine.stop();

      for (const cleanup of cleanups) {
        cleanup();
      }
    },
  };
};

//Re-export the engine and the theme helpers for advanced use.
export { TweakTagsEngine, createTweakTagsEngine } from '@tweaktags/browser';
export type { EngineOptions, EngineState, ToastMessage } from '@tweaktags/browser';
export { DEFAULT_THEME, mergeTheme } from './theme.js';
export type { TweakTagsTheme } from './theme.js';
