//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { createContext } from 'react';
import type { ReactNode } from 'react';

import type { AuthUser, ContentRecord, TagType } from '@tweaktags/core';

//Everything the provider shares with the rest of the app.
//Components and hooks read this through the useTweakTags hook.
export interface TweakTagsContextValue {
  //Where the backend handler is mounted.
  apiBasePath: string;

  //The signed in user, or null when nobody is signed in.
  user: AuthUser | null;

  //Whether edit in view mode is currently turned on.
  isEditing: boolean;

  //Whether editing happens in place on the page (true) or in a popup form (false).
  editInView: boolean;

  //Whether the rich text editor and tag types are turned on.
  richText: boolean;

  //Whether the media upload button is turned on.
  mediaUpload: boolean;

  //Whether the current user is allowed to edit.
  canEdit: boolean;

  //Turns edit in view mode on or off.
  setEditing: (on: boolean) => void;

  //Signs a user in with their email and password.
  login: (email: string, password: string) => Promise<void>;

  //Signs the current user out.
  logout: () => Promise<void>;

  //Reads the cached content for a tag.
  //Returns undefined when it has not loaded yet, and null when there is no record.
  getContent: (tag: string) => ContentRecord | null | undefined;

  //Asks the provider to load content for these tags if it has not already.
  requestTags: (tags: string[]) => void;

  //Saves new content for a tag and updates the cache.
  saveContent: (tag: string, body: string, mediaUrl?: string | null) => Promise<void>;

  //Creates a brand new tag. Superuser only.
  //An optional starting body and a tag type can be set.
  createTag: (tag: string, body?: string, type?: TagType) => Promise<void>;

  //Deletes a tag and its content. Superuser only.
  deleteTag: (tag: string) => Promise<void>;

  //Changes an existing tag's type. Superuser only.
  setTagType: (tag: string, type: TagType) => Promise<void>;

  //Lists every tag that currently exists in the database.
  listTags: () => Promise<string[]>;

  //Loads the content records for a set of tags and returns them.
  //Also updates the shared cache. Used by the popup editor.
  loadContent: (tags: string[]) => Promise<ContentRecord[]>;

  //Uploads a media file and returns the public url to save. Needs storage on
  //the server and the mediaUpload option on the client.
  uploadMedia: (file: File) => Promise<string>;

  //True when there are edits on the page that have not been saved yet.
  hasUnsavedChanges: boolean;

  //Saves every unsaved edit on the page at once.
  saveEdits: () => Promise<void>;

  //Throws away every unsaved edit and puts the saved content back.
  discardEdits: () => void;

  //Shows a short popup message, either a success or an error.
  notify: (message: string, type: 'success' | 'error') => void;

  //Shows an in page confirm popup and resolves to true when the user confirms.
  confirm: (
    message: string,
    options?: { confirmLabel?: string; cancelLabel?: string },
  ) => Promise<boolean>;

  //What to show while a piece of content is still loading.
  loadingComponent: ReactNode;
}

//The context starts as null so we can tell when a component is used
//outside of the provider and give a clear error.
export const TweakTagsContext = createContext<TweakTagsContextValue | null>(null);
