//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { useEffect, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';

import type { TagType } from '@tweaktags/core';

import { useTweakTags } from '../hooks/use-tweaktags.js';
import { Spinner } from './spinner.js';
import { RichTextEditor } from './rich-text-editor.js';
import { UploadButton } from './upload-button.js';

//The editable fields for one tag.
interface Draft {
  type: TagType;
  body: string;
  mediaUrl: string;
}

//A themed scrollbar for the scrolling body, matching the rest of TweakTags.
const SCROLLBAR_CLASS = 'tweaktags-editor-scroll';

const scrollbarCss = `
.${SCROLLBAR_CLASS}::-webkit-scrollbar { width: 10px; }
.${SCROLLBAR_CLASS}::-webkit-scrollbar-track { background: #1c1c1c; }
.${SCROLLBAR_CLASS}::-webkit-scrollbar-thumb { background: #0a84ff; border-radius: 5px; }
.${SCROLLBAR_CLASS}::-webkit-scrollbar-thumb:hover { background: #3d9bff; }
`;

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 2147483647,
  background: 'rgba(0, 0, 0, 0.6)',
  display: 'flex',
  justifyContent: 'center',
  font: '14px system-ui, sans-serif',
};

const panelStyle: CSSProperties = {
  width: '100%',
  maxWidth: '1800px',
  height: '100vh',
  background: '#111',
  color: '#fff',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 0 60px rgba(0, 0, 0, 0.5)',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  padding: '1rem 1.5rem',
  borderBottom: '1px solid #2a2a2a',
};

const bodyStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '1.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem',
  scrollbarWidth: 'thin',
  scrollbarColor: '#0a84ff #1c1c1c',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  paddingBottom: '1.25rem',
  borderBottom: '1px solid #222',
};

const labelStyle: CSSProperties = {
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  opacity: 0.6,
};

const inputStyle: CSSProperties = {
  padding: '0.5rem 0.6rem',
  borderRadius: '0.35rem',
  border: '1px solid #444',
  background: '#1c1c1c',
  color: '#fff',
  width: '100%',
  boxSizing: 'border-box',
  font: 'inherit',
};

const buttonStyle: CSSProperties = {
  padding: '0.45rem 0.9rem',
  borderRadius: '0.35rem',
  border: 'none',
  background: '#0a84ff',
  color: '#fff',
  cursor: 'pointer',
};

const closeButtonStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#fff',
  cursor: 'pointer',
  fontSize: '1.4rem',
  lineHeight: 1,
  padding: '0 0.25rem',
};

