//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import type { TweakTagsEngine, ToastMessage } from '@tweaktags/browser';

import { el } from './dom.js';
import { applyScope, type TweakTagsTheme } from './theme.js';

//Shows the engine's toast messages in the corner and fades each away on its own.
export const mountToasts = (engine: TweakTagsEngine, theme: TweakTagsTheme): (() => void) => {
  const container = el('div', { class: 'tt-toasts' });
  applyScope(container, theme);
  document.body.appendChild(container);

  const show = (toast: ToastMessage): void => {
    const node = el('div', { class: `tt-toast tt-${toast.type}`, text: toast.message });
    container.appendChild(node);

    setTimeout(() => {
      node.remove();
    }, 4000);
  };

  const unsubscribe = engine.onToast(show);

  return () => {
    unsubscribe();
    container.remove();
  };
};
