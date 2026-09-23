const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("Adicionando os 2 produtos de Marmita Fit no catálogo do DropHub...");

  // 1. Localiza ou cria a Categoria
  let category = await prisma.category.findFirst({
    where: {
      OR: [
        { slug: "casa-e-cozinha-inteligente" },
        { name: { contains: "Cozinha", mode: "insensitive" } },
      ],
    },
  });

  if (!category) {
    category = await prisma.category.create({
      data: {
        name: "Casa & Cozinha Inteligente",
        slug: "casa-e-cozinha-inteligente",
        description: "Organização, utensílios funcionais e marmitas térmicas para sua rotina.",
        active: true,
      },
    });
    console.log("✓ Categoria 'Casa & Cozinha Inteligente' criada.");
  }

  // 2. Localiza ou cria o Fornecedor
  let supplier = await prisma.supplier.findFirst({
    where: {
      OR: [
        { name: { contains: "Casa", mode: "insensitive" } },
        { name: { contains: "Imports", mode: "insensitive" } },
      ],
    },
  });

  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: {
        name: "Casa & Estilo Imports",
        contactName: "Rodrigo Sanches",
        email: "vendas@casaestilo-ficticio.com",
        phone: "(47) 99123-4567",
        active: true,
      },
    });
    console.log("✓ Fornecedor 'Casa & Estilo Imports' criado.");
  }

  // ==========================================
  // PRODUTO 1: Marmita Fit em Vidro Borossilicato
  // ==========================================
  const glassProduct = await prisma.product.upsert({
    where: { sku: "HOM-KIT-013" },
    update: {
      name: "Marmita Fit Hermética em Vidro Borossilicato com Divisórias Anti-Vazamento 1040ml",
      slug: "marmita-fit-vidro-borossilicato-divisorias-hermetica",
      description: "A solução definitiva para quem leva uma rotina saudável e fitness a sério. Fabricada em vidro borossilicato de alta resistência térmica (-20°C a 400°C), suporta micro-ondas, forno e freezer sem risco de choque térmico. 100% livre de BPA, não absorve manchas, gordura nem odores. Conta com tampa hermética com 4 travas reforçadas e anel de silicone que garante vedação total anti-vazamento, além de divisórias internas de vidro para separar os alimentos com perfeição.",
      shortDescription: "Vidro borossilicato térmico (-20°C a 400°C), tampa hermética 4 travas, livre de BPA e divisórias internas.",
      costPrice: 28.0,
      sellingPrice: 79.9,
      stock: 45,
      status: "ACTIVE",
      active: true,
      categoryId: category.id,
      supplierId: supplier.id,
    },
    create: {
      sku: "HOM-KIT-013",
      name: "Marmita Fit Hermética em Vidro Borossilicato com Divisórias Anti-Vazamento 1040ml",
      slug: "marmita-fit-vidro-borossilicato-divisorias-hermetica",
      description: "A solução definitiva para quem leva uma rotina saudável e fitness a sério. Fabricada em vidro borossilicato de alta resistência térmica (-20°C a 400°C), suporta micro-ondas, forno e freezer sem risco de choque térmico. 100% livre de BPA, não absorve manchas, gordura nem odores. Conta com tampa hermética com 4 travas reforçadas e anel de silicone que garante vedação total anti-vazamento, além de divisórias internas de vidro para separar os alimentos com perfeição.",
      shortDescription: "Vidro borossilicato térmico (-20°C a 400°C), tampa hermética 4 travas, livre de BPA e divisórias internas.",
      costPrice: 28.0,
      sellingPrice: 79.9,
      stock: 45,
      status: "ACTIVE",
      active: true,
      categoryId: category.id,
      supplierId: supplier.id,
      images: {
        create: [
          {
            url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80",
            isCover: true,
            position: 0,
            altText: "Marmita Fit Vidro Borossilicato com Divisórias",
          },
          {
            url: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80",
            isCover: false,
            position: 1,
            altText: "Refeição saudável organizada em marmita hermética",
          },
        ],
      },
      variants: {
        create: [
          {
            sku: "HOM-KIT-013-2DIV",
            name: "Vidro Borossilicato - 2 Divisórias (1040ml)",
            attributesJson: { material: "Vidro Borossilicato", divisorias: "2 Divisórias", capacidade: "1040ml" },
            costPrice: 28.0,
            sellingPrice: 79.9,
            stock: 25,
            active: true,
          },
          {
            sku: "HOM-KIT-013-3DIV",
            name: "Vidro Borossilicato - 3 Divisórias (1040ml)",
            attributesJson: { material: "Vidro Borossilicato", divisorias: "3 Divisórias", capacidade: "1040ml" },
            costPrice: 30.0,
            sellingPrice: 84.9,
            stock: 20,
            active: true,
          },
        ],
      },
    },
  });
  console.log(`✓ Produto 1 cadastrado/atualizado: ${glassProduct.name} (SKU: ${glassProduct.sku})`);

  // ==========================================
  // PRODUTO 2: Marmita Bento Box Ecológica
  // ==========================================
  const ecoProduct = await prisma.product.upsert({
    where: { sku: "HOM-KIT-014" },
    update: {
      name: "Marmita Bento Box Fit Ecológica Reutilizável com Compartimentos e Talheres Inclusos",
      slug: "marmita-bento-box-ecologica-reutilizavel-talheres",
      description: "Praticidade, sustentabilidade e leveza para o seu dia a dia e treino. A Marmita Bento Box Ecológica é confeccionada em fibra de palha de trigo natural combinada com polipropileno alimentício de grau premium, livre de BPA e 100% reciclável e reutilizável. Possui 3 compartimentos vedados, travas duplas seguras, resistência a quedas acidentais e vem com conjunto de talheres reutilizáveis (garfo e colher) acoplados na tampa.",
      shortDescription: "Fibra de trigo ecológica, ultraleve, 3 compartimentos empilháveis e talheres inclusos.",
      costPrice: 18.0,
      sellingPrice: 54.9,
      stock: 60,
      status: "ACTIVE",
      active: true,
      categoryId: category.id,
      supplierId: supplier.id,
    },
    create: {
      sku: "HOM-KIT-014",
      name: "Marmita Bento Box Fit Ecológica Reutilizável com Compartimentos e Talheres Inclusos",
      slug: "marmita-bento-box-ecologica-reutilizavel-talheres",
      description: "Praticidade, sustentabilidade e leveza para o seu dia a dia e treino. A Marmita Bento Box Ecológica é confeccionada em fibra de palha de trigo natural combinada com polipropileno alimentício de grau premium, livre de BPA e 100% reciclável e reutilizável. Possui 3 compartimentos vedados, travas duplas seguras, resistência a quedas acidentais e vem com conjunto de talheres reutilizáveis (garfo e colher) acoplados na tampa.",
      shortDescription: "Fibra de trigo ecológica, ultraleve, 3 compartimentos empilháveis e talheres inclusos.",
      costPrice: 18.0,
      sellingPrice: 54.9,
      stock: 60,
      status: "ACTIVE",
      active: true,
      categoryId: category.id,
      supplierId: supplier.id,
      images: {
        create: [
          {
            url: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80",
            isCover: true,
            position: 0,
            altText: "Bento Box Ecológica em Fibra de Trigo",
          },
          {
            url: "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=800&auto=format&fit=crop&q=80",
            isCover: false,
            position: 1,
            altText: "Marmita compacta e leve para refeições saudáveis",
          },
        ],
      },
      variants: {
        create: [
          {
            sku: "HOM-KIT-014-GRN",
            name: "Bento Box Ecológica - Verde Menta",
            attributesJson: { cor: "Verde Menta", material: "Fibra de Trigo", compartimentos: "3" },
            costPrice: 18.0,
            sellingPrice: 54.9,
            stock: 25,
            active: true,
          },
          {
            sku: "HOM-KIT-014-PNK",
            name: "Bento Box Ecológica - Rosa Quartzo",
            attributesJson: { cor: "Rosa Quartzo", material: "Fibra de Trigo", compartimentos: "3" },
            costPrice: 18.0,
            sellingPrice: 54.9,
            stock: 20,
            active: true,
          },
          {
            sku: "HOM-KIT-014-BGE",
            name: "Bento Box Ecológica - Bege Aveia",
            attributesJson: { cor: "Bege Aveia", material: "Fibra de Trigo", compartimentos: "3" },
            costPrice: 18.0,
            sellingPrice: 54.9,
            stock: 15,
            active: true,
          },
        ],
      },
    },
  });
  console.log(`✓ Produto 2 cadastrado/atualizado: ${ecoProduct.name} (SKU: ${ecoProduct.sku})`);

  console.log("\nCadastro concluído com sucesso!");
  console.log("-----------------------------------------");
  console.log("1. Vidro Borossilicato: R$ 79,90 (Custo R$ 28,00 | Lucro: R$ 51,90 | Margem: 64.9%)");
  console.log("2. Bento Box Ecológica: R$ 54,90 (Custo R$ 18,00 | Lucro: R$ 36,90 | Margem: 67.2%)");
  console.log("-----------------------------------------");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Erro ao cadastrar produtos:", err);
  process.exit(1);
});
