//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import type { ReactNode } from 'react';

import { TweakTagsProvider, TweakTagsEditBar } from '@tweaktags/next';

//Wrap the whole app in the provider so any page can use editable content.
//The edit bar gives a place to sign in and turn edit mode on.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <TweakTagsProvider apiBasePath="/api/tweaktags">
          {children}
          <TweakTagsEditBar />
        </TweakTagsProvider>
      </body>
    </html>
  );
}
