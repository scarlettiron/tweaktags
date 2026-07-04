//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { ROLES, isValidTag, type ContentRecord, type TagType, type TweakTagsEngine } from '@tweaktags/browser';

import { clear, el, type Child } from './dom.js';
import { applyScope, type TweakTagsTheme } from './theme.js';
import { uploadButton } from './upload.js';
import type { ConfirmFn } from './confirm.js';

const PAGE_SIZE = 10;

//One tag with its type and saved content record.
interface Entry {
  tag: string;
  type: TagType;
  record: ContentRecord | null;
}

//Turns a saved record into a short one line preview for the view list.
const previewOf = (record: ContentRecord | null): string => {
  if (!record) {
    return 'No content yet';
  }

  if (record.type === 'media') {
    return record.mediaUrl || record.body || 'No media set';
  }

  const text = record.body
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (text === '') {
    return 'Empty';
  }

  return text.length > 90 ? `${text.slice(0, 90)}...` : text;
};

//The type options for a select, with the current one preselected by the caller.
const typeOptions = (): HTMLElement[] =>
  (['plain', 'rich', 'media'] as TagType[]).map((value) => el('option', { value, text: value }));

//The prev and next paging controls shared by the lists.
const buildPager = (
  currentPage: number,
  totalPages: number,
  onPage: (page: number) => void,
): HTMLElement => {
  const prev = el('button', {
    class: 'tt-btn tt-subtle',
    type: 'button',
    text: 'Prev',
    onclick: () => onPage(Math.max(0, currentPage - 1)),
  });
  prev.disabled = currentPage === 0;

  const next = el('button', {
    class: 'tt-btn tt-subtle',
    type: 'button',
    text: 'Next',
    onclick: () => onPage(Math.min(totalPages - 1, currentPage + 1)),
  });
  next.disabled = currentPage >= totalPages - 1;

  return el('div', { class: 'tt-pager' }, [prev, el('span', { text: `Page ${currentPage + 1} of ${totalPages}` }), next]);
};

