//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import {
  ACTIONS,
  DEFAULT_API_BASE_PATH,
  type AuthResult,
  type AuthUser,
  type ContentRecord,
  type TagType,
  type UploadTarget,
} from '@tweaktags/core';

import { createApiClient, type ApiClient } from './api-client.js';
import { readCookie, readStoredTokens, writeStoredTokens } from './token-storage.js';
import { findTweakTagsElements, tweaktagsTagOf } from './scanner.js';
import { Emitter } from './emitter.js';
import type {
  EngineOptions,
  EngineState,
  ToastMessage,
  ToastType,
  ToolbarPosition,
} from './types.js';

//The shape returned by the getContent action.
interface GetContentResponse {
  content: ContentRecord[];
}

//Works out where to float the rich text toolbar for an element.
//It sits just above the element, or just below when there is no room above.
const computeToolbarPosition = (element: HTMLElement): ToolbarPosition => {
  const rect = element.getBoundingClientRect();
  const above = rect.top - 44;

  return { left: Math.max(4, rect.left), top: above < 4 ? rect.bottom + 4 : above };
};

//The framework agnostic heart of TweakTags. It crawls the page, shows saved
//content to everyone, tracks the signed in user, and turns on in place editing.
//It holds no UI of its own. A React or vanilla layer subscribes to it and draws
//the controls, so the exact same behavior powers both.
export class TweakTagsEngine {
  public readonly apiBasePath: string;
  public readonly tokenStorage: 'cookie' | 'header';
  public readonly csrfCookieName: string;

  private readonly _editInView: boolean;
  private readonly _richText: boolean;
  private readonly _mediaUpload: boolean;

  private _user: AuthUser | null = null;
  private _isEditing = false;
  private _hasUnsavedChanges = false;

  //The cache of content by tag. undefined means not loaded, null means no record.
  private content: Record<string, ContentRecord | null> = {};

  //Tokens for header mode. In cookie mode these stay null and the browser holds
  //the tokens in httpOnly cookies instead.
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  //Holds the current refresh so many requests that fail at once share one call,
  //which stops a second refresh from looking like a stolen token being reused.
  private refreshPromise: Promise<boolean> | null = null;

  //Tags we have already asked for, and tags waiting for the next batch.
  private readonly requested = new Set<string>();
  private readonly pending = new Set<string>();

  //Which elements belong to each tag, and which tag each element belongs to.
  private readonly elementsByTag = new Map<string, Set<HTMLElement>>();
  private readonly tagByElement = new Map<HTMLElement, string>();

  //Elements the crawler has made editable, with their cleanup functions.
  private readonly bound = new Map<HTMLElement, () => void>();

  //The html each element had before editing, so we can put it back on discard.
  private readonly originalText = new Map<HTMLElement, string>();

  //Elements that have been changed but not saved yet.
  private readonly dirty = new Set<HTMLElement>();

  //The rich element currently being edited in place, if any.
  private activeRichElement: HTMLElement | null = null;

  private observer: MutationObserver | null = null;
  private pruneTimer: ReturnType<typeof setTimeout> | null = null;
  private toastId = 0;
  private started = false;

  //A counter that ticks on every state change. React reads it as a stable
  //snapshot for useSyncExternalStore, which needs a value that only changes
  //when something actually changed.
  public version = 0;

  private readonly api: ApiClient;
  private readonly changeEmitter = new Emitter<EngineState>();
  private readonly toastEmitter = new Emitter<ToastMessage>();
  private readonly toolbarEmitter = new Emitter<ToolbarPosition | null>();

