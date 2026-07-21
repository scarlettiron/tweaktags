//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { DEFAULT_API_BASE_PATH, type TagType } from '@tweaktags/core';
import { TweakTagsEngine, type ToolbarPosition } from '@tweaktags/browser';

import { TweakTagsContext, type TweakTagsContextValue } from '../context/tweaktags-context.js';
import { DefaultLoader } from './default-loader.js';
import { ToastHost, type Toast } from './toast-host.js';
import { ConfirmDialog } from './confirm-dialog.js';
import { TagEditorModal } from './tag-editor-modal.js';
import { RichTextToolbar } from './rich-text-toolbar.js';

//The details of an open confirm popup, including how to answer it.
interface ConfirmState {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  resolve: (confirmed: boolean) => void;
}

//The props for the provider that wraps the host app.
export interface TweakTagsProviderProps {
  children: ReactNode;

  //Where the backend handler is mounted. Defaults to /api/tweaktags.
  apiBasePath?: string;

  //When true, editing happens in place on the page. When false, editing happens
  //in a popup form that lists every tag. Defaults to true.
  editInView?: boolean;

  //Turns on the rich text editor and tag types. Defaults to false.
  richText?: boolean;

  //Turns on the upload button for media tags. The server must have storage
  //configured for uploads to work. Defaults to false.
  mediaUpload?: boolean;

  //When true, no TweakTags branding shows anywhere in the UI, including the
  //admin panel. Defaults to false.
  whiteLabel?: boolean;

  //How the login token is kept. 'cookie' relies on a secure httpOnly cookie set
  //by the server, which is the safest option. 'header' stores the token in the
  //browser and sends it as a bearer header, needed for a separate app on another
  //origin. This must match the tokenStorage in your server config. Defaults to
  //'cookie'.
  tokenStorage?: 'cookie' | 'header';

  //The csrf cookie name, must match the server config. Defaults to 'tweaktags_csrf'.
  csrfCookieName?: string;

  //A custom loading component to show while content loads.
  loadingComponent?: ReactNode;
}

//The provider wraps the host app and shares TweakTags with the rest of it.
//It owns a single engine, which does all of the real work: crawling the page,
//showing saved content to everyone, tracking the signed in user, and editing.
//This component is a thin React binding over that engine, so the exact same
//behavior powers the vanilla build too.
export const TweakTagsProvider = ({
  children,
  apiBasePath = DEFAULT_API_BASE_PATH,
  editInView = true,
  richText = false,
  mediaUpload = false,
  whiteLabel = false,
  tokenStorage = 'cookie',
  csrfCookieName = 'tweaktags_csrf',
  loadingComponent,
}: TweakTagsProviderProps): ReactElement => {
  //Create the engine once and keep it for the life of the provider.
  const engineRef = useRef<TweakTagsEngine | null>(null);

  if (!engineRef.current) {
    engineRef.current = new TweakTagsEngine({
      apiBasePath,
      editInView,
      richText,
      mediaUpload,
      whiteLabel,
      tokenStorage,
      csrfCookieName,
    });
  }

  const engine = engineRef.current;

  //Re-render whenever the engine changes. The version is a stable snapshot that
  //only ticks on a real change, which is what useSyncExternalStore needs.
  const subscribe = useCallback((onChange: () => void) => engine.subscribe(onChange), [engine]);
  const getVersion = useCallback(() => engine.version, [engine]);
  const version = useSyncExternalStore(subscribe, getVersion, getVersion);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [richToolbar, setRichToolbar] = useState<ToolbarPosition | null>(null);

  //Start the engine on mount and tear it down on unmount.
  useEffect(() => {
    engine.start();

    return () => {
      engine.stop();
    };
  }, [engine]);

  //Show the engine's toast messages, each fading away on its own.
  useEffect(
    () =>
      engine.onToast((toast) => {
        setToasts((previous) => [...previous, { id: toast.id, message: toast.message, type: toast.type }]);

        setTimeout(() => {
          setToasts((previous) => previous.filter((item) => item.id !== toast.id));
        }, 4000);
      }),
    [engine],
  );

  //Float the rich text toolbar where the engine says the active element is.
  useEffect(() => engine.onToolbar((position) => setRichToolbar(position)), [engine]);

  //Opens the confirm popup and resolves once the user answers it.
  const confirm = useCallback(
    (
      message: string,
      options?: { confirmLabel?: string; cancelLabel?: string },
    ): Promise<boolean> =>
      new Promise<boolean>((resolve) => {
        setConfirmState({
          message,
          confirmLabel: options?.confirmLabel ?? 'Confirm',
          cancelLabel: options?.cancelLabel ?? 'Cancel',
          resolve,
        });
      }),
    [],
  );

  //Answers the open confirm popup and closes it.
  const answerConfirm = useCallback((confirmed: boolean): void => {
    setConfirmState((current) => {
      current?.resolve(confirmed);

      return null;
    });
  }, []);

  //The actions never change, so build them once. Keeping them separate from the
  //state means their identity stays stable across state changes, so a consumer
  //that depends on a method reference does not re-run needlessly.
  const actions = useMemo(
    () => ({
      setEditing: (on: boolean) => engine.setEditing(on),
      login: (email: string, password: string) => engine.login(email, password),
      logout: () => engine.logout(),
      getContent: (tag: string) => engine.getContent(tag),
      requestTags: (tags: string[]) => engine.requestTags(tags),
      saveContent: (tag: string, body: string, mediaUrl?: string | null) =>
        engine.saveContent(tag, body, mediaUrl),
      createTag: (tag: string, body?: string, type?: TagType) => engine.createTag(tag, body, type),
      deleteTag: (tag: string) => engine.deleteTag(tag),
      setTagType: (tag: string, type: TagType) => engine.setTagType(tag, type),
      listTags: () => engine.listTags(),
      loadContent: (tags: string[]) => engine.loadContent(tags),
      uploadMedia: (file: File) => engine.uploadMedia(file),
      saveEdits: () => engine.saveEdits(),
      discardEdits: () => engine.discardEdits(),
      notify: (message: string, type: 'success' | 'error') => engine.notify(message, type),
    }),
    [engine],
  );

  const value = useMemo<TweakTagsContextValue>(
    () => ({
      apiBasePath: engine.apiBasePath,
      user: engine.user,
      isEditing: engine.isEditing,
      editInView: engine.editInView,
      richText: engine.richText,
      mediaUpload: engine.mediaUpload,
      whiteLabel: engine.whiteLabel,
      canEdit: engine.canEdit,
      hasUnsavedChanges: engine.hasUnsavedChanges,
      ...actions,
      confirm,
      loadingComponent: loadingComponent ?? <DefaultLoader />,
    }),
    //version is read so the value updates when the engine state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine, version, actions, confirm, loadingComponent],
  );

  return (
    <TweakTagsContext.Provider value={value}>
      {children}
      <ToastHost toasts={toasts} />
      {!engine.editInView && engine.isEditing && engine.canEdit ? <TagEditorModal /> : null}
      {richToolbar ? (
        <RichTextToolbar
          onCommand={(command) => engine.applyRichCommand(command)}
          style={{
            position: 'fixed',
            left: richToolbar.left,
            top: richToolbar.top,
            zIndex: 2147483647,
          }}
        />
      ) : null}
      {confirmState ? (
        <ConfirmDialog
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          onConfirm={() => answerConfirm(true)}
          onCancel={() => answerConfirm(false)}
        />
      ) : null}
    </TweakTagsContext.Provider>
  );
};
