//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { el } from './dom.js';
import { applyScope, type TweakTagsTheme } from './theme.js';

//The labels for the confirm buttons.
export interface ConfirmOptions {
  confirmLabel?: string;
  cancelLabel?: string;
}

//An in page confirm popup that resolves to true when the user confirms.
export type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>;

//Builds a confirm function bound to the current theme.
export const createConfirm = (theme: TweakTagsTheme): ConfirmFn => {
  return (message: string, options: ConfirmOptions = {}): Promise<boolean> =>
    new Promise((resolve) => {
      const overlay = el('div', { class: 'tt-overlay' });
      applyScope(overlay, theme);

      const finish = (value: boolean): void => {
        overlay.remove();
        resolve(value);
      };

      const dialog = el('div', { class: 'tt-confirm' }, [
        el('div', { text: message }),
        el('div', { class: 'tt-confirm-actions' }, [
          el('button', {
            class: 'tt-btn tt-subtle',
            type: 'button',
            text: options.cancelLabel ?? 'Cancel',
            onclick: () => finish(false),
          }),
          el('button', {
            class: 'tt-btn',
            type: 'button',
            text: options.confirmLabel ?? 'Confirm',
            onclick: () => finish(true),
          }),
        ]),
      ]);

      //A click on the dark backdrop cancels, the same as the React version.
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
          finish(false);
        }
      });

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
    });
};