  constructor(options: EngineOptions = {}) {
    this.apiBasePath = options.apiBasePath ?? DEFAULT_API_BASE_PATH;
    this._editInView = options.editInView ?? true;
    this._richText = options.richText ?? false;
    this._mediaUpload = options.mediaUpload ?? false;
    this.tokenStorage = options.tokenStorage ?? 'cookie';
    this.csrfCookieName = options.csrfCookieName ?? 'tweaktags_csrf';

    //In cookie mode we send no bearer token and include credentials so the
    //browser attaches the secure cookie, and we echo the readable csrf cookie.
    this.api = createApiClient({
      basePath: this.apiBasePath,
      getToken: () => (this.tokenStorage === 'header' ? this.accessToken : null),
      credentials: this.tokenStorage === 'cookie' ? 'include' : 'same-origin',
      onUnauthorized: () => this.handleUnauthorized(),
      getCsrfToken: () => (this.tokenStorage === 'cookie' ? readCookie(this.csrfCookieName) : null),
    });

    this.reposition = this.reposition.bind(this);
  }

  //State the UI reads and renders from.
  public get user(): AuthUser | null {
    return this._user;
  }

  public get isEditing(): boolean {
    return this._isEditing;
  }

  public get editInView(): boolean {
    return this._editInView;
  }

  public get richText(): boolean {
    return this._richText;
  }

  public get mediaUpload(): boolean {
    return this._mediaUpload;
  }

  public get canEdit(): boolean {
    return this._user !== null;
  }

  public get hasUnsavedChanges(): boolean {
    return this._hasUnsavedChanges;
  }

  //A plain snapshot, handy for React's useSyncExternalStore and for logging.
  public getState(): EngineState {
    return {
      user: this._user,
      isEditing: this._isEditing,
      canEdit: this.canEdit,
      editInView: this._editInView,
      richText: this._richText,
      mediaUpload: this._mediaUpload,
      hasUnsavedChanges: this._hasUnsavedChanges,
    };
  }

  //Subscribe to state changes, toast messages, and rich toolbar moves. Each
  //returns a function that removes the listener again.
  public subscribe(listener: (state: EngineState) => void): () => void {
    return this.changeEmitter.subscribe(listener);
  }

  public onToast(listener: (toast: ToastMessage) => void): () => void {
    return this.toastEmitter.subscribe(listener);
  }

  public onToolbar(listener: (position: ToolbarPosition | null) => void): () => void {
    return this.toolbarEmitter.subscribe(listener);
  }

  private emitChange(): void {
    this.version += 1;
    this.changeEmitter.emit(this.getState());
  }

  //Shows a short message, which the UI renders as a toast.
  public notify(message: string, type: ToastType): void {
    this.toastId += 1;
    this.toastEmitter.emit({ id: this.toastId, message, type });
  }

  //Reads the cached content for a tag. undefined means it has not loaded yet,
  //null means there is no record for it.
  public getContent(tag: string): ContentRecord | null | undefined {
    return this.content[tag];
  }

  //Stores a record for a tag, updates every element showing it, and tells the UI.
  private setContent(tag: string, record: ContentRecord | null): void {
    this.content[tag] = record;

    if (record) {
      const set = this.elementsByTag.get(tag);

      if (set) {
        for (const element of set) {
          this.showContentInElement(element, record);
        }
      }
    }

    this.emitChange();
  }

  //Loads a batch of pending tags in a single request.
  private async flushPendingTags(): Promise<void> {
    const tags = Array.from(this.pending);
    this.pending.clear();

    if (tags.length === 0) {
      return;
    }

    try {
      const result = await this.api.request<GetContentResponse>(ACTIONS.GET_CONTENT, { tags });
      const byTag = new Map(result.content.map((record) => [record.tag, record]));

      for (const tag of tags) {
        //A tag with no record is stored as null so we stop asking for it.
        const record = byTag.get(tag) ?? null;
        this.content[tag] = record;

        if (record) {
          const set = this.elementsByTag.get(tag);

          if (set) {
            for (const element of set) {
              this.showContentInElement(element, record);
            }
          }
        }
      }

      this.emitChange();
    } catch {
      //A failed load should not crash the page, so we quietly leave tags unset.
    }
  }

