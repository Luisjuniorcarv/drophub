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
  console.log('🚀 Starting ETAPA 6 Financial HTTP E2E Testing Suite...\n');
  let cookie = '';
  let expenseId = '';

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
  console.log('2️⃣ Testing unauthenticated access to /api/admin/expenses and /api/admin/finance/dre...');
  const unauthExp = await makeRequest({
    hostname: 'localhost',
    port: PORT,
    path: '/api/admin/expenses',
    method: 'GET',
  });
  if (unauthExp.statusCode !== 401) {
    throw new Error(`Expected 401 for unauthenticated expenses access, got: ${unauthExp.statusCode}`);
  }

  const unauthDRE = await makeRequest({
    hostname: 'localhost',
    port: PORT,
    path: '/api/admin/finance/dre',
    method: 'GET',
  });
  if (unauthDRE.statusCode !== 401) {
    throw new Error(`Expected 401 for unauthenticated DRE access, got: ${unauthDRE.statusCode}`);
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

  // 4. Create Expense
  console.log('4️⃣ Creating new expense via POST /api/admin/expenses...');
  const newExpenseData = {
    title: 'Campanha Google Ads E2E',
    category: 'MARKETING',
    amount: 150.0,
    date: new Date().toISOString(),
    description: 'Despesa criada para validação do teste E2E',
  };

  const createExpRes = await makeRequest(
    {
      hostname: 'localhost',
      port: PORT,
      path: '/api/admin/expenses',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
    },
    newExpenseData
  );

  if (createExpRes.statusCode !== 201 || !createExpRes.body.success) {
    throw new Error(`Expense creation failed: ${JSON.stringify(createExpRes.body)}`);
  }
  expenseId = createExpRes.body.data.id;
  console.log(`✅ Expense created with ID: ${expenseId} | Valor: R$ ${createExpRes.body.data.amount}\n`);

  // 5. Query Expense by ID
  console.log(`5️⃣ Querying expense details via GET /api/admin/expenses/${expenseId}...`);
  const getExpRes = await makeRequest({
    hostname: 'localhost',
    port: PORT,
    path: `/api/admin/expenses/${expenseId}`,
    method: 'GET',
    headers: { Cookie: cookie },
  });

  if (getExpRes.statusCode !== 200 || getExpRes.body.data.title !== newExpenseData.title) {
    throw new Error(`Expense lookup failed: ${JSON.stringify(getExpRes.body)}`);
  }
  console.log('✅ Expense details retrieved successfully.\n');

  // 6. Update Expense
  console.log(`6️⃣ Updating expense via PUT /api/admin/expenses/${expenseId}...`);
  const updateExpRes = await makeRequest(
    {
      hostname: 'localhost',
      port: PORT,
      path: `/api/admin/expenses/${expenseId}`,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
    },
    {
      title: 'Campanha Google Ads E2E (Atualizada)',
      category: 'MARKETING',
      amount: 180.0,
      description: 'Orçamento aumentado',
    }
  );

  if (updateExpRes.statusCode !== 200 || updateExpRes.body.data.amount !== 180.0) {
    throw new Error(`Expense update failed: ${JSON.stringify(updateExpRes.body)}`);
  }
  console.log('✅ Expense updated to R$ 180.00.\n');

  // 7. Query DRE
  console.log('7️⃣ Querying DRE statement via GET /api/admin/finance/dre?period=month...');
  const dreRes = await makeRequest({
    hostname: 'localhost',
    port: PORT,
    path: '/api/admin/finance/dre?period=month',
    method: 'GET',
    headers: { Cookie: cookie },
  });

  if (dreRes.statusCode !== 200 || !dreRes.body.data?.metrics) {
    throw new Error(`DRE query failed: ${JSON.stringify(dreRes.body)}`);
  }
  const m = dreRes.body.data.metrics;
  console.log(`✅ DRE statement computed:`);
  console.log(`   - Receita Bruta: R$ ${m.grossRevenue}`);
  console.log(`   - Receita Líquida: R$ ${m.netRevenue}`);
  console.log(`   - CPV: R$ ${m.cpv}`);
  console.log(`   - Lucro Bruto: R$ ${m.grossProfit} (${m.grossMarginPercentage}%)`);
  console.log(`   - Despesas Totais: R$ ${m.totalExpenses}`);
  console.log(`   - Lucro Operacional: R$ ${m.operatingProfit} (${m.operatingMarginPercentage}%)\n`);

  // 8. Query Cash Flow
  console.log('8️⃣ Querying Cash Flow statement via GET /api/admin/finance/cash-flow?period=month...');
  const cashFlowRes = await makeRequest({
    hostname: 'localhost',
    port: PORT,
    path: '/api/admin/finance/cash-flow?period=month',
    method: 'GET',
    headers: { Cookie: cookie },
  });

  if (cashFlowRes.statusCode !== 200 || !cashFlowRes.body.data?.entries) {
    throw new Error(`Cash Flow query failed: ${JSON.stringify(cashFlowRes.body)}`);
  }
  const cf = cashFlowRes.body.data;
  console.log(`✅ Cash Flow statement computed:`);
  console.log(`   - Total Entradas: R$ ${cf.totalInflow}`);
  console.log(`   - Total Saídas: R$ ${cf.totalOutflow}`);
  console.log(`   - Saldo Líquido de Caixa: R$ ${cf.netCashBalance}`);
  console.log(`   - ${cf.entries.length} lançamentos de movimentação\n`);

  // 9. Delete Expense
  console.log(`9️⃣ Deleting test expense via DELETE /api/admin/expenses/${expenseId}...`);
  const deleteRes = await makeRequest({
    hostname: 'localhost',
    port: PORT,
    path: `/api/admin/expenses/${expenseId}`,
    method: 'DELETE',
    headers: { Cookie: cookie },
  });

  if (deleteRes.statusCode !== 200 || !deleteRes.body.success) {
    throw new Error(`Expense deletion failed: ${JSON.stringify(deleteRes.body)}`);
  }
  console.log('✅ Expense deleted successfully.\n');

  console.log('🎉 ALL ETAPA 6 FINANCIAL HTTP E2E TESTS PASSED SUCCESSFULLY! 🎉\n');
}

runE2E()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Financial E2E Test Suite failed:', err);
    process.exit(1);
  });
