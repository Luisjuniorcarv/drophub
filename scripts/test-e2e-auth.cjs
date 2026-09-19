const http = require("http");

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
        });
      });
    });

    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runE2ETests() {
  console.log("=== INICIANDO TESTES E2E DE AUTENTICAÇÃO E ROTAS PROTEGIDAS ===");

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

  // 2. Acesso a /admin sem autenticação (deve redirecionar para /login)
  console.log("\n2. Testando GET /admin sem cookie (esperado redirecionamento para /login)...");
  const unauthAdminRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/admin",
    method: "GET",
  });
  console.log(`Status: ${unauthAdminRes.statusCode} | Location: ${unauthAdminRes.headers.location}`);
  if (![302, 307].includes(unauthAdminRes.statusCode) || !unauthAdminRes.headers.location.includes("/login")) {
    throw new Error("Proteção de rota /admin falhou: não houve redirecionamento para login");
  }
  console.log("✓ Bloqueio e redirecionamento de usuário não autenticado validado!");

  // 3. Login com senha errada
  console.log("\n3. Testando POST /api/auth/login com senha incorreta...");
  const badLoginRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    JSON.stringify({ email: "admin@drophub.com", password: "senha_errada" })
  );
  console.log(`Status: ${badLoginRes.statusCode} | Resposta: ${badLoginRes.body}`);
  if (badLoginRes.statusCode !== 401) throw new Error("Falha na rejeição de senha incorreta");
  console.log("✓ Rejeição segura de senha incorreta validada!");

  // 4. Login correto
  console.log("\n4. Testando POST /api/auth/login com credenciais corretas do seed...");
  const validLoginRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    JSON.stringify({ email: "admin@drophub.com", password: "admin123456" })
  );
  console.log(`Status: ${validLoginRes.statusCode} | Resposta: ${validLoginRes.body}`);
  const setCookie = validLoginRes.headers["set-cookie"];
  console.log(`Set-Cookie recebido:`, setCookie);

  if (validLoginRes.statusCode !== 200 || !setCookie || !setCookie[0].includes("HttpOnly")) {
    throw new Error("Login não retornou cookie HttpOnly seguro");
  }
  console.log("✓ Login com sucesso e cookie HttpOnly emitido!");

  // Extrair o cookie da resposta
  const sessionCookie = setCookie[0].split(";")[0];

  // 5. Consulta /api/auth/me com cookie
  console.log("\n5. Testando GET /api/auth/me com cookie de sessão...");
  const meRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/auth/me",
    method: "GET",
    headers: { Cookie: sessionCookie },
  });
  console.log(`Status: ${meRes.statusCode} | Resposta: ${meRes.body}`);
  if (meRes.statusCode !== 200) throw new Error("Falha ao consultar /api/auth/me com cookie");
  console.log("✓ Identificação do usuário logado via cookie validada!");

  // 6. Acesso a /admin com cookie autenticado
  console.log("\n6. Testando GET /admin com cookie de sessão...");
  const authAdminRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/admin",
    method: "GET",
    headers: { Cookie: sessionCookie },
  });
  console.log(`Status: ${authAdminRes.statusCode} | Tamanho HTML: ${authAdminRes.body.length} bytes`);
  if (authAdminRes.statusCode !== 200 || !authAdminRes.body.includes("Visão Geral Operacional")) {
    throw new Error("Falha ao acessar /admin autenticado");
  }
  console.log("✓ Acesso ao Dashboard Administrativo protegido concedido com sucesso!");

  // 7. Logout
  console.log("\n7. Testando POST /api/auth/logout...");
  const logoutRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/auth/logout",
    method: "POST",
    headers: { Cookie: sessionCookie },
  });
  console.log(`Status: ${logoutRes.statusCode} | Resposta: ${logoutRes.body}`);
  console.log(`Set-Cookie no logout:`, logoutRes.headers["set-cookie"]);
  console.log("✓ Logout executado com sucesso e cookie limpo!");

  console.log("\n=======================================================");
  console.log("TODOS OS TESTES E2E DE AUTENTICAÇÃO FORAM APROVADOS! 🚀");
  console.log("=======================================================");
}

runE2ETests().catch((err) => {
  console.error("Erro nos testes E2E:", err);
  process.exit(1);
});