  //Asks the engine to load these tags if it has not already.
  public requestTags(tags: string[]): void {
    let hasNew = false;

    for (const tag of tags) {
      if (this.requested.has(tag)) {
        continue;
      }

      this.requested.add(tag);
      this.pending.add(tag);
      hasNew = true;
    }

    if (hasNew) {
      //Wait a tick so several elements can be batched into one request.
      setTimeout(() => {
        void this.flushPendingTags();
      }, 0);
    }
  }

  //Saves new content for a tag and updates the cache.
  public async saveContent(tag: string, body: string, mediaUrl?: string | null): Promise<void> {
    const result = await this.api.request<{ content: ContentRecord }>(ACTIONS.UPDATE_CONTENT, {
      tag,
      body,
      mediaUrl: mediaUrl ?? null,
    });

    this.setContent(tag, result.content);
  }

  //Creates a brand new tag, then optionally saves a starting body. Superuser only.
  public async createTag(tag: string, body?: string, type?: TagType): Promise<void> {
    const result = await this.api.request<{ content: ContentRecord }>(ACTIONS.CREATE_TAG, {
      tag,
      type: type ?? 'plain',
    });

    this.requested.add(tag);
    this.setContent(tag, result.content);

    if (body && body.trim() !== '') {
      await this.saveContent(tag, body);
    }
  }

  //Changes a tag's type. Superuser only.
  public async setTagType(tag: string, type: TagType): Promise<void> {
    const result = await this.api.request<{ content: ContentRecord }>(ACTIONS.UPDATE_TAG_TYPE, {
      tag,
      type,
    });

    this.setContent(tag, result.content);
  }

  //Deletes a tag and its content. Superuser only.
  public async deleteTag(tag: string): Promise<void> {
    await this.api.request(ACTIONS.DELETE_TAG, { tag });

    //Mark it as having no content now. Elements keep their last text until the
    //page reloads, at which point the crawler shows the fallback again.
    this.setContent(tag, null);
  }

  //Reads the full list of tags that exist in the database.
  public async listTags(): Promise<string[]> {
    const result = await this.api.request<{ tags: string[] }>(ACTIONS.LIST_TAGS);

    return result.tags;
  }

  //Loads content for a set of tags and returns the records, updating the cache.
  public async loadContent(tags: string[]): Promise<ContentRecord[]> {
    if (tags.length === 0) {
      return [];
    }

    const result = await this.api.request<GetContentResponse>(ACTIONS.GET_CONTENT, { tags });
    const byTag = new Map(result.content.map((record) => [record.tag, record]));

    for (const tag of tags) {
      this.requested.add(tag);
      this.content[tag] = byTag.get(tag) ?? null;
    }

    this.emitChange();

    return result.content;
  }

  //Uploads a media file and returns the public url to save as a media tag's
  //content. The server signs a short lived upload url, and the file goes straight
  //from the browser to the store, never through the TweakTags server. The caller
  //then saves the returned url like any other media url.
  public async uploadMedia(file: File): Promise<string> {
    const target = await this.api.request<UploadTarget>(ACTIONS.SIGN_UPLOAD, {
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
    });

    const response = await fetch(target.uploadUrl, {
      method: 'PUT',
      headers: target.headers ?? {},
      body: file,
    });

    if (!response.ok) {
      throw new Error('The file could not be uploaded to storage.');
    }

    return target.publicUrl;
  }

  //Puts the saved content into one element for display. Media tags set a url,
  //rich tags set html, and everything else sets text. A media tag on an element
  //with a src sets the src, and on a container like a div sets a background image.
  private showContentInElement(element: HTMLElement, record: ContentRecord): void {
    //Never overwrite an element the user is editing or has unsaved changes in.
    if (document.activeElement === element || this.dirty.has(element)) {
      return;
    }

    if (record.type === 'media' || element.tagName === 'IMG') {
      const url = record.mediaUrl ?? record.body;

      if (!url) {
        return;
      }

      if ('src' in element) {
        if (element.getAttribute('src') !== url) {
          element.setAttribute('src', url);
        }

        return;
      }

      const cssUrl = `url("${url.replace(/"/g, '\\"')}")`;

      if (element.style.backgroundImage !== cssUrl) {
        element.style.backgroundImage = cssUrl;

        if (!element.style.backgroundSize) {
          element.style.backgroundSize = 'cover';
        }

        if (!element.style.backgroundPosition) {
          element.style.backgroundPosition = 'center';
        }

        if (!element.style.backgroundRepeat) {
          element.style.backgroundRepeat = 'no-repeat';
        }
      }

      return;
    }

    if (record.type === 'rich') {
      if (element.innerHTML !== record.body) {
        element.innerHTML = record.body;
      }

      return;
    }

    if (element.innerText !== record.body) {
      element.innerText = record.body;
    }
  }

