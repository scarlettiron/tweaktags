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

//The ordered list of migrations for MySQL and MariaDB.
//Add new steps to the end of this list, never edit or reorder old ones.
export const MIGRATIONS: Migration[] = [
  {
    id: '0001_create_content_table',
    sql: `
      CREATE TABLE IF NOT EXISTS \`${CONTENT_TABLE}\` (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        tag VARCHAR(255) NOT NULL UNIQUE,
        body TEXT NOT NULL,
        media_url TEXT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_by VARCHAR(255) NULL
      );
    `,
  },
  {
    id: '0002_create_auth_table',
    sql: `
      CREATE TABLE IF NOT EXISTS \`${AUTH_TABLE}\` (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(32) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_tweaktags_role CHECK (role IN ('superuser', 'editor'))
      );
    `,
  },
  {
    id: '0003_add_content_type',
    sql: `
      ALTER TABLE \`${CONTENT_TABLE}\`
      ADD COLUMN type VARCHAR(16) NOT NULL DEFAULT 'plain';
    `,
  },
  {
    id: '0004_create_refresh_tokens',
    sql: `
      CREATE TABLE IF NOT EXISTS \`${REFRESH_TABLE}\` (
        id VARCHAR(64) PRIMARY KEY,
        family_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        expires_at VARCHAR(32) NOT NULL,
        revoked TINYINT(1) NOT NULL DEFAULT 0,
        INDEX idx_tweaktags_refresh_family (family_id)
      );
    `,
  },
  {
    //Adds tenant support so one database can serve several sites. Written as a
    //single ALTER so it runs without multi statement support: it adds the tenant
    //column, drops the old unique on tag, and adds a unique on tenant and tag.
    id: '0005_add_content_tenant',
    sql: `
      ALTER TABLE \`${CONTENT_TABLE}\`
        ADD COLUMN tenant VARCHAR(190) NOT NULL DEFAULT 'default',
        DROP INDEX tag,
        ADD UNIQUE KEY uniq_tweaktags_tenant_tag (tenant, tag);
    `,
  },
];
