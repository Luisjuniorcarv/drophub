const epModule = require("embedded-postgres");
const EmbeddedPostgres = epModule.default || epModule;
const path = require("path");

const dataDir = path.resolve(__dirname, "../.postgres_data");

async function main() {
  console.log("Iniciando PostgreSQL nativo local em:", dataDir);

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    port: 5432,
    user: "drophub_user",
    password: "drophub_secure_pass",
    initialDatabase: "drophub_db",
    persistent: true,
  });

  const fs = require("fs");
  const isInitialized = fs.existsSync(path.join(dataDir, "PG_VERSION"));
  if (!isInitialized) {
    await pg.initialise();
  }
  await pg.start();

  console.log("PostgreSQL ONLINE na porta 5432!");
  console.log("DATABASE_URL=postgresql://drophub_user:drophub_secure_pass@localhost:5432/drophub_db?schema=public");

  // Mantém ativo indefinidamente
  setInterval(() => {}, 1000 * 60 * 60);

  process.on("SIGINT", async () => {
    console.log("Encerrando PostgreSQL...");
    await pg.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Erro ao iniciar PostgreSQL:", err);
  process.exit(1);
});
