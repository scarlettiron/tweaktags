//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import type { CSSProperties, ReactElement } from 'react';

//The formatting buttons the toolbar shows.
const BUTTONS: Array<{ command: string; label: string; style?: CSSProperties }> = [
  { command: 'bold', label: 'B', style: { fontWeight: 700 } },
  { command: 'italic', label: 'I', style: { fontStyle: 'italic' } },
  { command: 'underline', label: 'U', style: { textDecoration: 'underline' } },
  { command: 'insertUnorderedList', label: '•' },
  { command: 'removeFormat', label: 'clear' },
];

const toolbarStyle: CSSProperties = {
  display: 'flex',
  gap: '0.25rem',
  padding: '0.25rem',
  borderRadius: '0.35rem',
  background: '#111',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
  font: '14px system-ui, sans-serif',
};

const buttonStyle: CSSProperties = {
  minWidth: '2rem',
  padding: '0.25rem 0.4rem',
  borderRadius: '0.3rem',
  border: '1px solid #444',
  background: '#2a2a2a',
  color: '#fff',
  cursor: 'pointer',
};

//The props for the toolbar.
export interface RichTextToolbarProps {
  //Runs a formatting command on the current selection.
  onCommand: (command: string) => void;

  //Extra styles, used to place the floating toolbar over the page.
  style?: CSSProperties;
}

//A row of formatting buttons used by both the popup editor and the in place
//editor. It uses the browser's built in commands, so there is no extra library.
export const RichTextToolbar = ({ onCommand, style }: RichTextToolbarProps): ReactElement => (
  <div style={{ ...toolbarStyle, ...style }}>
    {BUTTONS.map((button) => (
      <button
        key={button.command}
        type="button"
        style={{ ...buttonStyle, ...button.style }}
        //Keep the text selection while the button is pressed.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onCommand(button.command)}
      >
        {button.label}
      </button>
    ))}
  </div>
);
