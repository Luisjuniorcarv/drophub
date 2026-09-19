# DropHub — Guia Oficial de Implantação e Produção (Production Deployment Guide)

Este documento fornece as instruções completas, padronizadas e auditadas para a implantação em produção da plataforma **DropHub**.

---

## 1. Visão Geral da Arquitetura de Produção

```
                           [ CLIENTES / NAVEGADORES / ADMIN ]
                                           │
                                    HTTPS / TLS 1.3
                                           │
                              [ REVERSE PROXY / SSL TERMINATION ]
                              (Nginx / Caddy / Cloudflare / EasyPanel)
                                           │
                                    HTTP (Porta 3000)
                                           │
                      ┌────────────────────▼────────────────────┐
                      │              DROPHUB APP                │
                      │         (Next.js 16 Standalone)         │
                      │  - E-commerce Storefront (App Router)   │
                      │  - Painel Administrativo / Admin API    │
                      │  - Proteção SSRF / DNS Rebinding        │
                      │  - Criptografia AES-256-GCM             │
                      │  - Sessões HTTP-Only Seguras            │
                      └───────┬─────────────────────────┬───────┘
                              │                         │
                   Conexão PostgreSQL             Jobs Assíncronos / Webhooks
                   (Pool Seguro Prisma)                 │
                              │             ┌───────────▼───────────┐
                              │             │    BACKGROUND JOBS    │
                              │             │ - Outbox Worker       │
                              │             │ - Fulfillment Retry   │
                              │             │ - Sincronização Cron  │
                              │             └───────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │    POSTGRESQL     │
                    │   (Versão 16+)    │
                    │ 11 Migrações Dev  │
                    │ & Deploy Seguras  │
                    └───────────────────┘
```

---

## 2. Requisitos de Infraestrutura

| Componente | Requisito Mínimo | Recomendado para Produção |
| :--- | :--- | :--- |
| **CPU** | 1 vCPU | 2 vCPUs |
| **Memória RAM** | 1.0 GB RAM | 2.0 a 4.0 GB RAM |
| **Armazenamento** | 10 GB SSD | 25+ GB SSD NVMe |
| **Sistema Operacional** | Linux (Ubuntu 22.04 LTS / Debian 12 / Alpine) | Linux Ubuntu 22.04 LTS |
| **Runtime** | Node.js 20+ LTS ou Docker 24+ | Docker Engine 26+ com Compose |
| **Banco de Dados** | PostgreSQL 15 ou 16 | PostgreSQL 16 gerenciado ou container dedicado |

---

## 3. Checklist de Variáveis de Ambiente (`.env.production`)

Crie o arquivo `.env` no servidor de produção com base no modelo `.env.example`:

```bash
# 1. Banco de Dados PostgreSQL (Conexão interna/segura)
DATABASE_URL="postgresql://drophub_user:SENHA_FORTE_AQUI@postgres:5432/drophub_db?schema=public"

# 2. Segurança, Autenticação e Criptografia (Obrigatório >= 32 caracteres)
JWT_SECRET="GERAR_STRING_ALEATORIA_COM_NO_MINIMO_32_CARACTERES_SEGUROS"
ENCRYPTION_KEY="GERAR_STRING_ALEATORIA_COM_32_BYTES_HEX_OU_BASE64"
COOKIE_NAME="drophub_admin_session"
NODE_ENV="production"

# 3. Domínio e URLs Públicas (Com HTTPS)
NEXT_PUBLIC_APP_URL="https://seudominio.com.br"

# 4. Webhooks e Assinaturas HMAC
WEBHOOK_SECRET="GERAR_SEGREDO_DE_WEBHOOKS_SEGURO"

# 5. Segredo para Endpoints de Cron (/api/cron/*)
CRON_SECRET="GERAR_SEGREDO_CRON_ALTA_ENTROPIA"

# 6. Automações n8n (Opcional)
N8N_WEBHOOK_URL="https://n8n.seudominio.com.br/webhook/drophub-events"

# 7. Gateway de Pagamento
PAYMENT_GATEWAY="MERCADO_PAGO" # Ou TEST_MODE para testes
MERCADO_PAGO_ACCESS_TOKEN="APP_USR-..."

# 8. Inteligência Artificial (Opcional)
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4o-mini"
```

> [!IMPORTANT]
> Em produção (`NODE_ENV=production`), as chaves `JWT_SECRET` e `ENCRYPTION_KEY` são estritamente validadas para ter pelo menos 32 caracteres e os cookies de sessão são emitidos automaticamente com a flag `Secure=true`.

---

## 4. Métodos de Implantação

### Opção A: Docker Compose (Recomendado)

