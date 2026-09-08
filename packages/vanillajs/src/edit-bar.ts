//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import {
  ROLES,
  isValidTag,
  type AuthUser,
  type ContentRecord,
  type Role,
  type TagType,
  type TweakTagsEngine,
} from '@tweaktags/browser';
//The browser package re-exports the shared types but only a handful of values,
//so the email rule and the password length come straight from core rather than
//being written out again here.
import { MIN_PASSWORD_LENGTH, isValidEmail } from '@tweaktags/core';

import { clear, el, type Child } from './dom.js';
import { applyScope, type TweakTagsTheme } from './theme.js';
import { uploadButton } from './upload.js';
import type { ConfirmFn } from './confirm.js';

//The width below which the bar collapses into a mobile menu.
const NARROW_QUERY = '(max-width: 640px)';

//How many tags to show on one page of the Tags panel list.
const PAGE_SIZE = 10;

//The popups the bar can open. Tags and users are superuser work; account is for
//everyone, since an editor still has to be able to change their own sign in
//details.
type Panel = 'tags' | 'help' | 'users' | 'account';

//A button that looks like the text it replaces. The bar is 21rem wide and
//already crowded, so the account popup hangs off the email label rather than off
//a button of its own, and this is what stops that label looking like a button.
const BARE_BUTTON: Partial<CSSStyleDeclaration> = {
  background: 'none',
  border: 'none',
  padding: '0 0.35rem',
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
};

//One tag with its type, used by the Tags panel list.
interface TagEntry {
  tag: string;
  type: TagType;
  record: ContentRecord | null;
}

