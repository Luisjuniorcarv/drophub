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

function getFulfillmentStatusBadge(status: string) {
  switch (status) {
    case "ACKNOWLEDGED":
      return <Badge variant="success">Aceito / Processando</Badge>;
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
      return <Badge variant="danger">Cancelado</Badge>;
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
}

export default function FulfillmentAdminPage() {
  const [items, setItems] = useState<FulfillmentListItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);
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

  // Ações Operacionais
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  async function fetchFulfillments() {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedStatus && selectedStatus !== "ALL") params.set("status", selectedStatus);

      const res = await fetch(`/api/admin/fulfillment?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setItems(data.data || []);
      } else {
        setErrorMessage(data.error || "Erro ao carregar ordens de fulfillment.");
      }
    } catch {
      setErrorMessage("Falha de conexão ao carregar ordens de fulfillment.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchFulfillments();
  }, [selectedStatus]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    fetchFulfillments();
  }

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
      setErrorMessage("Erro ao consultar detalhes do fulfillment.");
    } finally {
      setIsLoadingDetail(false);
    }
  }

  // Disparo para o fornecedor
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
        fetchFulfillments();
      } else {
        setErrorMessage(data.error || data.errorMessage || "Falha ao enviar ao fornecedor.");
      }
    } catch {
      setErrorMessage("Erro de conexão ao enviar para o fornecedor.");
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
        fetchFulfillments();
      } else {
        setErrorMessage(data.error || data.errorMessage || "Falha na retentativa.");
      }
    } catch {
      setErrorMessage("Erro de conexão ao reprocessar fulfillment.");
    } finally {
      setActionLoadingId(null);
    }
  }

  // Marcar entregue
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
        setSuccessMessage("Ordem de fulfillment e pacote marcados como entregues!");
        fetchFulfillments();
      } else {
        setErrorMessage(data.error || "Erro ao marcar como entregue.");
      }
    } catch {
      setErrorMessage("Erro ao atualizar status de entrega.");
    } finally {
      setActionLoadingId(null);
    }
  }

  // Cancelar fulfillment
  async function handleCancelFulfillment(id: string) {
    const reason = window.prompt("Informe o motivo do cancelamento operacional:");
    if (!reason) return;

    try {
      setActionLoadingId(id);
      setSuccessMessage("");
      setErrorMessage("");

      const res = await fetch(`/api/admin/fulfillment/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED", reason }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage("Ordem de fulfillment cancelada com sucesso.");
        fetchFulfillments();
      } else {
        setErrorMessage(data.error || "Erro ao cancelar fulfillment.");
      }
    } catch {
      setErrorMessage("Erro ao cancelar ordem.");
    } finally {
      setActionLoadingId(null);
    }
  }

  // Salvar rastreamento
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
        setSuccessMessage(`Rastreamento ${trackingNumber} registrado e status atualizado para ENVIADO!`);
        setIsTrackingModalOpen(false);
        fetchFulfillments();
      } else {
        setErrorMessage(data.error || "Erro ao salvar rastreamento.");
      }
    } catch {
      setErrorMessage("Erro ao comunicar com a API de rastreamento.");
    } finally {
      setIsSavingTracking(false);
    }
  }

  // KPIs
  const totalCount = items.length;
  const pendingCount = items.filter((i) => i.status === "PENDING").length;
  const acknowledgedCount = items.filter((i) => i.status === "ACKNOWLEDGED" || i.status === "SUBMITTED").length;
  const shippedCount = items.filter((i) => i.status === "SHIPPED").length;
  const deliveredCount = items.filter((i) => i.status === "DELIVERED").length;
  const failedCount = items.filter((i) => i.status === "FAILED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Send className="w-6 h-6 text-emerald-500" /> Fulfillment & Fornecedores
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Gestão operacional de ordens de envio, integração com fornecedores e rastreamento de entregas.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchFulfillments()}
          isLoading={isLoading}
          className="border-slate-800 text-slate-300 hover:text-white"
        >
          <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="bg-slate-900/60 border-slate-800 p-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total</span>
          <span className="text-2xl font-black text-white mt-1 block">{totalCount}</span>
        </Card>

        <Card className="bg-amber-950/20 border-amber-900/40 p-4">
          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">Aguardando</span>
          <span className="text-2xl font-black text-amber-400 mt-1 block">{pendingCount}</span>
        </Card>

        <Card className="bg-blue-950/20 border-blue-900/40 p-4">
          <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block">No Fornecedor</span>
          <span className="text-2xl font-black text-blue-400 mt-1 block">{acknowledgedCount}</span>
        </Card>

        <Card className="bg-cyan-950/20 border-cyan-900/40 p-4">
          <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block">Despachados</span>
          <span className="text-2xl font-black text-cyan-400 mt-1 block">{shippedCount}</span>
        </Card>

        <Card className="bg-emerald-950/20 border-emerald-900/40 p-4">
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">Entregues</span>
          <span className="text-2xl font-black text-emerald-400 mt-1 block">{deliveredCount}</span>
        </Card>

        <Card className="bg-rose-950/20 border-rose-900/40 p-4">
          <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block">Com Falha</span>
          <span className="text-2xl font-black text-rose-400 mt-1 block">{failedCount}</span>
        </Card>
      </div>

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
            <span className="text-xs text-slate-400 shrink-0 font-medium">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">Todos os Status</option>
              <option value="PENDING">Aguardando Envio</option>
              <option value="ACKNOWLEDGED">Aceito / No Fornecedor</option>
              <option value="SHIPPED">Despachado</option>
              <option value="DELIVERED">Entregue</option>
              <option value="FAILED">Com Falha</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Fulfillment Orders Table */}
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
              <TableHead className="text-slate-400 text-xs text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-400 text-xs">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                  Carregando ordens de fulfillment...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-400 text-xs">
                  Nenhuma ordem de fulfillment localizada.
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
                      <span className="font-semibold text-slate-200">
                        {item.supplier?.name || "Fornecedor Padrão"}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="text-slate-300">
                        {item.items.reduce((acc, it) => acc + it.quantity, 0)} un. ({item.items.length}{" "}
                        {item.items.length === 1 ? "SKU" : "SKUs"})
                      </span>
                      <span className="block text-[10px] text-slate-500 truncate max-w-[150px]">
                        {item.items.map((it) => it.sku).join(", ")}
                      </span>
                    </TableCell>

                    <TableCell>{getFulfillmentStatusBadge(item.status)}</TableCell>

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

                        {/* Enviar ao Fornecedor */}
                        {item.status === "PENDING" && (
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
                <div className="mt-1">{getFulfillmentStatusBadge(selectedFulfillment.status)}</div>
              </div>

              <div className="text-right">
                <span className="text-slate-400 text-[11px] block">Fornecedor:</span>
                <span className="font-bold text-white text-sm">
                  {selectedFulfillment.supplier?.name || "Fornecedor Padrão"}
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

            {/* Itens do Fulfillment (com Snapshot Imutável) */}
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
                <span className="font-bold block mb-1">Motivo da Falha:</span>
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

            {/* Ações no Modal */}
            <div className="pt-4 border-t border-slate-800 flex justify-between gap-2">
              {selectedFulfillment.status !== "DELIVERED" && selectedFulfillment.status !== "CANCELLED" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleCancelFulfillment(selectedFulfillment.id);
                  }}
                  className="border-rose-900 text-rose-400 hover:bg-rose-950/40 text-xs"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Cancelar Ordem
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDetailModalOpen(false)}
                className="ml-auto text-xs"
              >
                Fechar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
