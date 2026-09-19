"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Package,
  DollarSign,
  Users,
  TrendingUp,
  Activity,
  Send,
  Loader2,
  Clock,
  Cpu,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

type AssistantType = "PRODUCT" | "PRICING" | "CUSTOMER" | "FINANCIAL" | "OPERATIONS";

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
}

interface CustomerOption {
  id: string;
  name: string;
  email: string;
}

const ASSISTANTS = [
  {
    id: "PRODUCT" as AssistantType,
    name: "Produtos & Copy",
    icon: Package,
    color: "from-blue-500 to-indigo-600",
    badge: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    description: "Criação de títulos, descrições persuasivas, bullet points e otimização para SEO e Marketplaces.",
    suggestions: [
      "Criar uma descrição persuasiva destacando benefícios de durabilidade",
      "Otimizar título para busca na Shopee e Mercado Livre",
      "Sugerir 5 tags de alta conversão para este produto",
      "Identificar quais informações técnicas essenciais estão faltando no anúncio",
    ],
  },
  {
    id: "PRICING" as AssistantType,
    name: "Precificação & Margens",
    icon: DollarSign,
    color: "from-emerald-500 to-teal-600",
    badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    description: "Análise estratégica de margem x markup e simulação de custos de taxas e frete.",
    suggestions: [
      "Qual preço de venda preciso para obter 35% de margem líquida?",
      "Qual o impacto de uma taxa de marketplace de 16% na minha margem atual?",
      "Explicar a diferença entre a margem e o markup praticados neste produto",
      "Simular se vale a pena oferecer 10% de desconto no pagamento via PIX",
    ],
  },
  {
    id: "CUSTOMER" as AssistantType,
    name: "Clientes & SAC",
    icon: Users,
    color: "from-purple-500 to-pink-600",
    badge: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    description: "Diagnóstico de histórico de compra, fidelidade e geração de respostas personalizadas de SAC.",
    suggestions: [
      "Resumir o histórico comercial deste cliente e calcular seu nível de fidelidade",
      "Gerar uma resposta acolhedora para cliente com dúvida sobre rastreamento",
      "Identificar padrões de compra e sugerir produtos para oferta de recompra",
    ],
  },
  {
    id: "FINANCIAL" as AssistantType,
    name: "Controladoria & DRE",
    icon: TrendingUp,
    color: "from-amber-500 to-orange-600",
    badge: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    description: "Interpretação executiva da DRE, fluxo de caixa e diagnóstico de gargalos financeiros.",
    suggestions: [
      "Analisar o desempenho da DRE dos últimos 30 dias e apontar os maiores custos",
      "Qual a representatividade do CPV sobre a receita líquida no mês atual?",
      "Avaliar a saúde operacional e cobertura de despesas fixas da operação",
    ],
  },
  {
    id: "OPERATIONS" as AssistantType,
    name: "Diagnóstico Operacional",
    icon: Activity,
    color: "from-rose-500 to-red-600",
    badge: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    description: "Auditoria em tempo real de pedidos travados, produtos em risco de ruptura e integrações.",
    suggestions: [
      "Executar varredura completa de gargalos operacionais da loja agora",
      "Quais produtos estão com estoque crítico (<= 5 unidades)?",
      "Existem pedidos parados aguardando fornecedor há mais de 24 horas?",
      "Auditar se houve falhas de fulfillment ou disparos de webhook recentes",
    ],
  },
];

