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

const PAGE_SIZE = 10;

//The tabs of the signed in dashboard. Create and users are superuser work;
//account is for everyone, since an editor still has to be able to change their
//own sign in details.
type Tab = 'view' | 'create' | 'edit' | 'users' | 'account';

//One tag with its type and saved content record.
interface Entry {
  tag: string;
  type: TagType;
  record: ContentRecord | null;
}

//Content longer than this collapses behind a show more toggle, so one long tag
//cannot push the rest of the list off the screen.
const CLAMP_AFTER = 220;

//Shows the saved content of a tag so it can be read before the editor is opened.
//Media shows the file itself, rich text renders the way it does on the page, and
//long text collapses to a few lines with a toggle.
const buildPreview = (entry: Entry): HTMLElement => {
  const record = entry.record;

  if (entry.type === 'media') {
    const url = record?.mediaUrl ?? record?.body ?? '';

    if (url === '') {
      return el('span', { class: 'tt-hint', text: 'No media set' });
    }

    return el('div', { class: 'tt-preview' }, [
      el('img', { class: 'tt-preview-media', src: url, alt: '' }),
      el('span', { class: 'tt-preview-url tt-mono', text: url }),
    ]);
  }

  const body = record?.body ?? '';

  if (body.trim() === '') {
    return el('span', { class: 'tt-hint', text: record ? 'Empty' : 'No content yet' });
  }

  //Rich content is saved as html, and the page renders it the same way.
  const content =
    entry.type === 'rich'
      ? el('div', { class: 'tt-preview-body tt-preview-rich', html: body })
      : el('div', { class: 'tt-preview-body tt-preview-text', text: body });

  const kids: Child[] = [content];

  if (body.length > CLAMP_AFTER) {
    content.classList.add('tt-clamped');

    const toggle = el('button', { class: 'tt-preview-more', type: 'button', text: 'Show more' });
    toggle.addEventListener('click', () => {
      const clamped = content.classList.toggle('tt-clamped');
      toggle.textContent = clamped ? 'Show more' : 'Show less';
    });

    kids.push(toggle);
  }

  return el('div', { class: 'tt-preview' }, kids);
};

//The type options for a select, with the current one preselected by the caller.
const typeOptions = (): HTMLElement[] =>
  (['plain', 'rich', 'media'] as TagType[]).map((value) => el('option', { value, text: value }));

//The role options for a select, with the current one preselected by the caller.
//Editor comes first because it is the safer of the two to pick by accident.
const roleOptions = (): HTMLOptionElement[] =>
  ([ROLES.EDITOR, ROLES.SUPERUSER] as Role[]).map((value) =>
    el('option', { value, text: value === ROLES.SUPERUSER ? 'Superuser' : 'Editor' }),
  );

