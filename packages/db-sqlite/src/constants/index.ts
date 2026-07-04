//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

//The table TweakTags uses to remember which migrations have already run.
export const MIGRATIONS_TABLE = '__TweakTags__Migrations';

//The start of the SQLite error code for a broken unique or primary key.
//We use this to turn a duplicate insert into a friendly conflict error.
export const CONSTRAINT_ERROR_PREFIX = 'SQLITE_CONSTRAINT';
