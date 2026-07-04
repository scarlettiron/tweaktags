//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import type { TweakTagsEngine } from '@tweaktags/browser';

import { el } from './dom.js';

//Builds an upload button for a media field, or returns null when uploads are
//off. Clicking it uploads the chosen file and calls back with the public url, so
//the caller can drop it into the media url input. The user can still paste a url.
export const uploadButton = (
  engine: TweakTagsEngine,
  onUploaded: (url: string) => void,
): HTMLElement | null => {
  if (!engine.mediaUpload) {
    return null;
  }

  const button = el('span', { class: 'tt-btn tt-subtle', text: 'Upload a file' });
  const input = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    //Reset so picking the same file again still fires a change.
    input.value = '';

    if (!file) {
      return;
    }

    button.textContent = 'Uploading...';

    try {
      const url = await engine.uploadMedia(file);
      onUploaded(url);
      engine.notify('Uploaded.', 'success');
    } catch (error) {
      engine.notify(error instanceof Error ? error.message : 'Could not upload the file', 'error');
    } finally {
      button.textContent = 'Upload a file';
    }
  });

  return el('label', { style: { alignSelf: 'flex-start', cursor: 'pointer' } }, [button, input]);
};
