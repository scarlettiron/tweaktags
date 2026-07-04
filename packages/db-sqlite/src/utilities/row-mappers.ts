//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import type { ContentRecord, StoredUser, TagType } from '@tweaktags/core';

//The raw shape of a content row as it comes back from SQLite.
interface ContentRow {
  tag: string;
  type: string;
  body: string;
  media_url: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

//Reads a tag type value safely, falling back to plain text.
const toTagType = (value: string): TagType =>
  value === 'rich' ? 'rich' : value === 'media' ? 'media' : 'plain';

//The raw shape of a user row as it comes back from SQLite.
interface UserRow {
  id: number | bigint;
  email: string;
  password_hash: string;
  role: string;
}

//Turns a database content row into the camel case shape the rest of TweakTags uses.
//SQLite stores the timestamp as text, so it is passed through as is.
export const mapContentRow = (row: ContentRow): ContentRecord => ({
  tag: row.tag,
  type: toTagType(row.type),
  body: row.body,
  mediaUrl: row.media_url,
  updatedAt: row.updated_at,
  updatedBy: row.updated_by,
});

//Turns a database user row into the stored user shape, including the password hash.
export const mapUserRow = (row: UserRow): StoredUser => ({
  id: String(row.id),
  email: row.email,
  passwordHash: row.password_hash,
  role: row.role === 'superuser' ? 'superuser' : 'editor',
});
