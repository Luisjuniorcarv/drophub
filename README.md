# DropHub 🚀

> Plataforma completa, modular e pronta para produção para gestão e operação de e-commerce e dropshipping.

Construído com foco em **segurança**, **modularidade**, **dados reais** e **arquitetura desacoplada**.

---

## 🛠️ Stack Tecnológica

- **Frontend:** Next.js 15+ (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons
- **Backend:** Next.js API Routes (REST), Node.js
- **Banco de Dados:** PostgreSQL 16+ com Prisma ORM
- **Autenticação:** Sessão com JWT criptografado em cookies **HTTP-Only**, **Secure** e **SameSite**
- **Infraestrutura:** Docker, Docker Compose, Multi-stage builds
- **Integrações:**
  - **n8n / Automações:** Desacoplado via webhooks assíncronos não-bloqueantes
  - **IA (OpenAI):** Geração de títulos, descrições, SEO, FAQ e precificação com fallback explícito
  - **Gateway de Pagamento:** Interface modular abstrata (Iniciando em Modo Teste / Mock)

---

## 📂 Arquitetura de Pastas e Módulos

```
drophub/
├── prisma/
│   ├── schema.prisma            # Modelagem das 19 tabelas e relacionamentos
│   ├── migrations/              # Histórico de migrações versionadas
│   └── seed.ts                  # Seed com dados reais para testes
├── src/
│   ├── app/                     # Next.js App Router (Admin, Loja pública e APIs)
│   │   ├── (admin)/             # Painel Administrativo protegido
│   │   ├── (store)/             # Loja pública e Checkout
│   │   └── api/                 # Endpoints REST e Webhooks
│   ├── components/
│   │   ├── ui/                  # Componentes reutilizáveis (Button, Card, Modal, etc.)
│   │   ├── admin/               # Widgets do Painel (Timeline, Métricas, Calculadora)
│   │   └── store/               # Vitrine, Carrinho e Checkout
│   ├── modules/                 # Regras de Negócio Isoladas
│   │   ├── auth/                # JWT, senhas com bcryptjs, cookies HTTP-only
│   │   ├── products/            # Regras de produtos, estoque e variações
│   │   ├── suppliers/           # Gestão de fornecedores
│   │   ├── customers/           # Clientes e endereços
│   │   ├── orders/              # Máquina de estados e histórico de pedidos
│   │   ├── payments/            # Abstração de gateways (Mock/MercadoPago)
│   │   ├── finance/             # Fórmulas de Margem vs. Markup e DRE
│   │   ├── ai/                  # Provedores de IA com tratamento de erros
│   │   ├── automations/         # Dispatcher para n8n e webhooks
│   │   └── settings/            # Parâmetros e configurações da loja
│   ├── lib/                     # Utilitários, validadores Zod, formatadores e Prisma
│   └── types/                   # Interfaces TypeScript
├── docker/
│   ├── Dockerfile               # Build de produção multi-stage
│   └── docker-compose.yml       # Orquestração (PostgreSQL + DropHub)
├── tests/                       # Testes unitários e de integração
└── README.md
```

---

## 🧮 Regras Financeiras: Margem vs. Markup

No DropHub, os conceitos financeiros são matematicamente rigorosos:

- **Lucro Bruto:** $\text{Preço de Venda} - \text{Custo Total}$
- **Margem de Lucro (% sobre a Venda):**
  $$\text{Margem (\%)} = \left(\frac{\text{Lucro}}{\text{Preço de Venda}}\right) \times 100$$
- **Markup (% sobre o Custo):**
  $$\text{Markup (\%)} = \left(\frac{\text{Lucro}}{\text{Custo Total}}\right) \times 100$$

---

## 🚀 Instalação e Execução Local

### Pré-requisitos
- Node.js 20+ ou 22+
- npm ou yarn
- PostgreSQL local ou Docker

### 1. Clonar e Instalar Dependências
```bash
cd drophub
npm install
```

### 2. Configurar Variáveis de Ambiente
Copie o arquivo de exemplo e ajuste as variáveis:
```bash
cp .env.example .env
```

### 3. Configurar o Banco de Dados (Prisma)
```bash
# Gerar o client do Prisma
npx prisma generate

# Executar as migrações no PostgreSQL
npx prisma migrate dev --name init

# Popular o banco com dados de teste realistas
npx prisma db seed
```

### 4. Executar em Modo de Desenvolvimento
```bash
npm run dev
```
Acesse:
- **Loja Pública:** [http://localhost:3000](http://localhost:3000)
- **Painel Administrativo:** [http://localhost:3000/admin](http://localhost:3000/admin)
- **Healthcheck:** [http://localhost:3000/api/health](http://localhost:3000/api/health)

---

## 🐳 Execução com Docker & Docker Compose

Para subir a aplicação completa com PostgreSQL em containers:

```bash
# Iniciar banco e aplicação
docker compose up -d --build

# Verificar logs
docker compose logs -f app
```

---

## 🌐 Deploy em VPS / EasyPanel / Coolify

1. No EasyPanel ou Coolify, crie uma aplicação a partir do repositório Git.
2. Defina o build type como **Dockerfile** (usando o `Dockerfile` raiz).
3. Adicione o serviço de banco **PostgreSQL**.
4. Configure as variáveis de ambiente baseadas no `.env.example`.
5. Execute `npx prisma migrate deploy` no build ou entrypoint.

---

## 🧪 Testes Automatizados

```bash
# Executar todos os testes com Vitest
npm test
```

---

## 🔒 Segurança

- **Cookies HTTP-Only:** O token JWT nunca fica exposto no JavaScript do cliente / LocalStorage.
- **Auditoria de Pedidos:** A tabela `OrderStatusHistory` grava imutavelmente quem alterou, quando e o motivo de cada alteração de status.
- **Validação:** Todas as entradas de formulários e rotas REST são validadas com esquemas estritos do **Zod**.
- **Autenticação em Webhooks:** Validação obrigatória de token secreto no header `x-webhook-secret`.

---

## 📄 Licença

Projeto proprietário para operação do DropHub.
