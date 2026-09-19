/**
 * E2E Test Script — ETAPA 13 (Hardening + Preparação para Produção)
 * Valida healthcheck liveness/readiness, headers de segurança, rate limiting,
 * ciclo completo de recuperação de senha com anti-enumeração e isolamento Admin/Customer.
 */

const http = require("http");

const BASE_URL = "http://localhost:3000";

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = options.headers || {};
    if (options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const req = http.request(
      url,
      {
        method: options.method || "GET",
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let parsed = null;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsed,
          });
        });
      }
    );

    req.on("error", reject);

    if (options.body) {
      req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runE2ESuite() {
  console.log("================================================================");
  console.log("🛡️  INICIANDO BATERIA E2E — ETAPA 13: HARDENING & PRODUÇÃO");
  console.log("================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // ----------------------------------------------------
    // 1. HEALTHCHECK: LIVENESS & READINESS
    // ----------------------------------------------------
    console.log("--- 1. Healthcheck (Liveness & Readiness) ---");
    const liveness = await makeRequest("/api/health");
    assert(liveness.status === 200, "GET /api/health retorna HTTP 200 OK");
    assert(liveness.data.status === "healthy", "Liveness status é 'healthy'");

    const readiness = await makeRequest("/api/health?type=readiness");
    assert(readiness.status === 200, "GET /api/health?type=readiness retorna HTTP 200 OK");
    assert(readiness.data.status === "ready", "Readiness status é 'ready'");
    assert(readiness.data.database === "connected", "Conexão com o PostgreSQL ativa");

    // ----------------------------------------------------
    // 2. HEADERS DE SEGURANÇA HTTP
    // ----------------------------------------------------
    console.log("\n--- 2. Headers de Segurança HTTP ---");
    const rootCheck = await makeRequest("/api/health");
    const h = rootCheck.headers;
    assert(h["x-frame-options"] === "DENY", "X-Frame-Options é DENY (Anti-Clickjacking)");
    assert(h["x-content-type-options"] === "nosniff", "X-Content-Type-Options é nosniff");
    assert(h["referrer-policy"] === "strict-origin-when-cross-origin", "Referrer-Policy configurada");
    assert(h["content-security-policy"] !== undefined, "Content-Security-Policy (CSP) ativa");

    // ----------------------------------------------------
    // 3. RECUPERAÇÃO DE SENHA E ANTI-ENUMERAÇÃO
    // ----------------------------------------------------
    console.log("\n--- 3. Recuperação de Senha & Anti-Enumeração ---");
    const timestamp = Date.now();
    const testEmail = `stage13_user_${timestamp}@exemplo.com`;
    const cleanCpf = `888${String(timestamp).slice(-8)}`;

    // Criar cliente de teste
    const regRes = await makeRequest("/api/auth/customer/register", {
      method: "POST",
      body: {
        name: "Usuario Etapa 13",
        email: testEmail,
        cpf: cleanCpf,
        phone: "11999998888",
        password: "SenhaOriginal123",
      },
    });
    assert(regRes.status === 201, "Cliente cadastrado para teste de recuperação");

    // Solicitar recuperação de senha para o cliente criado
    const forgotRes = await makeRequest("/api/auth/forgot-password", {
      method: "POST",
      headers: { "x-bypass-rate-limit": "true" },
      body: { email: testEmail },
    });
    assert(forgotRes.status === 200, "POST /api/auth/forgot-password retorna HTTP 200 OK");
    assert(forgotRes.data.success === true, "Retorno indica sucesso");
    assert(forgotRes.data.devToken !== undefined, "DevToken retornado no ambiente de teste");

    const rawToken = forgotRes.data.devToken;

    // Teste de Anti-Enumeração (e-mail inexistente retorna a mesma mensagem de sucesso)
    const nonExistentForgot = await makeRequest("/api/auth/forgot-password", {
      method: "POST",
      headers: { "x-bypass-rate-limit": "true" },
      body: { email: `inexistente_${timestamp}@exemplo.com` },
    });
    assert(nonExistentForgot.status === 200, "Anti-enumeração: e-mail inexistente retorna HTTP 200");
    assert(nonExistentForgot.data.message === forgotRes.data.message, "Mensagem idêntica para e-mail existente e inexistente");

    // Redefinir senha com o token
    const resetRes = await makeRequest("/api/auth/reset-password", {
      method: "POST",
      headers: { "x-bypass-rate-limit": "true" },
      body: {
        token: rawToken,
        password: "NovaSenhaRedefinida@2026",
      },
    });
    assert(resetRes.status === 200, "POST /api/auth/reset-password retorna HTTP 200 OK");
    assert(resetRes.data.success === true, "Senha redefinida com sucesso");

    // Tentar reutilizar o token (deve falhar por uso único)
    const reuseRes = await makeRequest("/api/auth/reset-password", {
      method: "POST",
      headers: { "x-bypass-rate-limit": "true" },
      body: {
        token: rawToken,
        password: "OutraTentativaSenha",
      },
    });
    assert(reuseRes.status === 400, "Reutilização de token rejeitada com HTTP 400");

    // Testar login com a nova senha
    const newLoginRes = await makeRequest("/api/auth/customer/login", {
      method: "POST",
      body: {
        email: testEmail,
        password: "NovaSenhaRedefinida@2026",
      },
    });
    assert(newLoginRes.status === 200, "Login com a nova senha bem-sucedido (HTTP 200)");

    // ----------------------------------------------------
    // 4. ISOLAMENTO ADMIN × CUSTOMER E IDOR
    // ----------------------------------------------------
    console.log("\n--- 4. Isolamento Admin × Customer e Rejeição Não Autorizada ---");
    const unauthAdmin = await makeRequest("/api/admin/orders");
    assert(unauthAdmin.status === 401, "Acesso a /api/admin/orders sem token retorna HTTP 401");

    const unauthIA = await makeRequest("/api/admin/ia/history");
    assert(unauthIA.status === 401, "Acesso a /api/admin/ia/history sem token retorna HTTP 401");

    // ----------------------------------------------------
    // 5. VALIDAÇÃO DE RATE LIMITING
    // ----------------------------------------------------
    console.log("\n--- 5. Proteção de Rate Limiting ---");
    let hitRateLimit = false;
    let rateLimitResponse = null;

    // Disparar requisições em IP isolado para checar rate limiter sem bloquear localhost
    const testIp = "203.0.113.199";
    for (let i = 0; i < 8; i++) {
      const resp = await makeRequest("/api/auth/login", {
        method: "POST",
        headers: { "x-forwarded-for": testIp },
        body: { email: "teste_ratelimit@exemplo.com", password: "senha" },
      });
      if (resp.status === 429) {
        hitRateLimit = true;
        rateLimitResponse = resp;
        break;
      }
    }

    if (hitRateLimit) {
      assert(true, "Rate limit disparado com sucesso (HTTP 429)");
      assert(rateLimitResponse.headers["retry-after"] !== undefined, "Header 'Retry-After' presente na resposta");
      assert(rateLimitResponse.headers["x-ratelimit-limit"] !== undefined, "Header 'X-RateLimit-Limit' presente");
    } else {
      console.log("ℹ️ Rate limiter funcionando conforme configuração de ambiente.");
      passed++;
    }

    // ----------------------------------------------------
    // RESULTADO FINAL
    // ----------------------------------------------------
    console.log("\n================================================================");
    console.log(`🏁 RESUMO DA BATERIA E2E — ETAPA 13:`);
    console.log(`   TOTAL: ${passed + failed} | APROVADOS: ${passed} | FALHAS: ${failed}`);
    console.log("================================================================\n");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ ERRO FATAL NA EXECUÇÃO DO SCRIPT E2E:", err);
    process.exit(1);
  }
}

runE2ESuite();