//The popup form editor shown when editInView is off.
//It lists every tag with labeled inputs, prefilled with the saved content, and
//shows a spinner while the content loads.
export const TagEditorModal = (): ReactElement => {
  const { listTags, loadContent, saveContent, confirm, notify, setEditing, richText } = useTweakTags();

  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saved, setSaved] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState(false);

  //Load the tags and their content once when the editor opens.
  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      setLoading(true);

      try {
        const names = await listTags();
        const records = await loadContent(names);
        const byTag = new Map(records.map((record) => [record.tag, record]));

        const initial: Record<string, Draft> = {};

        for (const name of names) {
          const record = byTag.get(name);
          initial[name] = {
            type: record?.type ?? 'plain',
            body: record?.body ?? '',
            mediaUrl: record?.mediaUrl ?? '',
          };
        }

        if (active) {
          setTags(names);
          setDrafts(initial);
          setSaved(initial);
        }
      } catch {
        if (active) {
          notify('Could not load the content to edit.', 'error');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [listTags, loadContent, notify]);

  const isDirty = (tag: string): boolean =>
    drafts[tag]?.body !== saved[tag]?.body || drafts[tag]?.mediaUrl !== saved[tag]?.mediaUrl;

  const hasUnsaved = tags.some((tag) => isDirty(tag));

  const setField = (tag: string, field: 'body' | 'mediaUrl', value: string): void => {
    setDrafts((previous) => {
      const current = previous[tag] ?? { type: 'plain', body: '', mediaUrl: '' };

      return { ...previous, [tag]: { ...current, [field]: value } };
    });
  };

  const handleSave = async (): Promise<void> => {
    const ok = await confirm('Save your changes?', {
      confirmLabel: 'Save',
      cancelLabel: 'Cancel',
    });

    if (!ok) {
      return;
    }

    setBusy(true);

    let saveCount = 0;
    const failedTags: string[] = [];

    for (const tag of tags) {
      const draft = drafts[tag];

      if (!draft || !isDirty(tag)) {
        continue;
      }

      try {
        await saveContent(tag, draft.body, draft.mediaUrl.trim() === '' ? null : draft.mediaUrl);
        saveCount += 1;
      } catch {
        failedTags.push(tag);
      }
    }

    setBusy(false);

    if (failedTags.length === 0) {
      setSaved(drafts);
      notify(`Saved ${saveCount} change${saveCount === 1 ? '' : 's'}.`, 'success');
    } else {
      notify(`Saved ${saveCount}, but could not save: ${failedTags.join(', ')}.`, 'error');
    }
  };

  const handleClose = async (): Promise<void> => {
    if (hasUnsaved) {
      const ok = await confirm('You have unsaved changes that will be lost. Close without saving?', {
        confirmLabel: 'Close without saving',
        cancelLabel: 'Keep editing',
      });

      if (!ok) {
        return;
      }
    }

    setEditing(false);
  };

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true">
      <style>{scrollbarCss}</style>

      <div style={panelStyle}>
        <div style={headerStyle}>
          <strong style={{ fontSize: '1.1rem' }}>Edit content</strong>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button style={buttonStyle} type="button" disabled={busy} onClick={() => void handleSave()}>
              {busy ? 'Saving...' : `Save${hasUnsaved ? ' *' : ''}`}
            </button>
            <button
              style={closeButtonStyle}
              type="button"
              aria-label="Close"
              onClick={() => void handleClose()}
            >
              &times;
            </button>
          </div>
        </div>

        <div className={SCROLLBAR_CLASS} style={bodyStyle}>
          {loading ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '12rem',
              }}
            >
              <Spinner size={40} />
            </div>
          ) : tags.length === 0 ? (
            <span style={{ opacity: 0.6 }}>There are no tags to edit yet.</span>
          ) : (
            tags.map((tag) => {
              const draft = drafts[tag];

              if (!draft) {
                return null;
              }

              return (
                <div key={tag} style={rowStyle}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {tag}
                    {richText ? (
                      <span style={{ opacity: 0.5, fontWeight: 400 }}> &middot; {draft.type}</span>
                    ) : null}
                  </span>

                  {draft.type === 'media' ? (
                    <>
                      <label style={labelStyle}>Media URL</label>
                      <input
                        style={inputStyle}
                        type="text"
                        placeholder="https://... or upload a file"
                        value={draft.mediaUrl}
                        onChange={(event) => setField(tag, 'mediaUrl', event.target.value)}
                      />
                      <UploadButton onUploaded={(url) => setField(tag, 'mediaUrl', url)} />
                      {draft.mediaUrl ? (
                        <img
                          src={draft.mediaUrl}
                          alt=""
                          style={{ maxWidth: '12rem', marginTop: '0.5rem', borderRadius: '0.3rem' }}
                        />
                      ) : null}
                    </>
                  ) : draft.type === 'rich' ? (
                    <>
                      <label style={labelStyle}>Rich text</label>
                      <RichTextEditor value={draft.body} onChange={(html) => setField(tag, 'body', html)} />
                    </>
                  ) : (
                    <>
                      <label style={labelStyle}>Text content</label>
                      <textarea
                        style={{ ...inputStyle, resize: 'vertical' }}
                        rows={2}
                        value={draft.body}
                        onChange={(event) => setField(tag, 'body', event.target.value)}
                      />
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
