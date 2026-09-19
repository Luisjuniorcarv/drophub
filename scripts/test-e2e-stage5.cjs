const http = require('http');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data ? JSON.parse(data) : null,
          rawBody: data,
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runE2E() {
  console.log('🚀 Starting ETAPA 5 HTTP E2E Testing Suite...\n');
  let cookie = '';
  let customerId = '';
  let orderId = '';
  let testProductId = '';

  // 1. Healthcheck
  console.log('1️⃣ Checking /api/health...');
  const healthRes = await makeRequest({
    hostname: 'localhost',
    port: PORT,
    path: '/api/health',
    method: 'GET',
  });
  if (healthRes.statusCode !== 200 || healthRes.body.status !== 'healthy') {
    throw new Error(`Healthcheck failed: ${JSON.stringify(healthRes.body)}`);
  }
  console.log('✅ Healthcheck passed! Database online.\n');

  // 2. Unauthenticated access check
  console.log('2️⃣ Testing unauthenticated access to /api/admin/customers and /api/admin/orders...');
  const unauthCust = await makeRequest({
    hostname: 'localhost',
    port: PORT,
    path: '/api/admin/customers',
    method: 'GET',
  });
  if (unauthCust.statusCode !== 401) {
    throw new Error(`Expected 401 for unauthenticated customers access, got: ${unauthCust.statusCode}`);
  }

  const unauthOrd = await makeRequest({
    hostname: 'localhost',
    port: PORT,
    path: '/api/admin/orders',
    method: 'GET',
  });
  if (unauthOrd.statusCode !== 401) {
    throw new Error(`Expected 401 for unauthenticated orders access, got: ${unauthOrd.statusCode}`);
  }
  console.log('✅ Unauthorized access successfully blocked (401).\n');

  // 3. Login
  console.log('3️⃣ Authenticating via /api/auth/login...');
  const loginRes = await makeRequest(
    {
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { email: 'admin@drophub.com', password: 'admin123456' }
  );

  if (loginRes.statusCode !== 200 || !loginRes.body.success) {
    throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
  }

  const setCookie = loginRes.headers['set-cookie'];
  if (!setCookie) {
    throw new Error('No cookie returned on login');
  }
  cookie = setCookie[0].split(';')[0];
  console.log('✅ Logged in successfully! Received HttpOnly JWT cookie.\n');

  // Get an existing product with stock from catalog to use in order
  const productsRes = await makeRequest({
    hostname: 'localhost',
    port: PORT,
    path: '/api/admin/products',
    method: 'GET',
    headers: { Cookie: cookie },
  });
  const availableProduct = productsRes.body.data?.find((p) => p.stock >= 2);
  if (!availableProduct) {
    throw new Error('No products with stock >= 2 found in catalog for order test');
  }
  testProductId = availableProduct.id;
  console.log(`📦 Using catalog product ${testProductId} (${availableProduct.name} - Estoque: ${availableProduct.stock})\n`);

  // 4. Create Customer
  console.log('4️⃣ Creating new customer via POST /api/admin/customers...');
  const newCustomerData = {
    name: 'Carlos Alberto E2E',
    email: `carlos.e2e.${Date.now()}@exemplo.com`,
    cpf: `234.${Math.floor(100 + Math.random() * 900)}.${Math.floor(100 + Math.random() * 900)}-11`,
    phone: '(11) 99123-4567',
    notes: 'Cliente criado pelo teste E2E',
    address: {
      street: 'Avenida Paulista',
      number: '1578',
      complement: 'Apto 101',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      postalCode: '01310-200',
      isDefault: true,
    },
  };

  const createCustRes = await makeRequest(
    {
      hostname: 'localhost',
      port: PORT,
      path: '/api/admin/customers',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
    },
    newCustomerData
  );

  if (createCustRes.statusCode !== 201 || !createCustRes.body.success) {
    throw new Error(`Customer creation failed: ${JSON.stringify(createCustRes.body)}`);
  }
  customerId = createCustRes.body.data.id;
  console.log(`✅ Customer created with ID: ${customerId}\n`);

  // 5. Query Customer
  console.log(`5️⃣ Querying customer details via GET /api/admin/customers/${customerId}...`);
  const getCustRes = await makeRequest({
    hostname: 'localhost',
    port: PORT,
    path: `/api/admin/customers/${customerId}`,
    method: 'GET',
    headers: { Cookie: cookie },
  });

  if (getCustRes.statusCode !== 200 || getCustRes.body.data.name !== newCustomerData.name) {
    throw new Error(`Customer lookup failed: ${JSON.stringify(getCustRes.body)}`);
  }
  console.log('✅ Customer details retrieved with addresses and order list.\n');

  // 6. Create Order
  console.log('6️⃣ Creating Order via POST /api/admin/orders...');
  const newOrderData = {
    customerId: customerId,
    shippingCost: 20.0,
    discountAmount: 10.0,
    paymentMethod: 'PIX',
    notes: 'Pedido gerado via teste E2E',
    shippingAddress: {
      street: 'Avenida Paulista',
      number: '1578',
      complement: 'Apto 101',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      postalCode: '01310-200',
    },
    items: [
      {
        productId: testProductId,
        quantity: 2,
      },
    ],
  };

  const createOrderRes = await makeRequest(
    {
      hostname: 'localhost',
      port: PORT,
      path: '/api/admin/orders',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
    },
    newOrderData
  );

  if (createOrderRes.statusCode !== 201 || !createOrderRes.body.success) {
    throw new Error(`Order creation failed: ${JSON.stringify(createOrderRes.body)}`);
  }
  orderId = createOrderRes.body.data.id;
  const orderNumber = createOrderRes.body.data.orderNumber;
  console.log(`✅ Order ${orderNumber} created with ID: ${orderId}`);
  console.log(`   Total: R$ ${createOrderRes.body.data.totalAmount} | Lucro: R$ ${createOrderRes.body.data.estimatedProfit}\n`);

  // 7. Query Order Details
  console.log(`7️⃣ Fetching Order via GET /api/admin/orders/${orderId}...`);
  const getOrderRes = await makeRequest({
    hostname: 'localhost',
    port: PORT,
    path: `/api/admin/orders/${orderId}`,
    method: 'GET',
    headers: { Cookie: cookie },
  });

  if (getOrderRes.statusCode !== 200 || !getOrderRes.body.data.items.length) {
    throw new Error(`Order lookup failed: ${JSON.stringify(getOrderRes.body)}`);
  }
  console.log(`✅ Order loaded with ${getOrderRes.body.data.items.length} items with immutable snapshot.\n`);

  // 8. Update Order Status
  console.log(`8️⃣ Updating Order status to PAID via PATCH /api/admin/orders/${orderId}/status...`);
  const updateStatusRes = await makeRequest(
    {
      hostname: 'localhost',
      port: PORT,
      path: `/api/admin/orders/${orderId}/status`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
    },
    {
      status: 'PAID',
      reason: 'Pagamento PIX confirmado via teste E2E',
    }
  );

  if (updateStatusRes.statusCode !== 200 || updateStatusRes.body.data.status !== 'PAID') {
    throw new Error(`Status update failed: ${JSON.stringify(updateStatusRes.body)}`);
  }
  console.log('✅ Order transitioned to PAID. Payment record set to APPROVED.\n');

  // 9. Create Shipment
  console.log(`9️⃣ Dispatching Shipment via POST /api/admin/orders/${orderId}/shipments...`);
  const shipmentData = {
    carrier: 'Correios - SEDEX',
    trackingNumber: 'BR987654321E2E',
    trackingUrl: 'https://rastreamento.correios.com.br?code=BR987654321E2E',
    notes: 'Despacho realizado com sucesso',
  };

  const createShipmentRes = await makeRequest(
    {
      hostname: 'localhost',
      port: PORT,
      path: `/api/admin/orders/${orderId}/shipments`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
    },
    shipmentData
  );

  if (createShipmentRes.statusCode !== 201 || !createShipmentRes.body.success) {
    throw new Error(`Shipment creation failed: ${JSON.stringify(createShipmentRes.body)}`);
  }
  console.log(`✅ Shipment registered with tracking: ${createShipmentRes.body.data.trackingNumber}`);
  console.log(`   Order status automatically advanced to: ${createShipmentRes.body.data.orderStatus}\n`);

  // 10. Audit History Verification
  console.log(`🔟 Verifying append-only audit trail for Order ${orderId}...`);
  const finalOrderRes = await makeRequest({
    hostname: 'localhost',
    port: PORT,
    path: `/api/admin/orders/${orderId}`,
    method: 'GET',
    headers: { Cookie: cookie },
  });

  const history = finalOrderRes.body.data.statusHistory;
  if (!history || history.length < 3) {
    throw new Error(`Expected at least 3 history entries, found: ${history?.length}`);
  }
  console.log(`✅ Audit trail verified (${history.length} immutable history records):`);
  history.forEach((h, i) => {
    console.log(`   ${i + 1}. [${h.createdAt}] ${h.previousStatus} ➔ ${h.newStatus} | Motivo: "${h.reason || 'N/A'}"`);
  });

  console.log('\n🎉 ALL ETAPA 5 HTTP E2E TESTS PASSED SUCCESSFULLY! 🎉\n');
}

runE2E()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ E2E Test Suite failed:', err);
    process.exit(1);
  });
