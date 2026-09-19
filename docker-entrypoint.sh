#!/bin/sh
set -e

# Executa migrações automaticamente se habilitado via variável de ambiente (padrão: desabilitado para controle manual ou habilitável com PRISMA_AUTO_MIGRATE=true)
if [ "$PRISMA_AUTO_MIGRATE" = "true" ] && [ -n "$DATABASE_URL" ]; then
  echo "📦 [ENTRYPOINT] Executando 'npx prisma migrate deploy'..."
  npx prisma migrate deploy || echo "⚠️ [ENTRYPOINT] Aviso: falha ao executar migrations automáticas no startup."
fi

exec "$@"