//A labelled control, the shape every form field in the panel takes.
const field = (labelText: string, control: HTMLElement): HTMLElement =>
  el('div', { class: 'tt-field' }, [el('label', { class: 'tt-label', text: labelText }), control]);

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
//login when signed out, and a dashboard with view, create, edit, users, and
//account tabs when signed in, each list with its own search and pagination.
export const mountAdminPanel = (
  container: HTMLElement,
  engine: TweakTagsEngine,
  theme: TweakTagsTheme,
  confirm: ConfirmFn,
): (() => void) => {
  applyScope(container, theme);

  let entries: Entry[] = [];
  let loading = true;
  let tab: Tab = 'view';

  //Users get their own state rather than being squeezed into the tag shaped
  //entries, and their own load, so opening the Users tab does not refetch every
  //tag and refreshing the tags does not refetch every user.
  let users: AuthUser[] = [];
  let usersLoaded = false;
  let usersLoading = false;

  //Search and page kept per tab so a reload restores where you were.
  let viewSearch = '';
  let viewPage = 0;
  let editSearch = '';
  let editPage = 0;
  let usersSearch = '';
  let usersPage = 0;

  let contentArea: HTMLElement | null = null;
  const tabButtons: Partial<Record<Tab, HTMLButtonElement>> = {};

  //Search and paging for any list. textOf says which field the search box
  //matches on, since tags are found by name and users by address.
  const filterPage = <T>(
    items: T[],
    textOf: (item: T) => string,
    search: string,
    page: number,
  ): { pageItems: T[]; totalPages: number; currentPage: number; matchCount: number } => {
    const query = search.trim().toLowerCase();
    const filtered = items.filter((item) => textOf(item).toLowerCase().includes(query));
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages - 1);
    const start = currentPage * PAGE_SIZE;

    return { pageItems: filtered.slice(start, start + PAGE_SIZE), totalPages, currentPage, matchCount: filtered.length };
  };

  //Falls a superuser only tab back to the view tab. An editor is never offered
  //the buttons, but the remembered tab survives a sign out, so what is drawn has
  //to be checked as well as what is offered. Account is for everyone.
  const superuserOnly = (wanted: Tab): Tab =>
    (wanted === 'create' || wanted === 'users') && !engine.isSuperuser ? 'view' : wanted;

  //The view tab: a read only, searchable, paged list of every tag.
  const buildViewTab = (): HTMLElement => {
    const listWrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '0.5rem' } });

    const draw = (): void => {
      clear(listWrap);
      const { pageItems, totalPages, currentPage, matchCount } = filterPage(entries, (entry) => entry.tag, viewSearch, viewPage);

      if (entries.length === 0) {
        listWrap.append(el('span', { class: 'tt-hint', text: 'There are no tags yet.' }));

        return;
      }

      if (matchCount === 0) {
        listWrap.append(el('span', { class: 'tt-hint', text: `No tags match "${viewSearch}".` }));

        return;
      }

      for (const entry of pageItems) {
        const header: Child[] = [el('span', { class: 'tt-mono', style: { minWidth: '8rem' }, text: entry.tag })];

        if (engine.richText) {
          header.push(el('span', { class: 'tt-badge', text: entry.type }));
        }

        listWrap.append(
          el('div', { class: 'tt-listrow', style: { flexDirection: 'column', alignItems: 'stretch' } }, [
            el('div', { style: { display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' } }, header),
            el('div', { style: { marginTop: '0.5rem' } }, [buildPreview(entry)]),
          ]),
        );
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

      if (engine.richText && engine.isSuperuser) {
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

      if (engine.isSuperuser) {
        header.push(
          el('button', { class: 'tt-btn tt-danger', type: 'button', text: 'Delete', onclick: () => void handleDelete(entry.tag) }),
        );
      }

      const kids: Child[] = [el('div', { style: { display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' } }, header)];

      if (isOpen) {
        kids.push(buildEditor(entry));
      } else {
        //Closed rows show the saved content, so a tag can be read before it is
        //opened for editing.
        kids.push(el('div', { style: { marginTop: '0.6rem' } }, [buildPreview(entry)]));
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
      const { pageItems, totalPages, currentPage, matchCount } = filterPage(entries, (entry) => entry.tag, editSearch, editPage);

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

  //The users tab: add a user, and change the role, password, or existence of one
  //that is already there. Only a superuser reaches this. Every rule below is
  //enforced by the server too; showing it here just saves somebody the error.
  const buildUsersTab = (): HTMLElement => {
    //Which row has its password field open. One at a time, so the list stays a
    //list rather than a column of password boxes.
    let openPasswordFor: string | null = null;

    const listWrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '0.6rem' } });

    const newEmail = el('input', { class: 'tt-input', type: 'email', autocomplete: 'off', placeholder: 'name@example.com' });
    const newPassword = el('input', { class: 'tt-input', type: 'password', autocomplete: 'new-password' });
    const newRole = el('select', { class: 'tt-input' }, roleOptions());
    const createError = el('span', { class: 'tt-error' });
    createError.style.display = 'none';
    const createButton = el('button', { class: 'tt-btn', style: { alignSelf: 'flex-start' }, type: 'button', text: 'Create user' });

    const showCreateError = (message: string): void => {
      createError.textContent = message;
      createError.style.display = '';
    };

    const handleCreate = async (): Promise<void> => {
      createError.style.display = 'none';
      const email = newEmail.value.trim();

      //The same two checks the server makes, so a typo comes back straight away
      //instead of as a 400 after a round trip. A duplicate address can only be
      //found by asking the server, so that one arrives as a 409.
      if (!isValidEmail(email)) {
        showCreateError('Enter a valid email address.');

        return;
      }

      if (newPassword.value.length < MIN_PASSWORD_LENGTH) {
        showCreateError(`The password must be at least ${MIN_PASSWORD_LENGTH} characters.`);

        return;
      }

      createButton.disabled = true;

      try {
        await engine.createUser(email, newPassword.value, newRole.value as Role);
        newEmail.value = '';
        newPassword.value = '';
        newRole.value = ROLES.EDITOR;
        engine.notify(`Created the user "${email}".`, 'success');
        await loadUsers();
      } catch (createUserError) {
        const message = createUserError instanceof Error ? createUserError.message : 'Could not create the user';
        showCreateError(message);
        engine.notify(message, 'error');
      } finally {
        createButton.disabled = false;
      }
    };

    createButton.addEventListener('click', () => void handleCreate());

    async function handleRoleChange(user: AuthUser, role: Role): Promise<void> {
      try {
        const updated = await engine.updateUserRole(user.id, role);
        users = users.map((item) => (item.id === updated.id ? updated : item));
        engine.notify(`${updated.email} is now ${updated.role === ROLES.SUPERUSER ? 'a superuser' : 'an editor'}.`, 'success');
      } catch (roleError) {
        engine.notify(roleError instanceof Error ? roleError.message : 'Could not change the role', 'error');
      }

      //Either way the select is showing what was picked, which after a refusal
      //is not what the user actually has, so redraw from state.
      draw();
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
        users = users.filter((item) => item.id !== user.id);

        if (openPasswordFor === user.id) {
          openPasswordFor = null;
        }

        draw();
        engine.notify(`Deleted the user "${user.email}".`, 'success');
      } catch (deleteError) {
        engine.notify(deleteError instanceof Error ? deleteError.message : 'Could not delete the user', 'error');
      }
    }

    //The reset password field, swapped into a row in place of nothing else, so
    //it is obvious which user it belongs to.
    const buildPasswordField = (user: AuthUser): HTMLElement => {
      const input = el('input', { class: 'tt-input', type: 'password', autocomplete: 'new-password' });
      const error = el('span', { class: 'tt-error' });
      error.style.display = 'none';
      const save = el('button', { class: 'tt-btn', style: { alignSelf: 'flex-start' }, type: 'button', text: 'Save password' });

      const submit = async (): Promise<void> => {
        error.style.display = 'none';

        if (input.value.length < MIN_PASSWORD_LENGTH) {
          error.textContent = `The password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
          error.style.display = '';

          return;
        }

        save.disabled = true;

        try {
          await engine.updateUserPassword(user.id, input.value);
          openPasswordFor = null;
          draw();
          engine.notify(`Set a new password for "${user.email}".`, 'success');
        } catch (passwordError) {
          const message = passwordError instanceof Error ? passwordError.message : 'Could not set the password';
          error.textContent = message;
          error.style.display = '';
          engine.notify(message, 'error');
        } finally {
          save.disabled = false;
        }
      };

      save.addEventListener('click', () => void submit());

      return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' } }, [
        field('New password', input),
        el('span', {
          class: 'tt-hint',
          text: 'A reset signs that user out everywhere. TweakTags sends no email, so tell them the new password yourself.',
        }),
        save,
        error,
      ]);
    };

    const drawRow = (user: AuthUser): HTMLElement => {
      const isSelf = user.id === engine.user?.id;
      const superuserCount = users.filter((item) => item.role === ROLES.SUPERUSER).length;

      const header: Child[] = [
        el('span', { class: 'tt-mono', style: { flex: '1', minWidth: '10rem' }, title: user.email, text: user.email }),
      ];

      const select = el('select', { class: 'tt-input', style: { width: 'auto' } }, roleOptions());
      select.value = user.role;

      if (isSelf) {
        //Self demotion is refused, so a lone superuser cannot lock everyone out
        //of the install by accident.
        select.disabled = true;
        select.title = 'You cannot change your own role. Promote somebody else first.';
      } else if (user.role === ROLES.SUPERUSER && superuserCount === 1) {
        //Demoting the last superuser leaves nobody who can manage users, so the
        //server refuses it. Only that one option is off; promoting still works.
        const editorOption = select.querySelector<HTMLOptionElement>(`option[value="${ROLES.EDITOR}"]`);

        if (editorOption) {
          editorOption.disabled = true;
        }

        select.title = 'This is the only superuser. Promote somebody else before demoting them.';
      }

      select.addEventListener('change', () => void handleRoleChange(user, select.value as Role));
      header.push(select);

      const passwordOpen = openPasswordFor === user.id;

      header.push(
        el('button', {
          class: 'tt-btn tt-subtle',
          type: 'button',
          text: passwordOpen ? 'Cancel' : 'Set password',
          onclick: () => {
            openPasswordFor = passwordOpen ? null : user.id;
            draw();
          },
        }),
      );

      //Deleting yourself is refused, and there is no reason to offer a button
      //that can only ever fail. Your own account is the Account tab's business.
      if (!isSelf) {
        const remove = el('button', {
          class: 'tt-btn tt-danger',
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

        header.push(remove);
      }

      const kids: Child[] = [
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' } }, header),
      ];

      if (isSelf) {
        kids.push(el('span', { class: 'tt-hint', text: 'This is you. Your own email and password live on the Account tab.' }));
      }

      if (passwordOpen) {
        kids.push(buildPasswordField(user));
      }

      return el('div', { class: 'tt-listrow', style: { flexDirection: 'column', alignItems: 'stretch' } }, kids);
    };

    const draw = (): void => {
      clear(listWrap);

      if (usersLoading && !usersLoaded) {
        listWrap.append(el('span', { class: 'tt-hint', text: 'Loading users...' }));

        return;
      }

      const { pageItems, totalPages, currentPage, matchCount } = filterPage(users, (user) => user.email, usersSearch, usersPage);

      //Only reachable when the load failed, since you are always in your own
      //list. The toast says what went wrong, so this just stays quiet.
      if (users.length === 0) {
        listWrap.append(el('span', { class: 'tt-hint', text: 'There are no users to show.' }));

        return;
      }

      if (matchCount === 0) {
        listWrap.append(el('span', { class: 'tt-hint', text: `No users match "${usersSearch}".` }));

        return;
      }

      for (const user of pageItems) {
        listWrap.append(drawRow(user));
      }

      if (totalPages > 1) {
        listWrap.append(
          buildPager(currentPage, totalPages, (page) => {
            usersPage = page;
            draw();
          }),
        );
      }
    };

    const search = el('input', { class: 'tt-input', type: 'search', placeholder: 'Search users...', value: usersSearch });
    search.addEventListener('input', () => {
      usersSearch = search.value;
      usersPage = 0;
      draw();
    });

    //The first visit to the tab pays for the load; after that the list is kept
    //in state and only a change to it redraws.
    if (!usersLoaded && !usersLoading) {
      void loadUsers();
    }

    draw();

    return el('div', { class: 'tt-card' }, [
      el('strong', { style: { fontSize: '1.05rem' }, text: 'Add a user' }),
      field('Email', newEmail),
      field('Password', newPassword),
      field('Role', newRole),
      createButton,
      createError,
      el('span', {
        class: 'tt-hint',
        text: `An editor can change content for tags that already exist. A superuser can also create tags and manage users. Passwords are at least ${MIN_PASSWORD_LENGTH} characters.`,
      }),
      el('hr', { class: 'tt-divider' }),
      el('strong', { style: { fontSize: '1.05rem' }, text: 'Existing users' }),
      search,
      listWrap,
    ]);
  };

  //The account tab: your own email and password. Every signed in user gets this,
  //editors included, so it sits outside the superuser guard. Both changes need
  //the current password, which is why they are two separate forms rather than
  //one form with a shared field.
  const buildAccountTab = (): HTMLElement => {
    const emailCurrent = el('input', { class: 'tt-input', type: 'password', autocomplete: 'current-password' });
    const emailNext = el('input', { class: 'tt-input', type: 'email', autocomplete: 'username', value: engine.user?.email ?? '' });
    const emailError = el('span', { class: 'tt-error' });
    emailError.style.display = 'none';
    const emailButton = el('button', { class: 'tt-btn', style: { alignSelf: 'flex-start' }, type: 'button', text: 'Change email' });

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

    const passwordCurrent = el('input', { class: 'tt-input', type: 'password', autocomplete: 'current-password' });
    const passwordNext = el('input', { class: 'tt-input', type: 'password', autocomplete: 'new-password' });
    const passwordRepeat = el('input', { class: 'tt-input', type: 'password', autocomplete: 'new-password' });
    const passwordError = el('span', { class: 'tt-error' });
    passwordError.style.display = 'none';
    const passwordButton = el('button', {
      class: 'tt-btn',
      style: { alignSelf: 'flex-start' },
      type: 'button',
      text: 'Change password',
    });

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

      //Only here, not on the server: a mistyped repeat would otherwise be saved
      //as a password nobody knows.
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
        engine.notify('Your password has been changed.', 'success');
      } catch (updateError) {
        const message = updateError instanceof Error ? updateError.message : 'Could not change your password';
        showPasswordError(message);
        engine.notify(message, 'error');
      } finally {
        passwordButton.disabled = false;
      }
    };

    passwordButton.addEventListener('click', () => void submitPassword());

    const emailCard = el('div', { class: 'tt-card' }, [
      el('strong', { style: { fontSize: '1.05rem' }, text: 'Change your email' }),
      el('span', { class: 'tt-hint', text: `You are signed in as ${engine.user?.email ?? ''}.` }),
      field('New email', emailNext),
      field('Current password', emailCurrent),
      emailButton,
      emailError,
      el('span', { class: 'tt-hint', text: 'This is the address you sign in with, so use one you can still read.' }),
    ]);

    const passwordCard = el('div', { class: 'tt-card' }, [
      el('strong', { style: { fontSize: '1.05rem' }, text: 'Change your password' }),
      field('Current password', passwordCurrent),
      field('New password', passwordNext),
      field('Repeat the new password', passwordRepeat),
      passwordButton,
      passwordError,
      el('span', { class: 'tt-hint', text: 'You stay signed in here. Any other device you are signed in on is signed out.' }),
    ]);

    return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '1rem' } }, [emailCard, passwordCard]);
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

    const activeTab = superuserOnly(tab);

    if (activeTab === 'view') {
      contentArea.append(buildViewTab());
    } else if (activeTab === 'create') {
      contentArea.append(buildCreateTab());
    } else if (activeTab === 'users') {
      contentArea.append(buildUsersTab());
    } else if (activeTab === 'account') {
      contentArea.append(buildAccountTab());
    } else {
      contentArea.append(buildEditTab());
    }
  };

  const setTab = (next: Tab): void => {
    tab = next;

    for (const key of ['view', 'create', 'edit', 'users', 'account'] as const) {
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

  //Users load on their own rather than through loading, which belongs to the tag
  //lists. Redrawing the tab when it lands is what the users tab watches for.
  const loadUsers = async (): Promise<void> => {
    usersLoading = true;

    try {
      users = await engine.listUsers();
    } catch {
      engine.notify('Could not load the users.', 'error');
    } finally {
      //Marks the attempt, not the success. The redraw below rebuilds the tab,
      //and the tab loads when it has not tried yet, so a failure that left this
      //false would send the two of them round in circles.
      usersLoaded = true;
      usersLoading = false;
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
      el('strong', {
        style: { fontSize: '1.25rem' },
        text: engine.whiteLabel ? 'Admin' : 'TweakTags admin',
      }),
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
      el('strong', {
        style: { fontSize: '1.3rem' },
        text: engine.whiteLabel ? 'Admin' : 'TweakTags admin',
      }),
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' } }, [
        el('span', { style: { opacity: '0.7' }, text: engine.user?.email ?? '' }),
        el('button', { class: 'tt-btn tt-subtle', type: 'button', text: 'Sign out', onclick: () => void engine.logout() }),
      ]),
    ]);

    const activeTab = superuserOnly(tab);
    const tabRow: Child[] = [];

    tabButtons.view = el('button', {
      class: activeTab === 'view' ? 'tt-btn' : 'tt-btn tt-subtle',
      type: 'button',
      text: 'View tags',
      onclick: () => setTab('view'),
    });
    tabRow.push(tabButtons.view);

    if (engine.isSuperuser) {
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

    if (engine.isSuperuser) {
      tabButtons.users = el('button', {
        class: activeTab === 'users' ? 'tt-btn' : 'tt-btn tt-subtle',
        type: 'button',
        text: 'Users',
        onclick: () => setTab('users'),
      });
      tabRow.push(tabButtons.users);
    }

    //Outside the superuser guard on purpose: an editor has an account too.
    tabButtons.account = el('button', {
      class: activeTab === 'account' ? 'tt-btn' : 'tt-btn tt-subtle',
      type: 'button',
      text: 'Account',
      onclick: () => setTab('account'),
    });
    tabRow.push(tabButtons.account);

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

  //Only redraw when who is signed in changes, so a background content load does
  //not reset the tab or steal input focus. The address is part of that: a user
  //can change their own email, and comparing signed in state alone would leave
  //the old one in the topbar and in the account form.
  const identity = (): string => (engine.user ? `1|${engine.user.email}` : '0');

  let lastIdentity = identity();

  const unsubscribe = engine.subscribe(() => {
    const next = identity();

    if (next !== lastIdentity) {
      lastIdentity = next;
      render();
    }
  });

  render();

  return () => {
    unsubscribe();
    clear(container);
  };
};
