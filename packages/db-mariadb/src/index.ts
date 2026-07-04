//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

//MariaDB speaks the MySQL protocol, so it uses the exact same adapter.
//This package exists only so people whose database is MariaDB can install a
//package with that name, instead of wondering why they need the MySQL one.
//It installs @tweaktags/db-mysql and re-exports everything from it, plus a
//MariadbAdapter name that is just an alias for MysqlAdapter.
export { MysqlAdapter, MysqlAdapter as MariadbAdapter, MIGRATIONS } from '@tweaktags/db-mysql';
export type { Migration } from '@tweaktags/db-mysql';
