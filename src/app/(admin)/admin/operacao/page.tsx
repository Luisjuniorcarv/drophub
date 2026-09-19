"use client";

import React, { useState, useEffect } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  Zap,
  Send,
  Truck,
  Package,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  ExternalLink,
  Eye,
  Clock,
  RotateCcw,
  XCircle,
  MapPin,
  FileText,
  User,
  Loader2,
  AlertTriangle,
  Play,
  ArrowRightLeft,
} from "lucide-react";

interface FulfillmentItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  unitCostSnapshot: number;
}

interface FulfillmentListItem {
  id: string;
  orderId: string;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    customer: { name: string; email: string };
  };
  supplierId: string | null;
  supplier: { id: string; name: string } | null;
  status: string;
  externalOrderId: string | null;
  supplierOrderNumber: string | null;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  submittedAt: string | null;
  acknowledgedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  failureReason: string | null;
  items: FulfillmentItem[];
  shipments: Array<{
    id: string;
    carrier: string;
    trackingNumber: string;
    trackingUrl: string | null;
    status: string;
  }>;
  createdAt: string;
}

interface OperationalKPIs {
  orders: {
    awaitingPayment: number;
    paid: number;
    awaitingSupplier: number;
    sentToSupplier: number;
    shipped: number;
    delivered: number;
    cancelled: number;
    refunded: number;
    total: number;
  };
  fulfillments: {
    pending: number;
    submitted: number;
    acknowledged: number;
    shipped: number;
    delivered: number;
    failed: number;
    cancelled: number;
    total: number;
  };
  alerts: {
    stuckFulfillments: number;
    unassignedSuppliers: number;
    failedFulfillments: number;
    paidWithoutFulfillment: number;
  };
}

