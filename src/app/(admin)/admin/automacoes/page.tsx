"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Zap,
  ShieldCheck,
  Send,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Key,
  Globe,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  Code,
  Activity,
  Layers,
  Search,
  Filter,
  Eye,
  RotateCcw,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { formatDate } from "@/lib/formatters";

interface WebhookItem {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  description: string | null;
  lastTriggeredAt: string | null;
  lastDeliveryStatus: "SUCCESS" | "FAILED" | "PENDING" | null;
  createdAt: string;
  _count?: { deliveries: number };
}

interface OutboxEventItem {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  payload: any;
  status: "PENDING" | "PROCESSED" | "FAILED";
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  processedAt: string | null;
  deliveries?: any[];
}

interface DeliveryItem {
  id: string;
  eventId: string;
  webhookId: string;
  status: "SUCCESS" | "FAILED" | "PENDING";
  attemptNumber: number;
  statusCode: number | null;
  durationMs: number | null;
  requestHeaders: any;
  requestBody: any;
  responseBody: string | null;
  errorMessage: string | null;
  deliveredAt: string | null;
  createdAt: string;
  webhook?: { name: string; url: string };
  event?: { eventType: string; entityType: string; entityId: string };
}

const AVAILABLE_EVENTS = [
  { id: "*", label: "Todos os Eventos (*)", group: "Global" },
  { id: "ORDER_CREATED", label: "Pedido Criado (ORDER_CREATED)", group: "Pedidos" },
  { id: "ORDER_PAID", label: "Pedido Pago / Aprovado (ORDER_PAID)", group: "Pedidos" },
  { id: "ORDER_PROCESSING", label: "Pedido em Separação (ORDER_PROCESSING)", group: "Pedidos" },
  { id: "ORDER_AWAITING_SUPPLIER", label: "Aguardando Fornecedor (ORDER_AWAITING_SUPPLIER)", group: "Pedidos" },
  { id: "ORDER_SENT_TO_SUPPLIER", label: "Enviado ao Fornecedor (ORDER_SENT_TO_SUPPLIER)", group: "Pedidos" },
  { id: "ORDER_SHIPPED", label: "Pedido Despachado (ORDER_SHIPPED)", group: "Pedidos" },
  { id: "ORDER_DELIVERED", label: "Pedido Entregue (ORDER_DELIVERED)", group: "Pedidos" },
  { id: "ORDER_CANCELLED", label: "Pedido Cancelado (ORDER_CANCELLED)", group: "Pedidos" },
  { id: "ORDER_REFUNDED", label: "Pedido Reembolsado (ORDER_REFUNDED)", group: "Pedidos" },
  { id: "PRODUCT_CREATED", label: "Produto Criado (PRODUCT_CREATED)", group: "Catálogo" },
  { id: "PRODUCT_UPDATED", label: "Produto Atualizado (PRODUCT_UPDATED)", group: "Catálogo" },
  { id: "LOW_STOCK", label: "Estoque Baixo (LOW_STOCK)", group: "Catálogo" },
  { id: "CUSTOMER_CREATED", label: "Novo Cliente Cadastrado (CUSTOMER_CREATED)", group: "Clientes" },
  { id: "PAYMENT_APPROVED", label: "Pagamento Aprovado (PAYMENT_APPROVED)", group: "Pagamentos" },
  { id: "PAYMENT_FAILED", label: "Pagamento Recusado / Falhou (PAYMENT_FAILED)", group: "Pagamentos" },
];