  //Makes one element editable. Changes are remembered here, not saved yet.
  private bindElement(element: HTMLElement, tag: string): void {
    if (this.bound.has(element)) {
      return;
    }

    //Images cannot be typed into, and media tags are edited by giving a url, so
    //neither is made editable in place. This also covers a media background div.
    if (element.tagName === 'IMG' || this.content[tag]?.type === 'media') {
      return;
    }

    if (!this.originalText.has(element)) {
      this.originalText.set(element, element.innerHTML);
    }

    const onInput = (): void => {
      this.dirty.add(element);
      this.setHasUnsaved(true);
    };

    //When a rich tag element is focused, float the formatting toolbar above it.
    const onFocus = (): void => {
      const currentTag = this.tagByElement.get(element);
      const record = currentTag ? this.content[currentTag] : undefined;

      if (record?.type === 'rich') {
        this.activeRichElement = element;
        this.toolbarEmitter.emit(computeToolbarPosition(element));
      }
    };

    //Hide the toolbar when leaving the element.
    const onBlur = (): void => {
      this.activeRichElement = null;
      this.toolbarEmitter.emit(null);
    };

    element.setAttribute('contenteditable', 'true');
    element.style.outline = '1px dashed rgba(0, 0, 0, 0.3)';
    element.addEventListener('input', onInput);
    element.addEventListener('focus', onFocus);
    element.addEventListener('blur', onBlur);

    this.bound.set(element, () => {
      element.removeEventListener('input', onInput);
      element.removeEventListener('focus', onFocus);
      element.removeEventListener('blur', onBlur);
      element.removeAttribute('contenteditable');
      element.style.outline = '';
    });
  }

  //Removes the editing behavior from one element.
  private unbindElement(element: HTMLElement): void {
    const cleanup = this.bound.get(element);

    if (cleanup) {
      cleanup();
    }

    this.bound.delete(element);
  }

  //Runs a formatting command from the floating toolbar on the element being
  //edited in place, then marks it as changed so the edit is saved. A value is
  //passed through for commands that need one, like createLink.
  public applyRichCommand(command: string, value?: string): void {
    document.execCommand(command, false, value);

    const element = this.activeRichElement;

    if (element) {
      this.dirty.add(element);
      this.setHasUnsaved(true);
    }
  }

  private setHasUnsaved(value: boolean): void {
    if (this._hasUnsavedChanges !== value) {
      this._hasUnsavedChanges = value;
      this.emitChange();
    }
  }

  //Saves every changed element at once and reports how it went.
  public async saveEdits(): Promise<void> {
    const elements = Array.from(this.dirty);

    if (elements.length === 0) {
      this.notify('There are no changes to save.', 'success');

      return;
    }

    let saved = 0;
    const failedTags: string[] = [];

    for (const element of elements) {
      const tag = this.tagByElement.get(element);

      if (!tag) {
        continue;
      }

      //Rich tags are saved as html, everything else as plain text.
      const record = this.content[tag];
      const body = record?.type === 'rich' ? element.innerHTML : element.innerText.trim();

      try {
        await this.saveContent(tag, body);
        this.dirty.delete(element);
        saved += 1;
      } catch {
        failedTags.push(tag);
      }
    }

    this.setHasUnsaved(this.dirty.size > 0);

    if (failedTags.length === 0) {
      this.notify(`Saved ${saved} change${saved === 1 ? '' : 's'}.`, 'success');
    } else {
      this.notify(`Saved ${saved}, but could not save: ${failedTags.join(', ')}.`, 'error');
    }
  }