//Turns a saved record into the short line shown under a tag name in the Tags
//panel. The panel is narrow, so this stays one readable line and the row's
//title attribute carries the rest.
const previewOf = (record: ContentRecord | null, type: TagType): string => {
  if (!record) {
    return 'No content yet';
  }

  //The row's type is the live one, since it can be changed without reloading.
  if (type === 'media') {
    return record.mediaUrl || record.body || 'No media set';
  }

  //Rich content is html, so strip the tags down to readable text.
  const text = record.body
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text === '' ? 'Empty' : text;
};

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
  let shownPanel: Panel | null = null;
  let openPanel: Panel | null = null;
  let menuOpen = false;
  let position: Position | null = null;

  const mq = window.matchMedia(NARROW_QUERY);
  let isNarrow = mq.matches;

  //Keeps a dragged bar where the user left it across redraws.
  const applyPosition = (node: HTMLElement): void => {
    if (position) {
      node.style.left = `${position.left}px`;
      node.style.top = `${position.top}px`;
      node.style.right = 'auto';
      node.style.bottom = 'auto';
    }
  };

  //The dotted grab handle. It is only the affordance: the whole bar is draggable,
  //because a ten pixel target is one most people never find and some cannot hit
  //at all.
  const makeGrip = (): HTMLElement =>
    el('span', { class: 'tt-grip', title: 'Drag to move', 'aria-label': 'Drag to move' });

  //Anything the pointer can act on in its own right. A drag that started on one
  //of these would swallow the click, so the bar leaves them alone.
  const INTERACTIVE = 'button, a, input, select, textarea, [contenteditable="true"]';

  const startsOnAControl = (target: EventTarget | null): boolean =>
    target instanceof Element && target.closest(INTERACTIVE) !== null;

  //Makes the whole bar draggable by its own background, with the grip as the
  //visible hint. The pointer is captured on the bar itself, so a fast drag that
  //outruns the cursor keeps moving it.
  const makeDraggable = (node: HTMLElement): void => {
    let offset: { x: number; y: number } | null = null;

    node.addEventListener('pointerdown', (event) => {
      if (startsOnAControl(event.target)) {
        return;
      }

      const rect = node.getBoundingClientRect();
      offset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      node.style.cursor = 'grabbing';

      try {
        node.setPointerCapture(event.pointerId);
      } catch {
        //Not every environment has pointer capture. Without it a fast drag can
        //outrun the cursor and stop, which is worth having rather than nothing.
      }
    });

    node.addEventListener('pointermove', (event) => {
      if (!offset) {
        return;
      }

      const maxLeft = Math.max(0, window.innerWidth - node.offsetWidth);
      const maxTop = Math.max(0, window.innerHeight - node.offsetHeight);
      const left = Math.min(Math.max(0, event.clientX - offset.x), maxLeft);
      const top = Math.min(Math.max(0, event.clientY - offset.y), maxTop);

      position = { left, top };
      applyPosition(node);
    });

    const release = (event: PointerEvent): void => {
      offset = null;
      node.style.cursor = '';

      try {
        node.releasePointerCapture(event.pointerId);
      } catch {
        //The pointer may already be released, which is fine.
      }
    };

    node.addEventListener('pointerup', release);
    node.addEventListener('pointercancel', release);
  };

  const togglePanel = (panel: Panel): void => {
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

  //The email label, which doubles as the way into the account popup. It is a
  //button rather than a span so the keyboard can reach it, and it carries the
  //full address in a title because the label truncates.
  const buildAccountLabel = (stacked: boolean): HTMLElement => {
    const email = engine.user?.email ?? '';
    const style: Partial<CSSStyleDeclaration> = { ...BARE_BUTTON };

    if (stacked) {
      style.maxWidth = 'none';
    }

    if (openPanel === 'account') {
      style.color = 'var(--tt-primary)';
    }

    return el('button', {
      class: 'tt-email',
      style,
      type: 'button',
      title: `${email} - open your account settings`,
      text: email,
      onclick: () => togglePanel('account'),
    });
  };

  //Signed in, wide screen: the horizontal toolbar.
  const buildBar = (): HTMLElement => {
    const kids: Child[] = [makeGrip(), buildAccountLabel(false)];

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

    if (engine.isSuperuser) {
      kids.push(
        el('button', {
          class: openPanel === 'tags' ? 'tt-btn' : 'tt-btn tt-subtle',
          type: 'button',
          text: 'Tags',
          onclick: () => togglePanel('tags'),
        }),
        el('button', {
          class: openPanel === 'users' ? 'tt-btn' : 'tt-btn tt-subtle',
          type: 'button',
          text: 'Users',
          onclick: () => togglePanel('users'),
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
      buildAccountLabel(true),
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

    if (engine.isSuperuser) {
      kids.push(
        el('button', { class: 'tt-btn tt-subtle tt-block', type: 'button', text: 'Tags', onclick: () => togglePanel('tags') }),
        el('button', { class: 'tt-btn tt-subtle tt-block', type: 'button', text: 'Users', onclick: () => togglePanel('users') }),
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

  //Editor comes first because it is the safer of the two to pick by accident.
  const roleOptions = (): HTMLOptionElement[] =>
    ([ROLES.EDITOR, ROLES.SUPERUSER] as Role[]).map((value) =>
      el('option', { value, text: value === ROLES.SUPERUSER ? 'Superuser' : 'Editor' }),
    );

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
      const head: Child[] = [el('span', { class: 'tt-mono', style: { flex: '1', minWidth: '6rem' }, text: entry.tag })];

      if (engine.richText) {
        const select = el('select', { class: 'tt-input', style: { width: 'auto', padding: '0.2rem 0.3rem' } }, typeOptions());
        select.value = entry.type;
        select.addEventListener('change', () => void handleChangeType(entry.tag, select.value as TagType));
        head.push(select);
      }

      head.push(
        el('button', {
          class: 'tt-btn tt-danger',
          style: { padding: '0.2rem 0.5rem' },
          type: 'button',
          text: 'Delete',
          onclick: () => void handleDelete(entry.tag),
        }),
      );

      //The saved content, so a tag can be told apart by what it holds rather
      //than by its name alone.
      const preview = previewOf(entry.record, entry.type);
      const previewKids: Child[] = [];

      if (entry.type === 'media' && entry.record?.mediaUrl) {
        previewKids.push(el('img', { class: 'tt-list-thumb', src: entry.record.mediaUrl, alt: '' }));
      }

      previewKids.push(el('span', { text: preview }));

      return el('li', { class: 'tt-list-item', title: preview }, [
        el('div', { class: 'tt-list-head' }, head),
        el('div', { class: 'tt-list-preview' }, previewKids),
      ]);
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

    //Loads the tag names with their saved content, so each row can show what the
    //tag holds. The content is fetched whether or not rich text is on, since the
    //preview matters in both cases.
    const loadEntries = async (): Promise<void> => {
      try {
        const names = await engine.listTags();
        const records = await engine.loadContent(names);
        const byTag = new Map(records.map((record) => [record.tag, record]));

        entries = names.map((tag) => {
          const record = byTag.get(tag) ?? null;

          return { tag, type: record?.type ?? 'plain', record };
        });
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

  //The Users panel: add a user, and change the role, password, or existence of
  //one that is already there. Superuser only. Every rule below is enforced by
  //the server too; showing it here just saves somebody the error.
  const buildUsersPanel = (): HTMLElement => {
    let users: AuthUser[] | null = null;
    let search = '';
    let page = 0;

    //Which row has its password field open. The row is two lines wide at 21rem,
    //so the field takes the place of the second line rather than adding a third.
    let openPasswordFor: string | null = null;

    //With an identity provider in front of the server, an address may already
    //have an account there, so adding somebody is two jobs rather than one: make
    //a new account, or point TweakTags at one that exists already. Without a
    //directory only the first is possible, and none of this is drawn.
    let linkMode = false;

    const newEmail = el('input', { class: 'tt-input', type: 'email', autocomplete: 'off', placeholder: 'email' });
    const newPassword = el('input', { class: 'tt-input', type: 'password', autocomplete: 'new-password', placeholder: 'password' });
    const newExternalId = el('input', {
      class: 'tt-input tt-mono',
      type: 'text',
      autocomplete: 'off',
      placeholder: 'identity provider user id (Cognito sub)',
    });
    const newRole = el('select', { class: 'tt-input' }, roleOptions());
    const createError = el('span', { class: 'tt-error' });
    createError.style.display = 'none';
    //A success the server wanted to explain, kept under the form as well as in
    //the toast so it can still be read once the toast has gone. Hint styling
    //rather than error styling, because nothing went wrong.
    const createNotice = el('span', { class: 'tt-hint' });
    createNotice.style.display = 'none';
    const createButton = el('button', { class: 'tt-btn', type: 'button', text: 'Create user' });

    //The two modes differ by a single field, so they share the rest of the form
    //and swap that one in and out. Redrawing only this much keeps whatever was
    //already typed into the fields the modes have in common.
    const formWrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '0.6rem' } });

    const drawForm = (): void => {
      clear(formWrap);
      formWrap.append(newEmail);

      if (linkMode) {
        formWrap.append(
          newExternalId,
          el('span', { class: 'tt-hint', text: 'TweakTags sets no password for a linked account.' }),
        );
      } else {
        formWrap.append(newPassword);
      }

      formWrap.append(newRole);
    };

    //Two short buttons on one line. The panel is 21rem wide, so a stacked pair
    //of full width ones would push the form itself down out of sight.
    const createModeButton = el('button', {
      class: 'tt-btn',
      style: { padding: '0.2rem 0.5rem' },
      type: 'button',
      text: 'Create new',
    });
    const linkModeButton = el('button', {
      class: 'tt-btn tt-subtle',
      style: { padding: '0.2rem 0.5rem' },
      type: 'button',
      text: 'Link existing',
    });

    const setLinkMode = (next: boolean): void => {
      linkMode = next;
      createModeButton.className = next ? 'tt-btn tt-subtle' : 'tt-btn';
      linkModeButton.className = next ? 'tt-btn' : 'tt-btn tt-subtle';
      createButton.textContent = next ? 'Link account' : 'Create user';
      //Whatever either box says was about the mode being left behind, so neither
      //of them still applies.
      createError.style.display = 'none';
      createNotice.style.display = 'none';
      drawForm();
    };

    createModeButton.addEventListener('click', () => setLinkMode(false));
    linkModeButton.addEventListener('click', () => setLinkMode(true));

    const searchInput = el('input', { class: 'tt-input', type: 'search', placeholder: 'Search users...' });
    const listWrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '0.6rem' } });

    const showCreateError = (message: string): void => {
      createError.textContent = message;
      createError.style.display = '';
    };

    //The line a row usually shows: what the user is, and what can be done to
    //them. Kept to one line so the row stays two lines tall.
    const buildActionsLine = (user: AuthUser, isSelf: boolean): HTMLElement => {
      const kids: Child[] = [];

      const select = el('select', { class: 'tt-input', style: { width: 'auto', padding: '0.2rem 0.3rem' } }, roleOptions());
      select.value = user.role;

      if (isSelf) {
        //Self demotion is refused, so a lone superuser cannot lock everyone out
        //of the install by accident.
        select.disabled = true;
        select.title = 'You cannot change your own role. Promote somebody else first.';
      } else if (user.role === ROLES.SUPERUSER && superuserCount() === 1) {
        //Demoting the last superuser leaves nobody who can manage users, so the
        //server refuses it. Only that one option is off; promoting still works.
        const editorOption = select.querySelector<HTMLOptionElement>(`option[value="${ROLES.EDITOR}"]`);

        if (editorOption) {
          editorOption.disabled = true;
        }

        select.title = 'This is the only superuser. Promote somebody else before demoting them.';
      }

      select.addEventListener('change', () => void handleRoleChange(user, select.value as Role));
      kids.push(select);

      kids.push(
        el('button', {
          class: 'tt-btn tt-subtle',
          style: { padding: '0.2rem 0.5rem' },
          type: 'button',
          text: 'Set password',
          onclick: () => {
            openPasswordFor = user.id;
            drawList();
          },
        }),
      );

      //Deleting yourself is refused, and there is no reason to offer a button
      //that can only ever fail. Your own account is the account popup's job.
      if (!isSelf) {
        const remove = el('button', {
          class: 'tt-btn tt-danger',
          style: { padding: '0.2rem 0.5rem' },
          type: 'button',
          text: 'Delete',
          onclick: () => void handleDeleteUser(user),
        });

        if (user.role === ROLES.SUPERUSER) {
          //Judged on the role they hold right now, so demoting them turns this
          //back on. Shown disabled rather than hidden, so the way out is clear.
          remove.disabled = true;
          remove.title = 'A superuser cannot be deleted. Change their role to editor first.';
        }

        kids.push(remove);
      }

      return el('div', { class: 'tt-list-head' }, kids);
    };

    //The reset password line, which replaces the actions line while it is open.
    //One input, never a stack of them, since the panel is only 21rem wide.
    const buildPasswordLine = (user: AuthUser): HTMLElement => {
      const input = el('input', {
        class: 'tt-input',
        style: { flex: '1', minWidth: '0', padding: '0.2rem 0.4rem' },
        type: 'password',
        autocomplete: 'new-password',
        placeholder: 'new password',
      });

      const save = el('button', { class: 'tt-btn', style: { padding: '0.2rem 0.5rem' }, type: 'button', text: 'Save' });

      const submit = async (): Promise<void> => {
        if (input.value.length < MIN_PASSWORD_LENGTH) {
          engine.notify(`The password must be at least ${MIN_PASSWORD_LENGTH} characters.`, 'error');

          return;
        }

        save.disabled = true;

        try {
          await engine.updateUserPassword(user.id, input.value);
          openPasswordFor = null;
          drawList();
          engine.notify(`Set a new password for "${user.email}". They are now signed out everywhere.`, 'success');
        } catch (passwordError) {
          engine.notify(passwordError instanceof Error ? passwordError.message : 'Could not set the password', 'error');
          save.disabled = false;
        }
      };

      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          void submit();
        }
      });

      save.addEventListener('click', () => void submit());

      return el('div', { class: 'tt-list-head' }, [
        input,
        save,
        el('button', {
          class: 'tt-btn tt-subtle',
          style: { padding: '0.2rem 0.5rem' },
          type: 'button',
          text: 'Cancel',
          onclick: () => {
            openPasswordFor = null;
            drawList();
          },
        }),
      ]);
    };

    const buildUserRow = (user: AuthUser): HTMLElement => {
      const isSelf = user.id === engine.user?.id;

      //The address truncates at this width, so the whole of it goes in a title.
      const head: Child[] = [
        el('span', {
          class: 'tt-mono',
          style: { flex: '1', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
          title: user.email,
          text: user.email,
        }),
      ];

      if (isSelf) {
        head.push(el('span', { class: 'tt-badge', text: 'you' }));
      }

      return el('li', { class: 'tt-list-item' }, [
        el('div', { class: 'tt-list-head' }, head),
        openPasswordFor === user.id ? buildPasswordLine(user) : buildActionsLine(user, isSelf),
      ]);
    };

    const superuserCount = (): number => (users ?? []).filter((user) => user.role === ROLES.SUPERUSER).length;

    const drawList = (): void => {
      clear(listWrap);

      if (users === null) {
        listWrap.append(el('span', { class: 'tt-hint', text: 'Loading...' }));

        return;
      }

      //Only reachable when the load failed, since you are always in your own
      //list. The toast says what went wrong, so this just stays quiet.
      if (users.length === 0) {
        listWrap.append(el('span', { class: 'tt-hint', text: 'No users to show.' }));

        return;
      }

      const query = search.trim().toLowerCase();
      const filtered = users.filter((user) => user.email.toLowerCase().includes(query));

      if (filtered.length === 0) {
        listWrap.append(el('span', { class: 'tt-hint', text: `No users match "${search}".` }));

        return;
      }

      const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      const currentPage = Math.min(page, totalPages - 1);
      const items = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

      const list = el('ul', { class: 'tt-list tt-scroll' }, items.map(buildUserRow));
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

    const loadUsers = async (): Promise<void> => {
      try {
        users = await engine.listUsers();
      } catch (loadError) {
        users = [];
        engine.notify(loadError instanceof Error ? loadError.message : 'Could not load the users', 'error');
      }

      drawList();
    };

    async function handleRoleChange(user: AuthUser, role: Role): Promise<void> {
      try {
        const updated = await engine.updateUserRole(user.id, role);
        users = (users ?? []).map((item) => (item.id === updated.id ? updated : item));
        engine.notify(`${updated.email} is now ${updated.role === ROLES.SUPERUSER ? 'a superuser' : 'an editor'}.`, 'success');
      } catch (roleError) {
        engine.notify(roleError instanceof Error ? roleError.message : 'Could not change the role', 'error');
      }

      //Either way the select is showing what was picked, which after a refusal
      //is not what the user actually has, so redraw from state.
      drawList();
    }

    async function handleDeleteUser(user: AuthUser): Promise<void> {
      const ok = await confirm(`Delete the user "${user.email}"? This cannot be undone.`, {
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
      });

      if (!ok) {
        return;
      }

      try {
        await engine.deleteUser(user.id);
        users = (users ?? []).filter((item) => item.id !== user.id);
        drawList();
        engine.notify(`Deleted the user "${user.email}".`, 'success');
      } catch (deleteError) {
        engine.notify(deleteError instanceof Error ? deleteError.message : 'Could not delete the user', 'error');
      }
    }

    const handleCreate = async (): Promise<void> => {
      createError.style.display = 'none';
      createNotice.style.display = 'none';
      const email = newEmail.value.trim();
      const externalId = newExternalId.value.trim();

      //The same two checks the server makes, so a typo comes back straight away
      //instead of as a 400 after a round trip. A duplicate address can only be
      //found by asking the server, so that one arrives as a 409.
      if (!isValidEmail(email)) {
        showCreateError('Enter a valid email address.');

        return;
      }

      //Linking sets no password at all, so the length rule has nothing to
      //measure. What it needs instead is the id the provider knows them by.
      if (linkMode) {
        if (externalId === '') {
          showCreateError('Enter the identity provider user id.');

          return;
        }
      } else if (newPassword.value.length < MIN_PASSWORD_LENGTH) {
        showCreateError(`The password must be at least ${MIN_PASSWORD_LENGTH} characters.`);

        return;
      }

      createButton.disabled = true;

      try {
        const result = await engine.createUser(
          email,
          linkMode ? '' : newPassword.value,
          newRole.value as Role,
          linkMode ? externalId : undefined,
        );
        newEmail.value = '';
        newPassword.value = '';
        newExternalId.value = '';
        newRole.value = ROLES.EDITOR;
        await loadUsers();

        //The server's wording, not ours: it is the only side that knows what it
        //actually did with the address, and what it says is worth more than
        //"created" would be.
        if (result.notice) {
          createNotice.textContent = result.notice;
          createNotice.style.display = '';
          engine.notify(result.notice, 'success');
        } else {
          engine.notify(`Created the user "${email}".`, 'success');
        }
      } catch (createErr) {
        const message = createErr instanceof Error ? createErr.message : 'Could not create the user';
        showCreateError(message);
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

    drawForm();

    const kids: Child[] = [
      panelHeader('Users', () => {
        openPanel = null;
        render();
      }),
      el('strong', { text: 'Add a user' }),
    ];

    //Only an install with a directory behind it has two ways to add somebody,
    //and by far the common case is the one that has not, so that one gets
    //today's form with no toggle over it at all.
    if (engine.hasUserDirectory) {
      kids.push(el('div', { style: { display: 'flex', gap: '0.4rem' } }, [createModeButton, linkModeButton]));
    }

    kids.push(
      formWrap,
      createButton,
      createError,
      createNotice,
      el('span', {
        class: 'tt-hint',
        text: 'An editor can change existing content. A superuser can also create tags and manage users.',
      }),
      el('hr', { class: 'tt-divider' }),
      el('strong', { text: 'Existing users' }),
      searchInput,
      listWrap,
    );

    void loadUsers();

    return el('div', { class: 'tt-panel' }, kids);
  };

  //The Account panel: your own email and password. Every signed in user gets
  //this, editors included, which is why it hangs off the email label rather than
  //off a button inside the superuser guard. Both changes need the current
  //password, so they are two forms rather than one with a shared field.
  const buildAccountPanel = (): HTMLElement => {
    const emailNext = el('input', {
      class: 'tt-input',
      type: 'email',
      autocomplete: 'username',
      placeholder: 'new email',
      value: engine.user?.email ?? '',
    });
    const emailCurrent = el('input', {
      class: 'tt-input',
      type: 'password',
      autocomplete: 'current-password',
      placeholder: 'current password',
    });
    const emailError = el('span', { class: 'tt-error' });
    emailError.style.display = 'none';
    const emailButton = el('button', { class: 'tt-btn', type: 'button', text: 'Change email' });

    const showEmailError = (message: string): void => {
      emailError.textContent = message;
      emailError.style.display = '';
    };

    const submitEmail = async (): Promise<void> => {
      emailError.style.display = 'none';
      const email = emailNext.value.trim();

      if (!isValidEmail(email)) {
        showEmailError('Enter a valid email address.');

        return;
      }

      if (emailCurrent.value === '') {
        showEmailError('Enter your current password.');

        return;
      }

      emailButton.disabled = true;

      try {
        const updated = await engine.updateMyEmail(emailCurrent.value, email);
        emailCurrent.value = '';
        engine.notify(`Your email is now "${updated.email}".`, 'success');
      } catch (updateError) {
        const message = updateError instanceof Error ? updateError.message : 'Could not change your email';
        showEmailError(message);
        engine.notify(message, 'error');
      } finally {
        emailButton.disabled = false;
      }
    };

    emailButton.addEventListener('click', () => void submitEmail());

    const passwordCurrent = el('input', {
      class: 'tt-input',
      type: 'password',
      autocomplete: 'current-password',
      placeholder: 'current password',
    });
    const passwordNext = el('input', {
      class: 'tt-input',
      type: 'password',
      autocomplete: 'new-password',
      placeholder: 'new password',
    });
    const passwordRepeat = el('input', {
      class: 'tt-input',
      type: 'password',
      autocomplete: 'new-password',
      placeholder: 'repeat the new password',
    });
    const passwordError = el('span', { class: 'tt-error' });
    passwordError.style.display = 'none';
    const passwordButton = el('button', { class: 'tt-btn', type: 'button', text: 'Change password' });

    const showPasswordError = (message: string): void => {
      passwordError.textContent = message;
      passwordError.style.display = '';
    };

    const submitPassword = async (): Promise<void> => {
      passwordError.style.display = 'none';

      if (passwordNext.value.length < MIN_PASSWORD_LENGTH) {
        showPasswordError(`The new password must be at least ${MIN_PASSWORD_LENGTH} characters.`);

        return;
      }

      //Only checked here, not on the server: a mistyped repeat would otherwise
      //be saved as a password nobody knows.
      if (passwordNext.value !== passwordRepeat.value) {
        showPasswordError('The two new passwords do not match.');

        return;
      }

      if (passwordCurrent.value === '') {
        showPasswordError('Enter your current password.');

        return;
      }

      passwordButton.disabled = true;

      try {
        await engine.updateMyPassword(passwordCurrent.value, passwordNext.value);
        passwordCurrent.value = '';
        passwordNext.value = '';
        passwordRepeat.value = '';
        engine.notify('Your password has been changed. You are still signed in here.', 'success');
      } catch (updateError) {
        const message = updateError instanceof Error ? updateError.message : 'Could not change your password';
        showPasswordError(message);
        engine.notify(message, 'error');
      } finally {
        passwordButton.disabled = false;
      }
    };

    passwordButton.addEventListener('click', () => void submitPassword());

    const kids: Child[] = [
      panelHeader('Account', () => {
        openPanel = null;
        render();
      }),
      el('strong', { text: 'Change your email' }),
      emailNext,
      emailCurrent,
      emailButton,
      emailError,
      el('hr', { class: 'tt-divider' }),
      el('strong', { text: 'Change your password' }),
      passwordCurrent,
      passwordNext,
      passwordRepeat,
      passwordButton,
      passwordError,
      el('span', {
        class: 'tt-hint',
        text: `Both changes need your current password. A new password is at least ${MIN_PASSWORD_LENGTH} characters, and changing it signs out your other devices.`,
      }),
    ];

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
      //The account popup opens off the email label, which is the one control
      //here that does not look like a button, so it is worth saying out loud.
      item('Your account', 'Click your email address to change the address you sign in with, or your password.'),
    ];

    if (engine.isSuperuser) {
      kids.push(item('Create a tag', 'Open the Tags panel, type a name like hero-title and some optional text, then click Create tag.'));
      kids.push(item('Change or delete a tag', 'In the Tags panel, change a tag type with its dropdown, or click Delete to remove it.'));
      kids.push(item('Manage people', 'Open the Users panel to add an editor, change what somebody can do, reset a password, or remove them.'));
    }

    return el('div', { class: 'tt-panel', style: { gap: '0.9rem' } }, kids);
  };

  //Draws or removes the open panel, but only when which panel is shown changes,
  //so a redraw of the bar does not throw away the panel's inputs.
  const renderPanel = (): void => {
    const superuserOnly = openPanel === 'tags' || openPanel === 'users';
    const want = !engine.user ? null : superuserOnly && !engine.isSuperuser ? null : openPanel;

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
    } else if (want === 'users') {
      panelEl = buildUsersPanel();
    } else if (want === 'account') {
      panelEl = buildAccountPanel();
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
      node.classList.add('tt-draggable');
      applyPosition(node);
      makeDraggable(node);
    }

    document.body.appendChild(node);
    current = node;

    renderPanel();
  };

  //Only redraw when something the bar shows actually changed, so a background
  //content load does not steal focus from the login or panel inputs. The address
  //is part of that: a user can change their own email from the account popup,
  //and none of the other three flip when they do, so the bar would go on showing
  //the address they just replaced.
  const snapshot = (): string =>
    `${engine.user ? '1' : '0'}|${engine.user?.email ?? ''}|${engine.isEditing ? '1' : '0'}|${engine.hasUnsavedChanges ? '1' : '0'}`;

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
