# DropHub — Procedimento Operacional: Backup e Disaster Recovery

Este documento descreve as rotinas operacionais para garantia de integridade, retenção de dados e recuperação de desastres (Disaster Recovery) do banco de dados PostgreSQL do DropHub em ambientes Docker, EasyPanel e VPS dedicadas.

---

## 1. Estratégia de Backup

### Tipos de Backup
1. **Backup Lógico Completo (Diário / Snapshot):**
   - Utiliza o utilitário nativo `pg_dump` com compressão `custom` ou `gzip`.
   - Executado automaticamente todo dia às **03:00 UTC** (horário de menor tráfego).
   - Armazenado fora do container em volume montado seguro ou bucket S3/R2.

2. **Políticas de Retenção (Garantia de 7 Dias + Semanal):**
   - **Diários:** Últimos 7 dias mantidos localmente.
   - **Semanais:** Últimas 4 semanas mantidas em armazenamento secundário / offsite.
   - **Mensais:** 12 meses para fins contábeis e fiscais.

---

## 2. Script de Execução Automatizada (`scripts/db-backup.cjs`)

Para disparar o backup via cron ou linha de comando:

```bash
# Execução direta via Node.js
node scripts/db-backup.cjs
```

O script lê as credenciais de `DATABASE_URL` do ambiente, cria o diretório de destino se não existir, gera o arquivo compactado `drophub_backup_YYYY-MM-DD_HHmmss.sql.gz` e remove automaticamente arquivos mais antigos que a política de retenção definida.

---

## 3. Comandos Manuais de Backup e Restore

### A. Realizar Backup Manual no PostgreSQL / Docker
```bash
# No host ou terminal do EasyPanel:
docker exec -t drophub_postgres pg_dump -U drophub_user -d drophub_db --clean --if-exists | gzip > /backups/drophub_$(date +%Y%m%d_%H%M%S).sql.gz
```

### B. Restaurar Backup em Novo Ambiente (Disaster Recovery)
```bash
# 1. Descompactar e restaurar
gunzip -c /backups/drophub_backup_YYYY-MM-DD.sql.gz | docker exec -i drophub_postgres psql -U drophub_user -d drophub_db

# 2. Executar validação de migrações
npx prisma migrate deploy

# 3. Validar integridade
node scripts/verify-db.cjs
```

---

## 4. Teste Periódico de Restore (Rotina de Validação)

Para garantir que os backups são utilizáveis e não estão corrompidos:
1. Criar um banco temporário: `createdb -U drophub_user drophub_test_restore`
2. Executar o restore no banco de teste: `psql -U drophub_user -d drophub_test_restore < drophub_backup.sql`
3. Validar contagem de tabelas e integridade das chaves primárias.
4. Remover banco temporário: `dropdb -U drophub_user drophub_test_restore`
