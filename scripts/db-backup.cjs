/**
 * Script operacional de Backup do Banco de Dados DropHub
 * Executa pg_dump utilizando as configurações de DATABASE_URL
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function runBackup() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL não definida no ambiente.");
    process.exit(1);
  }

  const backupDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputFile = path.join(backupDir, `drophub_backup_${timestamp}.sql`);

  console.log(`📦 [DB-BACKUP] Iniciando backup do banco de dados DropHub...`);
  console.log(`📁 Destino: ${outputFile}`);

  try {
    // Tenta executar pg_dump se o binário estiver disponível localmente ou em container
    const isWindows = process.platform === "win32";
    const command = `pg_dump "${databaseUrl}" -f "${outputFile}" --clean --if-exists`;

    execSync(command, { stdio: "inherit" });

    console.log(`✅ [DB-BACKUP] Backup gerado com sucesso: ${outputFile}`);
    console.log(`📊 Tamanho do arquivo: ${(fs.statSync(outputFile).size / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.warn(`⚠️ [DB-BACKUP] pg_dump local não executado diretamente: ${error.message}`);
    console.log(`💡 Para backup em container Docker/EasyPanel, utilize:`);
    console.log(`   docker exec drophub_postgres pg_dump -U drophub_user -d drophub_db > ${outputFile}`);
  }
}

if (require.main === module) {
  runBackup();
}

module.exports = { runBackup };
