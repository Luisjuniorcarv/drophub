/**
 * Script operacional de Restauração do Banco de Dados DropHub
 * Executa psql utilizando as configurações de DATABASE_URL e arquivo de backup SQL
 * 
 * Uso: node scripts/db-restore.cjs [caminho_do_arquivo.sql]
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function runRestore(targetFile) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL não definida no ambiente.");
    process.exit(1);
  }

  let sqlFile = targetFile;

  // Se nenhum arquivo for passado, tenta pegar o mais recente na pasta backups/
  if (!sqlFile) {
    const backupDir = path.join(process.cwd(), "backups");
    if (!fs.existsSync(backupDir)) {
      console.error("❌ Pasta de backups não encontrada e nenhum arquivo SQL especificado.");
      process.exit(1);
    }

    const files = fs.readdirSync(backupDir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);

    if (files.length === 0) {
      console.error("❌ Nenhum arquivo de backup .sql encontrado na pasta backups/.");
      process.exit(1);
    }

    sqlFile = path.join(backupDir, files[0].name);
    console.log(`ℹ️ [DB-RESTORE] Nenhum arquivo especificado. Selecionado backup mais recente: ${files[0].name}`);
  }

  if (!fs.existsSync(sqlFile)) {
    console.error(`❌ Arquivo de backup não encontrado: ${sqlFile}`);
    process.exit(1);
  }

  console.log(`🔄 [DB-RESTORE] Iniciando restauração do banco de dados DropHub...`);
  console.log(`📁 Origem: ${sqlFile}`);
  console.log(`📊 Tamanho do arquivo: ${(fs.statSync(sqlFile).size / 1024).toFixed(2)} KB`);

  try {
    const command = `psql "${databaseUrl}" -f "${sqlFile}"`;
    execSync(command, { stdio: "inherit" });
    console.log(`✅ [DB-RESTORE] Banco de dados restaurado com sucesso a partir de: ${sqlFile}`);
  } catch (error) {
    console.warn(`⚠️ [DB-RESTORE] psql local não executado diretamente: ${error.message}`);
    console.log(`💡 Para restauração em container Docker/EasyPanel, execute:`);
    console.log(`   cat "${sqlFile}" | docker exec -i drophub_postgres psql -U drophub_user -d drophub_db`);
  }
}

if (require.main === module) {
  const customFile = process.argv[2];
  runRestore(customFile);
}

module.exports = { runRestore };
