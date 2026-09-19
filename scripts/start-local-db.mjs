import { EmbeddedPostgres } from "embedded-postgres";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../.postgres_data");

async function main() {
  console.log("Iniciando PostgreSQL local em .postgres_data...");

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    port: 5432,
    user: "drophub_user",
    password: "drophub_secure_pass",
    initialDatabase: "drophub_db",
    persistent: true,
  });

  await pg.initialise();
  await pg.start();

  console.log("PostgreSQL iniciado com sucesso na porta 5432!");
  console.log("Database: drophub_db | User: drophub_user");

  // Manter o processo vivo
  process.on("SIGINT", async () => {
    console.log("Encerrando PostgreSQL...");
    await pg.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Erro ao iniciar PostgreSQL local:", err);
  process.exit(1);
});
