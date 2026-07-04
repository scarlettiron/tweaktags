//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';

import { ROLES, isValidTag, type ContentRecord, type TagType } from '@tweaktags/core';

import { useTweakTags } from '../hooks/use-tweaktags.js';
import { Spinner } from './spinner.js';
import { RichTextEditor } from './rich-text-editor.js';
import { UploadButton } from './upload-button.js';

//How many tags to show on one page of a list.
const PAGE_SIZE = 10;

//The colors that make up the admin panel theme. Pass a partial theme to the
//panel to recolor everything at once, for example a different primary color.
export interface AdminTheme {
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  muted: string;
  primary: string;
  primaryHover: string;
  danger: string;
  font: string;
}

//Our default theme. It is a calm dark look with a vibrant blue accent, matching
//the rest of TweakTags. Anything the user does not override falls back to this.
export const DEFAULT_ADMIN_THEME: AdminTheme = {
  bg: '#0e0f13',
  surface: '#14151a',
  surfaceRaised: '#1e2028',
  border: '#2b2d38',
  text: '#f3f4f6',
  muted: '#9aa0ac',
  primary: '#0a84ff',
  primaryHover: '#3d9bff',
  danger: '#e5484d',
  font: '14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
};

//A style for each part of the panel. Pass any subset to the panel to override
//just those parts. Each one you leave out falls back to the default below.
export interface AdminPanelStyles {
  page: CSSProperties;
  loginCard: CSSProperties;
  shell: CSSProperties;
  topbar: CSSProperties;
  nav: CSSProperties;
  card: CSSProperties;
  input: CSSProperties;
  button: CSSProperties;
  subtleButton: CSSProperties;
  dangerButton: CSSProperties;
  label: CSSProperties;
  listRow: CSSProperties;
  badge: CSSProperties;
}

//Builds the full set of default styles from a theme.
const buildStyles = (t: AdminTheme): AdminPanelStyles => {
  const button: CSSProperties = {
    padding: '0.55rem 0.9rem',
    borderRadius: '0.5rem',
    border: 'none',
    background: t.primary,
    color: '#fff',
    cursor: 'pointer',
    font: t.font,
    fontWeight: 600,
  };

  return {
    page: {
      minHeight: '100vh',
      background: t.bg,
      color: t.text,
      font: t.font,
      display: 'flex',
      flexDirection: 'column',
    },
    loginCard: {
      width: 'min(24rem, 100%)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.85rem',
      padding: '1.75rem',
      borderRadius: '0.9rem',
      border: `1px solid ${t.border}`,
      background: t.surface,
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.45)',
      boxSizing: 'border-box',
    },
    shell: {
      width: '100%',
      maxWidth: '1100px',
      margin: '0 auto',
      padding: '1.25rem',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.25rem',
    },
    topbar: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem',
      flexWrap: 'wrap',
      paddingBottom: '1rem',
      borderBottom: `1px solid ${t.border}`,
    },
    nav: {
      display: 'flex',
      gap: '0.4rem',
      flexWrap: 'wrap',
    },
    card: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.85rem',
      padding: '1.25rem',
      borderRadius: '0.75rem',
      border: `1px solid ${t.border}`,
      background: t.surface,
    },
    input: {
      padding: '0.55rem 0.65rem',
      borderRadius: '0.5rem',
      border: `1px solid ${t.border}`,
      background: t.surfaceRaised,
      color: t.text,
      font: t.font,
      width: '100%',
      boxSizing: 'border-box',
    },
    button,
    subtleButton: {
      ...button,
      background: t.surfaceRaised,
      border: `1px solid ${t.border}`,
      color: t.text,
      fontWeight: 500,
    },
    dangerButton: {
      ...button,
      background: t.danger,
    },
    label: {
      fontSize: '12px',
      textTransform: 'uppercase',
      letterSpacing: '0.03em',
      opacity: 0.6,
    },
    listRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.6rem',
      flexWrap: 'wrap',
      padding: '0.75rem',
      borderRadius: '0.6rem',
      border: `1px solid ${t.border}`,
      background: t.surfaceRaised,
    },
    badge: {
      fontSize: '11px',
      textTransform: 'uppercase',
      letterSpacing: '0.03em',
      padding: '0.1rem 0.4rem',
      borderRadius: '0.3rem',
      border: `1px solid ${t.border}`,
      color: t.muted,
    },
  };
};