function getFulfillmentStatusBadge(status: string, supplierId: string | null) {
  if (!supplierId) {
    return <Badge variant="danger">Sem Fornecedor</Badge>;
  }
  switch (status) {
    case "ACKNOWLEDGED":
      return <Badge variant="success">No Fornecedor (ACK)</Badge>;
    case "SUBMITTED":
      return <Badge variant="info">Enviado ao Fornecedor</Badge>;
    case "SHIPPED":
      return <Badge variant="info">Despachado</Badge>;
    case "DELIVERED":
      return <Badge variant="success">Entregue</Badge>;
    case "PENDING":
      return <Badge variant="warning">Aguardando Envio</Badge>;
    case "FAILED":
      return <Badge variant="danger">Falha de Envio</Badge>;
    case "CANCELLED":
      return <Badge variant="neutral">Cancelado</Badge>;
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
}

export default function OperationsDashboardPage() {
  const [items, setItems] = useState<FulfillmentListItem[]>([]);
  const [kpis, setKpis] = useState<OperationalKPIs | null>(null);
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [isExecutingWorker, setIsExecutingWorker] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Modal de Detalhes
  const [selectedFulfillment, setSelectedFulfillment] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Modal de Rastreamento
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [trackingTargetId, setTrackingTargetId] = useState<string | null>(null);
  const [carrier, setCarrier] = useState("Correios");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [isSavingTracking, setIsSavingTracking] = useState(false);

  // Modal de Troca de Fornecedor
  const [isSwitchSupplierModalOpen, setIsSwitchSupplierModalOpen] = useState(false);
  const [switchTargetId, setSwitchTargetId] = useState<string | null>(null);
  const [suppliersList, setSuppliersList] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedNewSupplierId, setSelectedNewSupplierId] = useState("");
  const [switchReason, setSwitchReason] = useState("");
  const [isSwitchingSupplier, setIsSwitchingSupplier] = useState(false);

  // Ações Operacionais Individuais
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  async function loadData() {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedStatus && selectedStatus !== "ALL") params.set("status", selectedStatus);

      const [resItems, resKpis, resSuppliers] = await Promise.all([
        fetch(`/api/admin/fulfillment?${params.toString()}`),
        fetch(`/api/admin/operacao/kpis`),
        fetch(`/api/admin/suppliers?limit=100`),
      ]);

      const dataItems = await resItems.json();
      const dataKpis = await resKpis.json();
      const dataSuppliers = await resSuppliers.json();

      if (resItems.ok && dataItems.success) {
        setItems(dataItems.data || []);
      }
      if (resKpis.ok && dataKpis.success) {
        setKpis(dataKpis.data);
      }
      if (resSuppliers.ok && dataSuppliers.data) {
        setSuppliersList(dataSuppliers.data.map((s: any) => ({ id: s.id, name: s.name })));
      }
    } catch {
      setErrorMessage("Falha ao carregar dados do painel operacional.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [selectedStatus]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadData();
  }

  // Executar worker de retentativas e sincronizações sob demanda
  async function handleRunFulfillmentWorker() {
    try {
      setIsExecutingWorker(true);
      setErrorMessage("");
      setSuccessMessage("");

      const res = await fetch(`/api/cron/fulfillment`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMessage(data.message || "Worker executado com sucesso!");
        loadData();
      } else {
        setErrorMessage(data.error || "Falha ao executar worker de fulfillment.");
      }
    } catch {
      setErrorMessage("Erro de conexão ao executar worker.");
    } finally {
      setIsExecutingWorker(false);
    }
  }

  // Disparo manual para fornecedor
  async function handleSubmitToSupplier(id: string) {
    try {
      setActionLoadingId(id);
      setSuccessMessage("");
      setErrorMessage("");

      const res = await fetch(`/api/admin/fulfillment/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(`Ordem enviada com sucesso ao fornecedor! (Ext ID: ${data.data?.externalOrderId})`);
        loadData();
      } else {
        setErrorMessage(data.error || data.errorMessage || "Falha ao enviar ao fornecedor.");
      }
    } catch {
      setErrorMessage("Erro ao comunicar com fornecedor.");
    } finally {
      setActionLoadingId(null);
    }
  }

  // Sincronizar status diretamente com fornecedor
  async function handleSyncStatus(id: string) {
    try {
      setActionLoadingId(id);
      setSuccessMessage("");
      setErrorMessage("");

      const res = await fetch(`/api/admin/fulfillment/${id}/sync`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMessage(data.message || "Status sincronizado com sucesso!");
        loadData();
      } else {
        setErrorMessage(data.error || "Falha ao sincronizar status.");
      }
    } catch {
      setErrorMessage("Erro ao consultar status no fornecedor.");
    } finally {
      setActionLoadingId(null);
    }
  }

  // Retentativa manual
  async function handleRetryFulfillment(id: string) {
    try {
      setActionLoadingId(id);
      setSuccessMessage("");
      setErrorMessage("");

      const res = await fetch(`/api/admin/fulfillment/${id}/retry`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMessage("Retentativa processada com sucesso!");
        loadData();
      } else {
        setErrorMessage(data.error || data.errorMessage || "Falha na retentativa.");
      }
    } catch {
      setErrorMessage("Erro ao processar retentativa.");
    } finally {
      setActionLoadingId(null);
    }
  }

  // Marcar como entregue
  async function handleMarkDelivered(id: string) {
    try {
      setActionLoadingId(id);
      setSuccessMessage("");
      setErrorMessage("");

      const res = await fetch(`/api/admin/fulfillment/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DELIVERED" }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage("Ordem e pacote confirmados como entregues!");
        loadData();
      } else {
        setErrorMessage(data.error || "Erro ao marcar como entregue.");
      }
    } catch {
      setErrorMessage("Erro ao atualizar entrega.");
    } finally {
      setActionLoadingId(null);
    }
  }

  // Abrir modal de detalhes
  async function openDetailModal(id: string) {
    try {
      setIsLoadingDetail(true);
      setIsDetailModalOpen(true);
      const res = await fetch(`/api/admin/fulfillment/${id}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedFulfillment(data.data);
      } else {
        setErrorMessage(data.error || "Erro ao carregar detalhes.");
      }
    } catch {
      setErrorMessage("Erro ao carregar detalhes.");
    } finally {
      setIsLoadingDetail(false);
    }
  }

  // Abrir modal de rastreamento
  function openTrackingModal(id: string) {
    setTrackingTargetId(id);
    setTrackingNumber("");
    setTrackingUrl("");
    setCarrier("Correios");
    setIsTrackingModalOpen(true);
  }

  async function handleSaveTracking(e: React.FormEvent) {
    e.preventDefault();
    if (!trackingTargetId || !trackingNumber.trim()) return;

    try {
      setIsSavingTracking(true);
      setErrorMessage("");
      setSuccessMessage("");

      const res = await fetch(`/api/admin/fulfillment/${trackingTargetId}/tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrier,
          trackingNumber: trackingNumber.trim(),
          trackingUrl: trackingUrl.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(`Rastreamento ${trackingNumber} salvo com sucesso!`);
        setIsTrackingModalOpen(false);
        loadData();
      } else {
        setErrorMessage(data.error || "Erro ao salvar rastreamento.");
      }
    } catch {
      setErrorMessage("Erro ao comunicar com a API de rastreamento.");
    } finally {
      setIsSavingTracking(false);
    }
  }

  // Abrir modal de troca de fornecedor
  function openSwitchSupplierModal(id: string) {
    setSwitchTargetId(id);
    setSelectedNewSupplierId("");
    setSwitchReason("");
    setIsSwitchSupplierModalOpen(true);
  }

  async function handleSaveSwitchSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!switchTargetId || !selectedNewSupplierId || !switchReason.trim()) return;

    try {
      setIsSwitchingSupplier(true);
      setErrorMessage("");
      setSuccessMessage("");

      const res = await fetch(`/api/admin/fulfillment/${switchTargetId}/switch-supplier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newSupplierId: selectedNewSupplierId,
          reason: switchReason.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(data.message || "Fornecedor substituído com sucesso!");
        setIsSwitchSupplierModalOpen(false);
        loadData();
      } else {
        setErrorMessage(data.error || "Erro ao substituir fornecedor.");
      }
    } catch {
      setErrorMessage("Erro ao trocar fornecedor.");
    } finally {
      setIsSwitchingSupplier(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Zap className="w-6 h-6 text-emerald-500" /> Operação de Dropshipping & Automações
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Orquestração em tempo real de pedidos, fornecedores, rastreamentos e retentativas automáticas.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="primary"
            size="sm"
            onClick={handleRunFulfillmentWorker}
            isLoading={isExecutingWorker}
            className="bg-emerald-600 hover:bg-emerald-500 font-bold text-xs shadow-lg shadow-emerald-600/20"
          >
            <Play className="w-4 h-4 mr-1.5" /> Executar Worker Agora
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            isLoading={isLoading}
            className="border-slate-800 text-slate-300 hover:text-white"
          >
            <RefreshCw className="w-4 h-4 mr-1.5" /> Atualizar
          </Button>
        </div>
      </div>

      {/* Alertas Operacionais Críticos */}
      {kpis && (kpis.alerts.stuckFulfillments > 0 || kpis.alerts.unassignedSuppliers > 0 || kpis.alerts.failedFulfillments > 0 || kpis.alerts.paidWithoutFulfillment > 0) && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/80 text-amber-200 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400" /> Atenção Operacional:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px]">
            {kpis.alerts.unassignedSuppliers > 0 && (
              <div className="p-2 rounded-lg bg-amber-900/30 border border-amber-700/50">
                <span className="font-bold">{kpis.alerts.unassignedSuppliers}</span> pedido(s) contêm itens sem fornecedor atribuído.
              </div>
            )}
            {kpis.alerts.failedFulfillments > 0 && (
              <div className="p-2 rounded-lg bg-rose-900/30 border border-rose-700/50 text-rose-200">
                <span className="font-bold">{kpis.alerts.failedFulfillments}</span> ordem(ns) de fulfillment falharam no envio.
              </div>
            )}
            {kpis.alerts.stuckFulfillments > 0 && (
              <div className="p-2 rounded-lg bg-amber-900/30 border border-amber-700/50">
                <span className="font-bold">{kpis.alerts.stuckFulfillments}</span> ordem(ns) necessitam de atenção/retentativa.
              </div>
            )}
            {kpis.alerts.paidWithoutFulfillment > 0 && (
              <div className="p-2 rounded-lg bg-rose-900/30 border border-rose-700/50 text-rose-200">
                <span className="font-bold">{kpis.alerts.paidWithoutFulfillment}</span> pedido(s) pagos aguardam criação de fulfillment.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-800/80 text-emerald-200 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-200 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Operational KPI Grid */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="bg-slate-900/60 border-slate-800 p-4">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Pagos / Fila</span>
            <span className="text-2xl font-black text-white mt-1 block">{kpis.orders.paid + kpis.orders.awaitingSupplier}</span>
          </Card>

          <Card className="bg-blue-950/20 border-blue-900/40 p-4">
            <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block">No Fornecedor</span>
            <span className="text-2xl font-black text-blue-400 mt-1 block">{kpis.fulfillments.acknowledged + kpis.fulfillments.submitted}</span>
          </Card>

          <Card className="bg-cyan-950/20 border-cyan-900/40 p-4">
            <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block">Despachados</span>
            <span className="text-2xl font-black text-cyan-400 mt-1 block">{kpis.fulfillments.shipped}</span>
          </Card>

          <Card className="bg-emerald-950/20 border-emerald-900/40 p-4">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">Entregues</span>
            <span className="text-2xl font-black text-emerald-400 mt-1 block">{kpis.fulfillments.delivered}</span>
          </Card>

          <Card className="bg-amber-950/20 border-amber-900/40 p-4">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">Aguardando Envio</span>
            <span className="text-2xl font-black text-amber-400 mt-1 block">{kpis.fulfillments.pending}</span>
          </Card>

          <Card className="bg-rose-950/20 border-rose-900/40 p-4">
            <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block">Com Falha</span>
            <span className="text-2xl font-black text-rose-400 mt-1 block">{kpis.fulfillments.failed}</span>
          </Card>
        </div>
      )}

      {/* Filters Bar */}
      <Card className="bg-slate-900/60 border-slate-800 p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full sm:w-96">
            <Input
              placeholder="Buscar por pedido (DH-*), Ext ID ou fornecedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-950 border-slate-800 text-white text-xs"
            />
            <Button type="submit" variant="outline" size="sm" className="shrink-0">
              <Search className="w-4 h-4" />
            </Button>
          </form>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            <span className="text-xs text-slate-400 shrink-0 font-medium">Filtro:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">Todos os Fulfillments</option>
              <option value="PENDING">Aguardando Envio</option>
              <option value="ACKNOWLEDGED">No Fornecedor (ACK)</option>
              <option value="SHIPPED">Despachados</option>
              <option value="DELIVERED">Entregues</option>
              <option value="FAILED">Com Falha</option>
              <option value="CANCELLED">Cancelados</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Main Operational Table */}
      <Card className="bg-slate-900/60 border-slate-800 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-950">
            <TableRow className="border-slate-800">
              <TableHead className="text-slate-400 text-xs">Pedido & Cliente</TableHead>
              <TableHead className="text-slate-400 text-xs">Fornecedor</TableHead>
              <TableHead className="text-slate-400 text-xs">Itens / Qtd</TableHead>
              <TableHead className="text-slate-400 text-xs">Status Fulfillment</TableHead>
              <TableHead className="text-slate-400 text-xs">ID Fornecedor</TableHead>
              <TableHead className="text-slate-400 text-xs">Rastreamento</TableHead>
              <TableHead className="text-slate-400 text-xs text-right">Ações Operacionais</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-400 text-xs">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                  Carregando ordens operacionais...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-400 text-xs">
                  Nenhuma ordem de fulfillment localizada no momento.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const isActionLoading = actionLoadingId === item.id;
                const tracking = item.shipments?.[0];

                return (
                  <TableRow key={item.id} className="border-slate-800 hover:bg-slate-800/40 text-xs">
                    <TableCell>
                      <div className="font-bold text-white text-sm">{item.order.orderNumber}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{item.order.customer.name}</div>
                    </TableCell>

                    <TableCell>
                      {item.supplier ? (
                        <span className="font-semibold text-slate-200">{item.supplier.name}</span>
                      ) : (
                        <span className="text-rose-400 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Sem Fornecedor
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      <span className="text-slate-300">
                        {item.items.reduce((acc, it) => acc + it.quantity, 0)} un. ({item.items.length}{" "}
                        {item.items.length === 1 ? "SKU" : "SKUs"})
                      </span>
                    </TableCell>

                    <TableCell>{getFulfillmentStatusBadge(item.status, item.supplierId)}</TableCell>

                    <TableCell>
                      {item.externalOrderId ? (
                        <div>
                          <span className="font-mono text-emerald-400 text-[11px] block">
                            {item.externalOrderId}
                          </span>
                          {item.supplierOrderNumber && (
                            <span className="text-[10px] text-slate-500">{item.supplierOrderNumber}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[11px]">—</span>
                      )}
                    </TableCell>

                    <TableCell>
                      {tracking ? (
                        <div>
                          <span className="font-mono text-cyan-400 text-[11px] font-bold block">
                            {tracking.trackingNumber}
                          </span>
                          <span className="text-[10px] text-slate-400">{tracking.carrier}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[11px]">Sem rastreio</span>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Ver Detalhes */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetailModal(item.id)}
                          className="h-8 px-2 text-slate-300 hover:text-white"
                          title="Visualizar detalhes"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>

                        {/* Trocar Fornecedor */}
                        {item.status !== "SHIPPED" && item.status !== "DELIVERED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openSwitchSupplierModal(item.id)}
                            className="h-8 px-2 text-amber-400 hover:bg-amber-950/40"
                            title="Trocar Fornecedor"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </Button>
                        )}

                        {/* Enviar ao Fornecedor */}
                        {item.status === "PENDING" && item.supplierId && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleSubmitToSupplier(item.id)}
                            isLoading={isActionLoading}
                            className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold"
                            title="Disparar para fornecedor"
                          >
                            <Send className="w-3.5 h-3.5 mr-1" /> Enviar
                          </Button>
                        )}

                        {/* Sincronizar com Fornecedor */}
                        {(item.status === "ACKNOWLEDGED" || item.status === "SUBMITTED") && item.externalOrderId && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSyncStatus(item.id)}
                            isLoading={isActionLoading}
                            className="h-8 px-2.5 border-slate-700 text-blue-400 hover:bg-blue-950/40 text-xs"
                            title="Consultar status no fornecedor"
                          >
                            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Sincronizar
                          </Button>
                        )}

                        {/* Inserir Rastreio */}
                        {(item.status === "ACKNOWLEDGED" || item.status === "SUBMITTED" || item.status === "PENDING") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openTrackingModal(item.id)}
                            className="h-8 px-2.5 border-slate-700 text-cyan-400 hover:bg-cyan-950/40 text-xs"
                            title="Adicionar código de rastreamento"
                          >
                            <Truck className="w-3.5 h-3.5 mr-1" /> Rastreio
                          </Button>
                        )}

                        {/* Marcar Entregue */}
                        {item.status === "SHIPPED" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkDelivered(item.id)}
                            isLoading={isActionLoading}
                            className="h-8 px-2.5 border-slate-700 text-emerald-400 hover:bg-emerald-950/40 text-xs font-semibold"
                            title="Confirmar entrega"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Entregue
                          </Button>
                        )}

                        {/* Retentativa em caso de falha */}
                        {item.status === "FAILED" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRetryFulfillment(item.id)}
                            isLoading={isActionLoading}
                            className="h-8 px-2.5 border-rose-800 text-rose-300 hover:bg-rose-950/50 text-xs font-bold"
                            title="Reprocessar ordem"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reprocessar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Modal: Atualizar Rastreamento */}
      <Modal
        isOpen={isTrackingModalOpen}
        onClose={() => setIsTrackingModalOpen(false)}
        title="Atualizar Rastreamento do Pacote"
      >
        <form onSubmit={handleSaveTracking} className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Transportadora / Carrier *
            </label>
            <Input
              required
              placeholder="Ex: Correios, Cainiao, J&T Express"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="bg-slate-950 border-slate-800 text-white text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Código de Rastreamento (Tracking Number) *
            </label>
            <Input
              required
              placeholder="Ex: BR123456789DH, AA987654321BR"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="bg-slate-950 border-slate-800 text-white font-mono text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              URL de Rastreamento (Opcional)
            </label>
            <Input
              type="url"
              placeholder="https://rastreamento.correios.com.br/..."
              value={trackingUrl}
              onChange={(e) => setTrackingUrl(e.target.value)}
              className="bg-slate-950 border-slate-800 text-white text-xs"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsTrackingModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSavingTracking}
              className="bg-emerald-600 hover:bg-emerald-500 font-bold"
            >
              <Truck className="w-4 h-4 mr-1.5" /> Salvar & Marcar Enviado
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Troca Assistida de Fornecedor */}
      <Modal
        isOpen={isSwitchSupplierModalOpen}
        onClose={() => setIsSwitchSupplierModalOpen(false)}
        title="Troca Assistida de Fornecedor"
      >
        <form onSubmit={handleSaveSwitchSupplier} className="space-y-4 pt-2">
          <p className="text-xs text-slate-400">
            Selecione o novo fornecedor responsável por atender este fulfillment. O histórico anterior será preservado para auditoria.
          </p>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Novo Fornecedor *
            </label>
            <select
              required
              value={selectedNewSupplierId}
              onChange={(e) => setSelectedNewSupplierId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-emerald-500"
            >
              <option value="">Selecione um fornecedor...</option>
              {suppliersList.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Motivo da Substituição *
            </label>
            <Input
              required
              placeholder="Ex: Fornecedor anterior sem estoque imediato; atraso operacional."
              value={switchReason}
              onChange={(e) => setSwitchReason(e.target.value)}
              className="bg-slate-950 border-slate-800 text-white text-xs"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsSwitchSupplierModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSwitchingSupplier}
              className="bg-emerald-600 hover:bg-emerald-500 font-bold"
            >
              <ArrowRightLeft className="w-4 h-4 mr-1.5" /> Confirmar Troca de Fornecedor
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Detalhes do Fulfillment */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={selectedFulfillment ? `Fulfillment — Pedido ${selectedFulfillment.order?.orderNumber}` : "Detalhes"}
      >
        {isLoadingDetail || !selectedFulfillment ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
            Carregando detalhes do fulfillment...
          </div>
        ) : (
          <div className="space-y-6 pt-2 text-xs">
            {/* Status & Identifiers Header */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-[11px] block">Status Atual:</span>
                <div className="mt-1">{getFulfillmentStatusBadge(selectedFulfillment.status, selectedFulfillment.supplierId)}</div>
              </div>

              <div className="text-right">
                <span className="text-slate-400 text-[11px] block">Fornecedor:</span>
                <span className="font-bold text-white text-sm">
                  {selectedFulfillment.supplier?.name || "Sem Fornecedor Vinculado"}
                </span>
              </div>
            </div>

            {/* External Order IDs */}
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 font-mono text-[11px]">
              <div>
                <span className="text-slate-400 block font-sans text-[10px]">ID Externo Fornecedor:</span>
                <span className="text-emerald-400 font-bold">
                  {selectedFulfillment.externalOrderId || "Pendente"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-sans text-[10px]">Cód. Pedido Fornecedor:</span>
                <span className="text-slate-200">
                  {selectedFulfillment.supplierOrderNumber || "Pendente"}
                </span>
              </div>
            </div>

            {/* Itens do Fulfillment */}
            <div>
              <h3 className="font-bold text-white text-xs mb-2 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-emerald-500" /> Itens deste Fornecedor (Snapshot Imutável)
              </h3>
              <div className="bg-slate-950 rounded-xl border border-slate-800 divide-y divide-slate-800/80">
                {selectedFulfillment.items?.map((it: any) => (
                  <div key={it.id} className="p-3 flex items-center justify-between gap-4">
                    <div>
                      <span className="font-bold text-white">{it.name}</span>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        SKU: {it.sku} • Qtd: {it.quantity} un.
                      </span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-slate-300 font-bold block">
                        {formatCurrency(Number(it.unitCostSnapshot) * it.quantity)}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        ({formatCurrency(Number(it.unitCostSnapshot))} /un)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Endereço de Entrega */}
            <div>
              <h3 className="font-bold text-white text-xs mb-2 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-500" /> Endereço de Destino
              </h3>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 space-y-1 text-[11px]">
                <p className="font-bold text-white">{selectedFulfillment.order?.customer?.name}</p>
                <p>
                  {selectedFulfillment.order?.shippingAddress?.street},{" "}
                  {selectedFulfillment.order?.shippingAddress?.number}{" "}
                  {selectedFulfillment.order?.shippingAddress?.complement &&
                    `(${selectedFulfillment.order.shippingAddress.complement})`}
                </p>
                <p>
                  {selectedFulfillment.order?.shippingAddress?.neighborhood} -{" "}
                  {selectedFulfillment.order?.shippingAddress?.city} /{" "}
                  {selectedFulfillment.order?.shippingAddress?.state} • CEP:{" "}
                  {selectedFulfillment.order?.shippingAddress?.postalCode}
                </p>
              </div>
            </div>

            {/* Falha ou Erro */}
            {selectedFulfillment.failureReason && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-900 text-rose-200 text-xs">
                <span className="font-bold block mb-1">Motivo da Falha / Alerta:</span>
                <span className="font-mono text-[11px]">{selectedFulfillment.failureReason}</span>
              </div>
            )}

            {/* Histórico / Auditoria */}
            {selectedFulfillment.history && selectedFulfillment.history.length > 0 && (
              <div>
                <h3 className="font-bold text-white text-xs mb-2 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-emerald-500" /> Linha do Tempo & Auditoria
                </h3>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {selectedFulfillment.history.map((h: any) => (
                    <div
                      key={h.id}
                      className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 flex items-center justify-between text-[11px]"
                    >
                      <div>
                        <span className="font-semibold text-emerald-400">{h.newStatus}</span>
                        <span className="text-slate-400 block mt-0.5">{h.reason}</span>
                      </div>
                      <span className="text-slate-500 text-[10px] shrink-0 font-mono">
                        {formatDate(h.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
