"use client";

import React, { useState, useEffect } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { formatCurrency, formatCpf, formatPhone, formatCep, formatDate } from "@/lib/formatters";
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  MapPin,
  ShoppingBag,
  Phone,
  Mail,
  FileText,
} from "lucide-react";

interface CustomerItem {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
  notes?: string | null;
  ordersCount: number;
  totalSpent: number;
  defaultAddress?: {
    street: string;
    number: string;
    complement?: string | null;
    neighborhood: string;
    city: string;
    state: string;
    postalCode: string;
  } | null;
  createdAt: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<CustomerItem | null>(null);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCpf, setFormCpf] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Address Form Fields
  const [formStreet, setFormStreet] = useState("");
  const [formNumber, setFormNumber] = useState("");
  const [formComplement, setFormComplement] = useState("");
  const [formNeighborhood, setFormNeighborhood] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formState, setFormState] = useState("");
  const [formCep, setFormCep] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  const loadCustomers = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const url = search ? `/api/admin/customers?q=${encodeURIComponent(search)}` : "/api/admin/customers";
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setCustomers(data.data || []);
      } else {
        setErrorMessage(data.error || "Erro ao carregar clientes.");
      }
    } catch {
      setErrorMessage("Erro de conexão ao carregar clientes.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [search]);

  const handleOpenCreate = () => {
    setEditingCustomer(null);
    setFormName("");
    setFormEmail("");
    setFormCpf("");
    setFormPhone("");
    setFormNotes("");
    setFormStreet("");
    setFormNumber("");
    setFormComplement("");
    setFormNeighborhood("");
    setFormCity("");
    setFormState("");
    setFormCep("");
    setModalError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: CustomerItem) => {
    setEditingCustomer(c);
    setFormName(c.name);
    setFormEmail(c.email);
    setFormCpf(c.cpf);
    setFormPhone(c.phone);
    setFormNotes(c.notes || "");
    setFormStreet(c.defaultAddress?.street || "");
    setFormNumber(c.defaultAddress?.number || "");
    setFormComplement(c.defaultAddress?.complement || "");
    setFormNeighborhood(c.defaultAddress?.neighborhood || "");
    setFormCity(c.defaultAddress?.city || "");
    setFormState(c.defaultAddress?.state || "");
    setFormCep(c.defaultAddress?.postalCode || "");
    setModalError("");
    setIsModalOpen(true);
  };

  const handleOpenDetail = async (customerId: string) => {
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedCustomer(data.customer);
        setIsDetailModalOpen(true);
      } else {
        alert(data.error || "Erro ao carregar detalhes do cliente.");
      }
    } catch {
      alert("Erro ao buscar detalhes.");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    setIsSaving(true);

    try {
      const payload: any = {
        name: formName,
        email: formEmail,
        cpf: formCpf,
        phone: formPhone,
        notes: formNotes || null,
      };

      if (!editingCustomer && formStreet && formCity && formCep) {
        payload.address = {
          street: formStreet,
          number: formNumber || "S/N",
          complement: formComplement || null,
          neighborhood: formNeighborhood,
          city: formCity,
          state: formState.toUpperCase(),
          postalCode: formCep,
          isDefault: true,
        };
      }

      const url = editingCustomer
        ? `/api/admin/customers/${editingCustomer.id}`
        : "/api/admin/customers";

      const method = editingCustomer ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setModalError(data.error || "Erro ao salvar cliente.");
        setIsSaving(false);
        return;
      }

      setIsModalOpen(false);
      setSuccessMessage(
        editingCustomer ? "Cliente atualizado com sucesso!" : "Cliente cadastrado com sucesso!"
      );
      setTimeout(() => setSuccessMessage(""), 4000);
      loadCustomers();
    } catch {
      setModalError("Erro de comunicação com o servidor.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (c: CustomerItem) => {
    if (c.ordersCount > 0) {
      alert(`Este cliente possui ${c.ordersCount} pedido(s) registrado(s) e não pode ser excluído para manter a integridade fiscal/comercial.`);
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir o cliente "${c.name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/customers/${c.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Erro ao excluir cliente.");
        return;
      }

      setSuccessMessage("Cliente excluído com sucesso.");
      setTimeout(() => setSuccessMessage(""), 4000);
      loadCustomers();
    } catch {
      alert("Erro ao excluir cliente.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-emerald-400" />
            Gestão de Clientes
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Histórico de compradores, endereços de entrega e valor vitalício (LTV)
          </p>
        </div>

        <Button onClick={handleOpenCreate} variant="primary" className="shadow-lg shadow-emerald-600/20">
          <Plus className="w-4 h-4 mr-1.5" /> Novo Cliente
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

      {/* Busca */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail, CPF ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-900 border border-slate-800 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Tabela de Clientes */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              <span>Carregando clientes...</span>
            </div>
          ) : customers.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Users className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-base font-semibold text-slate-300">Nenhum cliente encontrado</p>
              <p className="text-xs text-slate-500">Clique em "Novo Cliente" para cadastrar manualmente.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-850 border-slate-800 text-slate-400">
                <TableRow className="border-slate-800">
                  <TableHead>Cliente & CPF</TableHead>
                  <TableHead>Contatos</TableHead>
                  <TableHead>Localização (Principal)</TableHead>
                  <TableHead>Pedidos</TableHead>
                  <TableHead>Total Gasto (LTV)</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-slate-800 text-slate-300">
                {customers.map((c) => (
                  <TableRow key={c.id} className="hover:bg-slate-800/40 border-slate-800">
                    <TableCell>
                      <div className="font-semibold text-white text-sm">{c.name}</div>
                      <div className="text-xs font-mono text-slate-400">{formatCpf(c.cpf)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Mail className="w-3.5 h-3.5 text-slate-500" /> {c.email}
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Phone className="w-3.5 h-3.5 text-slate-500" /> {formatPhone(c.phone)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-300">
                      {c.defaultAddress ? (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>
                            {c.defaultAddress.city}/{c.defaultAddress.state} - {formatCep(c.defaultAddress.postalCode)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600">Sem endereço</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        <ShoppingBag className="w-3 h-3 text-emerald-400" />
                        {c.ordersCount} {c.ordersCount === 1 ? "pedido" : "pedidos"}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold text-emerald-400">
                      {formatCurrency(c.totalSpent)}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <button
                        onClick={() => handleOpenDetail(c.id)}
                        className="p-1.5 text-slate-400 hover:text-emerald-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                        title="Ver Perfil & Pedidos"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(c)}
                        className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                        title="Editar Cliente"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          c.ordersCount > 0
                            ? "text-slate-600 bg-slate-850 cursor-not-allowed opacity-50"
                            : "text-slate-400 hover:text-rose-400 bg-slate-800 hover:bg-rose-950/40"
                        }`}
                        title={
                          c.ordersCount > 0
                            ? "Não pode excluir cliente com histórico de pedidos"
                            : "Excluir Cliente"
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

      {/* Modal Criar / Editar Cliente */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCustomer ? "Editar Cliente" : "Novo Cliente"}
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
            label="Nome Completo *"
            required
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Ex: Lucas Ferreira Lima"
            className="bg-slate-950 border-slate-800 text-white"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="E-mail *"
              type="email"
              required
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="lucas@exemplo.com"
              className="bg-slate-950 border-slate-800 text-white"
            />
            <Input
              label="CPF (11 dígitos) *"
              required
              value={formCpf}
              onChange={(e) => setFormCpf(e.target.value)}
              placeholder="111.222.333-44"
              className="bg-slate-950 border-slate-800 text-white font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Telefone / WhatsApp *"
              required
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              placeholder="(11) 98765-4321"
              className="bg-slate-950 border-slate-800 text-white font-mono"
            />
            <Input
              label="Observações Internas"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Ex: Cliente VIP, contato preferencial"
              className="bg-slate-950 border-slate-800 text-white"
            />
          </div>

          {/* Endereço Inicial (apenas no cadastro) */}
          {!editingCustomer && (
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Endereço Principal de Entrega
              </h4>

              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="CEP *"
                  value={formCep}
                  onChange={(e) => setFormCep(e.target.value)}
                  placeholder="01310-100"
                  className="bg-slate-950 border-slate-800 text-white font-mono text-xs"
                />
                <div className="col-span-2">
                  <Input
                    label="Logradouro / Rua *"
                    value={formStreet}
                    onChange={(e) => setFormStreet(e.target.value)}
                    placeholder="Av. Paulista"
                    className="bg-slate-950 border-slate-800 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="Número *"
                  value={formNumber}
                  onChange={(e) => setFormNumber(e.target.value)}
                  placeholder="1578"
                  className="bg-slate-950 border-slate-800 text-white"
                />
                <div className="col-span-2">
                  <Input
                    label="Complemento"
                    value={formComplement}
                    onChange={(e) => setFormComplement(e.target.value)}
                    placeholder="Apto 102 / Bloco B"
                    className="bg-slate-950 border-slate-800 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="Bairro *"
                  value={formNeighborhood}
                  onChange={(e) => setFormNeighborhood(e.target.value)}
                  placeholder="Bela Vista"
                  className="bg-slate-950 border-slate-800 text-white"
                />
                <Input
                  label="Cidade *"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  placeholder="São Paulo"
                  className="bg-slate-950 border-slate-800 text-white"
                />
                <Input
                  label="UF *"
                  maxLength={2}
                  value={formState}
                  onChange={(e) => setFormState(e.target.value.toUpperCase())}
                  placeholder="SP"
                  className="bg-slate-950 border-slate-800 text-white uppercase text-center"
                />
              </div>
            </div>
          )}

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
              {editingCustomer ? "Salvar Alterações" : "Cadastrar Cliente"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de Detalhes & Histórico do Cliente */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={selectedCustomer ? `Cliente: ${selectedCustomer.name}` : "Detalhes do Cliente"}
        maxWidth="xl"
      >
        {selectedCustomer && (
          <div className="space-y-6">
            {/* Dados Cadastrais */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">CPF:</span>
                <span className="font-mono text-white font-medium">{formatCpf(selectedCustomer.cpf)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">E-mail:</span>
                <span className="text-white font-medium">{selectedCustomer.email}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Telefone:</span>
                <span className="font-mono text-white font-medium">{formatPhone(selectedCustomer.phone)}</span>
              </div>
            </div>

            {/* Endereços */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Endereços Cadastrados
              </h4>
              <div className="space-y-2">
                {selectedCustomer.addresses?.map((addr: any) => (
                  <div
                    key={addr.id}
                    className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-medium text-white">
                        {addr.street}, {addr.number} {addr.complement && `(${addr.complement})`}
                      </div>
                      <div className="text-slate-400">
                        {addr.neighborhood} - {addr.city}/{addr.state} | CEP: {formatCep(addr.postalCode)}
                      </div>
                    </div>
                    {addr.isDefault && <Badge variant="success">Padrão</Badge>}
                  </div>
                ))}
              </div>
            </div>

            {/* Histórico de Pedidos */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" /> Histórico de Pedidos ({selectedCustomer.orders?.length || 0})
              </h4>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {selectedCustomer.orders?.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">Nenhum pedido realizado ainda.</p>
                ) : (
                  selectedCustomer.orders?.map((ord: any) => (
                    <div
                      key={ord.id}
                      className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-emerald-400 block">{ord.orderNumber}</span>
                        <span className="text-slate-400">{formatDate(ord.createdAt)}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-white block">{formatCurrency(Number(ord.totalAmount))}</span>
                        <Badge variant="neutral">{ord.status}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
