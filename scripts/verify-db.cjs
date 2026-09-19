const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function verify() {
  console.log("Verificando tabelas no PostgreSQL...");

  const tables = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC;
  `;

  console.log(`Total de tabelas encontradas no schema public: ${tables.length}`);
  tables.forEach((t, i) => console.log(`  ${i + 1}. ${t.table_name}`));

  await prisma.$disconnect();
}

verify().catch((err) => {
  console.error("Erro na verificação:", err);
  process.exit(1);
});
