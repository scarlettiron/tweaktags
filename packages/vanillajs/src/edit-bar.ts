//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { ROLES, isValidTag, type TagType, type TweakTagsEngine } from '@tweaktags/browser';

import { clear, el, type Child } from './dom.js';
import { applyScope, type TweakTagsTheme } from './theme.js';
import { uploadButton } from './upload.js';
import type { ConfirmFn } from './confirm.js';

//The width below which the bar collapses into a mobile menu.
const NARROW_QUERY = '(max-width: 640px)';

//How many tags to show on one page of the Tags panel list.
const PAGE_SIZE = 10;

//One tag with its type, used by the Tags panel list.
interface TagEntry {
  tag: string;
  type: TagType;
}

//A remembered drag position for the floating bar.
interface Position {
  left: number;
  top: number;
}

//Mounts the floating edit bar. Signed out it is a compact login card, signed in
//it is a draggable toolbar on wide screens and a collapsible menu on small ones.
//Returns a function that removes it again.
export const mountEditBar = (
  engine: TweakTagsEngine,
  theme: TweakTagsTheme,
  confirm: ConfirmFn,
): (() => void) => {
  let current: HTMLElement | null = null;
  let panelEl: HTMLElement | null = null;
  let shownPanel: 'tags' | 'help' | null = null;
  let openPanel: 'tags' | 'help' | null = null;
  let menuOpen = false;
  let position: Position | null = null;

  const mq = window.matchMedia(NARROW_QUERY);
  let isNarrow = mq.matches;

  const isSuperuser = (): boolean => engine.user?.role === ROLES.SUPERUSER;

  //Keeps a dragged bar where the user left it across redraws.
  const applyPosition = (node: HTMLElement): void => {
    if (position) {
      node.style.left = `${position.left}px`;
      node.style.top = `${position.top}px`;
      node.style.right = 'auto';
      node.style.bottom = 'auto';
    }
  };

  //A grip that drags whatever bar is currently shown.
  const makeGrip = (): HTMLElement => {
    const grip = el('span', { class: 'tt-grip', title: 'Drag to move', 'aria-label': 'Drag to move' });
    let offset: { x: number; y: number } | null = null;

    grip.addEventListener('pointerdown', (event) => {
      if (!current) {
        return;
      }

      const rect = current.getBoundingClientRect();
      offset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      grip.setPointerCapture(event.pointerId);
    });

    grip.addEventListener('pointermove', (event) => {
      if (!offset || !current) {
        return;
      }

      const maxLeft = Math.max(0, window.innerWidth - current.offsetWidth);
      const maxTop = Math.max(0, window.innerHeight - current.offsetHeight);
      const left = Math.min(Math.max(0, event.clientX - offset.x), maxLeft);
      const top = Math.min(Math.max(0, event.clientY - offset.y), maxTop);

      position = { left, top };
      applyPosition(current);
    });

    const release = (event: PointerEvent): void => {
      offset = null;

      try {
        grip.releasePointerCapture(event.pointerId);
      } catch {
        //The pointer may already be released, which is fine.
      }
    };

    grip.addEventListener('pointerup', release);
    grip.addEventListener('pointercancel', release);

    return grip;
  };

  const togglePanel = (panel: 'tags' | 'help'): void => {
    openPanel = openPanel === panel ? null : panel;
    render();
  };

  const handleSave = async (): Promise<void> => {
    const ok = await confirm('Save your changes?', { confirmLabel: 'Save', cancelLabel: 'Cancel' });

    if (ok) {
      await engine.saveEdits();
    }
  };

  const handleClose = async (): Promise<void> => {
    if (engine.hasUnsavedChanges) {
      const ok = await confirm('You have unsaved changes that will be lost. Close without saving?', {
        confirmLabel: 'Close without saving',
        cancelLabel: 'Keep editing',
      });

      if (!ok) {
        return;
      }
    }

    engine.discardEdits();
    engine.setEditing(false);
  };

  //The save, close, and edit buttons, shared by both layouts.
  const buildControls = (stacked: boolean): HTMLElement[] => {
    const block = stacked ? ' tt-block' : '';

    if (!engine.isEditing) {
      const button = el('button', {
        class: `tt-btn${block}`,
        type: 'button',
        text: 'Edit page',
        onclick: () => engine.setEditing(true),
      });
      button.disabled = !engine.canEdit;

      return [button];
    }

    if (engine.editInView) {
      return [
        el('button', {
          class: `tt-btn${block}`,
          type: 'button',
          text: `Save${engine.hasUnsavedChanges ? ' *' : ''}`,
          onclick: () => void handleSave(),
        }),
        el('button', {
          class: `tt-btn tt-subtle${block}`,
          type: 'button',
          text: 'Close',
          onclick: () => void handleClose(),
        }),
      ];
    }

    //In popup mode the popup editor handles save and close, so the bar shows
    //nothing extra while editing.
    return [];
  };

  //Signed out: a compact login card with the fields inline, wrapping on mobile.
  const buildLogin = (): HTMLElement => {
    const email = el('input', { class: 'tt-input', type: 'email', placeholder: 'email' });
    const password = el('input', { class: 'tt-input', type: 'password', placeholder: 'password' });
    const error = el('span', { class: 'tt-error' });
    error.style.display = 'none';

    const submit = async (): Promise<void> => {
      error.style.display = 'none';

      try {
        await engine.login(email.value, password.value);
      } catch (loginError) {
        error.textContent = loginError instanceof Error ? loginError.message : 'Could not sign in';
        error.style.display = '';
      }
    };

    password.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        void submit();
      }
    });

    const fields = el('div', { class: 'tt-login-fields' }, [
      email,
      password,
      el('button', { class: 'tt-btn', type: 'button', text: 'Sign in', onclick: () => void submit() }),
    ]);

    const header = el('div', { class: 'tt-header' }, [
      el('span', { style: { display: 'flex', alignItems: 'center', gap: '0.4rem' } }, [
        makeGrip(),
        el('strong', { text: 'Sign in to edit' }),
      ]),
    ]);

    return el('div', { class: 'tt-login' }, [header, fields, error]);
  };

  //Signed in, wide screen: the horizontal toolbar.
  const buildBar = (): HTMLElement => {
    const kids: Child[] = [makeGrip(), el('span', { class: 'tt-email', text: engine.user?.email ?? '' })];

    kids.push(
      el('button', {
        class: openPanel === 'help' ? 'tt-btn' : 'tt-btn tt-icon',
        type: 'button',
        'aria-label': 'Help',
        title: 'Help and tips',
        text: '?',
        onclick: () => togglePanel('help'),
      }),
    );

    if (isSuperuser()) {
      kids.push(
        el('button', {
          class: openPanel === 'tags' ? 'tt-btn' : 'tt-btn tt-subtle',
          type: 'button',
          text: 'Tags',
          onclick: () => togglePanel('tags'),
        }),
      );
    }

    for (const control of buildControls(false)) {
      kids.push(control);
    }

    kids.push(
      el('button', { class: 'tt-btn tt-subtle', type: 'button', text: 'Sign out', onclick: () => void engine.logout() }),
    );

    return el('div', { class: 'tt-bar' }, kids);
  };

  //Signed in, small screen and closed: a round button that opens the menu.
  const buildFab = (): HTMLElement =>
    el('button', {
      class: 'tt-fab',
      type: 'button',
      'aria-label': 'Open the editor menu',
      text: '▲',
      onclick: () => {
        menuOpen = true;
        render();
      },
    });

  //Signed in, small screen and open: a stacked menu of the same controls.
  const buildMenu = (): HTMLElement => {
    const header = el('div', { class: 'tt-header' }, [
      el('span', { class: 'tt-email', style: { maxWidth: 'none' }, text: engine.user?.email ?? '' }),
      el('button', {
        class: 'tt-close',
        type: 'button',
        'aria-label': 'Close the editor menu',
        text: '▼',
        onclick: () => {
          menuOpen = false;
          render();
        },
      }),
    ]);

    const kids: Child[] = [header];

    kids.push(
      el('button', { class: 'tt-btn tt-subtle tt-block', type: 'button', text: 'Help', onclick: () => togglePanel('help') }),
    );

    if (isSuperuser()) {
      kids.push(
        el('button', { class: 'tt-btn tt-subtle tt-block', type: 'button', text: 'Tags', onclick: () => togglePanel('tags') }),
      );
    }

    for (const control of buildControls(true)) {
      kids.push(control);
    }

    kids.push(
      el('button', { class: 'tt-btn tt-subtle tt-block', type: 'button', text: 'Sign out', onclick: () => void engine.logout() }),
    );

    return el('div', { class: 'tt-menu' }, kids);
  };

  //A shared header with a title and a close X for the popups.
  const panelHeader = (title: string, onClose: () => void): HTMLElement =>
    el('div', { class: 'tt-header' }, [
      el('strong', { text: title }),
      el('button', { class: 'tt-close', type: 'button', 'aria-label': 'Close', text: '×', onclick: onClose }),
    ]);

  const typeOptions = (): HTMLElement[] =>
    (['plain', 'rich', 'media'] as TagType[]).map((value) => el('option', { value, text: value }));

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

  //The Tags panel: create a tag, and search, page, retype, and delete existing
  //ones. It loads once and updates the list in place so inputs keep focus.
  const buildTagsPanel = (): HTMLElement => {
    let entries: TagEntry[] | null = null;
    let search = '';
    let page = 0;

    const newTag = el('input', { class: 'tt-input', type: 'text', placeholder: 'tag name, like hero-title' });
    const newType = engine.richText
      ? el('select', { class: 'tt-input' }, [
          el('option', { value: 'plain', text: 'Plain text' }),
          el('option', { value: 'rich', text: 'Rich text' }),
          el('option', { value: 'media', text: 'Media' }),
        ])
      : null;
    const newContent = el('input', { class: 'tt-input', type: 'text', placeholder: 'starting content (optional)' });
    const createError = el('span', { class: 'tt-error' });
    createError.style.display = 'none';
    const createButton = el('button', { class: 'tt-btn', type: 'button', text: 'Create tag' });

    const searchInput = el('input', { class: 'tt-input', type: 'search', placeholder: 'Search tags...' });
    const listWrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '0.6rem' } });

    const buildTagRow = (entry: TagEntry): HTMLElement => {
      const kids: Child[] = [el('span', { class: 'tt-mono', style: { flex: '1', minWidth: '6rem' }, text: entry.tag })];

      if (engine.richText) {
        const select = el('select', { class: 'tt-input', style: { width: 'auto', padding: '0.2rem 0.3rem' } }, typeOptions());
        select.value = entry.type;
        select.addEventListener('change', () => void handleChangeType(entry.tag, select.value as TagType));
        kids.push(select);
      }

      kids.push(
        el('button', {
          class: 'tt-btn tt-danger',
          style: { padding: '0.2rem 0.5rem' },
          type: 'button',
          text: 'Delete',
          onclick: () => void handleDelete(entry.tag),
        }),
      );

      return el('li', { class: 'tt-list-item' }, kids);
    };

    const drawList = (): void => {
      clear(listWrap);

      if (entries === null) {
        listWrap.append(el('span', { class: 'tt-hint', text: 'Loading...' }));

        return;
      }

      if (entries.length === 0) {
        listWrap.append(el('span', { class: 'tt-hint', text: 'No tags yet.' }));

        return;
      }

      const query = search.trim().toLowerCase();
      const filtered = entries.filter((entry) => entry.tag.toLowerCase().includes(query));

      if (filtered.length === 0) {
        listWrap.append(el('span', { class: 'tt-hint', text: `No tags match "${search}".` }));

        return;
      }

      const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      const currentPage = Math.min(page, totalPages - 1);
      const items = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

      const list = el('ul', { class: 'tt-list tt-scroll' }, items.map(buildTagRow));
      listWrap.append(list);

      if (totalPages > 1) {
        listWrap.append(
          buildPager(currentPage, totalPages, (next) => {
            page = next;
            drawList();
          }),
        );
      }
    };

    const loadEntries = async (): Promise<void> => {
      try {
        const names = await engine.listTags();
        let typeByTag = new Map<string, TagType>();

        if (engine.richText) {
          const records = await engine.loadContent(names);
          typeByTag = new Map(records.map((record) => [record.tag, record.type]));
        }

        entries = names.map((tag) => ({ tag, type: typeByTag.get(tag) ?? 'plain' }));
      } catch {
        entries = [];
      }

      drawList();
    };

    async function handleChangeType(tag: string, type: TagType): Promise<void> {
      try {
        await engine.setTagType(tag, type);
        entries = entries ? entries.map((entry) => (entry.tag === tag ? { ...entry, type } : entry)) : entries;
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
        entries = (entries ?? []).filter((entry) => entry.tag !== tag);
        drawList();
        engine.notify(`Deleted the tag "${tag}".`, 'success');
      } catch (deleteError) {
        engine.notify(deleteError instanceof Error ? deleteError.message : 'Could not delete the tag', 'error');
      }
    }

    const handleCreate = async (): Promise<void> => {
      createError.style.display = 'none';
      const tag = newTag.value.trim();

      if (!isValidTag(tag)) {
        createError.textContent = 'Use lowercase letters, numbers, and hyphens only.';
        createError.style.display = '';

        return;
      }

      createButton.disabled = true;

      try {
        const type = (newType?.value as TagType | undefined) ?? 'plain';
        await engine.createTag(tag, newContent.value, type);
        newTag.value = '';
        newContent.value = '';

        if (newType) {
          newType.value = 'plain';
        }

        await loadEntries();
        engine.notify(`Created the tag "${tag}".`, 'success');
      } catch (createErr) {
        const message = createErr instanceof Error ? createErr.message : 'Could not create the tag';
        createError.textContent = message;
        createError.style.display = '';
        engine.notify(message, 'error');
      } finally {
        createButton.disabled = false;
      }
    };

    createButton.addEventListener('click', () => void handleCreate());
    searchInput.addEventListener('input', () => {
      search = searchInput.value;
      page = 0;
      drawList();
    });

    //An upload button for the starting content, shown only for a media tag.
    const upload = newType ? uploadButton(engine, (url) => (newContent.value = url)) : null;

    if (upload && newType) {
      const syncUpload = (): void => {
        upload.style.display = newType.value === 'media' ? '' : 'none';
      };
      syncUpload();
      newType.addEventListener('change', syncUpload);
    }

    const kids: Child[] = [
      panelHeader('Tags', () => {
        openPanel = null;
        render();
      }),
      el('strong', { text: 'Create a tag' }),
      newTag,
      newType,
      newContent,
      upload,
      createButton,
      createError,
      el('hr', { class: 'tt-divider' }),
      el('strong', { text: 'Existing tags' }),
      searchInput,
      listWrap,
      el('span', {
        class: 'tt-hint',
        text: 'A tag only shows on a page where an element has its data-tweaktags- attribute.',
      }),
    ];

    void loadEntries();

    return el('div', { class: 'tt-panel' }, kids);
  };

  //A short help popup with tips on how to use the editor.
  const buildHelpPanel = (): HTMLElement => {
    const item = (title: string, body: string): HTMLElement =>
      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '0.15rem' } }, [
        el('strong', { text: title }),
        el('span', { style: { opacity: '0.85' }, text: body }),
      ]);

    const kids: Child[] = [
      panelHeader('Help and tips', () => {
        openPanel = null;
        render();
      }),
      item('Find the editable spots', 'After you click Edit page, every spot you can change gets a dashed outline. Click inside one and type.'),
      item('Save your changes', 'Click Save. You are asked to confirm, then all of your changes are stored at once.'),
      item('Close the editor', 'Click Close to leave edit mode. If you have unsaved changes, you are warned first.'),
    ];

    if (isSuperuser()) {
      kids.push(item('Create a tag', 'Open the Tags panel, type a name like hero-title and some optional text, then click Create tag.'));
      kids.push(item('Change or delete a tag', 'In the Tags panel, change a tag type with its dropdown, or click Delete to remove it.'));
    }

    return el('div', { class: 'tt-panel', style: { gap: '0.9rem' } }, kids);
  };

  //Draws or removes the open panel, but only when which panel is shown changes,
  //so a redraw of the bar does not throw away the panel's inputs.
  const renderPanel = (): void => {
    const want = !engine.user ? null : openPanel === 'tags' && !isSuperuser() ? null : openPanel;

    if (want === shownPanel) {
      return;
    }

    if (panelEl) {
      panelEl.remove();
      panelEl = null;
    }

    shownPanel = want;

    if (want === 'tags') {
      panelEl = buildTagsPanel();
    } else if (want === 'help') {
      panelEl = buildHelpPanel();
    }

    if (panelEl) {
      applyScope(panelEl, theme);
      document.body.appendChild(panelEl);
    }
  };

  //Draws the right bar for the current state, keeping any dragged position.
  const render = (): void => {
    if (current) {
      current.remove();
      current = null;
    }

    let node: HTMLElement;
    let draggable = true;

    if (!engine.user) {
      node = buildLogin();
    } else if (isNarrow) {
      if (menuOpen) {
        node = buildMenu();
      } else {
        node = buildFab();
        draggable = false;
      }
    } else {
      node = buildBar();
    }

    applyScope(node, theme);

    if (draggable) {
      applyPosition(node);
    }

    document.body.appendChild(node);
    current = node;

    renderPanel();
  };

  //Only redraw when something the bar shows actually changed, so a background
  //content load does not steal focus from the login or panel inputs.
  const snapshot = (): string =>
    `${engine.user ? '1' : '0'}|${engine.isEditing ? '1' : '0'}|${engine.hasUnsavedChanges ? '1' : '0'}`;

  let last = snapshot();

  const unsubscribe = engine.subscribe(() => {
    const next = snapshot();

    if (next !== last) {
      last = next;
      render();
    }
  });

  const onMedia = (): void => {
    isNarrow = mq.matches;
    render();
  };

  mq.addEventListener('change', onMedia);
  render();

  return () => {
    unsubscribe();
    mq.removeEventListener('change', onMedia);

    if (current) {
      current.remove();
    }

    if (panelEl) {
      panelEl.remove();
    }
  };
};
