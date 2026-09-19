# Multi-stage Dockerfile para produção do DropHub (Otimizado para EasyPanel & Docker)
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# 1. Dependências
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci

# 2. Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Aceitar Build Args do EasyPanel com fallbacks seguros para a fase de compilação estática
ARG DATABASE_URL="postgresql://postgres:postgres@localhost:5432/drophub?schema=public"
ARG JWT_SECRET="drophub_super_secret_jwt_key_at_least_32_characters_long_2026"
ARG ENCRYPTION_KEY="drophub_super_secret_encryption_key_32_bytes_long_2026"
ARG NEXT_PUBLIC_APP_URL="http://localhost:3000"

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DATABASE_URL=$DATABASE_URL
ENV JWT_SECRET=$JWT_SECRET
ENV ENCRYPTION_KEY=$ENCRYPTION_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# Gerar Prisma Client e compilar Next.js em modo Standalone
RUN npx prisma generate
RUN npm run build

# 3. Runner / Produção
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar assets estáticos e scripts operacionais
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder /app/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Copiar bundle standalone Next.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

USER nextjs

EXPOSE 3000
EXPOSE 80

# Healthcheck resiliente que verifica a porta ativa do Next.js
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD (wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1 || wget -qO- http://127.0.0.1:80/api/health >/dev/null 2>&1 || exit 1)

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
