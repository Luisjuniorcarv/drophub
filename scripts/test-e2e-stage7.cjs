const http = require("http");
const crypto = require("crypto");

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

async function runStage7E2ETests() {
  console.log("=================================================");
  console.log("  DROPHUB - ETAPA 7: TESTE E2E DE AUTOMAÇÕES & WEBHOOKS");
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
    // 1. Login
    console.log("1. Autenticação Administrativa...");
    const loginRes = await request("/api/auth/login", {
      method: "POST",
      body: { email: "admin@drophub.com", password: "admin123456" },
    });
    assert(loginRes.status === 200, "Login administrativo autenticado com sucesso");

    // 2. Criar Mock HTTP Server para receber os webhooks do teste
    console.log("\n2. Inicializando servidor receptor de webhook mock...");
    let receivedWebhooks = [];
    const mockServer = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        receivedWebhooks.push({
          headers: req.headers,
          body: JSON.parse(body || "{}"),
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    });

    await new Promise((resolve) => mockServer.listen(9876, resolve));
    console.log("  Receptor mock escutando em http://localhost:9876");

    // 3. Cadastrar Webhook Endpoint
    console.log("\n3. Criando Webhook Endpoint via API...");
    const webhookRes = await request("/api/admin/webhooks", {
      method: "POST",
      body: {
        name: "E2E Test n8n Webhook",
        url: "http://localhost:9876/webhook/drophub",
        secret: "whsec_e2e_test_secret_12345678",
        events: ["*"],
        active: true,
        description: "Webhook de teste automatizado E2E",
      },
    });

    assert(webhookRes.status === 201, "Webhook criado com status 201");
    const createdWebhook = webhookRes.body.data;
    assert(createdWebhook?.id && createdWebhook?.secret === "whsec_e2e_test_secret_12345678", "Webhook retornado com ID e Secret");

    // 4. Listar Webhooks
    console.log("\n4. Listando Webhooks cadastrados...");
    const listRes = await request("/api/admin/webhooks");
    assert(listRes.status === 200, "Lista de webhooks retornada");
    assert(Array.isArray(listRes.body.data) && listRes.body.data.some((w) => w.id === createdWebhook.id), "Webhook recém-criado presente na lista");

    // 5. Testar Conexão (Ping)
    console.log("\n5. Enviando Ping de teste para o webhook...");
    const pingRes = await request(`/api/admin/webhooks/${createdWebhook.id}/test`, {
      method: "POST",
    });
    assert(pingRes.status === 200, "Ping de teste respondido com HTTP 200");
    assert(receivedWebhooks.length > 0, "Servidor mock recebeu o payload do Ping");

    const lastPing = receivedWebhooks[receivedWebhooks.length - 1];
    assert(lastPing.headers["x-drophub-event"] === "TEST_PING", "Header X-DropHub-Event presente no Ping");
    assert(lastPing.headers["x-drophub-signature"].startsWith("sha256="), "Header X-DropHub-Signature HMAC presente no Ping");

    // 6. Criar Pedido e Validar Publicação Atômica na Outbox
    console.log("\n6. Criando Pedido e validando evento na Outbox...");
    // Buscar produto e cliente existentes
    const productsRes = await request("/api/admin/products");
    const customersRes = await request("/api/admin/customers");

    const product = productsRes.body.data.find((p) => p.stock > 0) || productsRes.body.data[0];
    const customer = customersRes.body.data[0];

    const orderRes = await request("/api/admin/orders", {
      method: "POST",
      body: {
        customerId: customer.id,
        items: [{ productId: product.id, quantity: 1 }],
        shippingCost: 15,
        discountAmount: 0,
        shippingAddress: {
          street: "Rua das Automações",
          number: "100",
          neighborhood: "Centro",
          city: "São Paulo",
          state: "SP",
          postalCode: "01001000",
        },
        initialStatus: "PAID",
        paymentMethod: "PIX",
      },
    });

    if (orderRes.status !== 201) {
      console.error("  DETALHES DO ERRO AO CRIAR PEDIDO:", orderRes.status, orderRes.body);
    }
    assert(orderRes.status === 201, "Pedido criado com sucesso (HTTP 201)");
    const createdOrder = orderRes.body.data;

    // 7. Consultar Fila da Outbox
    console.log("\n7. Consultando fila de eventos na Outbox...");
    const outboxRes = await request("/api/admin/automations/events");
    assert(outboxRes.status === 200, "Outbox consultada com sucesso");
    const foundOrderEvent = outboxRes.body.data.find(
      (e) => e.entityId === createdOrder.id && e.eventType === "ORDER_CREATED"
    );
    assert(!!foundOrderEvent, "Evento ORDER_CREATED registrado na Outbox com atomicidade");

    // 8. Processar Fila de Outbox via Dispatch API
    console.log("\n8. Disparando processamento da fila de Outbox...");
    const beforeCount = receivedWebhooks.length;
    const dispatchRes = await request("/api/admin/automations/dispatch", {
      method: "POST",
      body: { limit: 20 },
    });
    assert(dispatchRes.status === 200, "Dispatch executado com sucesso");
    assert(receivedWebhooks.length > beforeCount, "Mock server recebeu notificações de novos eventos da outbox");

    // 9. Consultar Histórico de Auditoria & Entregas
    console.log("\n9. Consultando histórico de auditoria de entregas...");
    const deliveriesRes = await request("/api/admin/automations/deliveries");
    assert(deliveriesRes.status === 200, "Histórico de entregas consultado");
    assert(Array.isArray(deliveriesRes.body.data) && deliveriesRes.body.data.length > 0, "Registros de WebhookDelivery encontrados no banco");

    // 10. Testar Inbound Webhook com Validação de Assinatura HMAC
    console.log("\n10. Testando receptor de webhook de entrada (Inbound Webhook)...");
    const inboundPayload = JSON.stringify({ event: "n8n_order_sync", externalId: "EXT-99" });
    const inboundSecret = "test_inbound_secret";
    process.env.INBOUND_WEBHOOK_SECRET_N8N = inboundSecret;

    const inboundSig = `sha256=${crypto.createHmac("sha256", inboundSecret).update(inboundPayload, "utf8").digest("hex")}`;

    const inboundRes = await request("/api/webhooks/inbound/n8n", {
      method: "POST",
      headers: {
        "X-DropHub-Signature": inboundSig,
      },
      body: inboundPayload,
    });
    assert(inboundRes.status === 200, "Inbound Webhook recebido e validado com sucesso (HTTP 200)");

    // 11. Limpar Webhook de Teste
    console.log("\n11. Excluindo webhook de teste...");
    const deleteRes = await request(`/api/admin/webhooks/${createdWebhook.id}`, {
      method: "DELETE",
    });
    assert(deleteRes.status === 200, "Webhook de teste excluído com sucesso");

    // Fechar mock server
    mockServer.close();

    console.log("\n=================================================");
    console.log(`  RESUMO: ${passed} PASSOU | ${failed} FALHOU`);
    console.log("=================================================\n");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Erro fatal durante o teste E2E:", err);
    process.exit(1);
  }
}

runStage7E2ETests();
