import { prisma } from "../src/lib/prisma.js";

async function reportCounts() {
  const [
    users,
    suppliers,
    categories,
    products,
    productImages,
    productVariants,
    customers,
    customerAddresses,
    orders,
    orderItems,
    orderStatusHistories,
    payments,
    shipments,
    trackings,
    expenses,
    settings,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.supplier.count(),
    prisma.category.count(),
    prisma.product.count(),
    prisma.productImage.count(),
    prisma.productVariant.count(),
    prisma.customer.count(),
    prisma.customerAddress.count(),
    prisma.order.count(),
    prisma.orderItem.count(),
    prisma.orderStatusHistory.count(),
    prisma.payment.count(),
    prisma.shipment.count(),
    prisma.tracking.count(),
    prisma.expense.count(),
    prisma.systemSetting.count(),
  ]);

  console.log("=== CONTAGEM DE REGISTROS NO BANCO DE DADOS ===");
  console.log(`- Usuários (Admin/Op): ${users}`);
  console.log(`- Fornecedores: ${suppliers}`);
  console.log(`- Categorias: ${categories}`);
  console.log(`- Produtos: ${products}`);
  console.log(`- Imagens de Produtos: ${productImages}`);
  console.log(`- Variações de Produtos: ${productVariants}`);
  console.log(`- Clientes: ${customers}`);
  console.log(`- Endereços de Clientes: ${customerAddresses}`);
  console.log(`- Pedidos: ${orders}`);
  console.log(`- Itens de Pedidos: ${orderItems}`);
  console.log(`- Histórico de Status (Auditoria): ${orderStatusHistories}`);
  console.log(`- Pagamentos: ${payments}`);
  console.log(`- Envios/Remessas: ${shipments}`);
  console.log(`- Eventos de Rastreamento: ${trackings}`);
  console.log(`- Despesas Financeiras: ${expenses}`);
  console.log(`- Configurações do Sistema: ${settings}`);
  console.log("===============================================");
}

reportCounts().catch(console.error);
