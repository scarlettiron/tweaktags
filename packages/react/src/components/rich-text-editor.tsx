//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { useRef } from 'react';
import type { CSSProperties, ReactElement } from 'react';

import { RichTextToolbar } from './rich-text-toolbar.js';

//The props for the rich text editor.
export interface RichTextEditorProps {
  //The current html value.
  value: string;

  //Called with the new html whenever the user edits.
  onChange: (html: string) => void;
}

const editorStyle: CSSProperties = {
  minHeight: '4rem',
  marginTop: '0.35rem',
  padding: '0.5rem 0.6rem',
  borderRadius: '0.35rem',
  border: '1px solid #444',
  background: '#1c1c1c',
  color: '#fff',
  outline: 'none',
};

//A small rich text editor built on a contentEditable area.
//The toolbar uses the browser's built in formatting commands, so there is no
//extra dependency. The value is html, which the server cleans before saving.
export const RichTextEditor = ({ value, onChange }: RichTextEditorProps): ReactElement => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const initialized = useRef(false);

  //Set the starting html once, so React re-renders do not reset the cursor.
  const attachRef = (node: HTMLDivElement | null): void => {
    if (node && !initialized.current) {
      node.innerHTML = value;
      initialized.current = true;
    }

    editorRef.current = node;
  };

  const emitChange = (): void => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  //Runs a formatting command and then reports the new html.
  const runCommand = (command: string): void => {
    document.execCommand(command);
    emitChange();
  };

  return (
    <div>
      <RichTextToolbar onCommand={runCommand} />

      <div
        ref={attachRef}
        contentEditable
        suppressContentEditableWarning
        style={editorStyle}
        onInput={emitChange}
      />
    </div>
  );
};