//Merges the user theme and per part style overrides onto the defaults.
//Anything the user leaves out keeps the default value.
const resolveStyles = (
  theme?: Partial<AdminTheme>,
  overrides?: Partial<AdminPanelStyles>,
): AdminPanelStyles => {
  const base = buildStyles({ ...DEFAULT_ADMIN_THEME, ...theme });

  if (!overrides) {
    return base;
  }

  const merged = { ...base };

  for (const key of Object.keys(overrides) as Array<keyof AdminPanelStyles>) {
    const override = overrides[key];

    if (override) {
      merged[key] = { ...base[key], ...override };
    }
  }

  return merged;
};

//Shares the resolved styles with every part of the panel, so a user can theme
//the whole thing from one place. The default is our built in theme, so the
//panel still looks right even if a piece is used on its own.
const StylesContext = createContext<AdminPanelStyles>(buildStyles(DEFAULT_ADMIN_THEME));

const useStyles = (): AdminPanelStyles => useContext(StylesContext);

//A tab in the top navigation. It highlights when it is the open tab.
const NavTab = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}): ReactElement => {
  const s = useStyles();

  return (
    <button
      type="button"
      style={active ? s.button : s.subtleButton}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      {label}
    </button>
  );
};

//A search box plus the prev and next paging controls, shared by the lists.
const ListControls = ({
  search,
  onSearch,
  page,
  totalPages,
  onPage,
}: {
  search: string;
  onSearch: (value: string) => void;
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}): ReactElement => {
  const s = useStyles();

  return (
    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <input
        style={{ ...s.input, flex: 1, minWidth: '12rem' }}
        type="search"
        placeholder="Search tags..."
        value={search}
        onChange={(event) => onSearch(event.target.value)}
      />

      {totalPages > 1 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            style={s.subtleButton}
            disabled={page === 0}
            onClick={() => onPage(Math.max(0, page - 1))}
          >
            Prev
          </button>
          <span style={{ opacity: 0.7, whiteSpace: 'nowrap' }}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            type="button"
            style={s.subtleButton}
            disabled={page >= totalPages - 1}
            onClick={() => onPage(Math.min(totalPages - 1, page + 1))}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
};

//The editable fields for one tag.
interface Draft {
  type: TagType;
  body: string;
  mediaUrl: string;
}

//One tag with its type and its saved content record.
interface Entry {
  tag: string;
  type: TagType;
  record: ContentRecord | null;
}

//Takes the full list of tags, keeps only the ones that match the search, and
//returns just the slice for the current page along with the page count.
const paginate = (
  entries: Entry[],
  search: string,
  page: number,
): { totalPages: number; currentPage: number; pageItems: Entry[]; matchCount: number } => {
  const query = search.trim().toLowerCase();
  const filtered = entries.filter((entry) => entry.tag.toLowerCase().includes(query));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const start = currentPage * PAGE_SIZE;

  return {
    totalPages,
    currentPage,
    matchCount: filtered.length,
    pageItems: filtered.slice(start, start + PAGE_SIZE),
  };
};

//Turns a saved record into a short one line preview for the view list.
const previewOf = (record: ContentRecord | null): string => {
  if (!record) {
    return 'No content yet';
  }

  if (record.type === 'media') {
    return record.mediaUrl || record.body || 'No media set';
  }

  //Rich content is html, so strip the tags to show readable text.
  const text = record.body
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (text === '') {
    return 'Empty';
  }

  return text.length > 90 ? `${text.slice(0, 90)}...` : text;
};

//The full page login shown when nobody is signed in.
const AdminLogin = (): ReactElement => {
  const s = useStyles();
  const { login } = useTweakTags();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleLogin = async (): Promise<void> => {
    setError(null);
    setBusy(true);

    try {
      await login(email, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        ...s.page,
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        boxSizing: 'border-box',
      }}
    >
      <form
        style={s.loginCard}
        onSubmit={(event) => {
          event.preventDefault();
          void handleLogin();
        }}
      >
        <strong style={{ fontSize: '1.25rem' }}>TweakTags admin</strong>
        <span style={{ opacity: 0.7 }}>Sign in to manage your content.</span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={s.label}>Email</label>
          <input
            style={s.input}
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={s.label}>Password</label>
          <input
            style={s.input}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <button style={s.button} type="submit" disabled={busy}>
          {busy ? 'Signing in...' : 'Sign in'}
        </button>

        {error ? <span style={{ color: '#ff9a9a' }}>{error}</span> : null}
      </form>
    </div>
  );
};

//The create tag tab. Only a superuser can reach this.
const CreateTab = ({ onCreated }: { onCreated: () => Promise<void> }): ReactElement => {
  const s = useStyles();
  const { createTag, notify, richText } = useTweakTags();

  const [newTag, setNewTag] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState<TagType>('plain');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleCreate = async (): Promise<void> => {
    setError(null);
    const tag = newTag.trim();

    if (!isValidTag(tag)) {
      setError('Use lowercase letters, numbers, and hyphens only.');

      return;
    }

    setBusy(true);

    try {
      await createTag(tag, newContent, newType);
      setNewTag('');
      setNewContent('');
      setNewType('plain');
      await onCreated();
      notify(`Created the tag "${tag}".`, 'success');
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : 'Could not create the tag';
      setError(message);
      notify(message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={s.card}>
      <strong style={{ fontSize: '1.05rem' }}>Create a tag</strong>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <label style={s.label}>Tag name</label>
        <input
          style={s.input}
          type="text"
          placeholder="tag name, like hero-title"
          value={newTag}
          onChange={(event) => setNewTag(event.target.value)}
        />
      </div>

      {richText ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={s.label}>Type</label>
          <select
            style={s.input}
            value={newType}
            onChange={(event) => setNewType(event.target.value as TagType)}
          >
            <option value="plain">Plain text</option>
            <option value="rich">Rich text</option>
            <option value="media">Media</option>
          </select>
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <label style={s.label}>Starting content (optional)</label>
        <input
          style={s.input}
          type="text"
          placeholder={newType === 'media' ? 'starting media url' : 'starting text'}
          value={newContent}
          onChange={(event) => setNewContent(event.target.value)}
        />
        {newType === 'media' ? <UploadButton onUploaded={(url) => setNewContent(url)} /> : null}
      </div>

      <button
        style={{ ...s.button, alignSelf: 'flex-start' }}
        type="button"
        disabled={busy}
        onClick={() => void handleCreate()}
      >
        {busy ? 'Creating...' : 'Create tag'}
      </button>

      {error ? <span style={{ color: '#ff9a9a' }}>{error}</span> : null}

      <span style={{ opacity: 0.6, fontSize: '12px' }}>
        A tag only shows on a page where an element has its data-tweaktags attribute.
      </span>
    </div>
  );
};

//The view tab. A read only, searchable, paged list of every tag.
const ViewTab = ({ entries }: { entries: Entry[] }): ReactElement => {
  const s = useStyles();
  const { richText } = useTweakTags();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const { totalPages, currentPage, pageItems, matchCount } = paginate(entries, search, page);

  return (
    <div style={s.card}>
      <strong style={{ fontSize: '1.05rem' }}>All tags ({entries.length})</strong>

      <ListControls
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(0);
        }}
        page={currentPage}
        totalPages={totalPages}
        onPage={setPage}
      />

      {entries.length === 0 ? (
        <span style={{ opacity: 0.6 }}>There are no tags yet.</span>
      ) : matchCount === 0 ? (
        <span style={{ opacity: 0.6 }}>No tags match "{search}".</span>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {pageItems.map((entry) => (
            <li key={entry.tag} style={s.listRow}>
              <span style={{ fontFamily: 'monospace', fontWeight: 600, minWidth: '8rem' }}>
                {entry.tag}
              </span>
              {richText ? <span style={s.badge}>{entry.type}</span> : null}
              <span style={{ flex: 1, minWidth: '10rem', opacity: 0.75 }}>
                {previewOf(entry.record)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

//The edit tab. A searchable, paged list where each tag opens an inline editor
//prefilled with its saved content.
const EditTab = ({
  entries,
  onChanged,
}: {
  entries: Entry[];
  onChanged: (entries: Entry[]) => void;
}): ReactElement => {
  const s = useStyles();
  const { saveContent, setTagType, deleteTag, confirm, notify, user, richText } = useTweakTags();

  const isSuperuser = user?.role === ROLES.SUPERUSER;

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [openTag, setOpenTag] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const { totalPages, currentPage, pageItems, matchCount } = paginate(entries, search, page);

  //Opens the inline editor for a tag, prefilled with its saved content.
  const openEditor = (entry: Entry): void => {
    setOpenTag(entry.tag);
    setDraft({
      type: entry.type,
      body: entry.record?.body ?? '',
      mediaUrl: entry.record?.mediaUrl ?? '',
    });
  };

  const closeEditor = (): void => {
    setOpenTag(null);
    setDraft(null);
  };

  const setField = (field: 'body' | 'mediaUrl', value: string): void => {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  //Saves the open tag and folds its new content back into the list.
  const handleSave = async (tag: string): Promise<void> => {
    if (!draft) {
      return;
    }

    setBusy(true);

    try {
      const mediaUrl = draft.mediaUrl.trim() === '' ? null : draft.mediaUrl;
      await saveContent(tag, draft.body, mediaUrl);

      onChanged(
        entries.map((entry) =>
          entry.tag === tag
            ? {
                ...entry,
                record: {
                  tag,
                  type: draft.type,
                  body: draft.body,
                  mediaUrl,
                  updatedAt: entry.record?.updatedAt ?? '',
                  updatedBy: entry.record?.updatedBy ?? '',
                },
              }
            : entry,
        ),
      );

      notify(`Saved "${tag}".`, 'success');
      closeEditor();
    } catch (saveError) {
      notify(saveError instanceof Error ? saveError.message : 'Could not save the tag', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleChangeType = async (tag: string, type: TagType): Promise<void> => {
    try {
      await setTagType(tag, type);
      onChanged(entries.map((entry) => (entry.tag === tag ? { ...entry, type } : entry)));

      //Keep the open editor in step if this is the tag being edited.
      if (openTag === tag) {
        setDraft((current) => (current ? { ...current, type } : current));
      }

      notify(`Changed "${tag}" to ${type}.`, 'success');
    } catch (typeError) {
      notify(typeError instanceof Error ? typeError.message : 'Could not change the type', 'error');
    }
  };

  const handleDelete = async (tag: string): Promise<void> => {
    const ok = await confirm(`Delete the tag "${tag}"? This cannot be undone.`, {
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });

    if (!ok) {
      return;
    }

    try {
      await deleteTag(tag);
      onChanged(entries.filter((entry) => entry.tag !== tag));

      if (openTag === tag) {
        closeEditor();
      }

      notify(`Deleted the tag "${tag}".`, 'success');
    } catch (deleteError) {
      notify(deleteError instanceof Error ? deleteError.message : 'Could not delete the tag', 'error');
    }
  };

  return (
    <div style={s.card}>
      <strong style={{ fontSize: '1.05rem' }}>Edit tags</strong>

      <ListControls
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(0);
        }}
        page={currentPage}
        totalPages={totalPages}
        onPage={setPage}
      />

      {entries.length === 0 ? (
        <span style={{ opacity: 0.6 }}>There are no tags to edit yet.</span>
      ) : matchCount === 0 ? (
        <span style={{ opacity: 0.6 }}>No tags match "{search}".</span>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {pageItems.map((entry) => {
            const isOpen = openTag === entry.tag;

            return (
              <li key={entry.tag} style={{ ...s.listRow, flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, flex: 1, minWidth: '8rem' }}>
                    {entry.tag}
                  </span>

                  {richText && isSuperuser ? (
                    <select
                      style={{ ...s.input, width: 'auto' }}
                      value={entry.type}
                      onChange={(event) => void handleChangeType(entry.tag, event.target.value as TagType)}
                    >
                      <option value="plain">plain</option>
                      <option value="rich">rich</option>
                      <option value="media">media</option>
                    </select>
                  ) : richText ? (
                    <span style={s.badge}>{entry.type}</span>
                  ) : null}

                  <button
                    type="button"
                    style={s.subtleButton}
                    onClick={() => (isOpen ? closeEditor() : openEditor(entry))}
                  >
                    {isOpen ? 'Cancel' : 'Edit'}
                  </button>

                  {isSuperuser ? (
                    <button
                      type="button"
                      style={s.dangerButton}
                      onClick={() => void handleDelete(entry.tag)}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>

                {isOpen && draft ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
                    {draft.type === 'media' ? (
                      <>
                        <label style={s.label}>Media URL</label>
                        <input
                          style={s.input}
                          type="text"
                          placeholder="https://... or upload a file"
                          value={draft.mediaUrl}
                          onChange={(event) => setField('mediaUrl', event.target.value)}
                        />
                        <UploadButton onUploaded={(url) => setField('mediaUrl', url)} />
                        {draft.mediaUrl ? (
                          <img
                            src={draft.mediaUrl}
                            alt=""
                            style={{ maxWidth: '14rem', marginTop: '0.25rem', borderRadius: '0.4rem' }}
                          />
                        ) : null}
                      </>
                    ) : draft.type === 'rich' ? (
                      <>
                        <label style={s.label}>Rich text</label>
                        <RichTextEditor value={draft.body} onChange={(html) => setField('body', html)} />
                      </>
                    ) : (
                      <>
                        <label style={s.label}>Text content</label>
                        <textarea
                          style={{ ...s.input, resize: 'vertical' }}
                          rows={3}
                          value={draft.body}
                          onChange={(event) => setField('body', event.target.value)}
                        />
                      </>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        style={s.button}
                        disabled={busy}
                        onClick={() => void handleSave(entry.tag)}
                      >
                        {busy ? 'Saving...' : 'Save'}
                      </button>
                      <button type="button" style={s.subtleButton} onClick={closeEditor}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

//The dashboard shown once a user is signed in. It loads the tags once, then
//lets the user move between viewing, creating, and editing tags.
const AdminDashboard = (): ReactElement => {
  const s = useStyles();
  const { user, logout, listTags, loadContent, notify } = useTweakTags();

  const isSuperuser = user?.role === ROLES.SUPERUSER;

  const [tab, setTab] = useState<'view' | 'create' | 'edit'>('view');
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);

  //Loads every tag with its type and saved content, so the lists and the inline
  //editors can show and prefill the real data.
  const loadEntries = async (): Promise<void> => {
    setLoading(true);

    try {
      const names = await listTags();
      const records = await loadContent(names);
      const byTag = new Map(records.map((record) => [record.tag, record]));

      setEntries(
        names.map((tag) => {
          const record = byTag.get(tag) ?? null;

          return { tag, type: record?.type ?? 'plain', record };
        }),
      );
    } catch {
      notify('Could not load the tags.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEntries();
    //loadEntries reads current values, running it once on mount is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  //A non superuser cannot create tags, so hide that tab for them.
  const activeTab = tab === 'create' && !isSuperuser ? 'view' : tab;

  return (
    <div style={s.page}>
      <div style={s.shell}>
        <div style={s.topbar}>
          <strong style={{ fontSize: '1.3rem' }}>TweakTags admin</strong>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ opacity: 0.7 }}>{user?.email}</span>
            <button style={s.subtleButton} type="button" onClick={() => void logout()}>
              Sign out
            </button>
          </div>
        </div>

        <div style={s.nav}>
          <NavTab label="View tags" active={activeTab === 'view'} onClick={() => setTab('view')} />
          {isSuperuser ? (
            <NavTab label="Create tag" active={activeTab === 'create'} onClick={() => setTab('create')} />
          ) : null}
          <NavTab label="Edit tags" active={activeTab === 'edit'} onClick={() => setTab('edit')} />

          <button
            style={{ ...s.subtleButton, marginLeft: 'auto' }}
            type="button"
            onClick={() => void loadEntries()}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
            <Spinner size={40} />
          </div>
        ) : activeTab === 'view' ? (
          <ViewTab entries={entries} />
        ) : activeTab === 'create' ? (
          <CreateTab onCreated={loadEntries} />
        ) : (
          <EditTab entries={entries} onChanged={setEntries} />
        )}
      </div>
    </div>
  );
};

//The props for the admin panel. Theme recolors everything from a small set of
//tokens. Styles overrides individual parts with your own css. Both are optional
//and fall back to the built in defaults for anything you leave out. ClassName is
//put on the panel root so you can target it from a stylesheet.
export interface TweakTagsAdminPanelProps {
  theme?: Partial<AdminTheme>;
  styles?: Partial<AdminPanelStyles>;
  className?: string;
}

//A full page, traditional admin panel for managing TweakTags content. Render it
//on a dedicated route inside a TweakTagsProvider, as an alternative to the in
//page TweakTagsEditBar. It shows a full page login when signed out, and a
//dashboard with nav tabs for viewing, creating, and editing tags when signed in.
//Both the view and edit lists have their own search and pagination. Pass a theme
//or per part styles to change how it looks, or leave them out for the defaults.
export const TweakTagsAdminPanel = ({
  theme,
  styles,
  className,
}: TweakTagsAdminPanelProps = {}): ReactElement => {
  const { user } = useTweakTags();

  //Rebuild the styles only when the theme or overrides change.
  const resolved = useMemo(() => resolveStyles(theme, styles), [theme, styles]);

  return (
    <StylesContext.Provider value={resolved}>
      <div className={className} style={{ display: 'contents' }}>
        {user ? <AdminDashboard /> : <AdminLogin />}
      </div>
    </StylesContext.Provider>
  );
};