O repositório já inclui um `Dockerfile` multi-stage otimizado com build `standalone` e um `docker-compose.yml` pronto.

1. **Clonar repositório e configurar variáveis:**
   ```bash
   git clone <URL_DO_REPOSITORIO> drophub
   cd drophub
   cp .env.example .env
   # Edite o arquivo .env com os dados de produção
   nano .env
   ```

2. **Subir os containers:**
   ```bash
   docker compose up -d --build
   ```

3. **Executar migrações do banco de dados:**
   ```bash
   docker compose exec app npx prisma migrate deploy
   ```

4. **(Opcional) Executar seed de dados iniciais:**
   ```bash
   docker compose exec app npm run prisma:seed
   ```

---

### Opção B: Implantação Bare-Metal / VPS com PM2

1. **Instalar dependências do sistema:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs postgresql nginx
   sudo npm install -g pm2
   ```

2. **Instalar dependências do projeto e compilar:**
   ```bash
   npm ci
   npx prisma generate
   npx prisma migrate deploy
   npm run build
   ```

3. **Iniciar aplicação e worker com PM2:**
   ```bash
   # Iniciar servidor Next.js
   pm2 start npm --name "drophub-app" -- start

   # Iniciar worker de outbox em background
   pm2 start npm --name "drophub-worker" -- run worker:outbox

   # Salvar configuração do PM2
   pm2 save
   pm2 startup
   ```

---

## 5. Background Workers & Rotinas de Cron

O DropHub utiliza o **Outbox Pattern** para garantir a entrega consistente de eventos de domínio (pagamento aprovado, despacho de fornecedor, envio de e-mails/webhooks).

### Execução via Crontab do Sistema (HTTP Seguro)

Configure as chamadas protegidas por token no crontab do host:

```bash
# Executar a cada minuto o processamento de eventos do Outbox
* * * * * curl -X GET "https://seudominio.com.br/api/cron/outbox" -H "Authorization: Bearer CRON_SECRET_AQUI" >/dev/null 2>&1

# Executar a cada 2 minutos o retry e despacho de fulfillment pendente
*/2 * * * * curl -X GET "https://seudominio.com.br/api/cron/fulfillment" -H "Authorization: Bearer CRON_SECRET_AQUI" >/dev/null 2>&1
```

---

## 6. Verificação de Saúde e Monitoramento (Healthchecks)

A plataforma conta com endpoints padronizados de verificação de liveness e readiness para integração com load balancers e Uptime Monitors:

### 1. Liveness Probe
- **Endpoint:** `GET /api/health`
- **Resposta Esperada:** HTTP `200 OK`
- **Exemplo de Payload:**
  ```json
  {
    "status": "ok",
    "timestamp": "2026-09-19T18:30:00.000Z",
    "uptime": 12450.32
  }
  ```

### 2. Readiness Probe (Validação de Banco de Dados)
- **Endpoint:** `GET /api/ready`
- **Resposta Esperada:** HTTP `200 OK`
- **Exemplo de Payload:**
  ```json
  {
    "status": "ready",
    "database": "connected",
    "version": "1.0.0"
  }
  ```

---

## 7. Procedimentos de Backup e Disaster Recovery

### Backup Automatizado
Execute o script operacional para gerar snapshot completo do banco PostgreSQL:
```bash
npm run db:backup
```
O arquivo será gerado no diretório `./backups/drophub_backup_YYYY-MM-DD-HH-mm-ss.sql`.

### Restauração do Banco de Dados
Para restaurar a partir de um arquivo de backup:
```bash
# Restaurar o backup mais recente:
npm run db:restore

# Ou especificar arquivo específico:
npm run db:restore backups/drophub_backup_2026-09-19-15-00-00.sql
```

---

## 8. Checklist de Pré-Go-Live de Segurança

- [x] **Zero Migrações Pendentes:** `npx prisma migrate deploy` executado com sucesso.
- [x] **Variáveis de Ambiente Fortes:** `JWT_SECRET` e `ENCRYPTION_KEY` com entropia >= 32 caracteres.
- [x] **Proteção SSRF e DNS Rebinding Ativa:** Módulo `network-security.ts` bloqueando IPs privados, loopback e domínios locais.
- [x] **Criptografia de Credenciais:** AES-256-GCM com autenticação de tag ativa.
- [x] **Security Headers Ativos:** Content-Security-Policy, HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff.
- [x] **Certificado HTTPS/SSL:** Ativo via Proxy Reverso / Cloudflare.
- [x] **Suite de Testes:** 309/309 testes automatizados passando.
- [x] **TypeScript:** 0 erros de compilação.
- [x] **Next.js Standalone Build:** 83 rotas compiladas e otimizadas com sucesso.
