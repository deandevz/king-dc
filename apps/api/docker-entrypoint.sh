#!/bin/sh
set -e

echo "api: aplicando migrações"
node dist/migrate.js

if [ -n "${SEED_ADMIN_CODE}" ] && [ -n "${SEED_ADMIN_PASSWORD}" ]; then
  echo "api: rodando seed (idempotente)"
  node dist/seed.js
fi

exec node dist/server.js
