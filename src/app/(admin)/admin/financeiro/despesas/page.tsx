"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  DollarSign,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Calendar,
  Tag,
  ArrowLeft,
  Receipt,
  FileText,
  AlertCircle,
  CheckCircle2,
  PieChart,
  BarChart3,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/formatters";

interface ExpenseItem {
  id: string;
  title: string;
  category: "MARKETING" | "TOOLS" | "DOMAIN" | "LOGISTICS" | "TAXES" | "REFUND" | "OTHER";
  amount: number;
  date: string;
  description: string | null;
  orderId: string | null;
  order?: { id: string; orderNumber: string } | null;
  createdAt: string;
}

const CATEGORIES = [
  { value: "ALL", label: "Todas as Categorias" },
  { value: "MARKETING", label: "Marketing / Anúncios (Ads)" },
  { value: "TOOLS", label: "Ferramentas & Softwares (SaaS)" },
  { value: "DOMAIN", label: "Domínio & Hospedagem" },
  { value: "LOGISTICS", label: "Logística & Embalagens" },
  { value: "TAXES", label: "Impostos & Taxas" },
  { value: "REFUND", label: "Reembolsos" },
  { value: "OTHER", label: "Outras Despesas Operacionais" },
];

function getCategoryBadge(category: string) {
  switch (category) {
    case "MARKETING":
      return <Badge variant="info">Marketing / Ads</Badge>;
    case "TOOLS":
      return <Badge variant="neutral">Ferramentas / SaaS</Badge>;
    case "DOMAIN":
      return <Badge variant="neutral">Domínio & Host</Badge>;
    case "LOGISTICS":
      return <Badge variant="warning">Logística</Badge>;
    case "TAXES":
      return <Badge variant="danger">Impostos / Taxas</Badge>;
    case "REFUND":
      return <Badge variant="danger">Reembolso</Badge>;
    default:
      return <Badge variant="neutral">Outros</Badge>;
  }
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [totalSum, setTotalSum] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    title: "",
    category: "MARKETING",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
  });

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedCategory !== "ALL") params.append("category", selectedCategory);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const res = await fetch(`/api/admin/expenses?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Erro ao carregar despesas.");
      }

      setExpenses(json.data || []);
      setTotalSum(json.summary?.totalAmount || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleOpenCreateModal = () => {
    setEditingExpense(null);
    setFormData({
      title: "",
      category: "MARKETING",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      description: "",
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (exp: ExpenseItem) => {
    setEditingExpense(exp);
    setFormData({
      title: exp.title,
      category: exp.category,
      amount: exp.amount.toString(),
      date: exp.date.split("T")[0],
      description: exp.description || "",
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setFormLoading(true);
      setFormError(null);

      const parsedAmount = parseFloat(formData.amount.replace(",", "."));
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Informe um valor numérico válido maior que zero.");
      }

      const payload = {
        title: formData.title,
        category: formData.category,
        amount: parsedAmount,
        date: formData.date ? `${formData.date}T12:00:00.000Z` : new Date().toISOString(),
        description: formData.description || null,
      };

      const url = editingExpense
        ? `/api/admin/expenses/${editingExpense.id}`
        : "/api/admin/expenses";
      const method = editingExpense ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Erro ao salvar despesa.");
      }

      setIsModalOpen(false);
      await fetchExpenses();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteExpense = async (id: string, title: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir a despesa "${title}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/expenses/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Erro ao excluir despesa.");
      }
      await fetchExpenses();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin/financeiro"
              className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Hub Financeiro
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Despesas Operacionais
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-normal">
              {expenses.length} registradas
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Controle de custos fixos, ferramentas, marketing e logística do negócio.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/financeiro/dre"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <BarChart3 className="w-4 h-4 text-emerald-400" /> Ver DRE Gerencial
          </Link>
          <Button
            onClick={handleOpenCreateModal}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Nova Despesa
          </Button>
        </div>
      </div>

      {/* Summary Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-slate-900 border-slate-800 p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium block">Total de Despesas Filtradas</span>
            <span className="text-2xl font-bold font-mono text-white mt-1 block">
              {formatCurrency(totalSum)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-rose-400" />
          </div>
        </Card>

        <Card className="bg-slate-900 border-slate-800 p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium block">Quantidade de Lançamentos</span>
            <span className="text-2xl font-bold font-mono text-white mt-1 block">
              {expenses.length}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-slate-400" />
          </div>
        </Card>

        <Card className="bg-slate-900 border-slate-800 p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium block">Categoria Selecionada</span>
            <span className="text-sm font-semibold text-emerald-400 mt-1 block truncate">
              {CATEGORIES.find((c) => c.value === selectedCategory)?.label}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Tag className="w-5 h-5 text-emerald-400" />
          </div>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card className="bg-slate-900 border-slate-800 p-4">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar por título ou descrição..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-950 border-slate-800 text-xs w-full text-white"
            />
          </div>

          <div className="w-full md:w-64">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full h-9 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 focus:outline-none focus:border-emerald-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="bg-slate-900 border-slate-800 overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm animate-pulse">
              Carregando despesas operacionais...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-rose-400 text-sm">{error}</div>
          ) : expenses.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Receipt className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-300">Nenhuma despesa encontrada.</p>
              <p className="text-xs text-slate-500 mt-1">
                Tente ajustar os filtros ou cadastre um novo lançamento operacional.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-850 border-slate-800 text-slate-400 text-xs">
                <TableRow className="border-slate-800">
                  <TableHead>Título / Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Vínculo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-slate-800 text-slate-300 text-xs">
                {expenses.map((exp) => (
                  <TableRow key={exp.id} className="border-slate-800 hover:bg-slate-800/40">
                    <TableCell>
                      <div className="font-semibold text-white">{exp.title}</div>
                      {exp.description && (
                        <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                          {exp.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{getCategoryBadge(exp.category)}</TableCell>
                    <TableCell className="font-mono text-slate-400">
                      {formatDate(exp.date)}
                    </TableCell>
                    <TableCell>
                      {exp.order ? (
                        <Link
                          href="/admin/pedidos"
                          className="text-[11px] font-mono text-emerald-400 hover:underline"
                        >
                          {exp.order.orderNumber}
                        </Link>
                      ) : (
                        <span className="text-[11px] text-slate-500">— Geral</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-rose-400">
                      - {formatCurrency(exp.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(exp)}
                          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title="Editar Despesa"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(exp.id, exp.title)}
                          className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                          title="Excluir Despesa"
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

      {/* Modal de Criação / Edição */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingExpense ? "Editar Despesa Operacional" : "Nova Despesa Operacional"}
      >
        <form onSubmit={handleSaveExpense} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Título da Despesa *
            </label>
            <Input
              required
              placeholder="Ex: Assinatura Servidor Hetzner"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="bg-slate-950 border-slate-800 text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Categoria *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                className="w-full h-9 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 focus:outline-none focus:border-emerald-500"
              >
                {CATEGORIES.filter((c) => c.value !== "ALL").map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Valor (R$) *
              </label>
              <Input
                required
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="bg-slate-950 border-slate-800 text-xs text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Data de Competência *
            </label>
            <Input
              required
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="bg-slate-950 border-slate-800 text-xs text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Descrição / Observações
            </label>
            <textarea
              rows={3}
              placeholder="Detalhes adicionais sobre o pagamento ou fornecedor..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 p-2.5 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={formLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
            >
              {formLoading ? "Salvando..." : editingExpense ? "Atualizar Despesa" : "Salvar Despesa"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
