import { PrismaClient, Role, ProductStatus, OrderStatus, PaymentStatus, PaymentMethod, ExpenseCategory } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando Seed do DropHub com dados realistas...");

  // Limpeza prévia (em ordem correta para foreign keys)
  await prisma.tracking.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customerAddress.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();
  await prisma.systemSetting.deleteMany();

  // 1. ADMIN
  const passwordHash = await bcrypt.hash("admin123456", 10);
  const admin = await prisma.user.create({
    data: {
      name: "Administrador DropHub",
      email: "admin@drophub.com",
      passwordHash,
      role: Role.ADMIN,
    },
  });
  console.log(`✓ Admin criado: ${admin.email}`);

  // 2. FORNECEDORES (3 Fictícios)
  const supplier1 = await prisma.supplier.create({
    data: {
      name: "GlobalTech Electronics Direct",
      contactName: "Chen Wei",
      email: "contato@globaltech-ficticio.com",
      phone: "+86 138 0013 8000",
      website: "https://globaltech-ficticio.com",
      notes: "Fornecedor principal de smartwatches, fones e periféricos com envio ePacket / YunExpress.",
      active: true,
    },
  });

  const supplier2 = await prisma.supplier.create({
    data: {
      name: "NovaModa Dropship Brasil",
      contactName: "Juliana Mendes",
      email: "contato@novamoda-ficticio.com.br",
      phone: "(11) 98765-4321",
      website: "https://novamoda-ficticio.com.br",
      notes: "Fornecedor nacional de vestuário e acessórios. Envio via Sedex/J&T em 24h.",
      active: true,
    },
  });

  const supplier3 = await prisma.supplier.create({
    data: {
      name: "Casa & Estilo Imports",
      contactName: "Rodrigo Sanches",
      email: "vendas@casaestilo-ficticio.com",
      phone: "(47) 99123-4567",
      website: "https://casaestilo-ficticio.com",
      notes: "Utensílios inteligentes e iluminação para casa e escritório.",
      active: true,
    },
  });
  console.log("✓ 3 Fornecedores criados.");

  // 3. CATEGORIAS (4 Categorias)
  const catEletronicos = await prisma.category.create({
    data: {
      name: "Eletrônicos & Smart Gadgets",
      slug: "eletronicos-e-smart-gadgets",
      description: "Dispositivos inteligentes, fones sem fio, smartwatches e acessórios tech.",
    },
  });

  const catCasa = await prisma.category.create({
    data: {
      name: "Casa & Cozinha Inteligente",
      slug: "casa-e-cozinha-inteligente",
      description: "Organização, iluminação e utensílios que facilitam a rotina doméstica.",
    },
  });

  const catModa = await prisma.category.create({
    data: {
      name: "Moda & Acessórios Premium",
      slug: "moda-e-acessorios",
      description: "Mochilas funcionais, carteiras anti-furto e relógios elegantes.",
    },
  });

  const catSaude = await prisma.category.create({
    data: {
      name: "Saúde, Fitness & Bem-Estar",
      slug: "saude-e-bem-estar",
      description: "Massageadores elétricos, garrafas térmicas inteligentes e postura.",
    },
  });
  console.log("✓ 4 Categorias criadas.");

  // 4. PRODUTOS (12 Produtos com margens e custos variados)
  const productsData = [
    {
      name: "Fone de Ouvido Bluetooth Pro Noise-Cancelling",
      slug: "fone-bluetooth-pro-noise-cancelling",
      sku: "GAD-AUD-001",
      description: "Fone com tecnologia ANC avançada de cancelamento ativo de ruído, bateria de 30 horas e conexão multiponto Bluetooth 5.3.",
      shortDescription: "Cancelamento de ruído ativo e 30h de bateria.",
      categoryId: catEletronicos.id,
      supplierId: supplier1.id,
      costPrice: 65.0,
      sellingPrice: 169.9, // Lucro: 104.90 | Margem: 61.7% | Markup: 161.4%
      stock: 45,
      status: ProductStatus.ACTIVE,
      images: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80"],
    },
    {
      name: "Smartwatch Ultra Titanium Series 9",
      slug: "smartwatch-ultra-titanium-series-9",
      sku: "GAD-WCH-002",
      description: "Relógio inteligente com tela AMOLED de 2.02 polegadas, caixa em titânio, monitoramento cardíaco, GPS integrado e NFC para pagamentos.",
      shortDescription: "Tela AMOLED 2.02\" e caixa em liga de titânio.",
      categoryId: catEletronicos.id,
      supplierId: supplier1.id,
      costPrice: 110.0,
      sellingPrice: 249.9, // Lucro: 139.90 | Margem: 56.0% | Markup: 127.2%
      stock: 30,
      status: ProductStatus.ACTIVE,
      images: ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80"],
    },
    {
      name: "Luminária de Mesa LED Articulada Touch com Carregador por Indução",
      slug: "luminaria-led-articulada-touch-inducao",
      sku: "HOM-LMP-003",
      description: "Luminária articulada com 3 tons de luz (quente, neutra e fria), controle de intensidade touch e base com carregador wireless QI 15W.",
      shortDescription: "3 modos de cor e carregador sem fio 15W na base.",
      categoryId: catCasa.id,
      supplierId: supplier3.id,
      costPrice: 42.0,
      sellingPrice: 119.9, // Lucro: 77.90 | Margem: 65.0% | Markup: 185.5%
      stock: 25,
      status: ProductStatus.ACTIVE,
      images: ["https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&auto=format&fit=crop&q=80"],
    },
    {
      name: "Mini Processador e Triturador de Alimentos Elétrico USB",
      slug: "mini-processador-alimentos-eletrico-usb",
      sku: "HOM-KIT-004",
      description: "Triturador compacto sem fio com 3 lâminas em aço inoxidável e bateria recarregável via USB-C. Ideal para alho, cebola e temperos em segundos.",
      shortDescription: "Sem fio, 3 lâminas inox e recarga rápida via USB.",
      categoryId: catCasa.id,
      supplierId: supplier3.id,
      costPrice: 18.5,
      sellingPrice: 59.9, // Lucro: 41.40 | Margem: 69.1% | Markup: 223.8%
      stock: 80,
      status: ProductStatus.ACTIVE,
      images: ["https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=600&auto=format&fit=crop&q=80"],
    },
    {
      name: "Mochila Executiva Impermeável Antifurto com Trava TSA e Saída USB",
      slug: "mochila-executiva-impermeavel-antifurto",
      sku: "MOD-BCK-005",
      description: "Mochila para notebook de até 17.3 polegadas, tecido Oxford impermeável militar, zíperes ocultos, trava numérica TSA e alças ergonômicas.",
      shortDescription: "Impermeável, suporte a notebook 17\" e trava TSA.",
      categoryId: catModa.id,
      supplierId: supplier2.id,
      costPrice: 75.0,
      sellingPrice: 189.9, // Lucro: 114.90 | Margem: 60.5% | Markup: 153.2%
      stock: 20,
      status: ProductStatus.ACTIVE,
      images: ["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80"],
    },
    {
      name: "Carteira Minimalista Slim em Fibra de Carbono com Proteção RFID",
      slug: "carteira-slim-fibra-de-carbono-rfid",
      sku: "MOD-WLT-006",
      description: "Carteira ultra compacta em alumínio aeroespacial e placas de fibra de carbono real. Ejeção rápida com um clique e bloqueio anti-clonagem RFID.",
      shortDescription: "Ejeção rápida de cartões e bloqueio RFID antifurto.",
      categoryId: catModa.id,
      supplierId: supplier2.id,
      costPrice: 22.0,
      sellingPrice: 69.9, // Lucro: 47.90 | Margem: 68.5% | Markup: 217.7%
      stock: 60,
      status: ProductStatus.ACTIVE,
      images: ["https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&auto=format&fit=crop&q=80"],
    },
    {
      name: "Pistola Massageadora Muscular Elétrica Fascial Gun 6 Velocidades",
      slug: "pistola-massageadora-muscular-fascial-gun",
      sku: "SAU-MSG-007",
      description: "Massageador de percussão profissional com motor brushless silencioso, 6 níveis de intensidade e 4 cabeças intercambiáveis para alívio muscular pós-treino.",
      shortDescription: "Motor ultra silencioso, 6 velocidades e 4 ponteiras.",
      categoryId: catSaude.id,
      supplierId: supplier1.id,
      costPrice: 48.0,
      sellingPrice: 129.9, // Lucro: 81.90 | Margem: 63.0% | Markup: 170.6%
      stock: 35,
      status: ProductStatus.ACTIVE,
      images: ["https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&auto=format&fit=crop&q=80"],
    },
    {
      name: "Garrafa Térmica Inteligente com Sensor Digital de Temperatura LED 500ml",
      slug: "garrafa-termica-inteligente-sensor-led",
      sku: "SAU-BOT-008",
      description: "Garrafa a vácuo em aço inox 304 com infusor de chá integrado. Display touch na tampa que indica a temperatura exata do líquido em tempo real.",
      shortDescription: "Display LED com indicador de temperatura touch.",
      categoryId: catSaude.id,
      supplierId: supplier3.id,
      costPrice: 19.0,
      sellingPrice: 59.9, // Lucro: 40.90 | Margem: 68.3% | Markup: 215.3%
      stock: 50,
      status: ProductStatus.ACTIVE,
      images: ["https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&auto=format&fit=crop&q=80"],
    },
    {
      name: "Teclado Mecânico Compacto 60% RGB Switch Blue Hot-Swappable",
      slug: "teclado-mecanico-compacto-60-rgb-switch-blue",
      sku: "GAD-KBD-009",
      description: "Teclado gamer 61 teclas formato compacto com iluminação RGB personalizável, cabo tipo-C removível e switches azuis de alta resposta tátil.",
      shortDescription: "Layout 60% compacto com iluminação RGB e USB-C.",
      categoryId: catEletronicos.id,
      supplierId: supplier1.id,
      costPrice: 62.0,
      sellingPrice: 159.9, // Lucro: 97.90 | Margem: 61.2% | Markup: 157.9%
      stock: 15,
      status: ProductStatus.ACTIVE,
      images: ["https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80"],
    },
    {
      name: "Dispensador Automático de Sabonete e Álcool em Gel com Sensor Infravermelho",
      slug: "dispensador-automatico-sabonete-sensor",
      sku: "HOM-DSP-010",
      description: "Dispenser touchless de 350ml com detecção em 0.25s, controle de fluxo e vedação IPX4 à prova de respingos para banheiros e cozinhas.",
      shortDescription: "Sensor infravermelho de 0.25s e capacidade de 350ml.",
      categoryId: catCasa.id,
      supplierId: supplier3.id,
      costPrice: 24.0,
      sellingPrice: 69.9, // Lucro: 45.90 | Margem: 65.7% | Markup: 191.2%
      stock: 40,
      status: ProductStatus.ACTIVE,
      images: ["https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80"],
    },
    // Produto Rascunho / Inativo (para validar filtros de status)
    {
      name: "Projetor Portátil Smart Cinema Full HD 4K Android",
      slug: "projetor-portatil-smart-cinema-4k",
      sku: "GAD-PRJ-011",
      description: "Mini projetor portátil com Android integrado, Wi-Fi 6, alto-falante estéreo e rotação de 180 graus.",
      shortDescription: "Projeção até 130 polegadas com rotação de 180°.",
      categoryId: catEletronicos.id,
      supplierId: supplier1.id,
      costPrice: 180.0,
      sellingPrice: 389.9,
      stock: 0,
      status: ProductStatus.DRAFT,
      images: ["https://images.unsplash.com/photo-1535016120720-40c646be5580?w=600&auto=format&fit=crop&q=80"],
    },
    {
      name: "Jaqueta Corta-Vento Esportiva Impermeável e Refletiva",
      slug: "jaqueta-corta-vento-esportiva-impermeavel",
      sku: "MOD-JKT-012",
      description: "Jaqueta ultra leve para corrida e ciclismo com membrana respirável e detalhes refletivos de alta visibilidade noturna.",
      shortDescription: "Ultra leve, impermeável e com detalhes refletivos.",
      categoryId: catModa.id,
      supplierId: supplier2.id,
      costPrice: 50.0,
      sellingPrice: 119.9,
      stock: 0,
      status: ProductStatus.ARCHIVED,
      images: ["https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&auto=format&fit=crop&q=80"],
    },
  ];

  const createdProducts = [];
  for (const p of productsData) {
    const { images, ...prodFields } = p;
    const prod = await prisma.product.create({
      data: {
        ...prodFields,
        images: {
          create: images.map((url, idx) => ({
            url,
            isCover: idx === 0,
            position: idx,
            altText: prodFields.name,
          })),
        },
      },
    });
    createdProducts.push(prod);
  }
  console.log(`✓ ${createdProducts.length} Produtos cadastrados com imagens.`);

  // 5. CLIENTES FICTÍCIOS (5 Clientes com endereços completos)
  const customersData = [
    {
      name: "Lucas Ferreira Lima",
      email: "lucas.lima.ficticio@exemplo.com.br",
      cpf: "11122233344",
      phone: "(11) 98111-2233",
      notes: "Cliente VIP, gosta de gadgets eletrônicos.",
      address: {
        street: "Avenida Paulista",
        number: "1578",
        complement: "Apto 102",
        neighborhood: "Bela Vista",
        city: "São Paulo",
        state: "SP",
        postalCode: "01310200",
      },
    },
    {
      name: "Camila Rodrigues Silva",
      email: "camila.silva.ficticio@exemplo.com.br",
      cpf: "22233344455",
      phone: "(21) 98222-3344",
      notes: "Costuma comprar itens para casa e decoração.",
      address: {
        street: "Rua Visconde de Pirajá",
        number: "414",
        complement: "Bloco B",
        neighborhood: "Ipanema",
        city: "Rio de Janeiro",
        state: "RJ",
        postalCode: "22410002",
      },
    },
    {
      name: "Marcos Vinicius Santos",
      email: "marcos.santos.ficticio@exemplo.com.br",
      cpf: "33344455566",
      phone: "(31) 98333-4455",
      notes: "Cliente esportista e adepto a acessórios funcionais.",
      address: {
        street: "Avenida Afonso Pena",
        number: "2600",
        complement: "Sala 5",
        neighborhood: "Funcionários",
        city: "Belo Horizonte",
        state: "MG",
        postalCode: "30130007",
      },
    },
    {
      name: "Beatriz Cristina Alves",
      email: "beatriz.alves.ficticio@exemplo.com.br",
      cpf: "44455566677",
      phone: "(41) 98444-5566",
      notes: "Cliente frequente de moda e ergonomia.",
      address: {
        street: "Rua XV de Novembro",
        number: "780",
        complement: "",
        neighborhood: "Centro",
        city: "Curitiba",
        state: "PR",
        postalCode: "80020310",
      },
    },
    {
      name: "Rafael Guimarães Costa",
      email: "rafael.costa.ficticio@exemplo.com.br",
      cpf: "55566677788",
      phone: "(51) 98555-6677",
      notes: "Primeira compra na loja.",
      address: {
        street: "Avenida Borges de Medeiros",
        number: "1200",
        complement: "Conjunto 401",
        neighborhood: "Praia de Belas",
        city: "Porto Alegre",
        state: "RS",
        postalCode: "90110150",
      },
    },
  ];

  const createdCustomers = [];
  for (const c of customersData) {
    const { address, ...custFields } = c;
    const cust = await prisma.customer.create({
      data: {
        ...custFields,
        addresses: {
          create: {
            ...address,
            isDefault: true,
          },
        },
      },
      include: { addresses: true },
    });
    createdCustomers.push(cust);
  }
  console.log(`✓ ${createdCustomers.length} Clientes criados com endereços completos.`);

  // 6. PEDIDOS FICTÍCIOS (11 Pedidos distribuídos entre todos os status)
  const ordersSeedConfig = [
    {
      orderNumber: "DH-1001",
      customer: createdCustomers[0],
      status: OrderStatus.DELIVERED,
      productIndex: 0, // Fone Bluetooth
      quantity: 1,
      shippingCost: 0.0,
      paid: true,
      trackingNumber: "NL876543210BR",
      carrier: "Correios",
    },
    {
      orderNumber: "DH-1002",
      customer: createdCustomers[1],
      status: OrderStatus.DELIVERED,
      productIndex: 2, // Luminaria LED
      quantity: 2,
      shippingCost: 15.0,
      paid: true,
      trackingNumber: "JT987654321BR",
      carrier: "J&T Express",
    },
    {
      orderNumber: "DH-1003",
      customer: createdCustomers[2],
      status: OrderStatus.SHIPPED,
      productIndex: 1, // Smartwatch Ultra
      quantity: 1,
      shippingCost: 0.0,
      paid: true,
      trackingNumber: "BR123456789CN",
      carrier: "Cainiao Express",
    },
    {
      orderNumber: "DH-1004",
      customer: createdCustomers[3],
      status: OrderStatus.SENT_TO_SUPPLIER,
      productIndex: 4, // Mochila Executiva
      quantity: 1,
      shippingCost: 18.0,
      paid: true,
    },
    {
      orderNumber: "DH-1005",
      customer: createdCustomers[4],
      status: OrderStatus.PROCESSING,
      productIndex: 6, // Pistola Massageadora
      quantity: 1,
      shippingCost: 0.0,
      paid: true,
    },
    {
      orderNumber: "DH-1006",
      customer: createdCustomers[0],
      status: OrderStatus.PAID,
      productIndex: 3, // Mini Processador
      quantity: 3,
      shippingCost: 0.0,
      paid: true,
    },
    {
      orderNumber: "DH-1007",
      customer: createdCustomers[1],
      status: OrderStatus.PAID,
      productIndex: 5, // Carteira Carbono
      quantity: 1,
      shippingCost: 12.0,
      paid: true,
    },
    {
      orderNumber: "DH-1008",
      customer: createdCustomers[2],
      status: OrderStatus.AWAITING_PAYMENT,
      productIndex: 7, // Garrafa Termica LED
      quantity: 2,
      shippingCost: 0.0,
      paid: false,
    },
    {
      orderNumber: "DH-1009",
      customer: createdCustomers[3],
      status: OrderStatus.AWAITING_PAYMENT,
      productIndex: 8, // Teclado Mecanico
      quantity: 1,
      shippingCost: 20.0,
      paid: false,
    },
    {
      orderNumber: "DH-1010",
      customer: createdCustomers[4],
      status: OrderStatus.CANCELLED,
      productIndex: 0, // Fone Bluetooth
      quantity: 1,
      shippingCost: 0.0,
      paid: false,
      reason: "Boleto bancário expirado sem confirmação de pagamento.",
    },
    {
      orderNumber: "DH-1011",
      customer: createdCustomers[1],
      status: OrderStatus.REFUNDED,
      productIndex: 9, // Dispenser
      quantity: 1,
      shippingCost: 0.0,
      paid: true,
      reason: "Solicitação de cancelamento pelo cliente antes do despacho.",
    },
  ];

  for (const cfg of ordersSeedConfig) {
    const product = createdProducts[cfg.productIndex];
    const unitPrice = Number(product.sellingPrice);
    const unitCost = Number(product.costPrice);
    const qty = cfg.quantity;

    const subtotal = Number((unitPrice * qty).toFixed(2));
    const totalCost = Number((unitCost * qty).toFixed(2));
    const totalAmount = Number((subtotal + cfg.shippingCost).toFixed(2));
    const estimatedProfit = Number((totalAmount - totalCost).toFixed(2));
    const margin = Number(((estimatedProfit / totalAmount) * 100).toFixed(2));
    const markup = Number(((estimatedProfit / totalCost) * 100).toFixed(2));

    const order = await prisma.order.create({
      data: {
        orderNumber: cfg.orderNumber,
        customerId: cfg.customer.id,
        status: cfg.status,
        subtotalAmount: subtotal,
        shippingCost: cfg.shippingCost,
        discountAmount: 0.0,
        totalAmount,
        totalCostAmount: totalCost,
        estimatedProfit,
        marginPercentage: margin,
        markupPercentage: markup,
        shippingAddress: {
          name: cfg.customer.name,
          ...cfg.customer.addresses[0],
        },
        items: {
          create: {
            productId: product.id,
            sku: product.sku,
            name: product.name,
            unitCost,
            unitPrice,
            quantity: qty,
            totalCost,
            totalPrice: subtotal,
            profit: Number((subtotal - totalCost).toFixed(2)),
          },
        },
        payments: {
          create: {
            gateway: "TEST_GATEWAY",
            method: PaymentMethod.TEST_MODE,
            status: cfg.paid ? PaymentStatus.APPROVED : PaymentStatus.PENDING,
            amount: totalAmount,
            paidAt: cfg.paid ? new Date() : null,
            transactionId: `TX-TEST-${cfg.orderNumber}`,
          },
        },
        statusHistory: {
          create: [
            {
              previousStatus: OrderStatus.AWAITING_PAYMENT,
              newStatus: cfg.status,
              reason: cfg.reason || "Criação do pedido e atualização automática de fluxo.",
              changedByUserId: admin.id,
            },
          ],
        },
      },
    });

    // Se possui rastreio cadastrado
    if (cfg.trackingNumber) {
      const shipment = await prisma.shipment.create({
        data: {
          orderId: order.id,
          carrier: cfg.carrier,
          trackingNumber: cfg.trackingNumber,
          trackingUrl: `https://rastreamento.correios.com.br/app/index.php?codigo=${cfg.trackingNumber}`,
          status: cfg.status === OrderStatus.DELIVERED ? "DELIVERED" : "IN_TRANSIT",
          shippedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          deliveredAt: cfg.status === OrderStatus.DELIVERED ? new Date() : null,
          trackings: {
            create: [
              {
                status: "POSTADO",
                description: "Objeto postado pelo fornecedor parceiro",
                location: "Centro de Distribuição",
                timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
              },
              {
                status: cfg.status === OrderStatus.DELIVERED ? "ENTREGUE" : "EM_TRANSITO",
                description: cfg.status === OrderStatus.DELIVERED ? "Objeto entregue ao destinatário" : "Objeto em trânsito para a unidade de tratamento",
                location: cfg.customer.addresses[0].city + " - " + cfg.customer.addresses[0].state,
                timestamp: new Date(),
              },
            ],
          },
        },
      });
    }
  }
  console.log(`✓ ${ordersSeedConfig.length} Pedidos completos criados com itens, pagamentos, rastreios e auditoria.`);

  // 7. DESPESAS OPERACIONAIS COERENTES (Financeiro)
  const expensesData = [
    {
      title: "Google Ads - Campanha Fone Bluetooth Pro",
      category: ExpenseCategory.MARKETING,
      amount: 250.0,
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      description: "Tráfego pago no Google Shopping para palavra-chave Fone ANC.",
    },
    {
      title: "Facebook Ads - Campanha Smartwatch Ultra",
      category: ExpenseCategory.MARKETING,
      amount: 180.0,
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      description: "Anúncios em formato Reels/Stories para conversão direta.",
    },
    {
      title: "Registro de Domínio Anual (.com.br)",
      category: ExpenseCategory.DOMAIN,
      amount: 40.0,
      date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      description: "Renovação de domínio no Registro.br.",
    },
    {
      title: "Assinatura Servidor VPS / EasyPanel",
      category: ExpenseCategory.TOOLS,
      amount: 65.0,
      date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      description: "Hospedagem em VPS Linux Hetzner / Hostinger.",
    },
    {
      title: "Embalagens e Etiquetas Térmicas",
      category: ExpenseCategory.LOGISTICS,
      amount: 45.0,
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      description: "Bobinas térmicas para impressão de etiquetas de envio.",
    },
  ];

  for (const exp of expensesData) {
    await prisma.expense.create({
      data: exp,
    });
  }
  console.log(`✓ ${expensesData.length} Despesas operacionais cadastradas.`);

  // 8. CONFIGURAÇÕES GLOBAIS DO SISTEMA
  const settingsData = [
    { key: "STORE_NAME", value: "DropHub Store", description: "Nome público da loja", isSecret: false },
    { key: "SUPPORT_EMAIL", value: "suporte@drophub.com", description: "E-mail de suporte ao cliente", isSecret: false },
    { key: "SUPPORT_WHATSAPP", value: "(11) 98765-4321", description: "WhatsApp de atendimento", isSecret: false },
    { key: "FREE_SHIPPING_THRESHOLD", value: "199.00", description: "Valor mínimo para frete grátis", isSecret: false },
    { key: "WEBHOOK_SECRET_KEY", value: "drophub_webhook_secret_key_123456", description: "Segredo de validação de webhooks", isSecret: true },
  ];

  for (const set of settingsData) {
    await prisma.systemSetting.create({
      data: set,
    });
  }
  console.log(`✓ ${settingsData.length} Configurações globais salvas.`);

  console.log("\n==========================================");
  console.log("SEED CONCLUÍDO COM SUCESSO!");
  console.log("==========================================");
}

main()
  .catch((e) => {
    console.error("Erro ao executar Seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