  //Throws away every unsaved change and puts the saved content back on the page.
  public discardEdits(): void {
    for (const element of this.dirty) {
      const tag = this.tagByElement.get(element);
      const record = tag ? this.content[tag] : undefined;

      if (record && record.type === 'rich') {
        element.innerHTML = record.body;
      } else if (record && record.type !== 'media') {
        element.innerText = record.body;
      } else {
        element.innerHTML = this.originalText.get(element) ?? '';
      }
    }

    this.dirty.clear();
    this.setHasUnsaved(false);
  }

  //Adds one newly found element to the registry, shows any content we have,
  //turns on editing when in edit mode, and asks for its content.
  private registerElement(element: HTMLElement, tag: string): void {
    let set = this.elementsByTag.get(tag);

    if (!set) {
      set = new Set();
      this.elementsByTag.set(tag, set);
    }

    if (set.has(element)) {
      return;
    }

    set.add(element);
    this.tagByElement.set(element, tag);

    const record = this.content[tag];

    if (record) {
      this.showContentInElement(element, record);
    }

    if (this._isEditing && this.canEdit && this._editInView) {
      this.bindElement(element, tag);
    }

    this.requestTags([tag]);
  }

  //Removes one element from the registry and from editing.
  private unregisterElement(element: HTMLElement, tag: string): void {
    const set = this.elementsByTag.get(tag);

    if (set) {
      set.delete(element);

      if (set.size === 0) {
        this.elementsByTag.delete(tag);
      }
    }

    this.tagByElement.delete(element);
    this.originalText.delete(element);
    this.dirty.delete(element);
    this.unbindElement(element);
  }

  //Registers a newly added subtree, looking only at what was added.
  private registerTree(root: HTMLElement): void {
    const rootTag = tweaktagsTagOf(root);

    if (rootTag) {
      this.registerElement(root, rootTag);
    }

    for (const { element, tag } of findTweakTagsElements(root)) {
      this.registerElement(element, tag);
    }
  }

  //Drops any registered elements that have left the page.
  private prune(): void {
    const toRemove: Array<{ element: HTMLElement; tag: string }> = [];

    for (const [tag, elements] of this.elementsByTag) {
      for (const element of elements) {
        if (!element.isConnected) {
          toRemove.push({ element, tag });
        }
      }
    }

    for (const { element, tag } of toRemove) {
      this.unregisterElement(element, tag);
    }
  }

  //Runs a prune on the next tick, collapsing many removals into one pass.
  private schedulePrune(): void {
    if (typeof window === 'undefined' || this.pruneTimer !== null) {
      return;
    }

    this.pruneTimer = setTimeout(() => {
      this.pruneTimer = null;
      this.prune();
    }, 0);
  }

  //Signs a user in. In cookie mode the server sets the httpOnly cookies, so the
  //tokens are not in the response and we only keep them in header mode.
  public async login(email: string, password: string): Promise<void> {
    const result = await this.api.request<AuthResult>(ACTIONS.LOGIN, { email, password });

    if (this.tokenStorage === 'header') {
      writeStoredTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
      this.accessToken = result.accessToken;
      this.refreshToken = result.refreshToken;
    }

    this._user = result.user;
    this.emitChange();
  }

  //Signs the current user out.
  public async logout(): Promise<void> {
    try {
      await this.api.request(ACTIONS.LOGOUT);
    } finally {
      if (this.tokenStorage === 'header') {
        writeStoredTokens(null);
        this.accessToken = null;
        this.refreshToken = null;
      }

      this._user = null;
      //setEditing turns off editing and emits the change for both fields.
      this.setEditing(false);
    }
  }

  //Turns edit mode on or off. Only a signed in user is allowed to turn it on.
  public setEditing(on: boolean): void {
    this._isEditing = on && this.canEdit;
    this.applyEditingState();
    this.emitChange();
  }

