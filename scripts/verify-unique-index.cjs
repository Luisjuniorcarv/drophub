const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const indexes = await prisma.$queryRaw`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'Payment' AND indexname LIKE '%idempotency%';
  `;
  console.log("Indexes on Payment.idempotencyKey:", indexes);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
