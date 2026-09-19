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

async function runStage8E2ETests() {
  console.log("=================================================");
  console.log("  DROPHUB - ETAPA 8: TESTE E2E DE CHECKOUT & GATEWAY");
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

    // 3. Obter cliente e produto existentes para o pedido de teste
    console.log("\n3. Obtendo dados de apoio para criação de pedido...");
    const customersRes = await request("/api/admin/customers");
    const productsRes = await request("/api/admin/products");
    assert(customersRes.status === 200 && customersRes.body.data.length > 0, "Clientes encontrados");
    assert(productsRes.status === 200 && productsRes.body.data.length > 0, "Produtos encontrados");

    const customer = customersRes.body.data[0];
    const product = productsRes.body.data.find((p) => p.stock >= 2) || productsRes.body.data[0];

    // 4. Criar Pedido de Teste
    console.log("\n4. Criando Pedido de Teste para Checkout...");
    const orderPayload = {
      customerId: customer.id,
      items: [{ productId: product.id, quantity: 2 }],
      shippingCost: 20.0,
      discountAmount: 0.0,
      shippingAddress: {
        name: customer.name,
        street: "Av. Paulista",
        number: "1000",
        neighborhood: "Bela Vista",
        city: "São Paulo",
        state: "SP",
        postalCode: "01310100",
      },
      initialStatus: "AWAITING_PAYMENT",
      paymentMethod: "PIX",
      notes: "Pedido de teste E2E Etapa 8",
    };

    const orderRes = await request("/api/admin/orders", {
      method: "POST",
      body: orderPayload,
    });
    if (orderRes.status !== 201) {
      console.error("Order creation failed:", orderRes.status, orderRes.body);
    }
    assert(orderRes.status === 201, "Pedido criado com sucesso via API");
    const order = orderRes.body.order || orderRes.body.data;
    const orderId = order?.id;
    assert(order?.status === "AWAITING_PAYMENT", "Status inicial é AWAITING_PAYMENT");

    // 5. Iniciar Pagamento Pix via /api/checkout/payment
    console.log("\n5. Iniciando Cobrança Pix via Checkout (/api/checkout/payment)...");
    const pixRes1 = await request("/api/checkout/payment", {
      method: "POST",
      body: {
        orderId: orderId,
        method: "PIX",
        gateway: "TEST",
      },
    });
    assert(pixRes1.status === 201, "Cobrança Pix criada com status 201");
    assert(pixRes1.body.payment.status === "PENDING", "Status da cobrança é PENDING");
    assert(!!pixRes1.body.payment.qrCode, "Código Pix copia e cola retornado");
    assert(!!pixRes1.body.payment.qrCodeBase64, "QR Code Base64 retornado");
    const paymentId = pixRes1.body.payment.id;
    const transactionId = pixRes1.body.payment.transactionId;

    // 6. Testar Idempotência na Geração de Pix
    console.log("\n6. Testando Idempotência na Geração de Pix...");
    const pixRes2 = await request("/api/checkout/payment", {
      method: "POST",
      body: {
        orderId: orderId,
        method: "PIX",
        gateway: "TEST",
      },
    });
    assert(pixRes2.status === 200 || pixRes2.status === 201, "Chamada repetida respondeu com sucesso");
    assert(pixRes2.body.payment.id === paymentId, "Idempotência mantida: mesmo registro de cobrança retornado");

    // 7. Simular Webhook de Pagamento Aprovado
    console.log("\n7. Simulando Webhook de Pagamento Aprovado...");
    const webhookRes = await request("/api/webhooks/payments/mercadopago", {
      method: "POST",
      headers: {
        "x-signature": "ts=1234567890,v1=mock_valid_signature",
      },
      body: {
        action: "payment.updated",
        data: { id: transactionId },
      },
    });
    assert(webhookRes.status === 200, "Webhook aceito com HTTP 200");
    assert(webhookRes.body.received === true, "Payload recebido e processado com sucesso");

    // 8. Validar Pedido Atualizado para PAID
    console.log("\n8. Validando atualização do Pedido e Pagamento no Banco...");
    const checkOrderRes = await request(`/api/admin/orders/${orderId}`);
    assert(checkOrderRes.status === 200, "Pedido consultado com sucesso");
    assert(checkOrderRes.body.data.status === "PAID", "Status do Pedido transicionou automaticamente para PAID");
    const orderPayment = checkOrderRes.body.data.payments.find((p) => p.id === paymentId);
    assert(orderPayment && orderPayment.status === "APPROVED", "Status do Pagamento no Pedido é APPROVED");

    // 9. Testar Estorno / Reembolso Integral
    console.log("\n9. Testando Estorno / Reembolso Integral (/api/admin/payments/:id/refund)...");
    const refundRes = await request(`/api/admin/payments/${paymentId}/refund`, {
      method: "POST",
      body: { reason: "Cliente solicitou devolução antes do envio" },
    });
    assert(refundRes.status === 200, "Reembolso processado com sucesso com HTTP 200");
    const refundPayment = refundRes.body.data || refundRes.body.payment;
    assert(refundPayment?.status === "REFUNDED", "Status do Pagamento atualizado para REFUNDED");

    // 10. Validar Pedido Atualizado para REFUNDED
    const checkRefundedOrder = await request(`/api/admin/orders/${orderId}`);
    assert(checkRefundedOrder.body.data.status === "REFUNDED", "Status do Pedido atualizado para REFUNDED");

    // 11. Criar Segundo Pedido para Teste de Cancelamento de Cobrança
    console.log("\n11. Testando Cancelamento de Cobrança Pendente...");
    const order2Res = await request("/api/admin/orders", {
      method: "POST",
      body: {
        ...orderPayload,
        notes: "Pedido 2 para cancelamento",
      },
    });
    const order2 = order2Res.body.order || order2Res.body.data;
    const order2Id = order2.id;

    const pix2Res = await request("/api/checkout/payment", {
      method: "POST",
      body: {
        orderId: order2Id,
        method: "PIX",
        gateway: "TEST",
      },
    });
    const payment2Id = pix2Res.body.payment.id;

    const cancelRes = await request(`/api/admin/payments/${payment2Id}/cancel`, {
      method: "POST",
      body: { reason: "Cancelamento manual por expiração" },
    });
    assert(cancelRes.status === 200, "Cobrança cancelada com sucesso");
    const cancelPayment = cancelRes.body.data || cancelRes.body.payment;
    assert(cancelPayment?.status === "CANCELLED", "Status do Pagamento atualizado para CANCELLED");

    // Summary
    console.log("\n=================================================");
    console.log(`  RESULTADO DOS TESTES E2E ETAPA 8:`);
    console.log(`  Passaram: ${passed}`);
    console.log(`  Falharam: ${failed}`);
    console.log("=================================================\n");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Erro fatal na execução dos testes E2E:", error);
    process.exit(1);
  }
}

runStage8E2ETests();
