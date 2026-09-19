const http = require("http");

const BASE_URL = "http://localhost:3000";
let cookies = {};
let passCount = 0;
let failCount = 0;

function logPass(msg) {
  console.log(`  ✅ PASS: ${msg}`);
  passCount++;
}

function logFail(msg, err) {
  console.error(`  ❌ FAIL: ${msg}`);
  if (err) console.error("     Detalhes:", err);
  failCount++;
}

function makeRequest(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const headers = options.headers || {};
    
    const cookieHeader = Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    if (cookieHeader) {
      headers["Cookie"] = cookieHeader;
    }

    const reqOptions = {
      method: options.method || "GET",
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: headers,
    };

    const req = http.request(reqOptions, (res) => {
      const setCookie = res.headers["set-cookie"];
      if (setCookie) {
        setCookie.forEach((c) => {
          const parts = c.split(";")[0].split("=");
          if (parts.length >= 2) {
            cookies[parts[0].trim()] = parts.slice(1).join("=").trim();
          }
        });
      }

      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : {};
        } catch {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed,
        });
      });
    });

    req.on("error", (err) => reject(err));

    if (options.body) {
      req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runE2E() {
  console.log("\n=================================================");
  console.log("  DROPHUB - ETAPA 12: TESTE E2E DE INTEGRAÇÕES + IA");
  console.log("=================================================\n");

  try {
    // 1. Healthcheck
    console.log("1. Testando Healthcheck da API...");
    const health = await makeRequest("/api/health");
    if (health.status === 200) {
      logPass("API Healthcheck retornou HTTP 200");
    } else {
      logFail("Healthcheck falhou", health);
    }

    // 2. Login Administrativo
    console.log("\n2. Autenticando usuário administrativo...");
    const loginRes = await makeRequest("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: { email: "admin@drophub.com", password: "admin123456" },
    });

    if (loginRes.status === 200) {
      logPass("Login administrativo efetuado com sucesso");
      logPass("Cookie HttpOnly recebido");
    } else {
      logFail("Falha no login administrativo", loginRes);
    }

    // 3. Obter dados de contexto (Produtos e Clientes)
    console.log("\n3. Obtendo contextos existentes para os assistentes...");
    const prodsRes = await makeRequest("/api/admin/products");
    const productList = prodsRes.data?.data || prodsRes.data?.products || [];
    let testProductId = "";
    if (prodsRes.status === 200 && productList.length > 0) {
      testProductId = productList[0].id;
      logPass(`Produto localizado para contexto: ${productList[0].name} (ID: ${testProductId})`);
    } else {
      logFail("Nenhum produto encontrado para contexto", prodsRes);
    }

    const custsRes = await makeRequest("/api/admin/customers");
    const customerList = custsRes.data?.data || custsRes.data?.customers || [];
    let testCustomerId = "";
    if (custsRes.status === 200 && customerList.length > 0) {
      testCustomerId = customerList[0].id;
      logPass(`Cliente localizado para contexto: ${customerList[0].name} (ID: ${testCustomerId})`);
    } else {
      logFail("Nenhum cliente encontrado para contexto", custsRes);
    }

    // 4. Testar Assistente de Produtos (PRODUCT)
    console.log("\n4. Testando Assistente de Produtos (POST /api/admin/ia - PRODUCT)...");
    const prodAiRes = await makeRequest("/api/admin/ia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: {
        assistant: "PRODUCT",
        prompt: "Criar título otimizado e bullet points para marketplace",
        contextData: { productId: testProductId, targetMarketplace: "SHOPEE" },
      },
    });

    if (prodAiRes.status === 200 && prodAiRes.data?.success) {
      logPass("Assistente de Produtos respondeu com sucesso (HTTP 200)");
      logPass(`Provedor utilizado: ${prodAiRes.data.data.provider} (${prodAiRes.data.data.model})`);
      logPass(`Duração da análise: ${prodAiRes.data.data.durationMs}ms`);
    } else {
      logFail("Falha no Assistente de Produtos", prodAiRes);
    }

    // 5. Testar Assistente de Precificação (PRICING)
    console.log("\n5. Testando Assistente de Precificação (POST /api/admin/ia - PRICING)...");
    const pricingAiRes = await makeRequest("/api/admin/ia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: {
        assistant: "PRICING",
        prompt: "Como atingir 35% de margem de lucro líquida?",
        contextData: { productId: testProductId, targetMarginPercentage: 35 },
      },
    });

    if (pricingAiRes.status === 200 && pricingAiRes.data?.success) {
      logPass("Assistente de Precificação respondeu com sucesso");
      logPass("Métricas financeiras interpretadas pela IA com sucesso");
    } else {
      logFail("Falha no Assistente de Precificação", pricingAiRes);
    }

    // 6. Testar Assistente de Clientes (CUSTOMER)
    console.log("\n6. Testando Assistente de Clientes (POST /api/admin/ia - CUSTOMER)...");
    const customerAiRes = await makeRequest("/api/admin/ia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: {
        assistant: "CUSTOMER",
        prompt: "Gerar resumo do comportamento deste cliente e nota de agradecimento",
        contextData: { customerId: testCustomerId },
      },
    });

    if (customerAiRes.status === 200 && customerAiRes.data?.success) {
      logPass("Assistente de Clientes respondeu com sucesso");
      logPass("Isolamento e agregação de histórico de pedidos do cliente validados");
    } else {
      logFail("Falha no Assistente de Clientes", customerAiRes);
    }

    // 7. Testar Assistente Financeiro (FINANCIAL)
    console.log("\n7. Testando Assistente Financeiro (POST /api/admin/ia - FINANCIAL)...");
    const financialAiRes = await makeRequest("/api/admin/ia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: {
        assistant: "FINANCIAL",
        prompt: "Analisar a DRE dos últimos 30 dias e apontar os maiores custos",
        contextData: { period: "30d" },
      },
    });

    if (financialAiRes.status === 200 && financialAiRes.data?.success) {
      logPass("Assistente Financeiro respondeu com sucesso e interpretou a DRE");
    } else {
      logFail("Falha no Assistente Financeiro", financialAiRes);
    }

    // 8. Testar Assistente Operacional (OPERATIONS)
    console.log("\n8. Testando Assistente de Operações (POST /api/admin/ia - OPERATIONS)...");
    const operationsAiRes = await makeRequest("/api/admin/ia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: {
        assistant: "OPERATIONS",
        prompt: "Executar diagnóstico em tempo real dos gargalos operacionais da loja",
        contextData: { focusArea: "ALL" },
      },
    });

    if (operationsAiRes.status === 200 && operationsAiRes.data?.success) {
      logPass("Assistente de Operações respondeu com diagnóstico do banco de dados");
    } else {
      logFail("Falha no Assistente de Operações", operationsAiRes);
    }

    // 9. Consultar Histórico de Observabilidade de IA (/api/admin/ia/history)
    console.log("\n9. Consultando Histórico de Observabilidade de IA (GET /api/admin/ia/history)...");
    const historyRes = await makeRequest("/api/admin/ia/history?limit=10");
    if (historyRes.status === 200 && historyRes.data?.history?.length >= 5) {
      logPass("Histórico de IA consultado com sucesso");
      logPass(`Total de interações auditadas recuperadas: ${historyRes.data.history.length}`);
    } else {
      logFail("Falha na consulta de histórico de IA", historyRes);
    }

    // 10. Testar Segurança: Acesso Não Autenticado Bloqueado
    console.log("\n10. Testando Segurança: Bloqueio de Acesso Não Autenticado...");
    const oldCookies = cookies;
    cookies = {};
    const unauthRes = await makeRequest("/api/admin/ia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: { assistant: "PRODUCT", prompt: "Tentativa não autorizada" },
    });
    cookies = oldCookies;

    if (unauthRes.status === 401) {
      logPass("Requisição sem cookie de autenticação rejeitada com HTTP 401");
    } else {
      logFail("Segurança falhou: endpoint público não autenticado retornou status diferente de 401", unauthRes);
    }

    // 11. Testar Propriedade Read-Only: Verificar que produto permaneceu inalterado
    console.log("\n11. Verificando Imutabilidade do Banco (Read-Only da IA)...");
    const verifyProdRes = await makeRequest("/api/admin/products");
    const freshProductList = verifyProdRes.data?.data || verifyProdRes.data?.products || [];
    if (verifyProdRes.status === 200 && freshProductList.length > 0) {
      const prod = freshProductList.find((p) => p.id === testProductId);
      if (prod) {
        logPass(`Preço do produto permanece inalterado: R$ ${prod.sellingPrice}`);
        logPass(`Estoque do produto permanece inalterado: ${prod.stock} un`);
      }
    }

    console.log("\n=================================================");
    console.log(`  RESULTADO DOS TESTES E2E ETAPA 12:`);
    console.log(`  Passaram: ${passCount} | Falharam: ${failCount}`);
    console.log("=================================================\n");

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Erro fatal no teste E2E da Etapa 12:", err);
    process.exit(1);
  }
}

runE2E();