//Mounts the full page admin panel into the given container. It shows a full page
//login when signed out, and a dashboard with view, create, and edit tabs when
//signed in, each list with its own search and pagination.
export const mountAdminPanel = (
  container: HTMLElement,
  engine: TweakTagsEngine,
  theme: TweakTagsTheme,
  confirm: ConfirmFn,
): (() => void) => {
  applyScope(container, theme);

  let entries: Entry[] = [];
  let loading = true;
  let tab: 'view' | 'create' | 'edit' = 'view';

  //Search and page kept per tab so a reload restores where you were.
  let viewSearch = '';
  let viewPage = 0;
  let editSearch = '';
  let editPage = 0;

  let contentArea: HTMLElement | null = null;
  const tabButtons: Partial<Record<'view' | 'create' | 'edit', HTMLButtonElement>> = {};

  const isSuperuser = (): boolean => engine.user?.role === ROLES.SUPERUSER;

  const filterPage = (
    search: string,
    page: number,
  ): { pageItems: Entry[]; totalPages: number; currentPage: number; matchCount: number } => {
    const query = search.trim().toLowerCase();
    const filtered = entries.filter((entry) => entry.tag.toLowerCase().includes(query));
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages - 1);
    const start = currentPage * PAGE_SIZE;

    return { pageItems: filtered.slice(start, start + PAGE_SIZE), totalPages, currentPage, matchCount: filtered.length };
  };

  //The view tab: a read only, searchable, paged list of every tag.
  const buildViewTab = (): HTMLElement => {
    const listWrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '0.5rem' } });

    const draw = (): void => {
      clear(listWrap);
      const { pageItems, totalPages, currentPage, matchCount } = filterPage(viewSearch, viewPage);

      if (entries.length === 0) {
        listWrap.append(el('span', { class: 'tt-hint', text: 'There are no tags yet.' }));

        return;
      }

      if (matchCount === 0) {
        listWrap.append(el('span', { class: 'tt-hint', text: `No tags match "${viewSearch}".` }));

        return;
      }

      for (const entry of pageItems) {
        const kids: Child[] = [el('span', { class: 'tt-mono', style: { minWidth: '8rem' }, text: entry.tag })];

        if (engine.richText) {
          kids.push(el('span', { class: 'tt-badge', text: entry.type }));
        }

        kids.push(el('span', { style: { flex: '1', minWidth: '10rem', opacity: '0.75' }, text: previewOf(entry.record) }));
        listWrap.append(el('div', { class: 'tt-listrow' }, kids));
      }

      if (totalPages > 1) {
        listWrap.append(
          buildPager(currentPage, totalPages, (page) => {
            viewPage = page;
            draw();
          }),
        );
      }
    };

    const search = el('input', { class: 'tt-input', type: 'search', placeholder: 'Search tags...', value: viewSearch });
    search.addEventListener('input', () => {
      viewSearch = search.value;
      viewPage = 0;
      draw();
    });

    draw();

    return el('div', { class: 'tt-card' }, [
      el('strong', { style: { fontSize: '1.05rem' }, text: `All tags (${entries.length})` }),
      search,
      listWrap,
    ]);
  };

  //The create tab. Only a superuser reaches this.
  const buildCreateTab = (): HTMLElement => {
    const newTag = el('input', { class: 'tt-input', type: 'text', placeholder: 'tag name, like hero-title' });
    const newType = engine.richText
      ? el('select', { class: 'tt-input' }, [
          el('option', { value: 'plain', text: 'Plain text' }),
          el('option', { value: 'rich', text: 'Rich text' }),
          el('option', { value: 'media', text: 'Media' }),
        ])
      : null;
    const newContent = el('input', { class: 'tt-input', type: 'text', placeholder: 'starting content (optional)' });
    const error = el('span', { class: 'tt-error' });
    error.style.display = 'none';
    const button = el('button', { class: 'tt-btn', style: { alignSelf: 'flex-start' }, type: 'button', text: 'Create tag' });

    const handleCreate = async (): Promise<void> => {
      error.style.display = 'none';
      const tag = newTag.value.trim();

      if (!isValidTag(tag)) {
        error.textContent = 'Use lowercase letters, numbers, and hyphens only.';
        error.style.display = '';

        return;
      }

      button.disabled = true;

      try {
        const type = (newType?.value as TagType | undefined) ?? 'plain';
        await engine.createTag(tag, newContent.value, type);
        newTag.value = '';
        newContent.value = '';

        if (newType) {
          newType.value = 'plain';
        }

        engine.notify(`Created the tag "${tag}".`, 'success');
        await loadEntries();
      } catch (createError) {
        const message = createError instanceof Error ? createError.message : 'Could not create the tag';
        error.textContent = message;
        error.style.display = '';
        engine.notify(message, 'error');
      } finally {
        button.disabled = false;
      }
    };

    button.addEventListener('click', () => void handleCreate());

    //An upload button for the starting content, shown only when the new tag is a
    //media tag. Media tags need rich text on, so newType exists in that case.
    const upload = newType ? uploadButton(engine, (url) => (newContent.value = url)) : null;

    if (upload && newType) {
      const syncUpload = (): void => {
        upload.style.display = newType.value === 'media' ? '' : 'none';
      };
      syncUpload();
      newType.addEventListener('change', syncUpload);
    }

    const field = (labelText: string, control: HTMLElement): HTMLElement =>
      el('div', { class: 'tt-field' }, [el('label', { class: 'tt-label', text: labelText }), control]);

    const kids: Child[] = [el('strong', { style: { fontSize: '1.05rem' }, text: 'Create a tag' }), field('Tag name', newTag)];

    if (newType) {
      kids.push(field('Type', newType));
    }

    kids.push(field('Starting content (optional)', newContent));

    if (upload) {
      kids.push(upload);
    }

    kids.push(
      button,
      error,
      el('span', { class: 'tt-hint', text: 'A tag only shows on a page where an element has its data-tweaktags- attribute.' }),
    );

    return el('div', { class: 'tt-card' }, kids);
  };

  //The edit tab: a searchable, paged list where each tag opens an inline editor.
  const buildEditTab = (): HTMLElement => {
    let openTag: string | null = null;
    const listWrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '0.6rem' } });

    const drawRow = (entry: Entry): HTMLElement => {
      const header: Child[] = [
        el('span', { class: 'tt-mono', style: { flex: '1', minWidth: '8rem' }, text: entry.tag }),
      ];

      if (engine.richText && isSuperuser()) {
        const select = el('select', { class: 'tt-input', style: { width: 'auto' } }, typeOptions());
        select.value = entry.type;
        select.addEventListener('change', () => void handleChangeType(entry.tag, select.value as TagType));
        header.push(select);
      } else if (engine.richText) {
        header.push(el('span', { class: 'tt-badge', text: entry.type }));
      }

      const isOpen = openTag === entry.tag;

      header.push(
        el('button', {
          class: 'tt-btn tt-subtle',
          type: 'button',
          text: isOpen ? 'Cancel' : 'Edit',
          onclick: () => {
            openTag = isOpen ? null : entry.tag;
            draw();
          },
        }),
      );

      if (isSuperuser()) {
        header.push(
          el('button', { class: 'tt-btn tt-danger', type: 'button', text: 'Delete', onclick: () => void handleDelete(entry.tag) }),
        );
      }

      const kids: Child[] = [el('div', { style: { display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' } }, header)];

      if (isOpen) {
        kids.push(buildEditor(entry));
      }

      return el('div', { class: 'tt-listrow', style: { flexDirection: 'column', alignItems: 'stretch' } }, kids);
    };

    const buildEditor = (entry: Entry): HTMLElement => {
      const initialBody = entry.record?.body ?? '';
      const initialMedia = entry.record?.mediaUrl ?? '';

      let getBody: () => string;
      let getMedia: () => string | null;
      const fieldKids: Child[] = [];

      if (entry.type === 'media') {
        const input = el('input', { class: 'tt-input', type: 'text', placeholder: 'https://... or upload a file', value: initialMedia });
        getBody = () => initialBody;
        getMedia = () => (input.value.trim() === '' ? null : input.value);
        fieldKids.push(el('label', { class: 'tt-label', text: 'Media URL' }), input);
        const upload = uploadButton(engine, (url) => {
          input.value = url;
        });
        if (upload) {
          fieldKids.push(upload);
        }
      } else if (entry.type === 'rich') {
        const editor = el('div', { class: 'tt-input', html: initialBody, style: { minHeight: '4rem' } });
        editor.setAttribute('contenteditable', 'true');
        getBody = () => editor.innerHTML;
        getMedia = () => null;
        fieldKids.push(el('label', { class: 'tt-label', text: 'Rich text' }), editor);
      } else {
        const textarea = el('textarea', { class: 'tt-input', rows: '3', text: initialBody });
        getBody = () => textarea.value;
        getMedia = () => null;
        fieldKids.push(el('label', { class: 'tt-label', text: 'Text content' }), textarea);
      }

      const save = el('button', { class: 'tt-btn', type: 'button', text: 'Save' });
      const cancel = el('button', {
        class: 'tt-btn tt-subtle',
        type: 'button',
        text: 'Cancel',
        onclick: () => {
          openTag = null;
          draw();
        },
      });

      save.addEventListener('click', async () => {
        save.disabled = true;

        try {
          const media = getMedia();
          await engine.saveContent(entry.tag, getBody(), media);
          entry.record = {
            tag: entry.tag,
            type: entry.type,
            body: getBody(),
            mediaUrl: media,
            updatedAt: entry.record?.updatedAt ?? '',
            updatedBy: entry.record?.updatedBy ?? '',
          };
          engine.notify(`Saved "${entry.tag}".`, 'success');
          openTag = null;
          draw();
        } catch (saveError) {
          engine.notify(saveError instanceof Error ? saveError.message : 'Could not save the tag', 'error');
          save.disabled = false;
        }
      });

      return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' } }, [
        ...fieldKids,
        el('div', { style: { display: 'flex', gap: '0.5rem' } }, [save, cancel]),
      ]);
    };

    async function handleChangeType(tag: string, type: TagType): Promise<void> {
      try {
        await engine.setTagType(tag, type);
        entries = entries.map((entry) => (entry.tag === tag ? { ...entry, type } : entry));

        if (openTag === tag) {
          openTag = null;
        }

        draw();
        engine.notify(`Changed "${tag}" to ${type}.`, 'success');
      } catch (typeError) {
        engine.notify(typeError instanceof Error ? typeError.message : 'Could not change the type', 'error');
      }
    }

    async function handleDelete(tag: string): Promise<void> {
      const ok = await confirm(`Delete the tag "${tag}"? This cannot be undone.`, {
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
      });

      if (!ok) {
        return;
      }

      try {
        await engine.deleteTag(tag);
        entries = entries.filter((entry) => entry.tag !== tag);

        if (openTag === tag) {
          openTag = null;
        }

        draw();
        engine.notify(`Deleted the tag "${tag}".`, 'success');
      } catch (deleteError) {
        engine.notify(deleteError instanceof Error ? deleteError.message : 'Could not delete the tag', 'error');
      }
    }

    const draw = (): void => {
      clear(listWrap);
      const { pageItems, totalPages, currentPage, matchCount } = filterPage(editSearch, editPage);

      if (entries.length === 0) {
        listWrap.append(el('span', { class: 'tt-hint', text: 'There are no tags to edit yet.' }));

        return;
      }

      if (matchCount === 0) {
        listWrap.append(el('span', { class: 'tt-hint', text: `No tags match "${editSearch}".` }));

        return;
      }

      for (const entry of pageItems) {
        listWrap.append(drawRow(entry));
      }

      if (totalPages > 1) {
        listWrap.append(
          buildPager(currentPage, totalPages, (page) => {
            editPage = page;
            draw();
          }),
        );
      }
    };

    const search = el('input', { class: 'tt-input', type: 'search', placeholder: 'Search tags...', value: editSearch });
    search.addEventListener('input', () => {
      editSearch = search.value;
      editPage = 0;
      draw();
    });

    draw();

    return el('div', { class: 'tt-card' }, [el('strong', { style: { fontSize: '1.05rem' }, text: 'Edit tags' }), search, listWrap]);
  };

  //Draws the current tab into the content area.
  const showContent = (): void => {
    if (!contentArea) {
      return;
    }

    clear(contentArea);

    if (loading) {
      contentArea.append(el('div', { class: 'tt-center', style: { padding: '4rem 0' } }, [el('div', { class: 'tt-spinner' })]));

      return;
    }

    const activeTab = tab === 'create' && !isSuperuser() ? 'view' : tab;

    if (activeTab === 'view') {
      contentArea.append(buildViewTab());
    } else if (activeTab === 'create') {
      contentArea.append(buildCreateTab());
    } else {
      contentArea.append(buildEditTab());
    }
  };

  const setTab = (next: 'view' | 'create' | 'edit'): void => {
    tab = next;

    for (const key of ['view', 'create', 'edit'] as const) {
      const button = tabButtons[key];

      if (button) {
        button.className = key === next ? 'tt-btn' : 'tt-btn tt-subtle';
      }
    }

    showContent();
  };

  const loadEntries = async (): Promise<void> => {
    loading = true;
    showContent();

    try {
      const names = await engine.listTags();
      const records = await engine.loadContent(names);
      const byTag = new Map(records.map((record) => [record.tag, record]));

      entries = names.map((tag) => {
        const record = byTag.get(tag) ?? null;

        return { tag, type: record?.type ?? 'plain', record };
      });
    } catch {
      engine.notify('Could not load the tags.', 'error');
    } finally {
      loading = false;
      showContent();
    }
  };

  const renderLogin = (): void => {
    clear(container);

    const email = el('input', { class: 'tt-input', type: 'email', autocomplete: 'username' });
    const password = el('input', { class: 'tt-input', type: 'password', autocomplete: 'current-password' });
    const error = el('span', { class: 'tt-error' });
    error.style.display = 'none';
    const button = el('button', { class: 'tt-btn', type: 'submit', text: 'Sign in' });

    const submit = async (): Promise<void> => {
      error.style.display = 'none';
      button.disabled = true;

      try {
        await engine.login(email.value, password.value);
      } catch (loginError) {
        error.textContent = loginError instanceof Error ? loginError.message : 'Could not sign in';
        error.style.display = '';
      } finally {
        button.disabled = false;
      }
    };

    const form = el('form', { class: 'tt-login-card' }, [
      el('strong', { style: { fontSize: '1.25rem' }, text: 'TweakTags admin' }),
      el('span', { style: { opacity: '0.7' }, text: 'Sign in to manage your content.' }),
      el('div', { class: 'tt-field' }, [el('label', { class: 'tt-label', text: 'Email' }), email]),
      el('div', { class: 'tt-field' }, [el('label', { class: 'tt-label', text: 'Password' }), password]),
      button,
      error,
    ]);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void submit();
    });

    container.append(el('div', { class: 'tt-login-page' }, [form]));
  };

  const renderDashboard = (): void => {
    clear(container);

    const topbar = el('div', { class: 'tt-admin-top' }, [
      el('strong', { style: { fontSize: '1.3rem' }, text: 'TweakTags admin' }),
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' } }, [
        el('span', { style: { opacity: '0.7' }, text: engine.user?.email ?? '' }),
        el('button', { class: 'tt-btn tt-subtle', type: 'button', text: 'Sign out', onclick: () => void engine.logout() }),
      ]),
    ]);

    const activeTab = tab === 'create' && !isSuperuser() ? 'view' : tab;
    const tabRow: Child[] = [];

    tabButtons.view = el('button', {
      class: activeTab === 'view' ? 'tt-btn' : 'tt-btn tt-subtle',
      type: 'button',
      text: 'View tags',
      onclick: () => setTab('view'),
    });
    tabRow.push(tabButtons.view);

    if (isSuperuser()) {
      tabButtons.create = el('button', {
        class: activeTab === 'create' ? 'tt-btn' : 'tt-btn tt-subtle',
        type: 'button',
        text: 'Create tag',
        onclick: () => setTab('create'),
      });
      tabRow.push(tabButtons.create);
    }

    tabButtons.edit = el('button', {
      class: activeTab === 'edit' ? 'tt-btn' : 'tt-btn tt-subtle',
      type: 'button',
      text: 'Edit tags',
      onclick: () => setTab('edit'),
    });
    tabRow.push(tabButtons.edit);

    tabRow.push(
      el('button', {
        class: 'tt-btn tt-subtle',
        style: { marginLeft: 'auto' },
        type: 'button',
        text: 'Refresh',
        onclick: () => void loadEntries(),
      }),
    );

    contentArea = el('div');

    const shell = el('div', { class: 'tt-admin-shell' }, [topbar, el('div', { class: 'tt-tabs' }, tabRow), contentArea]);
    container.append(el('div', { class: 'tt-admin' }, [shell]));

    void loadEntries();
  };

  const render = (): void => {
    if (engine.user) {
      renderDashboard();
    } else {
      contentArea = null;
      renderLogin();
    }
  };

  //Only swap between login and dashboard when the signed in state changes, so a
  //background content load does not reset the tab or steal input focus.
  let wasSignedIn = engine.user !== null;

  const unsubscribe = engine.subscribe(() => {
    const signedIn = engine.user !== null;

    if (signedIn !== wasSignedIn) {
      wasSignedIn = signedIn;
      render();
    }
  });

  render();

  return () => {
    unsubscribe();
    clear(container);
  };
};
