"use client";

import React, { useState, useEffect } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import {
  FolderTree,
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  Package,
  CheckCircle2,
} from "lucide-react";

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  active: boolean;
  productsCount: number;
  createdAt: string;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  const loadCategories = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const url = search ? `/api/admin/categories?q=${encodeURIComponent(search)}` : "/api/admin/categories";
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setCategories(data.categories || []);
      } else {
        setErrorMessage(data.error || "Erro ao carregar categorias.");
      }
    } catch {
      setErrorMessage("Erro de conexão ao carregar categorias.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [search]);

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  };

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setFormName("");
    setFormSlug("");
    setFormDesc("");
    setFormActive(true);
    setModalError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (category: CategoryItem) => {
    setEditingCategory(category);
    setFormName(category.name);
    setFormSlug(category.slug);
    setFormDesc(category.description || "");
    setFormActive(category.active);
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
        slug: formSlug || generateSlug(formName),
        description: formDesc,
        active: formActive,
      };

      const url = editingCategory
        ? `/api/admin/categories/${editingCategory.id}`
        : "/api/admin/categories";

      const method = editingCategory ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setModalError(data.error || "Erro ao salvar categoria.");
        setIsSaving(false);
        return;
      }

      setIsModalOpen(false);
      setSuccessMessage(
        editingCategory ? "Categoria atualizada com sucesso!" : "Categoria cadastrada com sucesso!"
      );
      setTimeout(() => setSuccessMessage(""), 4000);
      loadCategories();
    } catch {
      setModalError("Erro de comunicação com o servidor.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (category: CategoryItem) => {
    if (category.productsCount > 0) {
      alert(`Esta categoria possui ${category.productsCount} produto(s) vinculado(s) e não pode ser excluída.`);
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir a categoria "${category.name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/categories/${category.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Erro ao excluir categoria.");
        return;
      }

      setSuccessMessage("Categoria excluída com sucesso.");
      setTimeout(() => setSuccessMessage(""), 4000);
      loadCategories();
    } catch {
      alert("Erro ao excluir categoria.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <FolderTree className="w-6 h-6 text-emerald-400" />
            Categorias de Produtos
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Organize o catálogo de produtos e estruture as seções da loja
          </p>
        </div>

        <Button onClick={handleOpenCreate} variant="primary" className="shadow-lg shadow-emerald-600/20">
          <Plus className="w-4 h-4 mr-1.5" /> Nova Categoria
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

      {/* Barra de Busca & Filtros */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome ou slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-900 border border-slate-800 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Tabela de Categorias */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              <span>Carregando categorias...</span>
            </div>
          ) : categories.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Package className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-base font-semibold text-slate-300">Nenhuma categoria encontrada</p>
              <p className="text-xs text-slate-500">Clique em "Nova Categoria" para cadastrar sua primeira categoria.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-850 border-slate-800 text-slate-400">
                <TableRow className="border-slate-800">
                  <TableHead>Nome & Slug</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Produtos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-slate-800 text-slate-300">
                {categories.map((cat) => (
                  <TableRow key={cat.id} className="hover:bg-slate-800/40 border-slate-800">
                    <TableCell>
                      <div className="font-semibold text-white text-sm">{cat.name}</div>
                      <div className="text-xs font-mono text-emerald-400">/{cat.slug}</div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-400 max-w-xs truncate">
                      {cat.description || "-"}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        <Package className="w-3 h-3 text-emerald-400" />
                        {cat.productsCount} {cat.productsCount === 1 ? "produto" : "produtos"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {cat.active ? (
                        <Badge variant="success">Ativa</Badge>
                      ) : (
                        <Badge variant="neutral">Inativa</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(cat)}
                        className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                        title="Editar Categoria"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(cat)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          cat.productsCount > 0
                            ? "text-slate-600 bg-slate-850 cursor-not-allowed opacity-50"
                            : "text-slate-400 hover:text-rose-400 bg-slate-800 hover:bg-rose-950/40"
                        }`}
                        title={
                          cat.productsCount > 0
                            ? "Não pode excluir categoria com produtos vinculados"
                            : "Excluir Categoria"
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

      {/* Modal Criar / Editar Categoria */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? "Editar Categoria" : "Nova Categoria"}
      >
        {modalError && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{modalError}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Nome da Categoria *"
            required
            value={formName}
            onChange={(e) => {
              setFormName(e.target.value);
              if (!editingCategory) setFormSlug(generateSlug(e.target.value));
            }}
            placeholder="Ex: Eletrônicos & Smart Gadgets"
            className="bg-slate-950 border-slate-800 text-white"
          />

          <Input
            label="Slug da Categoria (URL amigável) *"
            required
            value={formSlug}
            onChange={(e) => setFormSlug(e.target.value)}
            placeholder="ex: eletronicos-smart-gadgets"
            className="bg-slate-950 border-slate-800 text-white font-mono text-xs"
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-300">
              Descrição
            </label>
            <textarea
              rows={3}
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="Breve descrição da categoria para SEO e organização..."
              className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="categoryActive"
              checked={formActive}
              onChange={(e) => setFormActive(e.target.checked)}
              className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="categoryActive" className="text-sm font-medium text-slate-300">
              Categoria Ativa na Loja
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
              {editingCategory ? "Salvar Alterações" : "Criar Categoria"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
