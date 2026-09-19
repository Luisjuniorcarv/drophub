#!/bin/sh
set -e

# Executa migrações automaticamente se habilitado via variável de ambiente (PRISMA_AUTO_MIGRATE=true)
if [ "$PRISMA_AUTO_MIGRATE" = "true" ] && [ -n "$DATABASE_URL" ]; then
  echo "📦 [ENTRYPOINT] Executando migrações do banco de dados..."
  if [ -f "./node_modules/.bin/prisma" ]; then
    ./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma || echo "⚠️ [ENTRYPOINT] Aviso: falha nas migrações locais."
  elif command -v npx >/dev/null 2>&1; then
    npx prisma migrate deploy --schema=./prisma/schema.prisma || echo "⚠️ [ENTRYPOINT] Aviso: falha nas migrações via npx."
  fi
fi

exec "$@"
