//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import type { ReactElement } from 'react';

//The keyframes for the spin animation. Kept here because inline styles cannot
//hold keyframes on their own.
const spinnerCss = '@keyframes tweaktags-spin { to { transform: rotate(360deg); } }';

//A small loading spinner in the TweakTags theme.
export const Spinner = ({ size = 32 }: { size?: number }): ReactElement => (
  <>
    <style>{spinnerCss}</style>
    <div
      role="status"
      aria-label="Loading"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        border: '3px solid #333',
        borderTopColor: '#0a84ff',
        animation: 'tweaktags-spin 0.8s linear infinite',
      }}
    />
  </>
);
