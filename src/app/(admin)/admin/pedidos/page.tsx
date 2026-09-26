"use client";

import React, { useState, useEffect } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { formatCurrency, formatPercent, formatDate, formatCpf, formatCep, formatPhone } from "@/lib/formatters";
import {
  ShoppingCart,
  Plus,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  Truck,
  DollarSign,
  Package,
  History,
  Calendar,
  CreditCard,
  Send,
  User,
  ArrowRight,
  ExternalLink,
  QrCode,
  Copy,
  Check,
  RotateCcw,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

interface OrderItem {
  id: string;
  productId: string;
  sku: string;
  name: string;
  unitCost: number;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
}

interface OrderListItem {
  id: string;
  orderNumber: string;
  customerId: string;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  status: string;
  subtotalAmount: number;
  shippingCost: number;
  discountAmount: number;
  totalAmount: number;
  totalCostAmount: number;
  estimatedProfit: number;
  marginPercentage: number;
  markupPercentage: number;
  itemsCount: number;
  items: OrderItem[];
  payments: Array<{ id: string; method: string; status: string; amount: number }>;
  shipments: Array<{ id: string; carrier: string; trackingNumber: string; status: string }>;
  createdAt: string;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "PAID":
      return <Badge variant="success">Pago</Badge>;
    case "DELIVERED":
      return <Badge variant="success">Entregue</Badge>;
    case "SHIPPED":
      return <Badge variant="info">Enviado</Badge>;
    case "SENT_TO_SUPPLIER":
      return <Badge variant="info">No Fornecedor</Badge>;
    case "PROCESSING":
      return <Badge variant="info">Processando</Badge>;
    case "AWAITING_SUPPLIER":
      return <Badge variant="warning">Aguardando Fornecedor</Badge>;
    case "AWAITING_PAYMENT":
      return <Badge variant="warning">Aguardando Pagamento</Badge>;
    case "CANCELLED":
      return <Badge variant="danger">Cancelado</Badge>;
    case "REFUNDED":
      return <Badge variant="danger">Reembolsado</Badge>;
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Detalhes do Pedido Modal
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Pagamentos Actions
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentFeedback, setPaymentFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  // Rastreamento Modal
  const [isShipmentModalOpen, setIsShipmentModalOpen] = useState(false);
  const [carrier, setCarrier] = useState("Correios");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [isSavingShipment, setIsSavingShipment] = useState(false);

  // Criar Pedido Manual Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [customerOptions, setCustomerOptions] = useState<any[]>([]);
  const [productOptions, setProductOptions] = useState<any[]>([]);
  const [formCustomerId, setFormCustomerId] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Array<{ productId: string; quantity: number }>>([]);
  const [formShipping, setFormShipping] = useState(0);
  const [formDiscount, setFormDiscount] = useState(0);
  const [formInitialStatus, setFormInitialStatus] = useState("AWAITING_PAYMENT");
  const [formPaymentMethod, setFormPaymentMethod] = useState("TEST_MODE");
  const [formNotes, setFormNotes] = useState("");
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [createError, setCreateError] = useState("");

  const loadOrders = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (selectedStatus) params.set("status", selectedStatus);

      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setOrders(data.data || []);
      } else {
        setErrorMessage(data.error || "Erro ao carregar pedidos.");
      }
    } catch {
      setErrorMessage("Erro de conexão ao carregar pedidos.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadCreateOptions = async () => {
    try {
      const [custRes, prodRes] = await Promise.all([
        fetch("/api/admin/customers?limit=50"),
        fetch("/api/admin/products?limit=50&status=ACTIVE"),
      ]);
      const custData = await custRes.json();
      const prodData = await prodRes.json();
      if (custRes.ok) setCustomerOptions(custData.data || []);
      if (prodRes.ok) setProductOptions(prodData.data || []);
    } catch (err) {
      console.error("Erro ao carregar opções para novo pedido:", err);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [search, selectedStatus]);

  const handleOpenDetail = async (orderId: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedOrder(data.order);
        setNewStatus(data.order.status);
        setStatusReason("");
        setIsDetailModalOpen(true);
      } else {
        alert(data.error || "Erro ao carregar detalhes do pedido.");
      }
    } catch {
      alert("Erro ao buscar detalhes do pedido.");
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setIsUpdatingStatus(true);

    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          reason: statusReason || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Erro ao atualizar status.");
        setIsUpdatingStatus(false);
        return;
      }

      setSuccessMessage(`Status do pedido ${selectedOrder.orderNumber} atualizado para ${newStatus}!`);
      setTimeout(() => setSuccessMessage(""), 4000);
      setIsDetailModalOpen(false);
      loadOrders();
    } catch {
      alert("Erro de comunicação com o servidor.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleGeneratePayment = async (method: "PIX" | "CREDIT_CARD" | "TEST_MODE") => {
    if (!selectedOrder) return;
    setIsProcessingPayment(true);
    setPaymentFeedback(null);
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      const data = await res.json();
      if (res.ok) {
        setPaymentFeedback({
          type: "success",
          message: method === "PIX" ? "Cobrança Pix gerada com sucesso!" : "Pagamento processado com sucesso!",
        });
        const refRes = await fetch(`/api/admin/orders/${selectedOrder.id}`);
        const refData = await refRes.json();
        if (refRes.ok && refData.data) setSelectedOrder(refData.data);
        loadOrders();
      } else {
        setPaymentFeedback({
          type: "error",
          message: data.error || "Erro ao gerar cobrança de pagamento.",
        });
      }
    } catch {
      setPaymentFeedback({ type: "error", message: "Erro de conexão ao processar pagamento." });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleCancelPayment = async (paymentId: string) => {
    if (!confirm("Deseja realmente cancelar esta cobrança de pagamento?")) return;
    setIsProcessingPayment(true);
    setPaymentFeedback(null);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/cancel`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setPaymentFeedback({ type: "success", message: "Cobrança cancelada com sucesso." });
        const refRes = await fetch(`/api/admin/orders/${selectedOrder.id}`);
        const refData = await refRes.json();
        if (refRes.ok && refData.data) setSelectedOrder(refData.data);
        loadOrders();
      } else {
        setPaymentFeedback({ type: "error", message: data.error || "Erro ao cancelar cobrança." });
      }
    } catch {
      setPaymentFeedback({ type: "error", message: "Erro de conexão." });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleRefundPayment = async (paymentId: string) => {
    if (!confirm("Deseja realmente estornar/reembolsar este pagamento integralmente?")) return;
    setIsProcessingPayment(true);
    setPaymentFeedback(null);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/refund`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setPaymentFeedback({ type: "success", message: "Reembolso integral processado com sucesso!" });
        const refRes = await fetch(`/api/admin/orders/${selectedOrder.id}`);
        const refData = await refRes.json();
        if (refRes.ok && refData.data) setSelectedOrder(refData.data);
        loadOrders();
      } else {
        setPaymentFeedback({ type: "error", message: data.error || "Erro ao processar reembolso." });
      }
    } catch {
      setPaymentFeedback({ type: "error", message: "Erro de conexão." });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const copyPixCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2000);
  };

  const handleOpenShipment = () => {
    setCarrier("Correios");
    setTrackingNumber("");
    setTrackingUrl("");
    setIsShipmentModalOpen(true);
  };

  const handleSaveShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setIsSavingShipment(true);

    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}/shipments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrier,
          trackingNumber,
          trackingUrl: trackingUrl || undefined,
          status: "SHIPPED",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Erro ao cadastrar envio.");
        setIsSavingShipment(false);
        return;
      }

      setSuccessMessage(`Envio e código de rastreamento cadastrados com sucesso!`);
      setTimeout(() => setSuccessMessage(""), 4000);
      setIsShipmentModalOpen(false);
      setIsDetailModalOpen(false);
      loadOrders();
    } catch {
      alert("Erro ao salvar rastreamento.");
    } finally {
      setIsSavingShipment(false);
    }
  };

  const handleOpenCreateOrder = () => {
    loadCreateOptions();
    setFormCustomerId("");
    setSelectedProducts([]);
    setFormShipping(0);
    setFormDiscount(0);
    setFormInitialStatus("AWAITING_PAYMENT");
    setFormPaymentMethod("TEST_MODE");
    setFormNotes("");
    setCreateError("");
    setIsCreateModalOpen(true);
  };

  const handleAddProductToOrder = (productId: string) => {
    if (!productId) return;
    const exists = selectedProducts.find((p) => p.productId === productId);
    if (exists) {
      setSelectedProducts((prev) =>
        prev.map((p) => (p.productId === productId ? { ...p, quantity: p.quantity + 1 } : p))
      );
    } else {
      setSelectedProducts((prev) => [...prev, { productId, quantity: 1 }]);
    }
  };

  const handleRemoveProductFromOrder = (productId: string) => {
    setSelectedProducts((prev) => prev.filter((p) => p.productId !== productId));
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");

    if (!formCustomerId) {
      setCreateError("Selecione um cliente.");
      return;
    }

    if (selectedProducts.length === 0) {
      setCreateError("Adicione pelo menos um produto ao pedido.");
      return;
    }

    const customer = customerOptions.find((c) => c.id === formCustomerId);
    const addr = customer?.defaultAddress || {
      street: "Endereço Padrão",
      number: "100",
      neighborhood: "Centro",
      city: "São Paulo",
      state: "SP",
      postalCode: "01001000",
    };

    setIsCreatingOrder(true);

    try {
      const payload = {
        customerId: formCustomerId,
        items: selectedProducts,
        shippingCost: Number(formShipping),
        discountAmount: Number(formDiscount),
        shippingAddress: {
          name: customer.name,
          street: addr.street,
          number: addr.number,
          complement: addr.complement || null,
          neighborhood: addr.neighborhood,
          city: addr.city,
          state: addr.state,
          postalCode: addr.postalCode,
        },
        initialStatus: formInitialStatus,
        paymentMethod: formPaymentMethod,
        notes: formNotes || null,
      };

      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setCreateError(data.error || "Erro ao criar pedido.");
        setIsCreatingOrder(false);
        return;
      }

      setIsCreateModalOpen(false);
      setSuccessMessage(`Pedido ${data.order.orderNumber} criado com sucesso com snapshot comercial!`);
      setTimeout(() => setSuccessMessage(""), 4000);
      loadOrders();
    } catch {
      setCreateError("Erro de comunicação com o servidor.");
    } finally {
      setIsCreatingOrder(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <ShoppingCart className="w-6 h-6 text-emerald-400" />
            Gestão de Pedidos
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Acompanhamento de vendas, status de fornecedor, expedição e auditoria imutável
          </p>
        </div>

        <Button onClick={handleOpenCreateOrder} variant="primary" className="shadow-lg shadow-emerald-600/20">
          <Plus className="w-4 h-4 mr-1.5" /> Novo Pedido Manual
        </Button>
      </div>

      {/* Notificações */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por número do pedido, cliente ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-900 border border-slate-800 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="">Todos os Status</option>
            <option value="AWAITING_PAYMENT">Aguardando Pagamento</option>
            <option value="PAID">Pago</option>
            <option value="PROCESSING">Processando</option>
            <option value="AWAITING_SUPPLIER">Aguardando Fornecedor</option>
            <option value="SENT_TO_SUPPLIER">Enviado ao Fornecedor</option>
            <option value="SHIPPED">Enviado (Rastreio)</option>
            <option value="DELIVERED">Entregue</option>
            <option value="CANCELLED">Cancelado</option>
            <option value="REFUNDED">Reembolsado</option>
          </select>
        </div>
      </div>

      {/* Tabela de Pedidos */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              <span>Carregando pedidos...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <ShoppingCart className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-base font-semibold text-slate-300">Nenhum pedido encontrado</p>
              <p className="text-xs text-slate-500">Tente ajustar a busca ou crie um novo pedido.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-850 border-slate-800 text-slate-400">
                <TableRow className="border-slate-800">
                  <TableHead>Pedido & Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Total & Lucro</TableHead>
                  <TableHead>Rastreio / Envio</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-slate-800 text-slate-300">
                {orders.map((ord) => (
                  <TableRow key={ord.id} className="hover:bg-slate-800/40 border-slate-800">
                    <TableCell>
                      <div className="font-mono font-bold text-emerald-400 text-sm">{ord.orderNumber}</div>
                      <div className="text-[11px] text-slate-400">{formatDate(ord.createdAt)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-white text-sm">{ord.customer.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{ord.customer.email}</div>
                    </TableCell>
                    <TableCell>{getStatusBadge(ord.status)}</TableCell>
                    <TableCell className="text-xs text-slate-400 max-w-xs truncate">
                      {ord.items.map((it) => `${it.quantity}x ${it.name}`).join(", ")}
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-sm font-bold text-white">
                        {formatCurrency(ord.totalAmount)}
                      </div>
                      <div className="text-[11px] text-emerald-400 font-mono">
                        Lucro: +{formatCurrency(ord.estimatedProfit)} ({formatPercent(ord.marginPercentage)})
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {ord.shipments?.[0]?.trackingNumber ? (
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-emerald-300 border border-slate-700">
                          {ord.shipments[0].trackingNumber}
                        </span>
                      ) : (
                        <span className="text-slate-500">Sem rastreio</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        onClick={() => handleOpenDetail(ord.id)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        Detalhes
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal de Detalhes Completos do Pedido */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={selectedOrder ? `Pedido: ${selectedOrder.orderNumber}` : "Detalhes do Pedido"}
        maxWidth="2xl"
      >
        {selectedOrder && (
          <div className="space-y-6">
            {/* Top Overview */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs text-slate-400 block">Status Atual:</span>
                <div className="mt-1">{getStatusBadge(selectedOrder.status)}</div>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Cliente:</span>
                <span className="text-sm font-bold text-white">{selectedOrder.customer.name}</span>
                <span className="text-xs text-slate-400 block">{selectedOrder.customer.email}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Data da Compra:</span>
                <span className="text-xs font-mono text-slate-200">{formatDate(selectedOrder.createdAt)}</span>
              </div>
            </div>

            {/* Itens do Pedido (Snapshot Imutável) */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-emerald-400" /> Itens do Pedido (Snapshot no Momento da Compra)
              </h4>
              <div className="border border-slate-800 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-950 text-slate-400 text-xs">
                    <TableRow className="border-slate-800">
                      <TableHead>Item / SKU Snapshot</TableHead>
                      <TableHead>Custo Unit.</TableHead>
                      <TableHead>Preço Unit.</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead className="text-right">Total Item</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-slate-800 text-slate-300 text-xs">
                    {selectedOrder.items.map((it: any) => (
                      <TableRow key={it.id} className="border-slate-800">
                        <TableCell>
                          <div className="font-semibold text-white">{it.name}</div>
                          <div className="font-mono text-[11px] text-emerald-400">{it.sku}</div>
                        </TableCell>
                        <TableCell className="font-mono text-slate-400">
                          {formatCurrency(Number(it.unitCost))}
                        </TableCell>
                        <TableCell className="font-mono text-white font-semibold">
                          {formatCurrency(Number(it.unitPrice))}
                        </TableCell>
                        <TableCell className="font-mono">{it.quantity}x</TableCell>
                        <TableCell className="text-right font-mono font-bold text-white">
                          {formatCurrency(Number(it.totalPrice))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* DRE e Consolidação Financeira do Pedido */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal dos Produtos:</span>
                <span className="font-mono text-white">{formatCurrency(Number(selectedOrder.subtotalAmount))}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Frete Cobrado:</span>
                <span className="font-mono text-white">{formatCurrency(Number(selectedOrder.shippingCost))}</span>
              </div>
              {Number(selectedOrder.discountAmount) > 0 && (
                <div className="flex justify-between text-rose-400">
                  <span>Desconto Aplicado:</span>
                  <span className="font-mono">-{formatCurrency(Number(selectedOrder.discountAmount))}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-slate-800">
                <span>Total Recebido do Cliente:</span>
                <span className="font-mono text-emerald-400">{formatCurrency(Number(selectedOrder.totalAmount))}</span>
              </div>
              <div className="flex justify-between text-slate-400 pt-1">
                <span>Custo Total dos Produtos (CMV):</span>
                <span className="font-mono text-slate-300">{formatCurrency(Number(selectedOrder.totalCostAmount))}</span>
              </div>
              <div className="flex justify-between text-emerald-300 font-bold pt-1">
                <span>Lucro Líquido Estimado:</span>
                <span className="font-mono">+{formatCurrency(Number(selectedOrder.estimatedProfit))} ({formatPercent(Number(selectedOrder.marginPercentage))} margem)</span>
              </div>
            </div>

            {/* Gateway de Pagamento & Cobranças */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-400" /> Gateway de Pagamento (Mercado Pago / Teste)
                </h4>
                {selectedOrder.payments && selectedOrder.payments.length > 0 && (
                  <span className="text-[11px] font-mono text-slate-400">
                    {selectedOrder.payments.length} registro(s)
                  </span>
                )}
              </div>

              {paymentFeedback && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                    paymentFeedback.type === "success"
                      ? "bg-emerald-950/60 border border-emerald-800 text-emerald-200"
                      : "bg-rose-950/60 border border-rose-800 text-rose-200"
                  }`}
                >
                  {paymentFeedback.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{paymentFeedback.message}</span>
                </div>
              )}

              {(!selectedOrder.payments || selectedOrder.payments.length === 0) ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">Nenhum pagamento registrado para este pedido.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isProcessingPayment}
                      onClick={() => handleGeneratePayment("PIX")}
                      className="border-emerald-600/40 text-emerald-300 hover:bg-emerald-950/30"
                    >
                      <QrCode className="w-3.5 h-3.5 mr-1" /> Gerar Pix (Mercado Pago)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isProcessingPayment}
                      onClick={() => handleGeneratePayment("TEST_MODE")}
                      className="border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      <CreditCard className="w-3.5 h-3.5 mr-1" /> Simular Pagamento Teste
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedOrder.payments.map((pmt: any) => {
                    const isPending = pmt.status === "PENDING";
                    const isApproved = pmt.status === "APPROVED";

                    return (
                      <div
                        key={pmt.id}
                        className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-xs">
                              {pmt.method === "PIX" ? "PIX" : pmt.method === "CREDIT_CARD" ? "Cartão de Crédito" : pmt.method}
                            </span>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              Gateway: {pmt.gateway || "MERCADOPAGO"}
                            </span>
                          </div>
                          <div>
                            {pmt.status === "APPROVED" && <Badge variant="success">Aprovado</Badge>}
                            {pmt.status === "PENDING" && <Badge variant="warning">Aguardando Pagamento</Badge>}
                            {pmt.status === "CANCELLED" && <Badge variant="neutral">Cancelado</Badge>}
                            {pmt.status === "REFUNDED" && <Badge variant="danger">Reembolsado</Badge>}
                            {pmt.status === "FAILED" && <Badge variant="danger">Falhou</Badge>}
                            {pmt.status === "REJECTED" && <Badge variant="danger">Rejeitado</Badge>}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-400">
                          <div>
                            <span>Valor: </span>
                            <span className="font-mono text-white font-semibold">
                              {formatCurrency(Number(pmt.amount))}
                            </span>
                          </div>
                          <div>
                            <span>ID Transação: </span>
                            <span className="font-mono text-slate-300 truncate block">
                              {pmt.transactionId || "Pendente"}
                            </span>
                          </div>
                          <div>
                            <span>Criado em: </span>
                            <span className="font-mono text-slate-300">
                              {formatDate(pmt.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* Pix QR Code Display */}
                        {isPending && (pmt.qrCode || pmt.qrCodeBase64) && (
                          <div className="p-3 rounded-lg bg-slate-950 border border-emerald-900/40 space-y-3">
                            <div className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                              <QrCode className="w-4 h-4" /> Pagamento Pix Disponível
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-4">
                              {pmt.qrCodeBase64 && (
                                <img
                                  src={
                                    pmt.qrCodeBase64.startsWith("data:")
                                      ? pmt.qrCodeBase64
                                      : pmt.qrCodeBase64.startsWith("PHN2Zy") || pmt.qrCodeBase64.startsWith("PD94bWw")
                                      ? `data:image/svg+xml;base64,${pmt.qrCodeBase64}`
                                      : `data:image/png;base64,${pmt.qrCodeBase64}`
                                  }
                                  alt="Pix QR Code"
                                  className="w-32 h-32 rounded bg-white p-1 shadow-md object-contain"
                                />
                              )}

                              {pmt.qrCode && (
                                <div className="flex-1 space-y-1.5 w-full">
                                  <label className="text-[11px] text-slate-400 block font-medium">
                                    Pix Copia e Cola:
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      readOnly
                                      value={pmt.qrCode}
                                      className="w-full text-xs font-mono bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-300 select-all"
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => copyPixCode(pmt.qrCode)}
                                      className="shrink-0"
                                    >
                                      {copiedPix ? (
                                        <>
                                          <Check className="w-3.5 h-3.5 text-emerald-400 mr-1" /> Copiado!
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {pmt.failureReason && (
                          <div className="text-xs text-rose-400">
                            Motivo da falha: {pmt.failureReason}
                          </div>
                        )}

                        {/* Ações de Gestão de Pagamento */}
                        <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-800/80 justify-end">
                          {isPending && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isProcessingPayment}
                              onClick={() => handleCancelPayment(pmt.id)}
                              className="text-rose-400 hover:text-rose-300 border-rose-900/50 hover:bg-rose-950/40 text-xs"
                            >
                              Cancelar Cobrança
                            </Button>
                          )}
                          {isApproved && selectedOrder.status !== "REFUNDED" && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isProcessingPayment}
                              onClick={() => handleRefundPayment(pmt.id)}
                              className="text-amber-400 hover:text-amber-300 border-amber-900/50 hover:bg-amber-950/40 text-xs"
                            >
                              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Estornar Pagamento
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Endereço de Entrega Snapshot */}
            {selectedOrder.shippingAddress && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-emerald-400" /> Endereço de Entrega Snapshot
                </h4>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300">
                  <div className="font-medium text-white">{selectedOrder.shippingAddress.name}</div>
                  <div>
                    {selectedOrder.shippingAddress.street}, {selectedOrder.shippingAddress.number}{" "}
                    {selectedOrder.shippingAddress.complement && `(${selectedOrder.shippingAddress.complement})`}
                  </div>
                  <div>
                    {selectedOrder.shippingAddress.neighborhood} - {selectedOrder.shippingAddress.city}/
                    {selectedOrder.shippingAddress.state} | CEP: {selectedOrder.shippingAddress.postalCode}
                  </div>
                </div>
              </div>
            )}

            {/* Ordens de Fulfillment por Fornecedor */}
            {selectedOrder.fulfillmentOrders && selectedOrder.fulfillmentOrders.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-emerald-400" /> Ordens de Fulfillment ({selectedOrder.fulfillmentOrders.length} pacote(s))
                </h4>
                <div className="space-y-2">
                  {selectedOrder.fulfillmentOrders.map((f: any) => (
                    <div
                      key={f.id}
                      className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">
                            {f.supplier?.name || "Sem Fornecedor"}
                          </span>
                          <Badge variant={f.status === "DELIVERED" ? "success" : f.status === "SHIPPED" ? "info" : f.status === "FAILED" ? "danger" : "warning"}>
                            {f.status}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          {f.items?.length || 0} item(ns) • Ext ID: <span className="font-mono text-emerald-400">{f.externalOrderId || "Pendente"}</span>
                        </div>
                        {f.failureReason && (
                          <div className="text-rose-400 text-[11px] mt-0.5">{f.failureReason}</div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        {f.status === "PENDING" && f.supplierId && (
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 font-bold"
                            onClick={async () => {
                              await fetch(`/api/admin/fulfillment/${f.id}/submit`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ force: true }),
                              });
                              handleOpenDetail(selectedOrder.id);
                            }}
                          >
                            <Send className="w-3 h-3 mr-1" /> Enviar
                          </Button>
                        )}
                        {(f.status === "ACKNOWLEDGED" || f.status === "SUBMITTED") && f.externalOrderId && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-slate-700 text-blue-400 hover:bg-blue-950/40"
                            onClick={async () => {
                              await fetch(`/api/admin/fulfillment/${f.id}/sync`, { method: "POST" });
                              handleOpenDetail(selectedOrder.id);
                            }}
                          >
                            <RefreshCw className="w-3 h-3 mr-1" /> Sync
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rastreamento & Envio */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-blue-400" /> Envio & Rastreamento
                </h4>
                <Button type="button" variant="outline" size="sm" onClick={handleOpenShipment}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Cadastrar Rastreio
                </Button>
              </div>

              {selectedOrder.shipments?.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">Nenhum envio registrado ainda.</p>
              ) : (
                selectedOrder.shipments.map((shp: any) => (
                  <div key={shp.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">Transportadora: {shp.carrier}</span>
                      <Badge variant="info">{shp.status}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Código:</span>
                      <span className="font-mono text-emerald-400 font-bold">{shp.trackingNumber}</span>
                      {shp.trackingUrl && (
                        <a
                          href={shp.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:underline inline-flex items-center gap-1 ml-2"
                        >
                          Rastrear <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Alterar Status com Justificativa */}
            <form onSubmit={handleUpdateStatus} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-emerald-400" /> Atualizar Status do Pedido
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Novo Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white focus:border-emerald-500"
                  >
                    <option value="AWAITING_PAYMENT">Aguardando Pagamento</option>
                    <option value="PAID">Pago</option>
                    <option value="PROCESSING">Processando</option>
                    <option value="AWAITING_SUPPLIER">Aguardando Fornecedor</option>
                    <option value="SENT_TO_SUPPLIER">Enviado ao Fornecedor</option>
                    <option value="SHIPPED">Enviado (com rastreio)</option>
                    <option value="DELIVERED">Entregue</option>
                    <option value="CANCELLED">Cancelado</option>
                    <option value="REFUNDED">Reembolsado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Motivo / Observação</label>
                  <input
                    type="text"
                    placeholder="Ex: Fornecedor confirmou despacho"
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" variant="primary" size="sm" isLoading={isUpdatingStatus}>
                  Gravar Alteração de Status
                </Button>
              </div>
            </form>

            {/* Linha do Tempo de Auditoria (Append-Only) */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-purple-400" /> Histórico de Auditoria Imutável
              </h4>

              <div className="space-y-2 border-l-2 border-slate-800 pl-4 ml-2">
                {selectedOrder.statusHistory?.map((hist: any) => (
                  <div key={hist.id} className="relative text-xs space-y-0.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 absolute -left-[21px] top-1" />
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">
                        {hist.previousStatus} → {hist.newStatus}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">{formatDate(hist.createdAt)}</span>
                    </div>
                    {hist.reason && <p className="text-slate-400">{hist.reason}</p>}
                    {hist.changedByUser && (
                      <p className="text-[11px] text-slate-500">Por: {hist.changedByUser.name}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Adicionar Rastreio */}
      <Modal
        isOpen={isShipmentModalOpen}
        onClose={() => setIsShipmentModalOpen(false)}
        title="Cadastrar Rastreamento de Envio"
      >
        <form onSubmit={handleSaveShipment} className="space-y-4">
          <Input
            label="Transportadora / Método *"
            required
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            placeholder="Ex: Correios, Cainiao, J&T Express"
            className="bg-slate-950 border-slate-800 text-white"
          />

          <Input
            label="Código de Rastreamento *"
            required
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value.trim().toUpperCase())}
            placeholder="Ex: NL876543210BR ou BR123456789CN"
            className="bg-slate-950 border-slate-800 text-white font-mono"
          />

          <Input
            label="URL Direta de Rastreamento (Opcional)"
            type="url"
            value={trackingUrl}
            onChange={(e) => setTrackingUrl(e.target.value)}
            placeholder="https://..."
            className="bg-slate-950 border-slate-800 text-white"
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsShipmentModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={isSavingShipment}>
              Confirmar Envio
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Criar Pedido Manual */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Criar Novo Pedido Manual"
        maxWidth="xl"
      >
        {createError && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{createError}</span>
          </div>
        )}

        <form onSubmit={handleCreateOrder} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Selecionar Cliente *
            </label>
            <select
              required
              value={formCustomerId}
              onChange={(e) => setFormCustomerId(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white"
            >
              <option value="">Escolha um cliente cadastrado...</option>
              {customerOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({formatCpf(c.cpf)}) - {c.email}
                </option>
              ))}
            </select>
          </div>

          {/* Adicionar Produtos */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Adicionar Produtos ao Pedido *
            </label>
            <div className="flex gap-2 mb-3">
              <select
                id="selectProd"
                className="flex-1 px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddProductToOrder(e.target.value);
                    e.target.value = "";
                  }
                }}
              >
                <option value="">Selecione um produto para adicionar...</option>
                {productOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} - Preço: {formatCurrency(p.sellingPrice)} (Estoque: {p.stock} un)
                  </option>
                ))}
              </select>
            </div>

            {/* Lista de Produtos Selecionados */}
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {selectedProducts.map((sp) => {
                const p = productOptions.find((prod) => prod.id === sp.productId);
                if (!p) return null;

                return (
                  <div
                    key={sp.productId}
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white">{p.name}</div>
                      <div className="text-slate-400 font-mono">
                        {formatCurrency(p.sellingPrice)} x {sp.quantity} = {formatCurrency(p.sellingPrice * sp.quantity)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max={p.stock}
                        value={sp.quantity}
                        onChange={(e) => {
                          const qty = Math.max(1, parseInt(e.target.value) || 1);
                          setSelectedProducts((prev) =>
                            prev.map((item) =>
                              item.productId === sp.productId ? { ...item, quantity: qty } : item
                            )
                          );
                        }}
                        className="w-16 px-2 py-1 text-xs bg-slate-900 border border-slate-800 rounded text-white text-center"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveProductFromOrder(sp.productId)}
                        className="text-rose-400 hover:text-rose-300 p-1"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Frete (R$)"
              type="number"
              step="0.01"
              min="0"
              value={formShipping || ""}
              onChange={(e) => setFormShipping(parseFloat(e.target.value) || 0)}
              className="bg-slate-950 border-slate-800 text-white font-mono"
            />
            <Input
              label="Desconto (R$)"
              type="number"
              step="0.01"
              min="0"
              value={formDiscount || ""}
              onChange={(e) => setFormDiscount(parseFloat(e.target.value) || 0)}
              className="bg-slate-950 border-slate-800 text-white font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Status Inicial
              </label>
              <select
                value={formInitialStatus}
                onChange={(e) => setFormInitialStatus(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white"
              >
                <option value="AWAITING_PAYMENT">Aguardando Pagamento</option>
                <option value="PAID">Pago (Aprovado)</option>
                <option value="PROCESSING">Processando</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Método de Pagamento
              </label>
              <select
                value={formPaymentMethod}
                onChange={(e) => setFormPaymentMethod(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white"
              >
                <option value="TEST_MODE">Modo Teste (Simulação)</option>
                <option value="PIX">PIX</option>
                <option value="CREDIT_CARD">Cartão de Crédito</option>
                <option value="BOLETO">Boleto Bancário</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={isCreatingOrder}>
              Finalizar Pedido
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
