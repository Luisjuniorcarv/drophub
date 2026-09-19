"use client";

import React, { useState, useEffect } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  Boxes,
  PlusCircle,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  Scale,
  ShieldCheck,
  History,
  Loader2,
  Package,
} from "lucide-react";

interface StockItem {
  id: string;
  productId: string;
  variantId: string | null;
  name: string;
  sku: string;
  stock: number;
  isVariant: boolean;
  status: string;
  costPrice: number;
  sellingPrice: number;
}

interface StockSummary {
  totalSkus: number;
  totalUnitsInStock: number;
  lowStockCount: number;
  outOfStockCount: number;
  items: StockItem[];
}

interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  sku: string;
  orderId: string | null;
  orderNumber: string | null;
  userId: string | null;
  userName: string;
  type: string;
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  reason: string | null;
  idempotencyKey: string | null;
  metadata: any;
  createdAt: string;
}

interface ReconciliationData {
  productId: string;
  variantId: string | null;
  name: string;
  sku: string;
  currentBalance: number;
  calculatedFromMovements: number;
  difference: number;
  isConsistent: boolean;
  totalMovementsCount: number;
}

export default function StockAdminPage() {
  const [activeTab, setActiveTab] = useState<"balances" | "movements">("balances");
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementsPagination, setMovementsPagination] = useState({ total: 0, page: 1, limit: 30, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] = useState("ALL");

  // Modals state
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isReconcileOpen, setIsReconcileOpen] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState<StockItem | null>(null);

  // Form states
  const [restockQty, setRestockQty] = useState<number>(10);
  const [restockCost, setRestockCost] = useState<number>(0);
  const [restockReason, setRestockReason] = useState("");
  const [isSubmittingRestock, setIsSubmittingRestock] = useState(false);

  const [adjustNewBalance, setAdjustNewBalance] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustType, setAdjustType] = useState<"ADJUSTMENT" | "CORRECTION">("ADJUSTMENT");
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  // Reconcile state
  const [reconciliation, setReconciliation] = useState<ReconciliationData | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === "movements") {
      loadMovements(1);
    }
  }, [activeTab, movementTypeFilter]);

  async function loadData() {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/admin/stock/summary");
      if (!res.ok) throw new Error("Falha ao carregar sumário de estoque");
      const json = await res.json();
      setSummary(json.data);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao conectar à API de estoque.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadMovements(page = 1) {
    try {
      let url = `/api/admin/stock/movements?page=${page}&limit=30`;
      if (movementTypeFilter !== "ALL") {
        url += `&type=${movementTypeFilter}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Falha ao carregar histórico");
      const json = await res.json();
      setMovements(json.data || []);
      setMovementsPagination(json.pagination || { total: 0, page: 1, limit: 30, totalPages: 1 });
    } catch (err: any) {
      console.error(err);
    }
  }

  function handleOpenRestock(item: StockItem) {
    setSelectedStockItem(item);
    setRestockQty(10);
    setRestockCost(item.costPrice || 0);
    setRestockReason("Reposição de estoque via Painel Administrativo");
    setIsRestockOpen(true);
  }

  function handleOpenAdjust(item: StockItem) {
    setSelectedStockItem(item);
    setAdjustNewBalance(item.stock);
    setAdjustReason("");
    setAdjustType("ADJUSTMENT");
    setIsAdjustOpen(true);
  }

  async function handleOpenReconcile(item: StockItem) {
    setSelectedStockItem(item);
    setIsReconcileOpen(true);
    setIsReconciling(true);
    setReconciliation(null);
    try {
      let url = `/api/admin/stock/reconcile/${item.productId}`;
      if (item.variantId) {
        url += `?variantId=${item.variantId}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Falha na auditoria");
      const json = await res.json();
      setReconciliation(json.data);
    } catch (err: any) {
      setErrorMessage("Erro ao consultar reconciliação.");
    } finally {
      setIsReconciling(false);
    }
  }

  async function handleSubmitRestock(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStockItem) return;
    if (restockQty <= 0) {
      alert("A quantidade de reposição deve ser maior que zero.");
      return;
    }

    setIsSubmittingRestock(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/admin/stock/restock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedStockItem.productId,
          variantId: selectedStockItem.variantId,
          quantity: Number(restockQty),
          unitCost: Number(restockCost) || undefined,
          reason: restockReason || "Reposição de Estoque",
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao realizar reposição.");

      setSuccessMessage(`Reposição de +${restockQty} un realizada com sucesso para ${selectedStockItem.name}!`);
      setIsRestockOpen(false);
      await loadData();
      if (activeTab === "movements") loadMovements(1);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmittingRestock(false);
    }
  }

  async function handleSubmitAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStockItem) return;
    if (adjustNewBalance < 0) {
      alert("O novo saldo não pode ser negativo.");
      return;
    }
    if (!adjustReason || adjustReason.trim().length < 3) {
      alert("Informe uma justificativa de pelo menos 3 caracteres.");
      return;
    }

    setIsSubmittingAdjust(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/admin/stock/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedStockItem.productId,
          variantId: selectedStockItem.variantId,
          newBalance: Number(adjustNewBalance),
          reason: adjustReason.trim(),
          type: adjustType,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao realizar ajuste.");

      setSuccessMessage(`Ajuste de estoque concluído! Novo saldo: ${adjustNewBalance} un.`);
      setIsAdjustOpen(false);
      await loadData();
      if (activeTab === "movements") loadMovements(1);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmittingAdjust(false);
    }
  }

  function getMovementBadge(type: string) {
    switch (type) {
      case "SALE":
        return <Badge variant="danger">Venda (Saída)</Badge>;
      case "RESTOCK":
        return <Badge variant="success">Reposição (Entrada)</Badge>;
      case "ADJUSTMENT":
        return <Badge variant="info">Ajuste Manual</Badge>;
      case "CORRECTION":
        return <Badge variant="warning">Correção</Badge>;
      case "CANCEL":
        return <Badge variant="info">Cancelamento (Devolução)</Badge>;
      case "RETURN":
        return <Badge variant="success">Devolução</Badge>;
      default:
        return <Badge variant="neutral">{type}</Badge>;
    }
  }

  const filteredStockItems = (summary?.items || []).filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(query) ||
      item.sku.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Boxes className="w-7 h-7 text-emerald-400" />
            Controle de Estoque Avançado
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Gestão atômica de saldos, auditoria imutável (append-only ledger) e proteção contra concorrência e overselling.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              loadData();
              if (activeTab === "movements") loadMovements(1);
            }}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Alertas */}
      {errorMessage && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage("")} className="text-xs underline hover:text-white">
            Fechar
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage("")} className="text-xs underline hover:text-white">
            Fechar
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total de SKUs</p>
              <h3 className="text-2xl font-bold text-white mt-1">
                {summary ? summary.totalSkus : "--"}
              </h3>
              <p className="text-xs text-slate-500 mt-1">Produtos e variações ativas</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
              <Package className="w-6 h-6 text-slate-300" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Unidades em Estoque</p>
              <h3 className="text-2xl font-bold text-emerald-400 mt-1">
                {summary ? summary.totalUnitsInStock.toLocaleString("pt-BR") : "--"}
              </h3>
              <p className="text-xs text-slate-500 mt-1">Saldo físico consolidado</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Boxes className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Estoque Baixo (≤ 5)</p>
              <h3 className="text-2xl font-bold text-amber-400 mt-1">
                {summary ? summary.lowStockCount : "--"}
              </h3>
              <p className="text-xs text-slate-500 mt-1">Requer atenção operacional</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-400">Sem Estoque (0)</p>
              <h3 className="text-2xl font-bold text-rose-400 mt-1">
                {summary ? summary.outOfStockCount : "--"}
              </h3>
              <p className="text-xs text-slate-500 mt-1">Indisponível para venda</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertCircle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab("balances")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "balances"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Boxes className="w-4 h-4" />
          Saldos por SKU ({summary?.items.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("movements")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "movements"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <History className="w-4 h-4" />
          Histórico de Movimentações (Ledger)
        </button>
      </div>

      {/* TAB 1: SALDOS POR SKU */}
      {activeTab === "balances" && (
        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                placeholder="Buscar por SKU ou Nome do Produto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-950/50 border-slate-700 text-sm"
              />
            </div>
            <p className="text-xs text-slate-400">
              Exibindo <span className="text-white font-medium">{filteredStockItems.length}</span> itens
            </p>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400 font-semibold">SKU</TableHead>
                  <TableHead className="text-slate-400 font-semibold">Produto / Variação</TableHead>
                  <TableHead className="text-slate-400 font-semibold text-right">Custo Unit.</TableHead>
                  <TableHead className="text-slate-400 font-semibold text-right">Venda Unit.</TableHead>
                  <TableHead className="text-slate-400 font-semibold text-center">Saldo Atual</TableHead>
                  <TableHead className="text-slate-400 font-semibold text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                      Carregando saldos de estoque...
                    </TableCell>
                  </TableRow>
                ) : filteredStockItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                      Nenhum produto encontrado com os filtros aplicados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStockItems.map((item) => (
                    <TableRow key={item.id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                      <TableCell className="font-mono text-xs font-semibold text-slate-300">
                        {item.sku}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-white">{item.name}</div>
                        {item.isVariant && (
                          <span className="text-[11px] text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            Variação
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-slate-400 text-sm">
                        {formatCurrency(item.costPrice)}
                      </TableCell>
                      <TableCell className="text-right text-slate-200 font-medium text-sm">
                        {formatCurrency(item.sellingPrice)}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.stock === 0 ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            0 un (Esgotado)
                          </span>
                        ) : item.stock <= 5 ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {item.stock} un (Baixo)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {item.stock} un
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenRestock(item)}
                            className="h-8 px-2.5 text-xs text-emerald-400 hover:text-white hover:bg-emerald-600/20 border-emerald-500/30"
                            title="Repor Estoque"
                          >
                            <PlusCircle className="w-3.5 h-3.5 mr-1" />
                            Repor
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenAdjust(item)}
                            className="h-8 px-2.5 text-xs text-slate-300 hover:text-white"
                            title="Ajuste Manual"
                          >
                            <Sliders className="w-3.5 h-3.5 mr-1" />
                            Ajustar
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenReconcile(item)}
                            className="h-8 px-2 text-xs text-blue-400 hover:text-blue-300 border-blue-500/20"
                            title="Auditoria e Reconciliação"
                          >
                            <Scale className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* TAB 2: HISTÓRICO DE MOVIMENTAÇÕES (LEDGER) */}
      {activeTab === "movements" && (
        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-semibold uppercase">Filtrar por Tipo:</span>
              <select
                value={movementTypeFilter}
                onChange={(e) => setMovementTypeFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">Todos os Tipos</option>
                <option value="SALE">Venda (SALE)</option>
                <option value="RESTOCK">Reposição (RESTOCK)</option>
                <option value="ADJUSTMENT">Ajuste Manual (ADJUSTMENT)</option>
                <option value="CANCEL">Cancelamento (CANCEL)</option>
                <option value="RETURN">Devolução (RETURN)</option>
                <option value="CORRECTION">Correção (CORRECTION)</option>
              </select>
            </div>
            <p className="text-xs text-slate-400">
              Total de movimentações: <span className="text-white font-medium">{movementsPagination.total}</span>
            </p>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400 font-semibold">Data / Hora</TableHead>
                  <TableHead className="text-slate-400 font-semibold">Tipo</TableHead>
                  <TableHead className="text-slate-400 font-semibold">Produto / SKU</TableHead>
                  <TableHead className="text-slate-400 font-semibold text-center">Qtd</TableHead>
                  <TableHead className="text-slate-400 font-semibold text-center">Saldo Ant. → Novo</TableHead>
                  <TableHead className="text-slate-400 font-semibold">Origem / Motivo</TableHead>
                  <TableHead className="text-slate-400 font-semibold">Operador</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                      Nenhuma movimentação registrada no histórico.
                    </TableCell>
                  </TableRow>
                ) : (
                  movements.map((m) => (
                    <TableRow key={m.id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                      <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                        {formatDate(m.createdAt)}
                      </TableCell>
                      <TableCell>{getMovementBadge(m.type)}</TableCell>
                      <TableCell>
                        <div className="font-medium text-white text-xs">
                          {m.productName} {m.variantName ? `(${m.variantName})` : ""}
                        </div>
                        <span className="font-mono text-[11px] text-slate-400">{m.sku}</span>
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        {m.quantity > 0 ? (
                          <span className="font-bold text-emerald-400 text-xs inline-flex items-center gap-0.5">
                            <ArrowUpRight className="w-3.5 h-3.5" />+{m.quantity}
                          </span>
                        ) : m.quantity < 0 ? (
                          <span className="font-bold text-rose-400 text-xs inline-flex items-center gap-0.5">
                            <ArrowDownRight className="w-3.5 h-3.5" />{m.quantity}
                          </span>
                        ) : (
                          <span className="font-bold text-slate-400 text-xs">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs text-slate-300">
                        {m.balanceBefore} → <span className="font-bold text-white">{m.balanceAfter}</span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-300">
                        <div>{m.reason || "--"}</div>
                        {m.orderNumber && (
                          <span className="text-[10px] text-emerald-400 block font-mono">
                            Pedido #{m.orderNumber}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">
                        {m.userName}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* MODAL: REPOSIÇÃO DE ESTOQUE (RESTOCK) */}
      <Modal
        isOpen={isRestockOpen}
        onClose={() => setIsRestockOpen(false)}
        title="Reposição de Estoque (Restock)"
      >
        <form onSubmit={handleSubmitRestock} className="space-y-4">
          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
            <p className="text-xs text-slate-400">Produto selecionado:</p>
            <p className="text-sm font-semibold text-white mt-0.5">{selectedStockItem?.name}</p>
            <p className="text-xs font-mono text-emerald-400 mt-0.5">
              SKU: {selectedStockItem?.sku} | Saldo Atual: {selectedStockItem?.stock} un
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Quantidade para Entrada (+) *
            </label>
            <Input
              type="number"
              min="1"
              required
              value={restockQty}
              onChange={(e) => setRestockQty(parseInt(e.target.value) || 0)}
              className="bg-slate-950 border-slate-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Custo Unitário da Reposição (R$)
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={restockCost}
              onChange={(e) => setRestockCost(parseFloat(e.target.value) || 0)}
              className="bg-slate-950 border-slate-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Motivo / Observação
            </label>
            <Input
              value={restockReason}
              onChange={(e) => setRestockReason(e.target.value)}
              placeholder="Ex: Compra lote #429 Fornecedor ABC"
              className="bg-slate-950 border-slate-700"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsRestockOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmittingRestock || restockQty <= 0}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              {isSubmittingRestock ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <PlusCircle className="w-4 h-4 mr-1" />}
              Confirmar Reposição
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: AJUSTE MANUAL DE ESTOQUE (ADJUSTMENT) */}
      <Modal
        isOpen={isAdjustOpen}
        onClose={() => setIsAdjustOpen(false)}
        title="Ajuste Manual de Estoque (Inventário)"
      >
        <form onSubmit={handleSubmitAdjust} className="space-y-4">
          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
            <p className="text-xs text-slate-400">Produto selecionado:</p>
            <p className="text-sm font-semibold text-white mt-0.5">{selectedStockItem?.name}</p>
            <p className="text-xs font-mono text-emerald-400 mt-0.5">
              SKU: {selectedStockItem?.sku} | Saldo Atual no Sistema: {selectedStockItem?.stock} un
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Tipo do Ajuste
            </label>
            <select
              value={adjustType}
              onChange={(e) => setAdjustType(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2"
            >
              <option value="ADJUSTMENT">Ajuste de Inventário Físico (ADJUSTMENT)</option>
              <option value="CORRECTION">Correção Operacional (CORRECTION)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Novo Saldo Total em Estoque *
            </label>
            <Input
              type="number"
              min="0"
              required
              value={adjustNewBalance}
              onChange={(e) => setAdjustNewBalance(parseInt(e.target.value) || 0)}
              className="bg-slate-950 border-slate-700"
            />
            {selectedStockItem && (
              <p className="text-xs text-slate-400 mt-1">
                Diferença a ser registrada:{" "}
                <span className={adjustNewBalance - selectedStockItem.stock >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                  {adjustNewBalance - selectedStockItem.stock > 0 ? `+${adjustNewBalance - selectedStockItem.stock}` : adjustNewBalance - selectedStockItem.stock} un
                </span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Justificativa Obrigatória * (mínimo 3 caracteres)
            </label>
            <Input
              required
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="Ex: Contagem física de inventário realizada em 18/09"
              className="bg-slate-950 border-slate-700"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAdjustOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmittingAdjust || adjustNewBalance < 0 || adjustReason.trim().length < 3}
            >
              {isSubmittingAdjust ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sliders className="w-4 h-4 mr-1" />}
              Salvar Ajuste
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: AUDITORIA E RECONCILIAÇÃO */}
      <Modal
        isOpen={isReconcileOpen}
        onClose={() => setIsReconcileOpen(false)}
        title="Auditoria & Reconciliação de Integridade"
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
            <p className="text-xs text-slate-400">Item Auditado:</p>
            <p className="text-sm font-semibold text-white mt-0.5">{selectedStockItem?.name}</p>
            <p className="text-xs font-mono text-slate-400 mt-0.5">SKU: {selectedStockItem?.sku}</p>
          </div>

          {isReconciling ? (
            <div className="py-8 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
              Calculando consistência e validando ledger...
            </div>
          ) : reconciliation ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <p className="text-xs text-slate-400">Saldo Atual no Cadastro</p>
                  <p className="text-xl font-bold text-white mt-1">{reconciliation.currentBalance} un</p>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <p className="text-xs text-slate-400">Total de Movimentações</p>
                  <p className="text-xl font-bold text-blue-400 mt-1">{reconciliation.totalMovementsCount}</p>
                </div>
              </div>

              <div className={`p-4 rounded-lg border flex items-start gap-3 ${
                reconciliation.isConsistent
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-400"
              }`}>
                {reconciliation.isConsistent ? (
                  <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-bold">
                    {reconciliation.isConsistent ? "Estoque 100% Consistente" : "Divergência Detectada"}
                  </p>
                  <p className="text-xs mt-0.5 text-slate-300">
                    {reconciliation.isConsistent
                      ? "O saldo atual confere perfeitamente com o histórico auditável de transações no banco de dados."
                      : `Diferença de ${reconciliation.difference} unidades entre o saldo cadastral e o ledger.`}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-rose-400">Não foi possível carregar os dados de auditoria.</p>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsReconcileOpen(false)}
            >
              Fechar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
