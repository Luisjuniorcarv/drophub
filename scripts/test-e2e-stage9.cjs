/**
 * Script de Testes E2E Automatizados — ETAPA 9: Loja Pública / Storefront
 * DropHub Platform
 */

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedCount++;
  }
}

async function runStage9E2ETests() {
  console.log("=================================================");
  console.log("  DROPHUB - ETAPA 9: TESTE E2E DE STOREFRONT");
  console.log("=================================================\n");

  const uniqueSuffix = Date.now();
  let customerCookie = "";
  let adminCookie = "";
  let sampleProduct = null;
  let sampleCategory = null;
  let createdOrderId = null;
  let orderTrackingToken = null;
  let paymentTransactionId = null;

  // 1. Healthcheck
  console.log("1. Testando Healthcheck da API...");
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    const data = await res.json();
    assert(res.status === 200, "API Healthcheck retornou HTTP 200");
    assert(data.status === "healthy", "Serviço está online e saudável");
  } catch (err) {
    assert(false, `Falha ao conectar no servidor: ${err.message}`);
    return;
  }

  // 2. Consulta de Categorias Públicas
  console.log("\n2. Consultando Categorias do Catálogo Público...");
  try {
    const res = await fetch(`${BASE_URL}/api/store/categories`);
    const data = await res.json();
    assert(res.status === 200, "API de categorias retornou HTTP 200");
    assert(data.success === true, "Categorias retornadas com sucesso");
    if (data.categories && data.categories.length > 0) {
      sampleCategory = data.categories[0];
      assert(sampleCategory.slug !== undefined, `Categoria ativa encontrada: ${sampleCategory.name}`);
    }
  } catch (err) {
    assert(false, `Erro na consulta de categorias: ${err.message}`);
  }

  // 3. Consulta de Produtos do Catálogo Público
  console.log("\n3. Consultando Produtos do Catálogo Público...");
  try {
    const res = await fetch(`${BASE_URL}/api/store/products?limit=20`);
    const data = await res.json();
    assert(res.status === 200, "API de produtos retornou HTTP 200");
    assert(data.products.length > 0, `Total de produtos encontrados: ${data.products.length}`);
    sampleProduct = data.products.find((p) => p.stock >= 5) || data.products[0];
    assert(sampleProduct.id !== undefined, `Produto de teste selecionado: ${sampleProduct.name} (${sampleProduct.slug})`);
  } catch (err) {
    assert(false, `Erro na consulta de produtos: ${err.message}`);
  }

  // 4. Detalhes de um Produto por Slug
  console.log("\n4. Consultando Detalhes do Produto por Slug...");
  try {
    const res = await fetch(`${BASE_URL}/api/store/products/${sampleProduct.slug}`);
    const data = await res.json();
    assert(res.status === 200, "API de produto por slug retornou HTTP 200");
    assert(data.product.name === sampleProduct.name, "Nome do produto corresponde ao slug");
    assert(data.product.sellingPrice > 0, `Preço unitário válido: R$ ${data.product.sellingPrice}`);
  } catch (err) {
    assert(false, `Erro no detalhe do produto: ${err.message}`);
  }

  // 5. Busca Pública de Produtos
  console.log("\n5. Testando Busca no Catálogo...");
  try {
    const term = sampleProduct.name.split(" ")[0];
    const res = await fetch(`${BASE_URL}/api/store/products?q=${encodeURIComponent(term)}`);
    const data = await res.json();
    assert(res.status === 200, "API de busca retornou HTTP 200");
    assert(data.products.length > 0, `Busca por "${term}" retornou ${data.products.length} resultado(s)`);
  } catch (err) {
    assert(false, `Erro na busca: ${err.message}`);
  }

  // 6. Carrinho: Adicionar, Atualizar e Revalidar
  console.log("\n6. Testando Operações de Carrinho (com recálculo no servidor)...");
  let cartCookieHeader = "";
  try {
    // Adicionar item
    const addRes = await fetch(`${BASE_URL}/api/store/cart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: sampleProduct.id,
        quantity: 2,
      }),
    });

    const addData = await addRes.json();
    assert(addRes.status === 200, "Item adicionado ao carrinho com status 200");
    assert(addData.cart.itemsCount === 2, `Quantidade no carrinho: ${addData.cart.itemsCount}`);

    // Extrair cookie de carrinho
    const rawCookies = addRes.headers.get("set-cookie") || "";
    const match = rawCookies.match(/drophub_cart=([^;]+)/);
    if (match) cartCookieHeader = `drophub_cart=${match[1]}`;

    // Atualizar quantidade
    const updateRes = await fetch(`${BASE_URL}/api/store/cart`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cartCookieHeader,
      },
      body: JSON.stringify({
        productId: sampleProduct.id,
        quantity: 1,
      }),
    });
    const updateData = await updateRes.json();
    assert(updateData.cart.itemsCount === 1, "Quantidade atualizada para 1 no carrinho");
  } catch (err) {
    assert(false, `Erro no teste de carrinho: ${err.message}`);
  }

  // 7. Cadastro de Novo Cliente
  console.log("\n7. Testando Cadastro de Cliente (Storefront)...");
  const testCustomerEmail = `cliente_e2e_${uniqueSuffix}@drophub.com`;
  const testCustomerCpf = String(Math.floor(10000000000 + Math.random() * 89999999999));

  try {
    const regRes = await fetch(`${BASE_URL}/api/auth/customer/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Cliente Teste E2E",
        email: testCustomerEmail,
        cpf: testCustomerCpf,
        phone: "11987654321",
        password: "password123456",
      }),
    });

    const regData = await regRes.json();
    assert(regRes.status === 201, "Cadastro de cliente retornou HTTP 201");
    assert(regData.customer.email === testCustomerEmail, "Cliente criado com e-mail correto");

    const setCookies = regRes.headers.get("set-cookie") || "";
    const match = setCookies.match(/drophub_customer_session=([^;]+)/);
    if (match) customerCookie = `drophub_customer_session=${match[1]}`;
  } catch (err) {
    assert(false, `Erro no cadastro de cliente: ${err.message}`);
  }

  // 8. Consulta de Sessão do Cliente (/api/auth/customer/me)
  console.log("\n8. Testando Consulta de Sessão do Cliente (/api/auth/customer/me)...");
  try {
    const meRes = await fetch(`${BASE_URL}/api/auth/customer/me`, {
      headers: { Cookie: customerCookie },
    });
    const meData = await meRes.json();
    assert(meRes.status === 200, "Endpoint me retornou HTTP 200");
    assert(meData.authenticated === true, "Sessão autenticada confirmada");
    assert(meData.customer.name === "Cliente Teste E2E", "Nome do cliente validado na sessão");
  } catch (err) {
    assert(false, `Erro na verificação de sessão: ${err.message}`);
  }

  // 9. Checkout Público com Criação de Pedido e Pix
  console.log("\n9. Realizando Checkout Público (POST /api/store/checkout)...");
  try {
    const checkoutRes = await fetch(`${BASE_URL}/api/store/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: customerCookie,
      },
      body: JSON.stringify({
        customer: {
          name: "Cliente Teste E2E",
          email: testCustomerEmail,
          cpf: testCustomerCpf,
          phone: "11987654321",
        },
        shippingAddress: {
          street: "Av Paulista",
          number: "1500",
          neighborhood: "Bela Vista",
          city: "São Paulo",
          state: "SP",
          postalCode: "01310100",
        },
        items: [
          {
            productId: sampleProduct.id,
            quantity: 1,
          },
        ],
        paymentMethod: "PIX",
        gatewayName: "TEST",
      }),
    });

    const checkoutData = await checkoutRes.json();
    assert(checkoutRes.status === 201, "Checkout concluído com status 201");
    assert(checkoutData.order.orderNumber.startsWith("DH-"), `Número do pedido gerado: ${checkoutData.order.orderNumber}`);
    assert(checkoutData.order.status === "AWAITING_PAYMENT", "Status inicial é AWAITING_PAYMENT");
    assert(checkoutData.order.trackingToken !== undefined, "TrackingToken único gerado para o pedido");
    assert(checkoutData.payment !== null, "Cobrança de pagamento iniciada no checkout");
    assert(checkoutData.payment.qrCode !== undefined, "QR Code Copia e Cola retornado");

    createdOrderId = checkoutData.order.id;
    orderTrackingToken = checkoutData.order.trackingToken;
  } catch (err) {
    assert(false, `Erro no checkout: ${err.message}`);
  }

  // 10. Consulta de Status do Pedido para Polling em Tempo Real
  console.log("\n10. Consultando Status do Pedido (/api/store/orders/:id/status)...");
  try {
    const statusRes = await fetch(
      `${BASE_URL}/api/store/orders/${createdOrderId}/status?token=${orderTrackingToken}`
    );
    const statusData = await statusRes.json();
    assert(statusRes.status === 200, "Endpoint de status retornou HTTP 200");
    assert(statusData.status === "AWAITING_PAYMENT", "Status atual é AWAITING_PAYMENT");
    if (statusData.latestPayment) {
      paymentTransactionId = statusData.latestPayment.id;
      assert(statusData.latestPayment.status === "PENDING", "Pagamento está com status PENDING");
    }
  } catch (err) {
    assert(false, `Erro na consulta de status: ${err.message}`);
  }

  // 11. Simulação de Webhook de Pagamento Aprovado (ETAPA 8 Integration)
  console.log("\n11. Simulando Webhook de Aprovação de Pagamento...");
  try {
    // Buscar transactionId do pagamento
    const orderDetailRes = await fetch(
      `${BASE_URL}/api/customer/orders/${createdOrderId}?token=${orderTrackingToken}`
    );
    const orderDetailData = await orderDetailRes.json();
    const transId = orderDetailData.order.payments[0]?.id;

    // Acionar simulação de aprovação no webhook
    const hookRes = await fetch(`${BASE_URL}/api/webhooks/inbound/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "PAYMENT_APPROVED",
        transactionId: transId,
      }),
    });

    // Se webhook inbound responder, ou consultar status atualizado
    const verifyRes = await fetch(
      `${BASE_URL}/api/customer/orders/${createdOrderId}?token=${orderTrackingToken}`
    );
    const verifyData = await verifyRes.json();
    assert(verifyRes.status === 200, "Consulta de confirmação de pedido respondeu com sucesso");
  } catch (err) {
    assert(false, `Erro no webhook: ${err.message}`);
  }

  // 12. Listagem de Pedidos do Cliente Logado
  console.log("\n12. Consultando Lista de Pedidos em Minha Conta (/api/customer/orders)...");
  try {
    const ordersRes = await fetch(`${BASE_URL}/api/customer/orders`, {
      headers: { Cookie: customerCookie },
    });
    const ordersData = await ordersRes.json();
    assert(ordersRes.status === 200, "Listagem de pedidos retornou HTTP 200");
    assert(ordersData.orders.length >= 1, `Pedidos localizados na conta do cliente: ${ordersData.orders.length}`);
    assert(ordersData.orders[0].id === createdOrderId, "Pedido recém-criado está presente na listagem");
  } catch (err) {
    assert(false, `Erro na listagem de pedidos: ${err.message}`);
  }

  // 13. Teste de Isolamento e Segurança de Pedidos (Outro cliente tentando acessar)
  console.log("\n13. Testando Segurança e Isolamento de Pedidos entre Clientes...");
  try {
    // Criar Cliente B
    const otherCpf = String(Math.floor(10000000000 + Math.random() * 89999999999));
    const regBRes = await fetch(`${BASE_URL}/api/auth/customer/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Cliente Invasor B",
        email: `invasor_${uniqueSuffix}@drophub.com`,
        cpf: otherCpf,
        phone: "11911112222",
        password: "password123456",
      }),
    });

    const setCookiesB = regBRes.headers.get("set-cookie") || "";
    const matchB = setCookiesB.match(/drophub_customer_session=([^;]+)/);
    const customerBCookie = matchB ? `drophub_customer_session=${matchB[1]}` : "";

    // Cliente B tenta acessar o pedido do Cliente A sem token
    const invadeRes = await fetch(`${BASE_URL}/api/customer/orders/${createdOrderId}`, {
      headers: { Cookie: customerBCookie },
    });

    assert(invadeRes.status === 403, "Acesso negado para cliente não-proprietário (HTTP 403)");
  } catch (err) {
    assert(false, `Erro no teste de segurança: ${err.message}`);
  }

  // 14. Teste de Acesso de Visitante com Token Seguro de Rastreamento
  console.log("\n14. Testando Acesso com Token de Rastreamento de Visitante...");
  try {
    // Sem cookies de sessão, apenas o query param ?token=
    const guestRes = await fetch(`${BASE_URL}/api/customer/orders/${createdOrderId}?token=${orderTrackingToken}`);
    const guestData = await guestRes.json();
    assert(guestRes.status === 200, "Acesso autorizado com trackingToken válido (HTTP 200)");
    assert(guestData.order.orderNumber !== undefined, `Pedido consultado com sucesso: ${guestData.order.orderNumber}`);
  } catch (err) {
    assert(false, `Erro no teste de tracking token: ${err.message}`);
  }

  // 15. Teste de Rejeição de Adulteração de Preço
  console.log("\n15. Testando Proteção contra Adulteração de Preço pelo Frontend...");
  try {
    const tamperedRes = await fetch(`${BASE_URL}/api/store/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: {
          name: "Cliente Audit",
          email: `audit_${uniqueSuffix}@drophub.com`,
          cpf: String(Math.floor(10000000000 + Math.random() * 89999999999)),
          phone: "11988887777",
        },
        shippingAddress: {
          street: "Rua Teste",
          number: "100",
          neighborhood: "Centro",
          city: "São Paulo",
          state: "SP",
          postalCode: "01001000",
        },
        items: [
          {
            productId: sampleProduct.id,
            quantity: 1,
            unitPrice: 0.01, // Preço adulterado no payload
          },
        ],
        paymentMethod: "PIX",
      }),
    });

    const tamperedData = await tamperedRes.json();
    assert(tamperedRes.status === 201, "Pedido criado com sucesso");
    assert(
      tamperedData.order.totalAmount >= sampleProduct.sellingPrice,
      `Servidor recalculou o valor correto do banco: R$ ${tamperedData.order.totalAmount} (ignorou R$ 0.01)`
    );
  } catch (err) {
    assert(false, `Erro no teste de preço: ${err.message}`);
  }

  // 16. Teste de Logout do Cliente
  console.log("\n16. Testando Logout do Cliente...");
  try {
    const logoutRes = await fetch(`${BASE_URL}/api/auth/customer/logout`, {
      method: "POST",
      headers: { Cookie: customerCookie },
    });
    assert(logoutRes.status === 200, "Logout retornou status 200");
  } catch (err) {
    assert(false, `Erro no logout: ${err.message}`);
  }

  // 17. Validação de Visibilidade do Pedido no Painel Admin (ETAPA 5 & 8)
  console.log("\n17. Validando Presença do Pedido do Storefront no Painel Admin...");
  try {
    // Login admin
    const loginAdminRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@drophub.com",
        password: "admin123456",
      }),
    });
    const setAdminCookies = loginAdminRes.headers.get("set-cookie") || "";
    const adminMatch = setAdminCookies.match(/drophub_admin_session=([^;]+)/);
    if (adminMatch) adminCookie = `drophub_admin_session=${adminMatch[1]}`;

    // Consultar pedidos admin
    const adminOrdersRes = await fetch(`${BASE_URL}/api/admin/orders`, {
      headers: { Cookie: adminCookie },
    });
    const adminOrdersData = await adminOrdersRes.json();
    assert(adminOrdersRes.status === 200, "Admin orders retornou status 200");
    const found = adminOrdersData.data.find((o) => o.id === createdOrderId);
    assert(found !== undefined, `Pedido ${found?.orderNumber} do Storefront está visível no painel administrativo`);
  } catch (err) {
    assert(false, `Erro na consulta admin: ${err.message}`);
  }

  console.log("\n=================================================");
  console.log(`  RESULTADO DOS TESTES E2E ETAPA 9:`);
  console.log(`  Passaram: ${passedCount} | Falharam: ${failedCount}`);
  console.log("=================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runStage9E2ETests();
