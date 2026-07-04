//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { type ContentRecord, type TagType, type TweakTagsEngine } from '@tweaktags/browser';

import { clear, el, type Child } from './dom.js';
import { applyScope, type TweakTagsTheme } from './theme.js';
import { uploadButton } from './upload.js';
import type { ConfirmFn } from './confirm.js';

//One tag's editable field in the popup, with a way to read its current value.
interface Field {
  tag: string;
  type: TagType;
  initialBody: string;
  initialMedia: string;
  getBody: () => string;
  getMedia: () => string | null;
}

//The popup form editor, used when editInView is off. It lists every tag with a
//labeled input, prefilled with the saved content, and saves them all at once.
//It opens whenever edit mode turns on in popup mode, and closes when it turns off.
export const mountPopupEditor = (
  engine: TweakTagsEngine,
  theme: TweakTagsTheme,
  confirm: ConfirmFn,
): (() => void) => {
  let overlay: HTMLElement | null = null;

  const shouldShow = (): boolean => engine.isEditing && engine.canEdit && !engine.editInView;

  const close = (): void => {
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
  };

  const buildRow = (tag: string, type: TagType, record: ContentRecord | null): { row: HTMLElement; field: Field } => {
    const initialBody = record?.body ?? '';
    const initialMedia = record?.mediaUrl ?? '';

    const label = el('span', { class: 'tt-mono', text: engine.richText ? `${tag} · ${type}` : tag });
    const kids: Child[] = [label];

    let getBody: () => string;
    let getMedia: () => string | null;

    if (type === 'media') {
      const input = el('input', { class: 'tt-input', type: 'text', placeholder: 'https://... or upload a file', value: initialMedia });
      getBody = () => initialBody;
      getMedia = () => (input.value.trim() === '' ? null : input.value);
      kids.push(el('label', { class: 'tt-label', text: 'Media URL' }), input);
      const upload = uploadButton(engine, (url) => {
        input.value = url;
      });
      if (upload) {
        kids.push(upload);
      }
    } else if (type === 'rich') {
      const editor = el('div', { class: 'tt-input', html: initialBody, style: { minHeight: '4rem' } });
      editor.setAttribute('contenteditable', 'true');
      getBody = () => editor.innerHTML;
      getMedia = () => null;
      kids.push(el('label', { class: 'tt-label', text: 'Rich text' }), editor);
    } else {
      const textarea = el('textarea', { class: 'tt-input', rows: '2', text: initialBody });
      getBody = () => textarea.value;
      getMedia = () => null;
      kids.push(el('label', { class: 'tt-label', text: 'Text content' }), textarea);
    }

    return { row: el('div', { class: 'tt-row' }, kids), field: { tag, type, initialBody, initialMedia, getBody, getMedia } };
  };

  const open = async (): Promise<void> => {
    if (overlay) {
      return;
    }

    let fields: Field[] = [];

    const isDirty = (): boolean =>
      fields.some((field) => field.getBody() !== field.initialBody || (field.getMedia() ?? '') !== field.initialMedia);

    const handleClose = async (): Promise<void> => {
      if (isDirty()) {
        const ok = await confirm('You have unsaved changes that will be lost. Close without saving?', {
          confirmLabel: 'Close without saving',
          cancelLabel: 'Keep editing',
        });

        if (!ok) {
          return;
        }
      }

      //Turning edit mode off makes the subscription close this popup.
      engine.setEditing(false);
    };

    const saveButton = el('button', { class: 'tt-btn', type: 'button', text: 'Save' });
    const closeButton = el('button', { class: 'tt-close', type: 'button', 'aria-label': 'Close', text: '×' });
    const body = el('div', { class: 'tt-modal-body tt-scroll' });

    const handleSave = async (): Promise<void> => {
      const ok = await confirm('Save your changes?', { confirmLabel: 'Save', cancelLabel: 'Cancel' });

      if (!ok) {
        return;
      }

      saveButton.disabled = true;
      let saved = 0;
      const failed: string[] = [];

      for (const field of fields) {
        const bodyValue = field.getBody();
        const mediaValue = field.getMedia();
        const changed = bodyValue !== field.initialBody || (mediaValue ?? '') !== field.initialMedia;

        if (!changed) {
          continue;
        }

        try {
          await engine.saveContent(field.tag, bodyValue, mediaValue);
          field.initialBody = bodyValue;
          field.initialMedia = mediaValue ?? '';
          saved += 1;
        } catch {
          failed.push(field.tag);
        }
      }

      saveButton.disabled = false;

      if (failed.length === 0) {
        engine.notify(`Saved ${saved} change${saved === 1 ? '' : 's'}.`, 'success');
      } else {
        engine.notify(`Saved ${saved}, but could not save: ${failed.join(', ')}.`, 'error');
      }
    };

    saveButton.addEventListener('click', () => void handleSave());
    closeButton.addEventListener('click', () => void handleClose());

    const modal = el('div', { class: 'tt-modal' }, [
      el('div', { class: 'tt-modal-top' }, [
        el('strong', { style: { fontSize: '1.1rem' }, text: 'Edit content' }),
        el('div', { style: { display: 'flex', gap: '0.5rem', alignItems: 'center' } }, [saveButton, closeButton]),
      ]),
      body,
    ]);

    overlay = el('div', { class: 'tt-modal-overlay' }, [modal]);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        void handleClose();
      }
    });
    applyScope(overlay, theme);
    document.body.appendChild(overlay);

    //Show a spinner while the content loads.
    body.append(el('div', { class: 'tt-center', style: { flex: '1', minHeight: '12rem' } }, [el('div', { class: 'tt-spinner' })]));

    try {
      const names = await engine.listTags();
      const records = await engine.loadContent(names);
      const byTag = new Map(records.map((record) => [record.tag, record]));

      clear(body);

      if (names.length === 0) {
        body.append(el('span', { class: 'tt-hint', text: 'There are no tags to edit yet.' }));

        return;
      }

      fields = [];

      for (const tag of names) {
        const record = byTag.get(tag) ?? null;
        const type = record?.type ?? 'plain';
        const { row, field } = buildRow(tag, type, record);
        fields.push(field);
        body.append(row);
      }
    } catch {
      clear(body);
      body.append(el('span', { class: 'tt-error', text: 'Could not load the content to edit.' }));
    }
  };

  const unsubscribe = engine.subscribe(() => {
    if (shouldShow()) {
      if (!overlay) {
        void open();
      }
    } else {
      close();
    }
  });

  if (shouldShow()) {
    void open();
  }

  return () => {
    unsubscribe();
    close();
  };
};
