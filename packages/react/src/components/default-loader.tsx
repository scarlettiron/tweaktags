//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import type { ReactElement } from 'react';

//A very small placeholder shown while content loads.
//Hosts can pass their own loading component to replace this.
export const DefaultLoader = (): ReactElement => {
  return (
    <span
      aria-busy="true"
      style={{
        display: 'inline-block',
        minWidth: '3rem',
        opacity: 0.5,
        borderRadius: '0.25rem',
        background: 'currentColor',
      }}
    >
      &nbsp;
    </span>
  );
};