export default function AIAssistantPage() {
  const [activeAssistant, setActiveAssistant] = useState<AssistantType>("PRODUCT");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Contextos
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("30d");
  const [targetMarketplace, setTargetMarketplace] = useState<string>("STOREFRONT");

  // Histórico
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchContextData();
    fetchHistory();
  }, []);

  async function fetchContextData() {
    try {
      const [prodRes, custRes] = await Promise.all([
        fetch("/api/admin/products"),
        fetch("/api/admin/customers"),
      ]);

      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(prodData.products || prodData.data || []);
        if ((prodData.products || prodData.data || []).length > 0) {
          setSelectedProductId((prodData.products || prodData.data)[0].id);
        }
      }

      if (custRes.ok) {
        const custData = await custRes.json();
        setCustomers(custData.customers || custData.data || []);
        if ((custData.customers || custData.data || []).length > 0) {
          setSelectedCustomerId((custData.customers || custData.data)[0].id);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar contextos:", err);
    }
  }

  async function fetchHistory() {
    try {
      const res = await fetch("/api/admin/ia/history?limit=10");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
    }
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setError(null);

    const contextData: Record<string, any> = {};

    if (activeAssistant === "PRODUCT" || activeAssistant === "PRICING") {
      if (selectedProductId) contextData.productId = selectedProductId;
      if (activeAssistant === "PRODUCT") contextData.targetMarketplace = targetMarketplace;
    } else if (activeAssistant === "CUSTOMER") {
      if (!selectedCustomerId) {
        setError("Selecione um cliente para prosseguir.");
        setLoading(false);
        return;
      }
      contextData.customerId = selectedCustomerId;
    } else if (activeAssistant === "FINANCIAL") {
      contextData.period = selectedPeriod;
    } else if (activeAssistant === "OPERATIONS") {
      contextData.focusArea = "ALL";
    }

    try {
      const res = await fetch("/api/admin/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assistant: activeAssistant,
          prompt,
          contextData,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao consultar IA.");
      }

      setResponse(data.data);
      fetchHistory();
    } catch (err: any) {
      setError(err.message || "Falha na comunicação com o assistente.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (response?.content) {
      navigator.clipboard.writeText(response.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const currentAssistantObj = ASSISTANTS.find((a) => a.id === activeAssistant)!;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                Assistentes de Inteligência Artificial
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  DropHub AI Core v12
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                Copilotos especializados para análise de catálogo, precificação estratégica, clientes, financeiro e operações.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <span>Servidor Protegido • Sem Mutação Direta</span>
        </div>
      </div>

      {/* Seletor de Assistentes */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {ASSISTANTS.map((ast) => {
          const Icon = ast.icon;
          const isSelected = activeAssistant === ast.id;
          return (
            <button
              key={ast.id}
              onClick={() => {
                setActiveAssistant(ast.id);
                setError(null);
              }}
              className={`p-4 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${
                isSelected
                  ? "bg-slate-800/90 border-emerald-500/40 shadow-lg shadow-emerald-500/5 ring-1 ring-emerald-500/30"
                  : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isSelected ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                {isSelected && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </div>
              <div>
                <h3 className={`text-sm font-semibold ${isSelected ? "text-white" : "text-slate-300"}`}>
                  {ast.name}
                </h3>
                <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">{ast.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Área Principal de Interação */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Painel Esquerdo: Configuração de Contexto e Input */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${currentAssistantObj.badge}`}>
                {currentAssistantObj.name}
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5" /> Selecione o contexto abaixo
              </span>
            </div>

            {/* Context Pickers Dinâmicos */}
            {(activeAssistant === "PRODUCT" || activeAssistant === "PRICING") && (
              <div className="space-y-3">
                <label className="text-xs font-medium text-slate-300">Produto Alvo</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">-- Analisar sem produto vinculado --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (SKU: {p.sku} | Venda: R$ {Number(p.sellingPrice).toFixed(2)})
                    </option>
                  ))}
                </select>

                {activeAssistant === "PRODUCT" && (
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Canal de Venda Alvo
                    </label>
                    <select
                      value={targetMarketplace}
                      onChange={(e) => setTargetMarketplace(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2 focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="STOREFRONT">Loja Própria (DropHub Storefront)</option>
                      <option value="SHOPEE">Shopee Brasil</option>
                      <option value="MERCADO_LIVRE">Mercado Livre</option>
                      <option value="AMAZON">Amazon Brasil</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {activeAssistant === "CUSTOMER" && (
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Cliente Alvo</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">-- Selecione o Cliente --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {activeAssistant === "FINANCIAL" && (
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Período da DRE</label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="today">Hoje</option>
                  <option value="7d">Últimos 7 dias</option>
                  <option value="30d">Últimos 30 dias (Recomendado)</option>
                  <option value="month">Mês Atual</option>
                  <option value="last_month">Mês Anterior</option>
                </select>
              </div>
            )}

            {/* Prompt Chips de Sugestão Rápida */}
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Sugestões Prontas de Prompt:
              </span>
              <div className="flex flex-wrap gap-2">
                {currentAssistantObj.suggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrompt(sug)}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700/80 border border-slate-700/50 transition-colors text-left"
                  >
                    💡 {sug}
                  </button>
                ))}
              </div>
            </div>

            {/* Formulário de Pergunta */}
            <form onSubmit={handleSubmit} className="space-y-3 pt-2">
              <label className="text-xs font-medium text-slate-300">
                Sua Pergunta ou Instrução para a IA:
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: Como posso precificar este item para cobrir uma campanha com 12% de CPA e obter 30% de margem líquida?"
                rows={4}
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-sm rounded-lg p-3 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-600 resize-none"
              />

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-500">
                  {prompt.length}/1000 caracteres
                </span>
                <button
                  type="submit"
                  disabled={loading || !prompt.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Consultando IA...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Executar Análise
                    </>
                  )}
                </button>
              </div>
            </form>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2.5 text-xs text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Painel Direito: Resposta Formatada da IA */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex flex-col justify-between min-h-[460px]">
            <div>
              {/* Header do Resultado */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-200">Resposta do Assistente</span>
                  {response && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {response.model}
                    </span>
                  )}
                </div>

                {response && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{response.durationMs}ms</span>
                    </div>
                    <button
                      onClick={handleCopy}
                      className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                      title="Copiar resposta"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Conteúdo da Resposta */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                  <p className="text-sm font-medium">Processando análise com dados reais do DropHub...</p>
                  <span className="text-xs text-slate-500">Consultando contexto e métricas determinísticas</span>
                </div>
              ) : response ? (
                <div className="prose prose-invert max-w-none text-slate-200 text-sm leading-relaxed whitespace-pre-line space-y-3">
                  {response.content}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-2">
                  <Sparkles className="w-10 h-10 text-slate-700 stroke-1" />
                  <p className="text-sm font-medium">Nenhuma análise executada ainda.</p>
                  <p className="text-xs text-slate-600 text-center max-w-xs">
                    Selecione um assistente, ajuste o contexto e execute uma pergunta para receber insights estruturados.
                  </p>
                </div>
              )}
            </div>

            {response && (
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                <span>Tokens consumidos: {response.tokensUsed ?? "N/A"}</span>
                <span>Provedor: {response.provider}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Histórico Recente de Interações de IA */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-emerald-400" />
            Auditoria e Histórico de Interações (AIInteraction)
          </h2>
          <button
            onClick={fetchHistory}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
          >
            Atualizar
          </button>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-slate-500 py-4">Nenhum registro de interação gravado no ledger de IA.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium">
                  <th className="py-2.5 px-3">Assistente</th>
                  <th className="py-2.5 px-3">Solicitação (Resumo)</th>
                  <th className="py-2.5 px-3">Provedor / Modelo</th>
                  <th className="py-2.5 px-3">Latência</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Data / Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-100">{item.assistant}</td>
                    <td className="py-2.5 px-3 max-w-xs truncate text-slate-300">{item.promptSummary}</td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {item.provider} ({item.model})
                    </td>
                    <td className="py-2.5 px-3">{item.durationMs}ms</td>
                    <td className="py-2.5 px-3">
                      {item.success ? (
                        <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[10px] font-semibold">
                          SUCESSO
                        </span>
                      ) : (
                        <span className="text-red-400 bg-red-500/10 px-2 py-0.5 rounded text-[10px] font-semibold">
                          FALHA
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {new Date(item.createdAt).toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
