//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import type { TweakTagsEngine, ToolbarPosition } from '@tweaktags/browser';

import { el } from './dom.js';
import { applyScope, type TweakTagsTheme } from './theme.js';

//One button on the floating formatting toolbar.
interface Command {
  label: string;
  title: string;
  command: string;
  //When set, the user is asked for a value first, like a link url.
  prompt?: string;
}

const COMMANDS: Command[] = [
  { label: 'B', title: 'Bold', command: 'bold' },
  { label: 'I', title: 'Italic', command: 'italic' },
  { label: 'U', title: 'Underline', command: 'underline' },
  { label: '•', title: 'Bullet list', command: 'insertUnorderedList' },
  { label: '1.', title: 'Numbered list', command: 'insertOrderedList' },
  { label: 'Link', title: 'Add a link', command: 'createLink', prompt: 'Link URL' },
  { label: '✕', title: 'Clear formatting', command: 'removeFormat' },
];

//Shows a small formatting toolbar that floats above the rich text element the
//user is editing, following the engine's toolbar position events.
export const mountRichToolbar = (engine: TweakTagsEngine, theme: TweakTagsTheme): (() => void) => {
  const bar = el('div', { class: 'tt-toolbar', style: { display: 'none' } });
  applyScope(bar, theme);

  for (const item of COMMANDS) {
    const button = el('button', { type: 'button', title: item.title, text: item.label });

    //Keep the selection in the editable element when a button is pressed, so the
    //command has something to act on instead of losing focus first.
    button.addEventListener('mousedown', (event) => event.preventDefault());

    button.addEventListener('click', () => {
      if (item.prompt) {
        const value = window.prompt(item.prompt);

        if (value) {
          engine.applyRichCommand(item.command, value);
        }

        return;
      }

      engine.applyRichCommand(item.command);
    });

    bar.appendChild(button);
  }

  document.body.appendChild(bar);

  const unsubscribe = engine.onToolbar((position: ToolbarPosition | null) => {
    if (!position) {
      bar.style.display = 'none';

      return;
    }

    bar.style.display = 'inline-flex';
    bar.style.left = `${position.left}px`;
    bar.style.top = `${position.top}px`;
  });

  return () => {
    unsubscribe();
    bar.remove();
  };
};