export default function AutomationsPage() {
  const [activeTab, setActiveTab] = useState<"webhooks" | "outbox" | "deliveries">("webhooks");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Dados
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [outboxEvents, setOutboxEvents] = useState<OutboxEventItem[]>([]);
  const [outboxStats, setOutboxStats] = useState({ PENDING: 0, PROCESSED: 0, FAILED: 0 });
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [deliveryStats, setDeliveryStats] = useState({ SUCCESS: 0, FAILED: 0 });

  // Modais e visualizadores
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookItem | null>(null);
  const [viewingPayload, setViewingPayload] = useState<any | null>(null);
  const [viewingDelivery, setViewingDelivery] = useState<DeliveryItem | null>(null);
  const [copiedSecretId, setCopiedSecretId] = useState<string | null>(null);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    secret: "",
    events: ["*"],
    active: true,
    description: "",
  });

  // Filtros
  const [outboxFilter, setOutboxFilter] = useState("ALL");
  const [deliveryFilter, setDeliveryFilter] = useState("ALL");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [resWebhooks, resOutbox, resDeliveries] = await Promise.all([
        fetch("/api/admin/webhooks").then((r) => r.json()),
        fetch(`/api/admin/automations/events?status=${outboxFilter}`).then((r) => r.json()),
        fetch(`/api/admin/automations/deliveries?status=${deliveryFilter}`).then((r) => r.json()),
      ]);

      if (resWebhooks.success) setWebhooks(resWebhooks.data);
      if (resOutbox.success) {
        setOutboxEvents(resOutbox.data);
        if (resOutbox.stats) setOutboxStats(resOutbox.stats);
      }
      if (resDeliveries.success) {
        setDeliveries(resDeliveries.data);
        if (resDeliveries.stats) setDeliveryStats(resDeliveries.stats);
      }
    } catch (err) {
      console.error("Erro ao carregar automações:", err);
    } finally {
      setLoading(false);
    }
  }, [outboxFilter, deliveryFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Ações de Webhook
  const handleOpenCreateModal = () => {
    setEditingWebhook(null);
    setFormData({
      name: "",
      url: "",
      secret: "",
      events: ["*"],
      active: true,
      description: "",
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (webhook: WebhookItem) => {
    setEditingWebhook(webhook);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      secret: webhook.secret,
      events: webhook.events,
      active: webhook.active,
      description: webhook.description || "",
    });
    setIsModalOpen(true);
  };

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setMessage(null);

    try {
      const url = editingWebhook ? `/api/admin/webhooks/${editingWebhook.id}` : "/api/admin/webhooks";
      const method = editingWebhook ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage({
          type: "success",
          text: editingWebhook ? "Webhook atualizado com sucesso." : "Webhook criado com sucesso.",
        });
        setIsModalOpen(false);
        loadData();
      } else {
        setMessage({ type: "error", text: data.error || "Erro ao salvar webhook." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: "Erro de conexão ao salvar webhook." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteWebhook = async (id: string, name: string) => {
    if (!confirm(`Deseja realmente excluir o webhook "${name}"? Todas as auditorias associadas serão removidas.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/webhooks/${id}`, { method: "DELETE" });
      if (res.ok) {
        setMessage({ type: "success", text: "Webhook excluído com sucesso." });
        loadData();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Erro ao excluir webhook." });
      }
    } catch {
      setMessage({ type: "error", text: "Erro de conexão ao excluir webhook." });
    }
  };

  const handleTestPing = async (id: string) => {
    setTestingWebhookId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/webhooks/${id}/test`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({
          type: "success",
          text: `Teste enviado com sucesso! Latência: ${data.data?.durationMs}ms (HTTP ${data.data?.statusCode})`,
        });
      } else {
        setMessage({
          type: "error",
          text: `Falha no teste: ${data.data?.errorMessage || data.error || "Endpoint inacessível"}`,
        });
      }
      loadData();
    } catch {
      setMessage({ type: "error", text: "Erro ao disparar teste de conexão." });
    } finally {
      setTestingWebhookId(null);
    }
  };

  const handleProcessOutboxNow = async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/automations/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50 }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: data.message });
        loadData();
      } else {
        setMessage({ type: "error", text: data.error || "Erro ao processar fila." });
      }
    } catch {
      setMessage({ type: "error", text: "Erro ao comunicar com a API da outbox." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryDelivery = async (deliveryId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/automations/deliveries/${deliveryId}/retry`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: "success", text: "Reenvio realizado com sucesso!" });
      } else {
        setMessage({ type: "error", text: data.message || data.error || "Falha ao reenviar entrega." });
      }
      loadData();
    } catch {
      setMessage({ type: "error", text: "Erro de conexão ao reenviar." });
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSecretId(id);
    setTimeout(() => setCopiedSecretId(null), 2000);
  };

  const toggleEventSelection = (eventId: string) => {
    if (eventId === "*") {
      setFormData((prev) => ({
        ...prev,
        events: prev.events.includes("*") ? [] : ["*"],
      }));
      return;
    }

    setFormData((prev) => {
      let nextEvents = prev.events.filter((e) => e !== "*");
      if (nextEvents.includes(eventId)) {
        nextEvents = nextEvents.filter((e) => e !== eventId);
      } else {
        nextEvents.push(eventId);
      }
      return { ...prev, events: nextEvents };
    });
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Automações & Webhooks
            <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
              <Zap className="w-3.5 h-3.5 mr-1" /> n8n Ready (Desacoplado)
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Arquitetura resiliente baseada no Transactional Outbox Pattern e assinaturas HMAC-SHA256.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </button>
          <button
            onClick={handleProcessOutboxNow}
            disabled={actionLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" /> Processar Fila Agora
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Novo Webhook
          </button>
        </div>
      </div>

      {/* Alert Feedback */}
      {message && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between border ${
            message.type === "success"
              ? "bg-emerald-950/50 border-emerald-800 text-emerald-300"
              : "bg-rose-950/50 border-rose-800 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            {message.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            {message.text}
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-xs text-slate-400 hover:text-white"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Webhooks Cadastrados"
          value={webhooks.length}
          subtitle={`${webhooks.filter((w) => w.active).length} ativos para envio`}
          icon={<Globe className="w-4 h-4" />}
        />
        <StatCard
          title="Fila da Outbox"
          value={outboxStats.PENDING}
          subtitle={`${outboxStats.PROCESSED} processados • ${outboxStats.FAILED} falhas`}
          icon={<Layers className="w-4 h-4" />}
        />
        <StatCard
          title="Disparos Concluídos"
          value={deliveryStats.SUCCESS}
          subtitle={`${deliveryStats.FAILED} falhas de endpoint registradas`}
          icon={<Activity className="w-4 h-4" />}
        />
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Desacoplamento
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              100% Protegido
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Quedas do n8n não bloqueiam pedidos ou banco.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="border-b border-slate-800">
        <div className="flex space-x-6">
          <button
            onClick={() => setActiveTab("webhooks")}
            className={`pb-3 text-sm font-medium transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === "webhooks"
                ? "border-emerald-500 text-emerald-400 font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Globe className="w-4 h-4" /> Endpoints de Webhook ({webhooks.length})
          </button>
          <button
            onClick={() => setActiveTab("outbox")}
            className={`pb-3 text-sm font-medium transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === "outbox"
                ? "border-emerald-500 text-emerald-400 font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-4 h-4" /> Fila de Eventos (Outbox Explorer)
            {outboxStats.PENDING > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {outboxStats.PENDING}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("deliveries")}
            className={`pb-3 text-sm font-medium transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === "deliveries"
                ? "border-emerald-500 text-emerald-400 font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Activity className="w-4 h-4" /> Histórico de Auditoria & Entregas ({deliveries.length})
          </button>
        </div>
      </div>

      {/* TAB 1: WEBHOOKS LIST */}
      {activeTab === "webhooks" && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base font-semibold text-white">
              Endpoints de Notificação Externa (n8n / Webhooks)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {webhooks.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                Nenhum webhook cadastrado ainda. Clique em "Novo Webhook" para conectar o n8n.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 bg-slate-950/40">
                    <TableHead className="text-slate-400">Nome / Identificação</TableHead>
                    <TableHead className="text-slate-400">URL do Endpoint</TableHead>
                    <TableHead className="text-slate-400">Eventos Inscritos</TableHead>
                    <TableHead className="text-slate-400">Segredo HMAC</TableHead>
                    <TableHead className="text-slate-400">Último Disparo</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-right text-slate-400">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.map((wh) => (
                    <TableRow key={wh.id} className="border-slate-800 hover:bg-slate-800/40">
                      <TableCell className="font-medium text-white">
                        <div className="flex flex-col">
                          <span>{wh.name}</span>
                          {wh.description && (
                            <span className="text-xs text-slate-400">{wh.description}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-300 font-mono text-xs max-w-[220px] truncate" title={wh.url}>
                        {wh.url}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {wh.events.map((ev) => (
                            <Badge
                              key={ev}
                              variant={ev === "*" ? "info" : "neutral"}
                              className="text-[10px] px-1.5 py-0"
                            >
                              {ev}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => copyToClipboard(wh.secret, wh.id)}
                          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 font-mono bg-slate-800 px-2 py-1 rounded border border-slate-700"
                          title="Copiar segredo HMAC"
                        >
                          <Key className="w-3 h-3 text-amber-400" />
                          {copiedSecretId === wh.id ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Copiado!
                            </span>
                          ) : (
                            <span>••••{wh.secret.slice(-6)}</span>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">
                        {wh.lastTriggeredAt ? (
                          <div className="flex items-center gap-1.5">
                            {wh.lastDeliveryStatus === "SUCCESS" ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            ) : wh.lastDeliveryStatus === "FAILED" ? (
                              <XCircle className="w-3.5 h-3.5 text-rose-400" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                            )}
                            {formatDate(wh.lastTriggeredAt)}
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Nunca disparado</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={wh.active ? "success" : "neutral"}>
                          {wh.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleTestPing(wh.id)}
                            disabled={testingWebhookId === wh.id}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                            title="Disparar Ping de Teste"
                          >
                            <Send
                              className={`w-3.5 h-3.5 ${
                                testingWebhookId === wh.id ? "animate-pulse text-indigo-400" : ""
                              }`}
                            />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(wh)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors text-xs font-medium px-2.5"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteWebhook(wh.id, wh.name)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 border border-slate-700 transition-colors"
                            title="Excluir Webhook"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 2: OUTBOX EXPLORER */}
      {activeTab === "outbox" && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" /> Fila da Outbox (Persistência Atômica)
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Filtrar status:</span>
              <select
                value={outboxFilter}
                onChange={(e) => setOutboxFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200"
              >
                <option value="ALL">Todos os status</option>
                <option value="PENDING">Pendentes</option>
                <option value="PROCESSED">Processados</option>
                <option value="FAILED">Falhas</option>
              </select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {outboxEvents.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                Nenhum evento encontrado na outbox com os filtros atuais.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 bg-slate-950/40">
                    <TableHead className="text-slate-400">Evento</TableHead>
                    <TableHead className="text-slate-400">Entidade / ID</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Tentativas</TableHead>
                    <TableHead className="text-slate-400">Data Criação</TableHead>
                    <TableHead className="text-right text-slate-400">Payload</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outboxEvents.map((evt) => (
                    <TableRow key={evt.id} className="border-slate-800 hover:bg-slate-800/40">
                      <TableCell className="font-semibold text-white font-mono text-xs">
                        <Badge variant="neutral" className="bg-slate-800 text-slate-200 border-slate-700">
                          {evt.eventType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-300 text-xs">
                        <span className="text-slate-400">{evt.entityType}:</span>{" "}
                        <span className="font-mono text-slate-200">{evt.entityId.slice(0, 8)}...</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            evt.status === "PROCESSED"
                              ? "success"
                              : evt.status === "FAILED"
                              ? "danger"
                              : "warning"
                          }
                        >
                          {evt.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">
                        {evt.attempts} / {evt.maxAttempts}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">
                        {formatDate(evt.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          onClick={() => setViewingPayload(evt.payload)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-mono"
                        >
                          <Eye className="w-3 h-3" /> Ver JSON
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 3: DELIVERIES AUDIT LOG */}
      {activeTab === "deliveries" && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" /> Histórico de Disparos e Latência HTTP
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Filtrar status:</span>
              <select
                value={deliveryFilter}
                onChange={(e) => setDeliveryFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200"
              >
                <option value="ALL">Todos os disparos</option>
                <option value="SUCCESS">Sucessos (2xx)</option>
                <option value="FAILED">Falhas (4xx / 5xx / Timeout)</option>
              </select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {deliveries.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                Nenhum registro de entrega de webhook encontrado.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 bg-slate-950/40">
                    <TableHead className="text-slate-400">Webhook Destino</TableHead>
                    <TableHead className="text-slate-400">Evento</TableHead>
                    <TableHead className="text-slate-400">HTTP Status</TableHead>
                    <TableHead className="text-slate-400">Latência</TableHead>
                    <TableHead className="text-slate-400">Tentativa</TableHead>
                    <TableHead className="text-slate-400">Data / Hora</TableHead>
                    <TableHead className="text-right text-slate-400">Detalhes / Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((del) => (
                    <TableRow key={del.id} className="border-slate-800 hover:bg-slate-800/40">
                      <TableCell className="font-medium text-white text-xs">
                        {del.webhook?.name || "Webhook Removido"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-300">
                        {del.event?.eventType || "Evento"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            del.status === "SUCCESS"
                              ? "success"
                              : "danger"
                          }
                          className="font-mono text-[11px]"
                        >
                          {del.statusCode ? `HTTP ${del.statusCode}` : "TIMEOUT / ERROR"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-400 font-mono">
                        {del.durationMs !== null ? `${del.durationMs}ms` : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">
                        #{del.attemptNumber}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">
                        {formatDate(del.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setViewingDelivery(del)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs"
                          >
                            Auditoria
                          </button>
                          {del.status === "FAILED" && (
                            <button
                              onClick={() => handleRetryDelivery(del.id)}
                              disabled={actionLoading}
                              className="px-2 py-1 rounded bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 text-xs flex items-center gap-1"
                              title="Reenviar Payload"
                            >
                              <RotateCcw className="w-3 h-3" /> Reenviar
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* MODAL: CRIAR / EDITAR WEBHOOK */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-emerald-400" />
                {editingWebhook ? "Editar Endpoint de Webhook" : "Cadastrar Novo Endpoint de Webhook"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveWebhook} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Nome da Integração *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: n8n - Orquestração de Pedidos & WhatsApp"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  URL de Destino (Endpoint HTTP/HTTPS) *
                </label>
                <input
                  type="url"
                  required
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://n8n.seuservidor.com/webhook/drophub-orders"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Segredo HMAC-SHA256 (Opcional - gerado automaticamente se vazio)
                </label>
                <input
                  type="text"
                  value={formData.secret}
                  onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                  placeholder="whsec_..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Eventos Subscritos *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-950 rounded-lg border border-slate-800">
                  {AVAILABLE_EVENTS.map((ev) => {
                    const isSelected =
                      formData.events.includes("*") || formData.events.includes(ev.id);
                    return (
                      <label
                        key={ev.id}
                        className={`flex items-center gap-2 p-2 rounded text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800"
                            : "text-slate-400 hover:bg-slate-900"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleEventSelection(ev.id)}
                          className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0"
                        />
                        <span>{ev.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activeToggle"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0"
                />
                <label htmlFor="activeToggle" className="text-xs text-slate-300 font-medium">
                  Webhook Ativo (Pronto para receber disparos automáticos)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? "Salvando..." : editingWebhook ? "Atualizar Webhook" : "Salvar Webhook"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VISUALIZAR PAYLOAD JSON */}
      {viewingPayload && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Code className="w-4 h-4 text-emerald-400" /> Payload do Evento (JSON LGPD Compliant)
              </h2>
              <button
                onClick={() => setViewingPayload(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 max-h-96 overflow-y-auto">
              <pre className="text-xs text-emerald-400 font-mono">
                {JSON.stringify(viewingPayload, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setViewingPayload(null)}
                className="px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VISUALIZAR AUDITORIA DE ENTREGA */}
      {viewingDelivery && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-3xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" /> Detalhes de Auditoria da Entrega HTTP
              </h2>
              <button
                onClick={() => setViewingDelivery(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase">Status HTTP</span>
                  <p className="text-sm font-bold text-white font-mono mt-0.5">
                    {viewingDelivery.statusCode ? `HTTP ${viewingDelivery.statusCode}` : "Timeout"}
                  </p>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase">Latência</span>
                  <p className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                    {viewingDelivery.durationMs}ms
                  </p>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase">Tentativa</span>
                  <p className="text-sm font-bold text-white font-mono mt-0.5">
                    #{viewingDelivery.attemptNumber}
                  </p>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase">Resultado</span>
                  <p
                    className={`text-sm font-bold font-mono mt-0.5 ${
                      viewingDelivery.status === "SUCCESS" ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {viewingDelivery.status}
                  </p>
                </div>
              </div>

              {viewingDelivery.errorMessage && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
                  <strong className="block mb-1">Mensagem de Erro:</strong>
                  {viewingDelivery.errorMessage}
                </div>
              )}

              <div>
                <span className="text-xs font-semibold text-slate-300 block mb-1">
                  Cabeçalhos HTTP Enviados (com Assinatura HMAC):
                </span>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono text-slate-300">
                  <pre>{JSON.stringify(viewingDelivery.requestHeaders, null, 2)}</pre>
                </div>
              </div>

              {viewingDelivery.responseBody && (
                <div>
                  <span className="text-xs font-semibold text-slate-300 block mb-1">
                    Corpo da Resposta do Servidor Remoto:
                  </span>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono text-slate-300 max-h-40 overflow-y-auto">
                    <pre>{viewingDelivery.responseBody}</pre>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setViewingDelivery(null)}
                className="px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
