//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { Editable } from '@tweaktags/next';

//A simple page that shows three editable spots.
//Two use the Editable component, and one is plain html with a data attribute.
export default function HomePage() {
  return (
    <main style={{ maxWidth: '40rem', margin: '0 auto', padding: '3rem 1.5rem' }}>
      <h1>
        <Editable tag="hero-title">Welcome to the TweakTags demo</Editable>
      </h1>

      <p>
        <Editable tag="hero-body">
          Sign in with the bar in the corner, turn on edit mode, then change this text.
        </Editable>
      </p>

      <p data-tweaktags-plain-note>
        This plain HTML paragraph has no component, only a data-tweaktags-plain-note attribute, and
        it is still editable.
      </p>
    </main>
  );
}
