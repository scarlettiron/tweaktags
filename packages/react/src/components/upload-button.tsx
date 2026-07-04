//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { useState } from 'react';
import type { ChangeEvent, CSSProperties, ReactElement } from 'react';

import { useTweakTags } from '../hooks/use-tweaktags.js';

//The props for the upload button.
export interface UploadButtonProps {
  //Called with the public url once the file has finished uploading.
  onUploaded: (url: string) => void;
  style?: CSSProperties;
}

//A neutral button style that looks right on both the dark popup and the admin
//panel, without needing the theme colors.
const buttonStyle: CSSProperties = {
  display: 'inline-block',
  padding: '0.45rem 0.8rem',
  borderRadius: '0.5rem',
  border: '1px solid rgba(255, 255, 255, 0.25)',
  background: 'rgba(255, 255, 255, 0.06)',
  color: 'inherit',
  font: 'inherit',
  fontWeight: 500,
};

//An upload button for media fields. It only appears when the mediaUpload option
//is on, and when clicked it uploads the chosen file and hands back the url. It
//sits next to the media url input, so the user can upload or paste a url.
export const UploadButton = ({ onUploaded, style }: UploadButtonProps): ReactElement | null => {
  const { mediaUpload, uploadMedia, notify } = useTweakTags();
  const [busy, setBusy] = useState(false);

  if (!mediaUpload) {
    return null;
  }

  const handleChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    //Reset so picking the same file again still fires a change.
    event.target.value = '';

    if (!file) {
      return;
    }

    setBusy(true);

    try {
      const url = await uploadMedia(file);
      onUploaded(url);
      notify('Uploaded.', 'success');
    } catch (uploadError) {
      notify(uploadError instanceof Error ? uploadError.message : 'Could not upload the file', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <label style={{ cursor: busy ? 'default' : 'pointer', alignSelf: 'flex-start', ...style }}>
      <span style={{ ...buttonStyle, opacity: busy ? 0.6 : 1 }}>{busy ? 'Uploading...' : 'Upload a file'}</span>
      <input
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        disabled={busy}
        onChange={(event) => void handleChange(event)}
      />
    </label>
  );
};
