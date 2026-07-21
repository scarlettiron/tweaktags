//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactElement } from 'react';

import { ROLES, isValidTag, type TagType } from '@tweaktags/core';

import { useTweakTags } from '../hooks/use-tweaktags.js';
import { UploadButton } from './upload-button.js';

//The top layer, so the bar and its popups sit over the whole page.
const TOP_LAYER = 2147483647;

//The width below which the bar collapses into a mobile menu.
const NARROW_QUERY = '(max-width: 640px)';

//Shared colors and shapes, kept in one place for a consistent look.
const COLORS = {
  surface: '#14151a',
  surfaceRaised: '#1e2028',
  border: '#2b2d38',
  text: '#f3f4f6',
  muted: '#9aa0ac',
  primary: '#0a84ff',
  primaryHover: '#3d9bff',
  danger: '#e5484d',
};

const panelShadow = '0 10px 34px rgba(0, 0, 0, 0.45)';

const baseFont = '14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

const barStyle: CSSProperties = {
  position: 'fixed',
  right: '1rem',
  bottom: '1rem',
  zIndex: TOP_LAYER,
  display: 'flex',
  flexWrap: 'wrap',
  maxWidth: 'calc(100vw - 2rem)',
  gap: '0.4rem',
  alignItems: 'center',
  padding: '0.5rem',
  borderRadius: '0.75rem',
  border: `1px solid ${COLORS.border}`,
  background: COLORS.surface,
  color: COLORS.text,
  font: baseFont,
  boxShadow: panelShadow,
};

const dragHandleStyle: CSSProperties = {
  cursor: 'grab',
  touchAction: 'none',
  userSelect: 'none',
  display: 'flex',
  alignItems: 'center',
  padding: '0 0.15rem',
};

const gripDotsStyle: CSSProperties = {
  width: '10px',
  height: '18px',
  backgroundImage: `radial-gradient(${COLORS.muted} 1.2px, transparent 1.3px)`,
  backgroundSize: '5px 5px',
  backgroundPosition: 'center',
};

const emailStyle: CSSProperties = {
  color: COLORS.muted,
  padding: '0 0.35rem',
  maxWidth: '14rem',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const buttonStyle: CSSProperties = {
  padding: '0.45rem 0.75rem',
  borderRadius: '0.5rem',
  border: 'none',
  background: COLORS.primary,
  color: '#fff',
  cursor: 'pointer',
  font: baseFont,
  fontWeight: 600,
};

const subtleButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: COLORS.surfaceRaised,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  fontWeight: 500,
};

const iconButtonStyle: CSSProperties = {
  ...subtleButtonStyle,
  width: '2.1rem',
  padding: '0.45rem 0',
  textAlign: 'center',
};

const inputStyle: CSSProperties = {
  padding: '0.45rem 0.55rem',
  borderRadius: '0.5rem',
  border: `1px solid ${COLORS.border}`,
  background: COLORS.surfaceRaised,
  color: COLORS.text,
  font: baseFont,
};

//A full width input for the stacked card layouts.
const fullInputStyle: CSSProperties = {
  ...inputStyle,
  width: '100%',
  boxSizing: 'border-box',
};

//A round button that opens the mobile menu.
const fabStyle: CSSProperties = {
  position: 'fixed',
  right: '1rem',
  bottom: '1rem',
  zIndex: TOP_LAYER,
  width: '3rem',
  height: '3rem',
  borderRadius: '50%',
  border: `1px solid ${COLORS.border}`,
  background: COLORS.primary,
  color: '#fff',
  cursor: 'pointer',
  fontSize: '1.1rem',
  boxShadow: panelShadow,
};

//The vertical mobile menu card.
const menuStyle: CSSProperties = {
  position: 'fixed',
  right: '1rem',
  bottom: '1rem',
  zIndex: TOP_LAYER,
  width: 'min(18rem, calc(100vw - 2rem))',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  padding: '0.75rem',
  borderRadius: '0.75rem',
  border: `1px solid ${COLORS.border}`,
  background: COLORS.surface,
  color: COLORS.text,
  font: baseFont,
  boxShadow: panelShadow,
};

