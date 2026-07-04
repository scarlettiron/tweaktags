//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import type { CSSProperties, ReactElement } from 'react';

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 2147483647,
  background: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  font: '14px system-ui, sans-serif',
};

const boxStyle: CSSProperties = {
  width: '22rem',
  maxWidth: '90vw',
  background: '#111',
  color: '#fff',
  borderRadius: '0.5rem',
  padding: '1.25rem',
  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.5rem',
};

const buttonStyle: CSSProperties = {
  padding: '0.45rem 0.8rem',
  borderRadius: '0.35rem',
  border: 'none',
  cursor: 'pointer',
  color: '#fff',
};

//The details of the confirm popup to show.
export interface ConfirmDialogProps {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

//A simple in page confirm popup, used instead of the browser's own dialog.
//Clicking the dark background or the cancel button counts as a cancel.
export const ConfirmDialog = ({
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): ReactElement => {
  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" onClick={onCancel}>
      <div style={boxStyle} onClick={(event) => event.stopPropagation()}>
        <span>{message}</span>

        <div style={actionsStyle}>
          <button type="button" style={{ ...buttonStyle, background: '#333' }} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            style={{ ...buttonStyle, background: '#0a84ff' }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
