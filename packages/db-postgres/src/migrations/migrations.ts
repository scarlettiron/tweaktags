//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { AUTH_TABLE, CONTENT_TABLE, REFRESH_TABLE } from '@tweaktags/core';

//A single migration step.
//The id must never change once it has shipped, because it is how we
//remember that this step already ran.
export interface Migration {
  id: string;
  sql: string;
}

//The ordered list of migrations.
//Add new steps to the end of this list, never edit or reorder old ones.
export const MIGRATIONS: Migration[] = [
  {
    id: '0001_create_content_table',
    sql: `
      CREATE TABLE IF NOT EXISTS "${CONTENT_TABLE}" (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        tag TEXT NOT NULL UNIQUE,
        body TEXT NOT NULL DEFAULT '',
        media_url TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_by TEXT
      );
    `,
  },
  {
    id: '0002_create_auth_table',
    sql: `
      CREATE TABLE IF NOT EXISTS "${AUTH_TABLE}" (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('superuser', 'editor')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `,
  },
  {
    id: '0003_add_content_type',
    sql: `
      ALTER TABLE "${CONTENT_TABLE}"
      ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'plain';
    `,
  },
  {
    id: '0004_create_refresh_tokens',
    sql: `
      CREATE TABLE IF NOT EXISTS "${REFRESH_TABLE}" (
        id TEXT PRIMARY KEY,
        family_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked BOOLEAN NOT NULL DEFAULT false
      );
      CREATE INDEX IF NOT EXISTS idx_tweaktags_refresh_family
        ON "${REFRESH_TABLE}" (family_id);
    `,
  },
  {
    //Adds tenant support so one database can serve several sites. The tag
    //uniqueness moves from the tag alone to the pair of tenant and tag, so two
    //sites can use the same tag name. Existing rows become the default tenant.
    id: '0005_add_content_tenant',
    sql: `
      ALTER TABLE "${CONTENT_TABLE}"
        ADD COLUMN IF NOT EXISTS tenant TEXT NOT NULL DEFAULT 'default';
      ALTER TABLE "${CONTENT_TABLE}"
        DROP CONSTRAINT IF EXISTS "${CONTENT_TABLE}_tag_key";
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tweaktags_content_tenant_tag
        ON "${CONTENT_TABLE}" (tenant, tag);
    `,
  },
];