//Full width versions of the buttons for the stacked mobile menu.
const menuButtonStyle: CSSProperties = { ...buttonStyle, width: '100%' };
const menuSubtleStyle: CSSProperties = { ...subtleButtonStyle, width: '100%' };

const panelStyle: CSSProperties = {
  position: 'fixed',
  right: '1rem',
  bottom: '4.75rem',
  zIndex: TOP_LAYER,
  width: 'min(21rem, calc(100vw - 2rem))',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.6rem',
  padding: '1rem',
  borderRadius: '0.75rem',
  border: `1px solid ${COLORS.border}`,
  background: COLORS.surface,
  color: COLORS.text,
  font: baseFont,
  boxShadow: panelShadow,
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const closeButtonStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: COLORS.text,
  cursor: 'pointer',
  fontSize: '1.1rem',
  lineHeight: 1,
  padding: '0 0.25rem',
};

//A themed scrollbar for the tag list.
const SCROLLBAR_CLASS = 'tweaktags-scroll';

const scrollbarCss = `
.${SCROLLBAR_CLASS}::-webkit-scrollbar { width: 8px; }
.${SCROLLBAR_CLASS}::-webkit-scrollbar-track { background: ${COLORS.surfaceRaised}; border-radius: 4px; }
.${SCROLLBAR_CLASS}::-webkit-scrollbar-thumb { background: ${COLORS.primary}; border-radius: 4px; }
.${SCROLLBAR_CLASS}::-webkit-scrollbar-thumb:hover { background: ${COLORS.primaryHover}; }
`;

//A shared header with a title and a close X for the popups.
const PanelHeader = ({ title, onClose }: { title: string; onClose: () => void }): ReactElement => (
  <div style={headerStyle}>
    <strong>{title}</strong>
    <button type="button" style={closeButtonStyle} aria-label="Close" onClick={onClose}>
      &times;
    </button>
  </div>
);

//One tag row in the Tags panel.
interface TagEntry {
  tag: string;
  type: TagType;
}

