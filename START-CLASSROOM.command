#!/bin/zsh
cd "$(dirname "$0")" || exit 1
if [[ ! -f work/classroom-keys.json ]]; then
  node tools/classroom-server/server.mjs --init || exit 1
else
  print 'Using existing private room configuration in work/classroom-keys.json.'
fi
print 'Loopback only. See docs/classroom.md before explicitly enabling LAN access.'
exec node tools/classroom-server/server.mjs
