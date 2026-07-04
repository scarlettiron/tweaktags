//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import type { CSSProperties, ReactElement } from 'react';

//One popup message.
export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

const containerStyle: CSSProperties = {
  position: 'fixed',
  top: '1rem',
  right: '1rem',
  zIndex: 2147483647,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  font: '14px system-ui, sans-serif',
};

const baseToastStyle: CSSProperties = {
  padding: '0.6rem 0.9rem',
  borderRadius: '0.4rem',
  color: '#fff',
  maxWidth: '22rem',
  boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)',
};

//Shows the current popup messages stacked in the corner of the screen.
export const ToastHost = ({ toasts }: { toasts: Toast[] }): ReactElement | null => {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div style={containerStyle}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          style={{
            ...baseToastStyle,
            background: toast.type === 'success' ? '#1f8a4c' : '#b3261e',
          }}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
};