//The panel where a superuser creates tags, changes their type, and deletes them.
const TagManager = ({ onClose }: { onClose: () => void }): ReactElement => {
  const { createTag, deleteTag, setTagType, listTags, loadContent, notify, confirm, richText } =
    useTweakTags();

  const [newTag, setNewTag] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState<TagType>('plain');
  const [entries, setEntries] = useState<TagEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  //How many tags to show on one page of the list.
  const PAGE_SIZE = 10;

  //Filter by the search text, then work out the current page of results.
  const query = search.trim().toLowerCase();
  const filtered = (entries ?? []).filter((entry) => entry.tag.toLowerCase().includes(query));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  //Loads the tag names, and their types when rich text is on.
  const loadEntries = async (): Promise<TagEntry[]> => {
    const names = await listTags();
    let typeByTag = new Map<string, TagType>();

    if (richText) {
      const records = await loadContent(names);
      typeByTag = new Map(records.map((record) => [record.tag, record.type]));
    }

    return names.map((tag) => ({ tag, type: typeByTag.get(tag) ?? 'plain' }));
  };

  useEffect(() => {
    let active = true;

    loadEntries()
      .then((result) => {
        if (active) {
          setEntries(result);
        }
      })
      .catch(() => {
        if (active) {
          setEntries([]);
        }
      });

    return () => {
      active = false;
    };
    //loadEntries reads current values, running it once on open is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setEntries(await loadEntries());
      notify(`Created the tag "${tag}".`, 'success');
    } catch (createError) {
      const message =
        createError instanceof Error ? createError.message : 'Could not create the tag';
      setError(message);
      notify(message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleChangeType = async (tag: string, type: TagType): Promise<void> => {
    try {
      await setTagType(tag, type);
      setEntries((current) =>
        current ? current.map((entry) => (entry.tag === tag ? { ...entry, type } : entry)) : current,
      );
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
      setEntries((current) => (current ? current.filter((entry) => entry.tag !== tag) : current));
      notify(`Deleted the tag "${tag}".`, 'success');
    } catch (deleteError) {
      notify(deleteError instanceof Error ? deleteError.message : 'Could not delete the tag', 'error');
    }
  };

  return (
    <div style={panelStyle}>
      <style>{scrollbarCss}</style>

      <PanelHeader title="Tags" onClose={onClose} />

      <strong>Create a tag</strong>

      <input
        style={inputStyle}
        type="text"
        placeholder="tag name, like hero-title"
        value={newTag}
        onChange={(event) => setNewTag(event.target.value)}
      />

      {richText ? (
        <select
          style={inputStyle}
          value={newType}
          onChange={(event) => setNewType(event.target.value as TagType)}
        >
          <option value="plain">Plain text</option>
          <option value="rich">Rich text</option>
          <option value="media">Media</option>
        </select>
      ) : null}

      <input
        style={inputStyle}
        type="text"
        placeholder={newType === 'media' ? 'starting media url (optional)' : 'starting text (optional)'}
        value={newContent}
        onChange={(event) => setNewContent(event.target.value)}
      />

      {newType === 'media' ? <UploadButton onUploaded={(url) => setNewContent(url)} /> : null}

      <button style={buttonStyle} type="button" disabled={busy} onClick={() => void handleCreate()}>
        {busy ? 'Creating...' : 'Create tag'}
      </button>

      {error ? <span style={{ color: '#ff9a9a' }}>{error}</span> : null}

      <hr style={{ width: '100%', border: 'none', borderTop: `1px solid ${COLORS.border}`, margin: 0 }} />

      <strong>Existing tags</strong>

      <input
        style={inputStyle}
        type="search"
        placeholder="Search tags..."
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(0);
        }}
      />

      {entries === null ? (
        <span style={{ opacity: 0.6 }}>Loading...</span>
      ) : entries.length === 0 ? (
        <span style={{ opacity: 0.6 }}>No tags yet.</span>
      ) : filtered.length === 0 ? (
        <span style={{ opacity: 0.6 }}>No tags match "{search}".</span>
      ) : (
        <>
          <ul
            className={SCROLLBAR_CLASS}
            style={{
              margin: 0,
              padding: '0 0.4rem 0 0',
              listStyle: 'none',
              maxHeight: '16rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              scrollbarWidth: 'thin',
              scrollbarColor: `${COLORS.primary} ${COLORS.surfaceRaised}`,
            }}
          >
            {pageItems.map((entry) => (
              <li
                key={entry.tag}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}
              >
                <span style={{ fontFamily: 'monospace', flex: 1, minWidth: '6rem' }}>
                  {entry.tag}
                </span>

                {richText ? (
                  <select
                    style={{ ...inputStyle, padding: '0.2rem 0.3rem' }}
                    value={entry.type}
                    onChange={(event) =>
                      void handleChangeType(entry.tag, event.target.value as TagType)
                    }
                  >
                    <option value="plain">plain</option>
                    <option value="rich">rich</option>
                    <option value="media">media</option>
                  </select>
                ) : null}

                <button
                  type="button"
                  style={{ ...buttonStyle, background: COLORS.danger, padding: '0.2rem 0.5rem' }}
                  onClick={() => void handleDelete(entry.tag)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>

          {totalPages > 1 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                type="button"
                style={subtleButtonStyle}
                disabled={currentPage === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                Prev
              </button>
              <span style={{ opacity: 0.7 }}>
                Page {currentPage + 1} of {totalPages}
              </span>
              <button
                type="button"
                style={subtleButtonStyle}
                disabled={currentPage >= totalPages - 1}
                onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      )}

      <span style={{ opacity: 0.6, fontSize: '12px' }}>
        A tag only shows on a page where an element has its data-tweaktags attribute.
      </span>
    </div>
  );
};

//One help item with a small title and a line of guidance.
const HelpItem = ({ title, children }: { title: string; children: string }): ReactElement => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
    <strong>{title}</strong>
    <span style={{ opacity: 0.85 }}>{children}</span>
  </div>
);

//A short help popup with tips on how to use the editor.
const HelpPanel = ({
  onClose,
  isSuperuser,
}: {
  onClose: () => void;
  isSuperuser: boolean;
}): ReactElement => (
  <div style={{ ...panelStyle, gap: '0.9rem' }}>
    <PanelHeader title="Help and tips" onClose={onClose} />

    <HelpItem title="Find the editable spots">
      After you click Edit page, every spot you can change gets a dashed outline. Click inside one
      and type to change it.
    </HelpItem>

    <HelpItem title="Save your changes">
      Click Save. You are asked to confirm, then all of your changes are stored at once. A popup
      tells you if it worked.
    </HelpItem>

    <HelpItem title="Close the editor">
      Click Close to leave edit mode. If you have changes you have not saved, you are warned first
      so nothing is lost by accident.
    </HelpItem>

    {isSuperuser ? (
      <HelpItem title="Create a tag">
        Open the Tags panel with the Tags button. Type a name like hero-title and some optional
        starting text, then click Create tag.
      </HelpItem>
    ) : null}

    {isSuperuser ? (
      <HelpItem title="Change or delete a tag">
        In the Tags panel, change a tag's type with its dropdown, or click Delete to remove it. You
        are asked to confirm before a delete.
      </HelpItem>
    ) : null}
  </div>
);

//The floating admin bar. It shows a login form when signed out, a horizontal
//toolbar on wider screens, and a collapsible menu on small screens.
export const TweakTagsEditBar = (): ReactElement => {
  const {
    user,
    isEditing,
    editInView,
    canEdit,
    setEditing,
    login,
    logout,
    hasUnsavedChanges,
    saveEdits,
    discardEdits,
    confirm,
  } = useTweakTags();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState<'tags' | 'help' | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const barRef = useRef<HTMLDivElement | null>(null);
  const dragOffset = useRef<{ x: number; y: number } | null>(null);

  const isSuperuser = user?.role === ROLES.SUPERUSER;

  //Track whether the screen is narrow enough to use the mobile menu.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const query = window.matchMedia(NARROW_QUERY);
    const update = (): void => setIsNarrow(query.matches);

    update();
    query.addEventListener('change', update);

    return () => query.removeEventListener('change', update);
  }, []);

  const togglePanel = (panel: 'tags' | 'help'): void => {
    setOpenPanel((current) => (current === panel ? null : panel));
  };

  const handleLogin = async (): Promise<void> => {
    setError(null);

    try {
      await login(email, password);
      setEmail('');
      setPassword('');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Could not sign in');
    }
  };

  const handleSave = async (): Promise<void> => {
    const ok = await confirm('Save your changes?', { confirmLabel: 'Save', cancelLabel: 'Cancel' });

    if (ok) {
      await saveEdits();
    }
  };

  const handleClose = async (): Promise<void> => {
    if (hasUnsavedChanges) {
      const ok = await confirm('You have unsaved changes that will be lost. Close without saving?', {
        confirmLabel: 'Close without saving',
        cancelLabel: 'Keep editing',
      });

      if (!ok) {
        return;
      }
    }

    discardEdits();
    setEditing(false);
  };

  //Drag handlers, used only for the wide screen bar.
  const startDrag = (event: ReactPointerEvent<HTMLSpanElement>): void => {
    const bar = barRef.current;

    if (!bar) {
      return;
    }

    const rect = bar.getBoundingClientRect();
    dragOffset.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onDrag = (event: ReactPointerEvent<HTMLSpanElement>): void => {
    const offset = dragOffset.current;
    const bar = barRef.current;

    if (!offset || !bar) {
      return;
    }

    const maxLeft = Math.max(0, window.innerWidth - bar.offsetWidth);
    const maxTop = Math.max(0, window.innerHeight - bar.offsetHeight);
    const left = Math.min(Math.max(0, event.clientX - offset.x), maxLeft);
    const top = Math.min(Math.max(0, event.clientY - offset.y), maxTop);

    setPosition({ left, top });
  };

  const endDrag = (event: ReactPointerEvent<HTMLSpanElement>): void => {
    dragOffset.current = null;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      //The pointer may already be released, which is fine.
    }
  };

  const positionStyle: CSSProperties = position
    ? { left: position.left, top: position.top, right: 'auto', bottom: 'auto' }
    : {};

  //The reusable grab handle for the card and bar headers.
  const dragHandle = (
    <span
      style={dragHandleStyle}
      onPointerDown={startDrag}
      onPointerMove={onDrag}
      onPointerUp={endDrag}
      title="Drag to move"
      aria-label="Drag to move"
    >
      <span style={gripDotsStyle} />
    </span>
  );

  //The editing controls, shared by both layouts.
  const editControls = (stacked: boolean): ReactElement | null => {
    const primary = stacked ? menuButtonStyle : buttonStyle;
    const subtle = stacked ? menuSubtleStyle : subtleButtonStyle;

    if (!isEditing) {
      return (
        <button style={primary} type="button" disabled={!canEdit} onClick={() => setEditing(true)}>
          Edit page
        </button>
      );
    }

    if (editInView) {
      return (
        <>
          <button style={primary} type="button" onClick={() => void handleSave()}>
            Save{hasUnsavedChanges ? ' *' : ''}
          </button>
          <button style={subtle} type="button" onClick={() => void handleClose()}>
            Close
          </button>
        </>
      );
    }

    return null;
  };

  //The panels are shared across layouts.
  const panels = (
    <>
      {openPanel === 'tags' && isSuperuser ? <TagManager onClose={() => setOpenPanel(null)} /> : null}
      {openPanel === 'help' ? (
        <HelpPanel onClose={() => setOpenPanel(null)} isSuperuser={Boolean(isSuperuser)} />
      ) : null}
    </>
  );

  //Signed out: a compact login card. The drag handle and title sit on their own
  //line, then the email, password, and button sit inline and wrap onto more
  //lines on narrow screens so nothing is cramped underneath the handle.
  if (!user) {
    return (
      <div
        ref={barRef}
        style={{ ...menuStyle, width: 'min(32rem, calc(100vw - 2rem))', ...positionStyle }}
      >
        <div style={headerStyle}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {dragHandle}
            <strong>Sign in to edit</strong>
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <input
            style={{ ...inputStyle, flex: '1 1 9rem', minWidth: '8rem', boxSizing: 'border-box' }}
            type="email"
            placeholder="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            style={{ ...inputStyle, flex: '1 1 9rem', minWidth: '8rem', boxSizing: 'border-box' }}
            type="password"
            placeholder="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button style={buttonStyle} type="button" onClick={() => void handleLogin()}>
            Sign in
          </button>
        </div>

        {error ? <span style={{ color: '#ff9a9a' }}>{error}</span> : null}
      </div>
    );
  }

  //Signed in, small screen: a collapsible menu opened by an arrow button.
  if (isNarrow) {
    if (!menuOpen) {
      return (
        <>
          {panels}
          <button
            style={fabStyle}
            type="button"
            aria-label="Open the editor menu"
            onClick={() => setMenuOpen(true)}
          >
            &#9650;
          </button>
        </>
      );
    }

    return (
      <>
        {panels}
        <div style={menuStyle}>
          <div style={headerStyle}>
            <span style={{ ...emailStyle, maxWidth: 'none' }}>{user.email}</span>
            <button
              style={closeButtonStyle}
              type="button"
              aria-label="Close the editor menu"
              onClick={() => setMenuOpen(false)}
            >
              &#9660;
            </button>
          </div>

          <button style={menuSubtleStyle} type="button" onClick={() => togglePanel('help')}>
            Help
          </button>

          {isSuperuser ? (
            <button style={menuSubtleStyle} type="button" onClick={() => togglePanel('tags')}>
              Tags
            </button>
          ) : null}

          {editControls(true)}

          <button style={menuSubtleStyle} type="button" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </>
    );
  }

  //Signed in, wide screen: the horizontal toolbar.
  return (
    <>
      {panels}

      <div ref={barRef} style={{ ...barStyle, ...positionStyle }}>
        {dragHandle}

        <span style={emailStyle}>{user.email}</span>

        <button
          style={openPanel === 'help' ? buttonStyle : iconButtonStyle}
          type="button"
          aria-label="Help"
          title="Help and tips"
          onClick={() => togglePanel('help')}
        >
          ?
        </button>

        {isSuperuser ? (
          <button
            style={openPanel === 'tags' ? buttonStyle : subtleButtonStyle}
            type="button"
            onClick={() => togglePanel('tags')}
          >
            Tags
          </button>
        ) : null}

        {editControls(false)}

        <button style={subtleButtonStyle} type="button" onClick={() => void logout()}>
          Sign out
        </button>
      </div>
    </>
  );
};
