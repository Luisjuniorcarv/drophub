const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const duplicates = await prisma.$queryRaw`
    SELECT "idempotencyKey", COUNT(*) 
    FROM "Payment" 
    WHERE "idempotencyKey" IS NOT NULL 
    GROUP BY "idempotencyKey" 
    HAVING COUNT(*) > 1
  `;
  console.log("Duplicate idempotency keys found:", duplicates);

  const totalPayments = await prisma.payment.count();
  console.log("Total payments count:", totalPayments);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
