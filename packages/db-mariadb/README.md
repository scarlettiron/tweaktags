# @tweaktags/db-mariadb

A thin MariaDB alias that installs and re-exports @tweaktags/db-mysql.

Part of [TweakTags](https://github.com/scarlettiron/tweaktags), a lightweight edit in place content layer for React, Next, and
plain HTML sites. Mark content with a `data-tweaktags-*` attribute and signed in editors change
it right on the page.

## Install

```sh
npm install @tweaktags/db-mariadb
```

MariaDB speaks the MySQL protocol, so it uses the same adapter. Install this so the package
name matches your database, then set `database.provider: 'mariadb'`.

## Documentation

Full setup and guides: https://scarlettiron.github.io/tweaktags

## License

MIT
