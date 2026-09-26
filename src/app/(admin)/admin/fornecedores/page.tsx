"use client";

import React, { useState, useEffect } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import {
  Truck,
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  Package,
  CheckCircle2,
  Mail,
  Phone,
  Globe,
  ExternalLink,
  Plug,
  PlugZap,
  Activity,
  Key,
  ShieldCheck,
  RefreshCw,
  Power,
  PowerOff,
  Clock,
  Radio,
  Sliders,
  XCircle,
} from "lucide-react";

interface SupplierIntegrationSummary {
  id?: string;
  provider: string;
  status: "NOT_CONFIGURED" | "CONFIGURED" | "ACTIVE" | "ERROR" | "DISABLED";
  lastTestedAt?: string | null;
  lastError?: string | null;
}

interface SupplierItem {
  id: string;
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  notes?: string | null;
  active: boolean;
  productsCount: number;
  shipmentsCount: number;
  integration?: SupplierIntegrationSummary | null;
  createdAt: string;
}

interface IntegrationDetail {
  id?: string;
  supplierId: string;
  provider: string;
  status: "NOT_CONFIGURED" | "CONFIGURED" | "ACTIVE" | "ERROR" | "DISABLED";
  baseUrl?: string | null;
  authHeader?: string | null;
  timeoutMs: number;
  retryMaxAttempts: number;
  isActive: boolean;
  lastTestedAt?: string | null;
  lastError?: string | null;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  hasWebhookSecret: boolean;
  maskedApiKey?: string | null;
  maskedApiSecret?: string | null;
  maskedWebhookSecret?: string | null;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Supplier Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formContact, setFormContact] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formWebsite, setFormWebsite] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  // Integration Modal State
  const [isIntegrationModalOpen, setIsIntegrationModalOpen] = useState(false);
  const [selectedSupplierForIntegration, setSelectedSupplierForIntegration] = useState<SupplierItem | null>(null);
  const [integrationLoading, setIntegrationLoading] = useState(false);
  const [integrationData, setIntegrationData] = useState<IntegrationDetail | null>(null);
  const [integrationProvider, setIntegrationProvider] = useState<string>("TEST");
  const [integrationBaseUrl, setIntegrationBaseUrl] = useState<string>("");
  const [integrationApiKey, setIntegrationApiKey] = useState<string>("");
  const [integrationApiSecret, setIntegrationApiSecret] = useState<string>("");
  const [integrationAuthHeader, setIntegrationAuthHeader] = useState<string>("Bearer");
  const [integrationWebhookSecret, setIntegrationWebhookSecret] = useState<string>("");
  const [integrationTimeoutMs, setIntegrationTimeoutMs] = useState<number>(10000);
  const [integrationRetryMaxAttempts, setIntegrationRetryMaxAttempts] = useState<number>(3);
  const [integrationIsActive, setIntegrationIsActive] = useState<boolean>(true);
  const [integrationSaving, setIntegrationSaving] = useState(false);
  const [integrationError, setIntegrationError] = useState("");
  const [integrationSuccess, setIntegrationSuccess] = useState("");

  // Live Test State
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    category?: string;
    message: string;
    latencyMs?: number;
    testedAt: string;
  } | null>(null);

  const loadSuppliers = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const url = search ? `/api/admin/suppliers?q=${encodeURIComponent(search)}` : "/api/admin/suppliers";
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setSuppliers(data.suppliers || []);
      } else {
        setErrorMessage(data.error || "Erro ao carregar fornecedores.");
      }
    } catch {
      setErrorMessage("Erro de conexão ao carregar fornecedores.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, [search]);

  const handleOpenCreate = () => {
    setEditingSupplier(null);
    setFormName("");
    setFormContact("");
    setFormEmail("");
    setFormPhone("");
    setFormWebsite("");
    setFormNotes("");
    setFormActive(true);
    setModalError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (supplier: SupplierItem) => {
    setEditingSupplier(supplier);
    setFormName(supplier.name);
    setFormContact(supplier.contactName || "");
    setFormEmail(supplier.email || "");
    setFormPhone(supplier.phone || "");
    setFormWebsite(supplier.website || "");
    setFormNotes(supplier.notes || "");
    setFormActive(supplier.active);
    setModalError("");
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    setIsSaving(true);

    try {
      const payload = {
        name: formName,
        contactName: formContact || null,
        email: formEmail || null,
        phone: formPhone || null,
        website: formWebsite || null,
        notes: formNotes || null,
        active: formActive,
      };

      const url = editingSupplier
        ? `/api/admin/suppliers/${editingSupplier.id}`
        : "/api/admin/suppliers";

      const method = editingSupplier ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setModalError(data.error || "Erro ao salvar fornecedor.");
        setIsSaving(false);
        return;
      }

      setIsModalOpen(false);
      setSuccessMessage(
        editingSupplier ? "Fornecedor atualizado com sucesso!" : "Fornecedor cadastrado com sucesso!"
      );
      setTimeout(() => setSuccessMessage(""), 4000);
      loadSuppliers();
    } catch {
      setModalError("Erro de comunicação com o servidor.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (supplier: SupplierItem) => {
    if (supplier.productsCount > 0 || supplier.shipmentsCount > 0) {
      alert(
        `Este fornecedor possui ${supplier.productsCount} produto(s) ou ${supplier.shipmentsCount} envio(s) vinculados e não pode ser excluído.`
      );
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir o fornecedor "${supplier.name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/suppliers/${supplier.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Erro ao excluir fornecedor.");
        return;
      }

      setSuccessMessage("Fornecedor excluído com sucesso.");
      setTimeout(() => setSuccessMessage(""), 4000);
      loadSuppliers();
    } catch {
      alert("Erro ao excluir fornecedor.");
    }
  };

  // ==========================================
  // INTEGRATION HUB HANDLERS
  // ==========================================

  const handleOpenIntegrationModal = async (supplier: SupplierItem) => {
    setSelectedSupplierForIntegration(supplier);
    setIsIntegrationModalOpen(true);
    setIntegrationLoading(true);
    setIntegrationError("");
    setIntegrationSuccess("");
    setTestResult(null);
    setIntegrationApiKey("");
    setIntegrationApiSecret("");
    setIntegrationWebhookSecret("");

    try {
      const res = await fetch(`/api/admin/suppliers/${supplier.id}/integration`);
      const data = await res.json();

      if (res.ok && data.integration) {
        const integ = data.integration;
        setIntegrationData(integ);
        setIntegrationProvider(integ.provider || "TEST");
        setIntegrationBaseUrl(integ.baseUrl || "");
        setIntegrationAuthHeader(integ.authHeader || "Bearer");
        setIntegrationTimeoutMs(integ.timeoutMs || 10000);
        setIntegrationRetryMaxAttempts(integ.retryMaxAttempts || 3);
        setIntegrationIsActive(integ.isActive ?? true);
      } else {
        // Sem integração configurada previamente
        setIntegrationData(null);
        setIntegrationProvider("TEST");
        setIntegrationBaseUrl("");
        setIntegrationAuthHeader("Bearer");
        setIntegrationTimeoutMs(10000);
        setIntegrationRetryMaxAttempts(3);
        setIntegrationIsActive(true);
      }
    } catch {
      setIntegrationError("Erro ao carregar dados de integração.");
    } finally {
      setIntegrationLoading(false);
    }
  };

  const handleSaveIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierForIntegration) return;

    setIntegrationSaving(true);
    setIntegrationError("");
    setIntegrationSuccess("");

    try {
      const payload: any = {
        provider: integrationProvider,
        baseUrl: integrationBaseUrl || null,
        authHeader: integrationAuthHeader || "Bearer",
        timeoutMs: Number(integrationTimeoutMs) || 10000,
        retryMaxAttempts: Number(integrationRetryMaxAttempts) || 3,
        isActive: integrationIsActive,
      };

      // Só envia chaves se o usuário digitou uma nova chave
      if (integrationApiKey.trim()) {
        payload.apiKey = integrationApiKey.trim();
      }
      if (integrationApiSecret.trim()) {
        payload.apiSecret = integrationApiSecret.trim();
      }
      if (integrationWebhookSecret.trim()) {
        payload.webhookSecret = integrationWebhookSecret.trim();
      }

      const res = await fetch(`/api/admin/suppliers/${selectedSupplierForIntegration.id}/integration`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setIntegrationError(data.error || "Erro ao salvar integração.");
        return;
      }

      setIntegrationData(data.integration);
      setIntegrationApiKey("");
      setIntegrationApiSecret("");
      setIntegrationWebhookSecret("");
      setIntegrationSuccess("Configurações de integração salvas com sucesso!");
      loadSuppliers();
    } catch {
      setIntegrationError("Erro de conexão ao salvar integração.");
    } finally {
      setIntegrationSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!selectedSupplierForIntegration) return;

    setTestingConnection(true);
    setTestResult(null);
    setIntegrationError("");

    try {
      const res = await fetch(`/api/admin/suppliers/${selectedSupplierForIntegration.id}/integration/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeoutMs: integrationTimeoutMs }),
      });

      const data = await res.json();
      setTestResult({
        success: data.success,
        category: data.category,
        message: data.message || (data.success ? "Conexão estabelecida com sucesso." : "Falha na conexão."),
        latencyMs: data.latencyMs,
        testedAt: new Date().toISOString(),
      });

      if (data.integration) {
        setIntegrationData(data.integration);
      }
      loadSuppliers();
    } catch {
      setTestResult({
        success: false,
        category: "NETWORK_ERROR",
        message: "Erro de comunicação ao testar conexão com o fornecedor.",
        testedAt: new Date().toISOString(),
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleToggleIntegrationActive = async (enable: boolean) => {
    if (!selectedSupplierForIntegration) return;

    setIntegrationSaving(true);
    setIntegrationError("");
    setIntegrationSuccess("");

    try {
      const endpoint = enable ? "enable" : "disable";
      const res = await fetch(`/api/admin/suppliers/${selectedSupplierForIntegration.id}/integration/${endpoint}`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setIntegrationError(data.error || "Erro ao alterar estado da integração.");
        return;
      }

      setIntegrationData(data.integration);
      setIntegrationIsActive(data.integration.isActive);
      setIntegrationSuccess(data.message || (enable ? "Integração ativada." : "Integração desativada."));
      loadSuppliers();
    } catch {
      setIntegrationError("Erro de comunicação com o servidor.");
    } finally {
      setIntegrationSaving(false);
    }
  };

  const handleRemoveIntegration = async () => {
    if (!selectedSupplierForIntegration) return;
    if (!confirm("Tem certeza que deseja remover a integração deste fornecedor? As credenciais criptografadas serão excluídas permanentemente.")) {
      return;
    }

    setIntegrationSaving(true);
    setIntegrationError("");
    setIntegrationSuccess("");

    try {
      const res = await fetch(`/api/admin/suppliers/${selectedSupplierForIntegration.id}/integration`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setIntegrationError(data.error || "Erro ao remover integração.");
        return;
      }

      setIntegrationData(null);
      setTestResult(null);
      setIntegrationSuccess("Integração removida com sucesso.");
      loadSuppliers();
    } catch {
      setIntegrationError("Erro de comunicação ao remover integração.");
    } finally {
      setIntegrationSaving(false);
    }
  };

  const renderIntegrationBadge = (integration?: SupplierIntegrationSummary | null) => {
    if (!integration || integration.status === "NOT_CONFIGURED") {
      return <Badge variant="neutral" size="sm">Não Configurada</Badge>;
    }
    switch (integration.status) {
      case "ACTIVE":
        return (
          <Badge variant="success" size="sm" className="gap-1">
            <PlugZap className="w-3 h-3 text-emerald-400" />
            Ativa ({integration.provider})
          </Badge>
        );
      case "CONFIGURED":
        return (
          <Badge variant="info" size="sm" className="gap-1">
            <CheckCircle2 className="w-3 h-3 text-sky-400" />
            Configurada
          </Badge>
        );
      case "ERROR":
        return (
          <Badge variant="danger" size="sm" className="gap-1">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            Erro
          </Badge>
        );
      case "DISABLED":
        return (
          <Badge variant="warning" size="sm" className="gap-1">
            <PowerOff className="w-3 h-3 text-amber-400" />
            Desativada
          </Badge>
        );
      default:
        return <Badge variant="neutral" size="sm">{integration.status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Truck className="w-6 h-6 text-emerald-400" />
            Gestão de Fornecedores & Hub de Integrações
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Cadastre fornecedores, configure credenciais seguras (AES-256) e monitore conexões de dropshipping
          </p>
        </div>

        <Button onClick={handleOpenCreate} variant="primary" className="shadow-lg shadow-emerald-600/20">
          <Plus className="w-4 h-4 mr-1.5" /> Novo Fornecedor
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

      {/* Barra de Busca */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, contato ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-900 border border-slate-800 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Tabela de Fornecedores */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              <span>Carregando fornecedores...</span>
            </div>
          ) : suppliers.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Truck className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-base font-semibold text-slate-300">Nenhum fornecedor encontrado</p>
              <p className="text-xs text-slate-500">Clique em "Novo Fornecedor" para cadastrar.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-850 border-slate-800 text-slate-400">
                <TableRow className="border-slate-800">
                  <TableHead>Fornecedor & Contato</TableHead>
                  <TableHead>Canais de Contato</TableHead>
                  <TableHead>Produtos</TableHead>
                  <TableHead>Hub de Integração</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-slate-800 text-slate-300">
                {suppliers.map((sup) => (
                  <TableRow key={sup.id} className="hover:bg-slate-800/40 border-slate-800">
                    <TableCell>
                      <div className="font-semibold text-white text-sm">{sup.name}</div>
                      {sup.contactName && (
                        <div className="text-xs text-slate-400">Resp: {sup.contactName}</div>
                      )}
                      {sup.website && (
                        <a
                          href={sup.website}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline mt-0.5"
                        >
                          <Globe className="w-3 h-3" /> Visitar Site <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5 text-xs text-slate-300">
                        {sup.email && (
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <Mail className="w-3.5 h-3.5 text-slate-500" /> {sup.email}
                          </div>
                        )}
                        {sup.phone && (
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <Phone className="w-3.5 h-3.5 text-slate-500" /> {sup.phone}
                          </div>
                        )}
                        {!sup.email && !sup.phone && <span className="text-slate-600">-</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        <Package className="w-3 h-3 text-emerald-400" />
                        {sup.productsCount} {sup.productsCount === 1 ? "produto" : "produtos"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        {renderIntegrationBadge(sup.integration)}
                        {sup.integration?.lastTestedAt && (
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            Testado em: {new Date(sup.integration.lastTestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {sup.active ? (
                        <Badge variant="success">Ativo</Badge>
                      ) : (
                        <Badge variant="neutral">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1.5">
                      <button
                        onClick={() => handleOpenIntegrationModal(sup)}
                        className="p-1.5 text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/50 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-medium px-2"
                        title="Configurar Integração com API"
                      >
                        <Plug className="w-3.5 h-3.5" />
                        <span>Integração</span>
                      </button>
                      <button
                        onClick={() => handleOpenEdit(sup)}
                        className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                        title="Editar Fornecedor"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(sup)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          sup.productsCount > 0 || sup.shipmentsCount > 0
                            ? "text-slate-600 bg-slate-850 cursor-not-allowed opacity-50"
                            : "text-slate-400 hover:text-rose-400 bg-slate-800 hover:bg-rose-950/40"
                        }`}
                        title={
                          sup.productsCount > 0 || sup.shipmentsCount > 0
                            ? "Não pode excluir fornecedor com produtos ou envios vinculados"
                            : "Excluir Fornecedor"
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal Criar / Editar Fornecedor */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}
        maxWidth="lg"
      >
        {modalError && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{modalError}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Razão Social / Nome da Empresa *"
            required
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Ex: GlobalTech Electronics Direct"
            className="bg-slate-950 border-slate-800 text-white"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nome do Contato / Representante"
              value={formContact}
              onChange={(e) => setFormContact(e.target.value)}
              placeholder="Ex: Chen Wei / Juliana Mendes"
              className="bg-slate-950 border-slate-800 text-white"
            />
            <Input
              label="Telefone / WhatsApp"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              placeholder="Ex: (11) 98765-4321"
              className="bg-slate-950 border-slate-800 text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="E-mail de Contato"
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="contato@fornecedor.com"
              className="bg-slate-950 border-slate-800 text-white"
            />
            <Input
              label="Website / Catálogo Online"
              type="url"
              value={formWebsite}
              onChange={(e) => setFormWebsite(e.target.value)}
              placeholder="https://fornecedor.com"
              className="bg-slate-950 border-slate-800 text-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-300">
              Observações / Métodos de Envio
            </label>
            <textarea
              rows={3}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Informações sobre prazos de despacho, transportadoras (ePacket, Cainiao, Sedex), etc..."
              className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="supplierActive"
              checked={formActive}
              onChange={(e) => setFormActive(e.target.checked)}
              className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="supplierActive" className="text-sm font-medium text-slate-300">
              Fornecedor Ativo no Sistema
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>
              {editingSupplier ? "Salvar Alterações" : "Criar Fornecedor"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* Modal Hub de Integração com Fornecedor */}
      {/* ======================================================== */}
      <Modal
        isOpen={isIntegrationModalOpen}
        onClose={() => setIsIntegrationModalOpen(false)}
        title={`Integração de Fornecedor: ${selectedSupplierForIntegration?.name || ""}`}
        maxWidth="2xl"
      >
        {integrationLoading ? (
          <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            <span>Carregando configurações de integração...</span>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Status & Security Banner */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-950/60 border border-emerald-800/80 rounded-lg text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                    <span>Status da Conexão:</span>
                    {renderIntegrationBadge(integrationData || { id: "", provider: integrationProvider, status: "NOT_CONFIGURED" })}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Credenciais protegidas com criptografia autenticada AES-256-GCM.
                  </p>
                </div>
              </div>

              {integrationData && (
                <div className="flex items-center gap-2">
                  {integrationData.isActive ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-amber-400 hover:text-amber-300 border-amber-800/60"
                      onClick={() => handleToggleIntegrationActive(false)}
                      disabled={integrationSaving}
                    >
                      <PowerOff className="w-3.5 h-3.5 mr-1" /> Desativar
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-emerald-400 hover:text-emerald-300 border-emerald-800/60"
                      onClick={() => handleToggleIntegrationActive(true)}
                      disabled={integrationSaving}
                    >
                      <Power className="w-3.5 h-3.5 mr-1" /> Ativar
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Error and Success Alerts */}
            {integrationError && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{integrationError}</span>
              </div>
            )}

            {integrationSuccess && (
              <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{integrationSuccess}</span>
              </div>
            )}

            {/* Form de Configuração */}
            <form onSubmit={handleSaveIntegration} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Provedor de Integração *
                  </label>
                  <select
                    value={integrationProvider}
                    onChange={(e) => setIntegrationProvider(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ALIEXPRESS">ALIEXPRESS & DSERS (Dropshipping Automático)</option>
                    <option value="CJ_DROPSHIPPING">CJ DROPSHIPPING (API Oficial Automática)</option>
                    <option value="TEST">TEST (Sandbox de Simulação)</option>
                    <option value="GENERIC_REST">GENERIC_REST (API REST Genérica)</option>
                  </select>
                  <p className="text-[11px] text-slate-500">
                    Selecione ALIEXPRESS (Opção A) ou CJ DROPSHIPPING (Opção B) para despacho automatizado.
                  </p>
                </div>

                <Input
                  label="URL Base da API (Endpoint)"
                  value={integrationBaseUrl}
                  onChange={(e) => setIntegrationBaseUrl(e.target.value)}
                  placeholder="https://api.fornecedor.com/v1"
                  className="bg-slate-950 border-slate-800 text-white"
                />
              </div>

              {/* Credenciais Criptografadas */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <Key className="w-4 h-4 text-amber-400" />
                  <span>Credenciais e Autenticação (Nunca Expostas no Frontend)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      API Key / Chave de Acesso
                    </label>
                    <input
                      type="password"
                      value={integrationApiKey}
                      onChange={(e) => setIntegrationApiKey(e.target.value)}
                      placeholder={integrationData?.maskedApiKey ? `Atual: ${integrationData.maskedApiKey}` : "Insira a chave da API..."}
                      className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-800 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    {integrationData?.hasApiKey && !integrationApiKey && (
                      <span className="text-[11px] text-slate-500">Chave salva ({integrationData.maskedApiKey}). Deixe em branco para manter.</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      API Secret / Token Secreto
                    </label>
                    <input
                      type="password"
                      value={integrationApiSecret}
                      onChange={(e) => setIntegrationApiSecret(e.target.value)}
                      placeholder={integrationData?.maskedApiSecret ? `Atual: ${integrationData.maskedApiSecret}` : "Opcional ou Secret..."}
                      className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-800 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    {integrationData?.hasApiSecret && !integrationApiSecret && (
                      <span className="text-[11px] text-slate-500">Secret salvo ({integrationData.maskedApiSecret}). Deixe em branco para manter.</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    label="Header de Auth"
                    value={integrationAuthHeader}
                    onChange={(e) => setIntegrationAuthHeader(e.target.value)}
                    placeholder="Bearer ou X-API-Key"
                    className="bg-slate-900 border-slate-800 text-white"
                  />

                  <Input
                    label="Timeout (ms)"
                    type="number"
                    value={integrationTimeoutMs}
                    onChange={(e) => setIntegrationTimeoutMs(Number(e.target.value))}
                    placeholder="10000"
                    className="bg-slate-900 border-slate-800 text-white"
                  />

                  <Input
                    label="Tentativas (Retries)"
                    type="number"
                    value={integrationRetryMaxAttempts}
                    onChange={(e) => setIntegrationRetryMaxAttempts(Number(e.target.value))}
                    placeholder="3"
                    className="bg-slate-900 border-slate-800 text-white"
                  />
                </div>
              </div>

              {/* Live Connection Test Panel */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <Activity className="w-4 h-4 text-sky-400" />
                    <span>Diagnóstico de Conexão em Tempo Real</span>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-xs text-sky-300 border-sky-800/60 hover:bg-sky-950/40"
                    onClick={handleTestConnection}
                    disabled={testingConnection || integrationSaving}
                  >
                    {testingConnection ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5 text-sky-400" />
                        Testando Conexão...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-sky-400" />
                        Testar Conexão Agora
                      </>
                    )}
                  </Button>
                </div>

                {testResult && (
                  <div
                    className={`p-3 rounded-lg border text-xs flex flex-col gap-1.5 ${
                      testResult.success
                        ? "bg-emerald-950/50 border-emerald-800 text-emerald-200"
                        : "bg-rose-950/50 border-rose-800 text-rose-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold flex items-center gap-1.5">
                        {testResult.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400" />
                        )}
                        {testResult.message}
                      </span>
                      {testResult.latencyMs !== undefined && (
                        <span className="text-[11px] font-mono opacity-80">
                          {testResult.latencyMs}ms
                        </span>
                      )}
                    </div>
                    {testResult.category && (
                      <div className="text-[11px] opacity-90">
                        Categoria de Falha: <strong className="font-mono">{testResult.category}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Botões do Rodapé */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
                <div>
                  {integrationData && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs text-rose-400 hover:text-rose-300 border-rose-900/60 hover:bg-rose-950/40"
                      onClick={handleRemoveIntegration}
                      disabled={integrationSaving}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Remover Integração
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsIntegrationModalOpen(false)}
                    disabled={integrationSaving}
                  >
                    Fechar
                  </Button>
                  <Button type="submit" variant="primary" isLoading={integrationSaving}>
                    Salvar Configurações
                  </Button>
                </div>
              </div>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
}
