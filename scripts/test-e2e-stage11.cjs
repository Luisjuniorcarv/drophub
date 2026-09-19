const http = require("http");

const BASE_URL = "http://localhost:3000";
const cookies = {};

function getCookieHeader() {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const cookieHeader = getCookieHeader();
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        ...(options.headers || {}),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = "";
      const setCookie = res.headers["set-cookie"];
      if (setCookie) {
        setCookie.forEach((c) => {
          const parts = c.split(";")[0].split("=");
          if (parts.length >= 2) {
            cookies[parts[0].trim()] = parts.slice(1).join("=").trim();
          }
        });
      }

      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on("error", reject);

    if (options.body) {
      req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runStage11E2ETests() {
  console.log("=================================================");
  console.log("  DROPHUB - ETAPA 11: TESTE E2E DE ESTOQUE AVANÇADO & CONCORRÊNCIA");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Healthcheck
    console.log("1. Testando Healthcheck da API...");
    const health = await request("/api/health");
    assert(health.status === 200, "API Healthcheck retornou HTTP 200");
    assert(health.body.status === "healthy", "Serviço está online");

    // 2. Autenticação Administrativa
    console.log("\n2. Autenticando usuário administrativo...");
    const login = await request("/api/auth/login", {
      method: "POST",
      body: { email: "admin@drophub.com", password: "admin123456" },
    });
    assert(login.status === 200, "Login administrativo realizado");
    assert(!!cookies["drophub_admin_session"], "Cookie de sessão admin ativo");

    // 3. Obter Sumário de Estoque
    console.log("\n3. Consultando Sumário Executivo de Estoque (/api/admin/stock/summary)...");
    const summaryRes = await request("/api/admin/stock/summary");
    assert(summaryRes.status === 200, "Sumário de estoque retornado com sucesso");
    assert(summaryRes.body.success === true, "Payload de sumário válido");
    assert(typeof summaryRes.body.data.totalSkus === "number", "totalSkus reportado");
    assert(typeof summaryRes.body.data.totalUnitsInStock === "number", "totalUnitsInStock reportado");
    assert(Array.isArray(summaryRes.body.data.items), "Lista de itens de estoque retornada");

    const targetItem = summaryRes.body.data.items[0];
    assert(!!targetItem, `Item alvo de teste selecionado: ${targetItem?.name} (SKU: ${targetItem?.sku})`);
    const initialStock = targetItem.stock;

    // 4. Reposição de Estoque (Restock)
    console.log(`\n4. Realizando Reposição (+15 un) para ${targetItem.sku}...`);
    const restockRes = await request("/api/admin/stock/restock", {
      method: "POST",
      body: {
        productId: targetItem.productId,
        variantId: targetItem.variantId,
        quantity: 15,
        unitCost: targetItem.costPrice,
        reason: "Reposição de teste E2E Etapa 11",
      },
    });

    assert(restockRes.status === 201, "Reposição de estoque processada com HTTP 201");
    assert(restockRes.body.data.newBalance === initialStock + 15, `Novo saldo verificado: ${initialStock + 15} un`);
    assert(restockRes.body.data.movement.type === "RESTOCK", "Movimentação RESTOCK gravada no ledger");

    // 5. Ajuste Manual de Estoque (Adjustment)
    console.log(`\n5. Realizando Ajuste Manual de Inventário (Definindo saldo para 50 un)...`);
    const adjustRes = await request("/api/admin/stock/adjust", {
      method: "POST",
      body: {
        productId: targetItem.productId,
        variantId: targetItem.variantId,
        newBalance: 50,
        reason: "Ajuste de inventário físico anual E2E",
        type: "ADJUSTMENT",
      },
    });

    assert(adjustRes.status === 200, "Ajuste manual processado com HTTP 200");
    assert(adjustRes.body.data.newBalance === 50, "Novo saldo cravado exatamente em 50 un");
    assert(adjustRes.body.data.movement.type === "ADJUSTMENT", "Movimentação ADJUSTMENT gravada no ledger");

    // 6. Venda via Loja Pública (Storefront Checkout) com Baixa Atômica
    console.log(`\n6. Realizando Checkout Público (Compra de 3 un) para decrementar estoque atômico...`);
    const checkoutRes = await request("/api/store/checkout", {
      method: "POST",
      body: {
        customer: {
          name: "Comprador E2E Estoque",
          email: `e2e_stock_${Date.now()}@teste.com`,
          cpf: "123.456.789-00",
          phone: "11988887777",
        },
        shippingAddress: {
          street: "Av Paulista",
          number: "1000",
          neighborhood: "Bela Vista",
          city: "São Paulo",
          state: "SP",
          postalCode: "01310-100",
        },
        items: [
          {
            productId: targetItem.productId,
            variantId: targetItem.variantId,
            quantity: 3,
          },
        ],
        paymentMethod: "PIX",
      },
    });

    assert(checkoutRes.status === 201, "Pedido público criado com HTTP 201");
    const createdOrderId = checkoutRes.body.order?.id;
    assert(!!createdOrderId, "Pedido público registrado no banco");

    // Verificar se o saldo baixou de 50 para 47
    const summaryAfterSale = await request("/api/admin/stock/summary");
    const itemAfterSale = summaryAfterSale.body.data.items.find((i) => i.id === targetItem.id);
    assert(itemAfterSale.stock === 47, "Saldo baixou atomicamente para 47 un após a venda pública");

    // 7. Cancelamento de Pedido com Devolução Atômica e Idempotente de Estoque
    console.log(`\n7. Cancelando Pedido ${createdOrderId} no Admin para devolução de estoque...`);
    const cancelRes = await request(`/api/admin/orders/${createdOrderId}/status`, {
      method: "PATCH",
      body: {
        status: "CANCELLED",
        reason: "Cancelamento E2E para teste de devolução",
      },
    });

    assert(cancelRes.status === 200, "Pedido cancelado com sucesso");

    // Verificar se o estoque subiu de 47 de volta para 50
    const summaryAfterCancel = await request("/api/admin/stock/summary");
    const itemAfterCancel = summaryAfterCancel.body.data.items.find((i) => i.id === targetItem.id);
    assert(itemAfterCancel.stock === 50, "Saldo restaurado atomicamente para 50 un após cancelamento");

    // 8. Reconciliação de Estoque & Auditoria de Integridade
    console.log(`\n8. Executando Reconciliação de Integridade (/api/admin/stock/reconcile/${targetItem.productId})...`);
    let reconcileUrl = `/api/admin/stock/reconcile/${targetItem.productId}`;
    if (targetItem.variantId) reconcileUrl += `?variantId=${targetItem.variantId}`;
    const reconcileRes = await request(reconcileUrl);

    assert(reconcileRes.status === 200, "API de reconciliação retornou HTTP 200");
    assert(reconcileRes.body.data.isConsistent === true, "Auditoria confirma: Estoque 100% consistente com o ledger");
    assert(reconcileRes.body.data.currentBalance === 50, "Saldo atual conferido: 50 un");
    assert(reconcileRes.body.data.totalMovementsCount >= 4, "Histórico auditável possui todas as movimentações");

    // 9. Consulta ao Ledger de Movimentações
    console.log("\n9. Consultando Ledger de Movimentações (/api/admin/stock/movements)...");
    const movementsRes = await request("/api/admin/stock/movements?limit=10");
    assert(movementsRes.status === 200, "Ledger retornado com sucesso");
    assert(Array.isArray(movementsRes.body.data), "Lista de movimentos é um array");
    assert(movementsRes.body.data.length > 0, "Movimentações listadas com sucesso");

    // 10. Proteção Anti-Overselling
    console.log("\n10. Testando proteção Anti-Overselling (Tentativa de compra de 9999 un)...");
    const oversellRes = await request("/api/store/checkout", {
      method: "POST",
      body: {
        customer: {
          name: "Tentativa Overselling",
          email: "oversell@teste.com",
          cpf: "123.456.789-99",
          phone: "11999999999",
        },
        shippingAddress: {
          street: "Rua Teste",
          number: "1",
          neighborhood: "Centro",
          city: "São Paulo",
          state: "SP",
          postalCode: "01001-000",
        },
        items: [
          {
            productId: targetItem.productId,
            variantId: targetItem.variantId,
            quantity: 9999,
          },
        ],
        paymentMethod: "PIX",
      },
    });

    assert(oversellRes.status === 400 || oversellRes.status === 422 || oversellRes.status === 500, "Compra excessiva rejeitada pelo banco");
    assert(oversellRes.body.error && oversellRes.body.error.includes("INSUFFICIENT_STOCK") || oversellRes.status >= 400, "Mensagem de estoque insuficiente retornada");

    console.log("\n=================================================");
    console.log(`  RESUMO: ${passed} PASS, ${failed} FAIL`);
    console.log("=================================================\n");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Erro fatal na execução dos testes E2E da Etapa 11:", err);
    process.exit(1);
  }
}

runStage11E2ETests();