  //Binds or unbinds every registered element to match the current edit state.
  //In place binding only happens when editInView is on.
  private applyEditingState(): void {
    const shouldEdit = this._isEditing && this.canEdit && this._editInView;

    for (const [tag, elements] of this.elementsByTag) {
      for (const element of elements) {
        if (shouldEdit) {
          this.bindElement(element, tag);
        } else {
          this.unbindElement(element);
        }
      }
    }

    if (!shouldEdit) {
      this.dirty.clear();
      this.originalText.clear();
      this._hasUnsavedChanges = false;
      this.activeRichElement = null;
      this.toolbarEmitter.emit(null);
    }
  }

  //Tries to refresh the session when a request comes back unauthorized. Returns
  //true when a new access token was issued. Many failing requests share one
  //refresh so the token is only rotated once. When it fails, the user is out.
  private handleUnauthorized(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const promise = (async (): Promise<boolean> => {
      try {
        const payload =
          this.tokenStorage === 'header' ? { refreshToken: this.refreshToken } : undefined;
        const result = await this.api.request<AuthResult>(ACTIONS.REFRESH, payload);

        if (this.tokenStorage === 'header') {
          writeStoredTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
          this.accessToken = result.accessToken;
          this.refreshToken = result.refreshToken;
        }

        return true;
      } catch {
        if (this.tokenStorage === 'header') {
          writeStoredTokens(null);
          this.accessToken = null;
          this.refreshToken = null;
        }

        this._user = null;
        this._isEditing = false;
        this.emitChange();

        return false;
      }
    })();

    this.refreshPromise = promise;
    void promise.finally(() => {
      this.refreshPromise = null;
    });

    return promise;
  }

  //Keeps the floating toolbar over its element as the page scrolls or resizes.
  private reposition(): void {
    if (this.activeRichElement) {
      this.toolbarEmitter.emit(computeToolbarPosition(this.activeRichElement));
    }
  }

  //Boots the engine. Restores any session, scans the page once, and then watches
  //only for what is added or removed. Safe to call once. Call stop to tear down.
  public start(): void {
    if (this.started || typeof document === 'undefined') {
      return;
    }

    this.started = true;

    //In header mode, load any saved tokens so requests can use them.
    if (this.tokenStorage === 'header') {
      const saved = readStoredTokens();

      if (saved) {
        this.accessToken = saved.accessToken;
        this.refreshToken = saved.refreshToken;
      }
    }

    //Ask the server who we are. The cookie or bearer token is used, and an
    //expired access token is refreshed automatically. No session stays signed out.
    this.api
      .request<{ user: AuthUser }>(ACTIONS.ME)
      .then((result) => {
        this._user = result.user;
        this.emitChange();
      })
      .catch(() => {
        //No valid session, so remain signed out.
      });

    this.registerTree(document.body);

    this.observer = new MutationObserver((mutations) => {
      let removed = false;

      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.registerTree(node as HTMLElement);
          }
        });

        if (mutation.removedNodes.length > 0) {
          removed = true;
        }
      }

      if (removed) {
        this.schedulePrune();
      }
    });

    this.observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('scroll', this.reposition, true);
    window.addEventListener('resize', this.reposition);
  }

  //Tears everything down. Disconnects the observer and unbinds every element.
  public stop(): void {
    if (!this.started) {
      return;
    }

    this.started = false;

    this.observer?.disconnect();
    this.observer = null;

    for (const element of Array.from(this.bound.keys())) {
      this.unbindElement(element);
    }

    this.elementsByTag.clear();

    if (this.pruneTimer !== null) {
      clearTimeout(this.pruneTimer);
      this.pruneTimer = null;
    }

    window.removeEventListener('scroll', this.reposition, true);
    window.removeEventListener('resize', this.reposition);
  }
}

//Creates and returns a new engine. A thin helper for callers that prefer a
//factory over the class.
export const createTweakTagsEngine = (options?: EngineOptions): TweakTagsEngine =>
  new TweakTagsEngine(options);
