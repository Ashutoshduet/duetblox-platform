#!/bin/zsh
# Starts this verified production folder locally; no network download or installation.
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  print 'Install Node.js 22 or newer, then open this launcher again.'
  read '?Press Return to close.'
  exit 1
fi
if [[ ! -f dist/offline-manifest.json ]]; then
  print 'The production build is missing. Follow README.md to restore assets and run npm run build.'
  read '?Press Return to close.'
  exit 1
fi
exec node scripts/serve-built.mjs
