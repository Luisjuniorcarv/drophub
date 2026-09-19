const http = require("http");

const BASE_URL = "http://localhost:3000";
let authCookie = "";

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authCookie ? { Cookie: authCookie } : {}),
        ...(options.headers || {}),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = "";
      const setCookie = res.headers["set-cookie"];
      if (setCookie) {
        authCookie = setCookie.map((c) => c.split(";")[0]).join("; ");
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

async function runStage10E2ETests() {
  console.log("=================================================");
  console.log("  DROPHUB - ETAPA 10: TESTE E2E DE FULFILLMENT & FORNECEDORES");
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
    assert(health.body.status === "healthy", "Serviço está online e responsivo");

    // 2. Autenticação Administrativa
    console.log("\n2. Autenticando usuário administrativo...");
    const login = await request("/api/auth/login", {
      method: "POST",
      body: { email: "admin@drophub.com", password: "admin123456" },
    });
    assert(login.status === 200, "Login administrativo efetuado com sucesso");
    assert(!!authCookie, "Cookie HttpOnly de autenticação recebido");

    // 3. Obter cliente e produto para criação de pedido pago
    console.log("\n3. Obtendo dados para criação de pedido...");
    const customersRes = await request("/api/admin/customers");
    const productsRes = await request("/api/admin/products");
    assert(customersRes.status === 200 && customersRes.body.data.length > 0, "Clientes encontrados");
    assert(productsRes.status === 200 && productsRes.body.data.length > 0, "Produtos encontrados");

    const customer = customersRes.body.data[0];
    const product = productsRes.body.data.find((p) => p.stock >= 2) || productsRes.body.data[0];

    // 4. Criar Pedido Pago de Teste
    console.log("\n4. Criando Pedido Pago de Teste...");
    const orderPayload = {
      customerId: customer.id,
      items: [{ productId: product.id, quantity: 1 }],
      shippingCost: 15.0,
      discountAmount: 0.0,
      shippingAddress: {
        name: customer.name,
        street: "Av. Faria Lima",
        number: "2000",
        neighborhood: "Pinheiros",
        city: "São Paulo",
        state: "SP",
        postalCode: "05426100",
      },
      initialStatus: "PAID", // Pedido já pago
      paymentMethod: "TEST_MODE",
      notes: "Pedido de teste E2E Etapa 10 - Fulfillment",
    };

    const orderRes = await request("/api/admin/orders", {
      method: "POST",
      body: orderPayload,
    });
    assert(orderRes.status === 201, "Pedido criado com sucesso via API");
    const order = orderRes.body.order || orderRes.body.data;
    const orderId = order?.id;
    assert(order?.status === "PAID", "Status inicial do pedido é PAID");

    // 5. Gerar Fulfillment para o Pedido (/api/admin/fulfillment)
    console.log("\n5. Gerando ordens de fulfillment (/api/admin/fulfillment)...");
    const createFulRes = await request("/api/admin/fulfillment", {
      method: "POST",
      body: { orderId },
    });
    assert(createFulRes.status === 201, "Fulfillment criado com sucesso (HTTP 201)");
    const fulData = createFulRes.body.data || createFulRes.body;
    assert(fulData.totalFulfillments >= 1, "Pelo menos 1 ordem de fulfillment foi criada");
    const fulfillmentId = fulData.fulfillments[0].id;

    // 6. Testar Idempotência na Criação de Fulfillment
    console.log("\n6. Testando Idempotência na Criação de Fulfillment...");
    const createFulRes2 = await request("/api/admin/fulfillment", {
      method: "POST",
      body: { orderId },
    });
    assert(createFulRes2.status === 200 || createFulRes2.status === 201, "Chamada idempotente executada com sucesso");
    const fulData2 = createFulRes2.body.data || createFulRes2.body;
    assert(fulData2.fulfillments[0].id === fulfillmentId, "Idempotência mantida: mesmo fulfillment retornado");

    // 7. Listar Fulfillments (/api/admin/fulfillment)
    console.log("\n7. Consultando listagem de Fulfillments...");
    const listRes = await request(`/api/admin/fulfillment?orderId=${orderId}`);
    assert(listRes.status === 200, "Listagem retornou HTTP 200");
    assert(listRes.body.data.length >= 1, "Fulfillment localizado na listagem");
    assert(listRes.body.pagination !== undefined, "Paginação retornada na resposta");

    // 8. Consultar Detalhes do Fulfillment (/api/admin/fulfillment/:id)
    console.log("\n8. Consultando Detalhes do Fulfillment...");
    const detailRes = await request(`/api/admin/fulfillment/${fulfillmentId}`);
    assert(detailRes.status === 200, "Detalhes retornados com HTTP 200");
    assert(detailRes.body.data.id === fulfillmentId, "ID corresponde ao solicitado");
    assert(detailRes.body.data.items.length >= 1, "Itens e snapshot financeiro presentes");
    assert(detailRes.body.data.history.length >= 1, "Histórico de auditoria presente");

    // 9. Submeter Ordem ao Fornecedor (/api/admin/fulfillment/:id/submit)
    console.log("\n9. Submetendo Fulfillment ao Fornecedor (/submit)...");
    const submitRes = await request(`/api/admin/fulfillment/${fulfillmentId}/submit`, {
      method: "POST",
    });
    assert(submitRes.status === 200, "Envio ao fornecedor realizado com sucesso (HTTP 200)");
    const submitFul = submitRes.body.data || submitRes.body.fulfillment;
    assert(submitFul.status === "ACKNOWLEDGED", "Status atualizado para ACKNOWLEDGED");
    assert(!!submitFul.externalOrderId, "ExternalOrderId do fornecedor registrado");
    assert(!!submitFul.supplierOrderNumber, "SupplierOrderNumber amigável registrado");

    // 10. Validar se o Pedido Pai transitou para SENT_TO_SUPPLIER
    console.log("\n10. Validando transição do Pedido Pai...");
    const checkOrderRes1 = await request(`/api/admin/orders/${orderId}`);
    assert(checkOrderRes1.body.data.status === "SENT_TO_SUPPLIER", "Pedido Pai transicionou para SENT_TO_SUPPLIER");

    // 11. Atualizar Código de Rastreamento (/api/admin/fulfillment/:id/tracking)
    console.log("\n11. Despachando e Atualizando Rastreamento (/tracking)...");
    const trackPayload = {
      trackingNumber: "NL987654321BR",
      carrier: "Correios",
      trackingUrl: "https://rastreamento.correios.com.br/app/index.php?codigo=NL987654321BR",
    };
    const trackRes = await request(`/api/admin/fulfillment/${fulfillmentId}/tracking`, {
      method: "POST",
      body: trackPayload,
    });
    assert(trackRes.status === 200, "Rastreamento atualizado com sucesso");
    const trackFul = trackRes.body.data?.fulfillment || trackRes.body.fulfillment;
    const trackShipment = trackRes.body.data?.shipment || trackRes.body.shipment;
    assert(trackFul.status === "SHIPPED", "Status do Fulfillment atualizado para SHIPPED");
    assert(trackShipment.trackingNumber === "NL987654321BR", "Shipment gerado com o código correto");

    // 12. Validar Pedido Pai como SHIPPED
    console.log("\n12. Validando Pedido Pai como SHIPPED...");
    const checkOrderRes2 = await request(`/api/admin/orders/${orderId}`);
    assert(checkOrderRes2.body.data.status === "SHIPPED", "Pedido Pai transicionou automaticamente para SHIPPED");

    // 13. Confirmar Entrega do Pacote (/api/admin/fulfillment/:id/status -> DELIVERED)
    console.log("\n13. Marcando Fulfillment como Entregue (/status -> DELIVERED)...");
    const deliverRes = await request(`/api/admin/fulfillment/${fulfillmentId}/status`, {
      method: "POST",
      body: { status: "DELIVERED" },
    });
    assert(deliverRes.status === 200, "Status de entrega atualizado com sucesso");
    const deliverFul = deliverRes.body.data || deliverRes.body.fulfillment;
    assert(deliverFul.status === "DELIVERED", "Fulfillment status é DELIVERED");

    // 14. Validar Pedido Pai como DELIVERED
    console.log("\n14. Validando Pedido Pai como DELIVERED...");
    const checkOrderRes3 = await request(`/api/admin/orders/${orderId}`);
    assert(checkOrderRes3.body.data.status === "DELIVERED", "Pedido Pai transicionou automaticamente para DELIVERED");

    // 15. Testar Webhook Inbound de Fornecedor (/api/webhooks/suppliers/test)
    console.log("\n15. Testando Webhook Inbound de Fornecedor...");
    const webhookRes = await request("/api/webhooks/suppliers/test", {
      method: "POST",
      body: {
        event: "TRACKING_UPDATE",
        externalOrderId: submitFul.externalOrderId,
        trackingNumber: "NL987654321BR",
        carrier: "Correios",
        status: "DELIVERED",
      },
    });
    assert(webhookRes.status === 200, "Webhook de fornecedor processado com sucesso");
    assert(webhookRes.body.success === true, "Payload de webhook validado e aceito");

    // 16. Testar Cancelamento de Fulfillment em um Segundo Pedido
    console.log("\n16. Testando Cancelamento de Fulfillment...");
    const order2Res = await request("/api/admin/orders", {
      method: "POST",
      body: {
        ...orderPayload,
        notes: "Pedido 2 para cancelamento de fulfillment",
      },
    });
    const order2 = order2Res.body.order || order2Res.body.data;
    const createFul2 = await request("/api/admin/fulfillment", {
      method: "POST",
      body: { orderId: order2.id },
    });
    const fulData2Obj = createFul2.body.data || createFul2.body;
    const ful2Id = fulData2Obj.fulfillments[0].id;

    const cancelFulRes = await request(`/api/admin/fulfillment/${ful2Id}/status`, {
      method: "POST",
      body: { status: "CANCELLED", reason: "Cancelado pelo lojista" },
    });
    assert(cancelFulRes.status === 200, "Fulfillment cancelado com sucesso");
    const cancelFul = cancelFulRes.body.data || cancelFulRes.body.fulfillment;
    assert(cancelFul.status === "CANCELLED", "Status atualizado para CANCELLED");

    // Summary
    console.log("\n=================================================");
    console.log(`  RESULTADO DOS TESTES E2E ETAPA 10:`);
    console.log(`  Passaram: ${passed}`);
    console.log(`  Falharam: ${failed}`);
    console.log("=================================================\n");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Erro fatal na execução dos testes E2E Etapa 10:", error);
    process.exit(1);
  }
}

runStage10E2ETests();
