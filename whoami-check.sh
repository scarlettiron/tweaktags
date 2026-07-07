#!/usr/bin/env bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null
corepack prepare pnpm@11.9.0 --activate >/dev/null 2>&1 || true
cd "$HOME/work/static-tag-admin-pannel"
echo "=== npm registry identity ==="
corepack pnpm whoami --registry https://registry.npmjs.org/ 2>&1
echo "=== can this identity publish to @tweaktags? (dry run, no upload) ==="
corepack pnpm -r publish --access public --no-git-checks --dry-run 2>&1 | tail -20
rm -f "$HOME/work/static-tag-admin-pannel/whoami-check.sh"
