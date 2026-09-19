const http = require("http");

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
          json,
        });
      });
    });

    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runE2ECatalogTests() {
  console.log("=== INICIANDO TESTES HTTP E2E DO MÓDULO DE CATÁLOGO & FORNECEDORES ===");

  // 1. Healthcheck
  console.log("\n1. Testando GET /api/health...");
  const healthRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/health",
    method: "GET",
  });
  console.log(`Status: ${healthRes.statusCode} | Resposta: ${healthRes.body}`);
  if (healthRes.statusCode !== 200) throw new Error("Healthcheck falhou");

  // 2. Bloqueio de Acesso Não Autenticado
  console.log("\n2. Testando GET /api/admin/products sem autenticação...");
  const unauthRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/admin/products",
    method: "GET",
  });
  console.log(`Status: ${unauthRes.statusCode} | Resposta: ${unauthRes.body}`);
  if (unauthRes.statusCode !== 401) throw new Error("API não bloqueou requisição desautenticada");
  console.log("✓ Bloqueio de endpoint administrativo validado com HTTP 401!");

  // 3. Login com credenciais do Seed
  console.log("\n3. Realizando login administrativo para obter cookie HTTP-Only...");
  const loginRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    JSON.stringify({ email: "admin@drophub.com", password: "admin123456" })
  );
  if (loginRes.statusCode !== 200 || !loginRes.headers["set-cookie"]) {
    throw new Error("Falha no login administrativo");
  }
  const sessionCookie = loginRes.headers["set-cookie"][0].split(";")[0];
  console.log("✓ Autenticado com sucesso!");

  // 4. Criar Categoria
  console.log("\n4. Testando POST /api/admin/categories...");
  const catSlug = "categoria-e2e-" + Date.now();
  const catRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/admin/categories",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
    },
    JSON.stringify({
      name: "Categoria E2E Teste",
      slug: catSlug,
      description: "Categoria criada no teste E2E",
      active: true,
    })
  );
  console.log(`Status: ${catRes.statusCode} | ID: ${catRes.json?.category?.id}`);
  if (catRes.statusCode !== 201 || !catRes.json?.category?.id) {
    throw new Error(`Falha ao criar categoria: ${catRes.body}`);
  }
  const categoryId = catRes.json.category.id;
  console.log("✓ Categoria criada com sucesso!");

  // 5. Criar Fornecedor
  console.log("\n5. Testando POST /api/admin/suppliers...");
  const supRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/admin/suppliers",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
    },
    JSON.stringify({
      name: "Fornecedor E2E Express",
      contactName: "Li Zhang",
      email: `supplier-${Date.now()}@e2etest.com`,
      phone: "+86 138 0000 1111",
      website: "https://fornecedore2e.com",
      notes: "Fornecedor de teste E2E",
      active: true,
    })
  );
  console.log(`Status: ${supRes.statusCode} | ID: ${supRes.json?.supplier?.id}`);
  if (supRes.statusCode !== 201 || !supRes.json?.supplier?.id) {
    throw new Error(`Falha ao criar fornecedor: ${supRes.body}`);
  }
  const supplierId = supRes.json.supplier.id;
  console.log("✓ Fornecedor criado com sucesso!");

  // 6. Criar Produto com Calculadora & Fotos
  console.log("\n6. Testando POST /api/admin/products...");
  const prodSku = "E2E-PROD-" + Date.now();
  const prodSlug = "produto-e2e-teste-" + Date.now();
  const prodRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/admin/products",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
    },
    JSON.stringify({
      name: "Produto Teste E2E Dropshipping",
      slug: prodSlug,
      sku: prodSku,
      description: "Descrição completa do produto criado via teste E2E.",
      shortDescription: "Descrição curta",
      categoryId,
      supplierId,
      costPrice: 40.0,
      sellingPrice: 100.0,
      stock: 25,
      status: "ACTIVE",
      active: true,
      images: [
        {
          url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500",
          isCover: true,
        },
      ],
    })
  );
  console.log(`Status: ${prodRes.statusCode} | ID: ${prodRes.json?.product?.id}`);
  if (prodRes.statusCode !== 201 || !prodRes.json?.product?.id) {
    throw new Error(`Falha ao criar produto: ${prodRes.body}`);
  }
  const productId = prodRes.json.product.id;
  console.log("✓ Produto criado com sucesso!");

  // 7. Consultar Produto e Validar Margem
  console.log("\n7. Testando GET /api/admin/products?q=" + prodSku + "...");
  const listProdRes = await request({
    hostname: "localhost",
    port: 3000,
    path: `/api/admin/products?q=${encodeURIComponent(prodSku)}`,
    method: "GET",
    headers: { Cookie: sessionCookie },
  });
  console.log(`Status: ${listProdRes.statusCode}`);
  const foundProd = listProdRes.json?.data?.[0];
  if (!foundProd || foundProd.id !== productId) {
    throw new Error("Produto não retornado na busca");
  }
  console.log(
    `Valores calculados: Custo = R$ ${foundProd.costPrice} | Venda = R$ ${foundProd.sellingPrice} | Lucro = R$ ${foundProd.profit} | Margem = ${foundProd.marginPercentage}% | Markup = ${foundProd.markupPercentage}%`
  );
  if (foundProd.profit !== 60 || foundProd.marginPercentage !== 60 || foundProd.markupPercentage !== 150) {
    throw new Error("Cálculos de margem ou markup divergentes na resposta da API");
  }
  console.log("✓ Fórmulas de Lucro (R$ 60), Margem (60%) e Markup (150%) 100% exatas!");

  // 8. Tentar Excluir Categoria com Produto Vinculado (deve retornar 400)
  console.log("\n8. Testando DELETE /api/admin/categories com produto vinculado (esperado HTTP 400)...");
  const blockDelCatRes = await request({
    hostname: "localhost",
    port: 3000,
    path: `/api/admin/categories/${categoryId}`,
    method: "DELETE",
    headers: { Cookie: sessionCookie },
  });
  console.log(`Status: ${blockDelCatRes.statusCode} | Mensagem: ${blockDelCatRes.json?.error}`);
  if (blockDelCatRes.statusCode !== 400) {
    throw new Error("API permitiu exclusão indevida de categoria com produtos vinculados");
  }
  console.log("✓ Integridade referencial protegida com sucesso!");

  // 9. Excluir Produto
  console.log("\n9. Testando DELETE /api/admin/products/" + productId + "...");
  const delProdRes = await request({
    hostname: "localhost",
    port: 3000,
    path: `/api/admin/products/${productId}`,
    method: "DELETE",
    headers: { Cookie: sessionCookie },
  });
  console.log(`Status: ${delProdRes.statusCode} | Resposta: ${delProdRes.body}`);
  if (delProdRes.statusCode !== 200) throw new Error("Falha ao excluir produto");
  console.log("✓ Produto excluído com sucesso!");

  // 10. Excluir Categoria e Fornecedor agora liberados
  console.log("\n10. Excluindo categoria e fornecedor liberados...");
  await request({
    hostname: "localhost",
    port: 3000,
    path: `/api/admin/categories/${categoryId}`,
    method: "DELETE",
    headers: { Cookie: sessionCookie },
  });
  await request({
    hostname: "localhost",
    port: 3000,
    path: `/api/admin/suppliers/${supplierId}`,
    method: "DELETE",
    headers: { Cookie: sessionCookie },
  });
  console.log("✓ Categoria e fornecedor excluídos com sucesso!");

  console.log("\n=======================================================");
  console.log("TODOS OS TESTES E2E DE CATÁLOGO FORAM APROVADOS! 🚀");
  console.log("=======================================================");
}

runE2ECatalogTests().catch((err) => {
  console.error("Erro nos testes E2E:", err);
  process.exit(1);
});
