"use client";

import React, { useState, useEffect } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Filter,
  Image as ImageIcon,
  DollarSign,
  TrendingUp,
  X,
  Star,
  ExternalLink,
  RefreshCw,
  UploadCloud,
  FileSpreadsheet,
  Layers,
  History,
  Store,
  Sliders,
  Check,
  AlertTriangle,
  Info,
} from "lucide-react";

interface ProductImageItem {
  id?: string;
  url: string;
  altText?: string | null;
  isCover: boolean;
}

interface SupplierProductItem {
  id: string;
  supplierId: string;
  supplierName: string;
  externalSku?: string | null;
  supplierCost: number;
  supplierStock: number;
  isAvailable: boolean;
  lastSyncedAt?: string | null;
  lastSyncError?: string | null;
  supplierUrl?: string | null;
}

interface MarketplaceListingItem {
  id: string;
  channel: string;
  externalListingId?: string | null;
  status: string;
  marketplacePrice?: number | null;
  marketplaceStock?: number | null;
  lastSyncedAt?: string | null;
  syncError?: string | null;
}

interface ProductAuditLogItem {
  id: string;
  field: string;
  oldValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string } | null;
}

interface ProductItem {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string;
  shortDescription?: string | null;
  category?: { id: string; name: string } | null;
  supplier?: { id: string; name: string } | null;
  brand?: string | null;
  tags: string[];
  minPrice?: number | null;
  maxPrice?: number | null;
  targetMargin?: number | null;
  targetMarkup?: number | null;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
  active: boolean;
  supplierUrl?: string | null;
  externalId?: string | null;
  images: ProductImageItem[];
  supplierProducts?: SupplierProductItem[];
  marketplaceListings?: MarketplaceListingItem[];
  auditLogs?: ProductAuditLogItem[];
  salesCount: number;
  stockMovementsCount?: number;
  profit: number;
  marginPercentage: number;
  markupPercentage: number;
  createdAt: string;
  updatedAt: string;
}

interface OptionItem {
  id: string;
  name: string;
}

interface CatalogStats {
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  draftProducts: number;
  archivedProducts: number;
  outOfStockCount: number;
  lowStockCount: number;
  noSupplierCount: number;
  noPriceCount: number;
  lowMarginCount: number;
  syncErrorsCount: number;
  neverSyncedCount: number;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<OptionItem[]>([]);
  const [suppliers, setSuppliers] = useState<OptionItem[]>([]);
  const [stats, setStats] = useState<CatalogStats | null>(null);

  // Filtros & Paginação
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedSupplier, setSelectedSupplier] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedStockStatus, setSelectedStockStatus] = useState("ALL");
  const [selectedSyncStatus, setSelectedSyncStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Modal de Criação / Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState<"basic" | "commercial" | "supplier" | "images">("basic");
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formSku, setFormSku] = useState("");
  const [formBrand, setFormBrand] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formSupplierId, setFormSupplierId] = useState("");
  const [formCostPrice, setFormCostPrice] = useState<number>(0);
  const [formSellingPrice, setFormSellingPrice] = useState<number>(0);
  const [formStock, setFormStock] = useState<number>(0);
  const [formStatus, setFormStatus] = useState<"DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED">("ACTIVE");
  const [formActive, setFormActive] = useState(true);
  const [formMinPrice, setFormMinPrice] = useState<string>("");
  const [formMaxPrice, setFormMaxPrice] = useState<string>("");
  const [formTargetMargin, setFormTargetMargin] = useState<string>("");
  const [formTargetMarkup, setFormTargetMarkup] = useState<string>("");
  const [formSupplierUrl, setFormSupplierUrl] = useState("");
  const [formExternalSku, setFormExternalSku] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formShortDesc, setFormShortDesc] = useState("");
  const [formImages, setFormImages] = useState<ProductImageItem[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Modal de Detalhe Operacional
  const [detailProduct, setDetailProduct] = useState<ProductItem | null>(null);
  const [detailTab, setDetailTab] = useState<"commercial" | "supplier" | "stock" | "marketplaces" | "audit">("commercial");
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Modal de Importação em Lote
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFormat, setImportFormat] = useState<"CSV" | "JSON">("CSV");
  const [importRawData, setImportRawData] = useState("");
  const [importPreview, setImportPreview] = useState<any | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isCommitLoading, setIsCommitLoading] = useState(false);

  // Modal de Pricing Assistant
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [calcCost, setCalcCost] = useState<number>(50);
  const [calcMargin, setCalcMargin] = useState<number>(35);
  const [calcMarkup, setCalcMarkup] = useState<number>(0);
  const [calcRounding, setCalcRounding] = useState<string>("PSYCHOLOGICAL_99");
  const [calcShipping, setCalcShipping] = useState<number>(15);
  const [calcGatewayFee, setCalcGatewayFee] = useState<number>(4.99);
  const [calcTax, setCalcTax] = useState<number>(6);
  const [calcAdSpend, setCalcAdSpend] = useState<number>(10);
  const [pricingSimulation, setPricingSimulation] = useState<any | null>(null);

  // Carregar dados iniciais
  useEffect(() => {
    loadCategories();
    loadSuppliers();
    loadStats();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [search, selectedCategory, selectedSupplier, selectedStatus, selectedStockStatus, selectedSyncStatus, page]);

  async function loadCategories() {
    try {
      const res = await fetch("/api/admin/categories");
      const json = await res.json();
      if (json.success && json.categories) {
        setCategories(json.categories);
      }
    } catch (err) {
      console.error("Erro ao buscar categorias:", err);
    }
  }

  async function loadSuppliers() {
    try {
      const res = await fetch("/api/admin/suppliers");
      const json = await res.json();
      if (json.success && json.suppliers) {
        setSuppliers(json.suppliers);
      }
    } catch (err) {
      console.error("Erro ao buscar fornecedores:", err);
    }
  }

  async function loadStats() {
    setIsStatsLoading(true);
    try {
      const res = await fetch("/api/admin/catalog/stats");
      const json = await res.json();
      if (json.success && json.stats) {
        setStats(json.stats);
      }
    } catch (err) {
      console.error("Erro ao carregar estatísticas do catálogo:", err);
    } finally {
      setIsStatsLoading(false);
    }
  }

  async function loadProducts() {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (selectedCategory && selectedCategory !== "ALL") params.set("categoryId", selectedCategory);
      if (selectedSupplier && selectedSupplier !== "ALL") params.set("supplierId", selectedSupplier);
      if (selectedStatus && selectedStatus !== "ALL") params.set("status", selectedStatus);
      if (selectedStockStatus && selectedStockStatus !== "ALL") params.set("stockStatus", selectedStockStatus);
      if (selectedSyncStatus && selectedSyncStatus !== "ALL") params.set("syncStatus", selectedSyncStatus);
      params.set("page", String(page));
      params.set("limit", "20");

      const res = await fetch(`/api/admin/products?${params.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setProducts(json.data);
        if (json.pagination) {
          setTotalPages(json.pagination.totalPages || 1);
        }
      } else {
        setErrorMessage(json.error || "Erro ao carregar produtos.");
      }
    } catch (err: any) {
      setErrorMessage("Erro de conexão ao carregar produtos.");
    } finally {
      setIsLoading(false);
    }
  }

  async function openDetailModal(productId: string) {
    setIsDetailLoading(true);
    setDetailTab("commercial");
    try {
      const res = await fetch(`/api/admin/products/${productId}`);
      const json = await res.json();
      if (json.success && json.product) {
        setDetailProduct(json.product);
      }
    } catch (err) {
      console.error("Erro ao carregar detalhe do produto:", err);
    } finally {
      setIsDetailLoading(false);
    }
  }

  function handleOpenCreateModal() {
    setEditingProduct(null);
    setFormName("");
    setFormSlug("");
    setFormSku(`SKU-${Date.now().toString().slice(-6)}`);
    setFormBrand("");
    setFormTags("");
    setFormCategoryId("");
    setFormSupplierId("");
    setFormCostPrice(0);
    setFormSellingPrice(0);
    setFormStock(0);
    setFormStatus("ACTIVE");
    setFormActive(true);
    setFormMinPrice("");
    setFormMaxPrice("");
    setFormTargetMargin("30");
    setFormTargetMarkup("");
    setFormSupplierUrl("");
    setFormExternalSku("");
    setFormDesc("");
    setFormShortDesc("");
    setFormImages([]);
    setActiveFormTab("basic");
    setIsModalOpen(true);
  }

  function handleOpenEditModal(p: ProductItem) {
    setEditingProduct(p);
    setFormName(p.name);
    setFormSlug(p.slug);
    setFormSku(p.sku);
    setFormBrand(p.brand || "");
    setFormTags(p.tags ? p.tags.join(", ") : "");
    setFormCategoryId(p.category?.id || "");
    setFormSupplierId(p.supplier?.id || "");
    setFormCostPrice(p.costPrice);
    setFormSellingPrice(p.sellingPrice);
    setFormStock(p.stock);
    setFormStatus(p.status);
    setFormActive(p.active);
    setFormMinPrice(p.minPrice ? String(p.minPrice) : "");
    setFormMaxPrice(p.maxPrice ? String(p.maxPrice) : "");
    setFormTargetMargin(p.targetMargin ? String(p.targetMargin) : "");
    setFormTargetMarkup(p.targetMarkup ? String(p.targetMarkup) : "");
    setFormSupplierUrl(p.supplierUrl || "");
    setFormExternalSku(p.externalId || "");
    setFormDesc(p.description);
    setFormShortDesc(p.shortDescription || "");
    setFormImages(p.images || []);
    setActiveFormTab("basic");
    setIsModalOpen(true);
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const tagsArray = formTags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const payload: any = {
        name: formName,
        slug: formSlug || formName.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-"),
        sku: formSku,
        brand: formBrand || null,
        tags: tagsArray,
        description: formDesc,
        shortDescription: formShortDesc || null,
        categoryId: formCategoryId || null,
        supplierId: formSupplierId || null,
        costPrice: Number(formCostPrice),
        sellingPrice: Number(formSellingPrice),
        stock: Number(formStock),
        status: formStatus,
        active: formActive,
        minPrice: formMinPrice ? Number(formMinPrice) : null,
        maxPrice: formMaxPrice ? Number(formMaxPrice) : null,
        targetMargin: formTargetMargin ? Number(formTargetMargin) : null,
        targetMarkup: formTargetMarkup ? Number(formTargetMarkup) : null,
        supplierUrl: formSupplierUrl || null,
        externalId: formExternalSku || null,
        images: formImages.map((img, idx) => ({
          url: img.url,
          altText: img.altText || formName,
          isCover: img.isCover ?? idx === 0,
        })),
      };

      const url = editingProduct ? `/api/admin/products/${editingProduct.id}` : "/api/admin/products";
      const method = editingProduct ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Erro ao salvar produto.");
      }

      setSuccessMessage(editingProduct ? "Produto atualizado com sucesso!" : "Produto cadastrado com sucesso!");
      setIsModalOpen(false);
      loadProducts();
      loadStats();
    } catch (err: any) {
      setErrorMessage(err.message || "Falha ao salvar produto.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteProduct(p: ProductItem) {
    if (!confirm(`Tem certeza que deseja excluir o produto "${p.name}" (SKU: ${p.sku})?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/products/${p.id}`, { method: "DELETE" });
      const json = await res.json();

      if (!res.ok || !json.success) {
        alert(json.error || "Erro ao excluir produto.");
        return;
      }

      setSuccessMessage("Produto excluído com sucesso!");
      loadProducts();
      loadStats();
    } catch (err: any) {
      alert("Erro ao excluir produto.");
    }
  }

  async function handleSyncSingleProduct(productId: string) {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/admin/catalog/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, updateCommercialStock: true }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMessage("Sincronização com fornecedor concluída com sucesso!");
        loadProducts();
        loadStats();
        if (detailProduct?.id === productId) {
          openDetailModal(productId);
        }
      } else {
        alert(json.error || "Falha ao sincronizar com fornecedor.");
      }
    } catch (err) {
      alert("Erro de comunicação ao sincronizar.");
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleGenerateImportPreview() {
    setIsPreviewLoading(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/admin/catalog/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: importFormat,
          rawData: importRawData,
          defaultStatus: "ACTIVE",
        }),
      });

      const json = await res.json();
      if (json.success && json.preview) {
        setImportPreview(json.preview);
      } else {
        setErrorMessage(json.error || "Erro ao gerar pré-visualização.");
      }
    } catch (err: any) {
      setErrorMessage("Erro ao processar importação.");
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function handleCommitImport() {
    if (!importPreview || !importPreview.summary.sampleValid) return;
    setIsCommitLoading(true);
    try {
      const validItems = importPreview.rows.filter((r: any) => r.isValid).map((r: any) => r.data);
      const res = await fetch("/api/admin/catalog/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importBatchId: importPreview.importBatchId,
          items: validItems,
          updateExisting: true,
          syncStockLedger: true,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSuccessMessage(
          `Importação concluída! Criados: ${json.result.createdCount}, Atualizados: ${json.result.updatedCount}`
        );
        setIsImportModalOpen(false);
        setImportPreview(null);
        setImportRawData("");
        loadProducts();
        loadStats();
      } else {
        alert(json.error || "Falha ao gravar importação.");
      }
    } catch (err) {
      alert("Erro ao gravar importação.");
    } finally {
      setIsCommitLoading(false);
    }
  }

  async function runPricingSimulation() {
    try {
      const res = await fetch("/api/admin/catalog/pricing/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          costPrice: Number(calcCost),
          targetMargin: calcMargin > 0 ? Number(calcMargin) : undefined,
          targetMarkup: calcMarkup > 0 ? Number(calcMarkup) : undefined,
          shippingCost: Number(calcShipping),
          gatewayFeePercentage: Number(calcGatewayFee),
          taxPercentage: Number(calcTax),
          adSpend: Number(calcAdSpend),
          roundingRule: calcRounding,
        }),
      });
      const json = await res.json();
      if (json.success && json.simulation) {
        setPricingSimulation(json.simulation);
      }
    } catch (err) {
      console.error("Erro na simulação de preço:", err);
    }
  }

  function handleAddImageUrl() {
    if (!newImageUrl.trim()) return;
    setFormImages([
      ...formImages,
      {
        url: newImageUrl.trim(),
        altText: formName,
        isCover: formImages.length === 0,
      },
    ]);
    setNewImageUrl("");
  }

  function handleRemoveImage(index: number) {
    const updated = formImages.filter((_, i) => i !== index);
    if (updated.length > 0 && !updated.some((img) => img.isCover)) {
      updated[0].isCover = true;
    }
    setFormImages(updated);
  }

  function handleSetCoverImage(index: number) {
    const updated = formImages.map((img, i) => ({
      ...img,
      isCover: i === index,
    }));
    setFormImages(updated);
  }

  return (
    <div className="space-y-6">
      {/* Header Principal */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Package className="h-7 w-7 text-indigo-400" />
            Catálogo & Gestão de Dropshipping
          </h1>
          <p className="text-sm text-slate-400">
            Administração avançada de produtos, SKUs, relacionamento com fornecedores, estoque e canais.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setIsPricingModalOpen(true);
              runPricingSimulation();
            }}
            className="flex items-center gap-2 border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800"
          >
            <DollarSign className="h-4 w-4 text-emerald-400" />
            Pricing Assistant
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              setIsImportModalOpen(true);
              setImportPreview(null);
            }}
            className="flex items-center gap-2 border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800"
          >
            <FileSpreadsheet className="h-4 w-4 text-indigo-400" />
            Importar Catálogo (CSV/JSON)
          </Button>

          <Button onClick={handleOpenCreateModal} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500">
            <Plus className="h-4 w-4" />
            Novo Produto
          </Button>
        </div>
      </div>

      {/* Alertas */}
      {successMessage && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage("")} className="text-emerald-400 hover:text-emerald-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage("")} className="text-red-400 hover:text-red-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Cards de Métricas Operacionais do Catálogo */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-medium text-slate-400">Total Produtos</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-white">{stats?.totalProducts ?? "-"}</div>
            <div className="text-[11px] text-emerald-400 font-medium">
              {stats ? `${stats.activeProducts} ativos na loja` : "..."}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-medium text-slate-400">Status Comercial</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-indigo-400">{stats?.draftProducts ?? 0} Rascunhos</div>
            <div className="text-[11px] text-slate-400">
              {stats ? `${stats.inactiveProducts} pausados | ${stats.archivedProducts} arq.` : "..."}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-medium text-slate-400">Estoque Crítico</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-amber-400">{stats?.outOfStockCount ?? 0} Esgotados</div>
            <div className="text-[11px] text-amber-500/80">
              {stats ? `${stats.lowStockCount} com estoque baixo (<= 5)` : "..."}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-medium text-slate-400">Fornecedores</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-sky-400">
              {stats ? stats.totalProducts - stats.noSupplierCount : "-"} Vinculados
            </div>
            <div className="text-[11px] text-slate-400">
              {stats ? `${stats.noSupplierCount} sem fornecedor` : "..."}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-medium text-slate-400">Sync Fornecedor</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className={`text-xl font-bold ${stats?.syncErrorsCount ? "text-red-400" : "text-emerald-400"}`}>
              {stats?.syncErrorsCount ? `${stats.syncErrorsCount} Erros` : "100% OK"}
            </div>
            <div className="text-[11px] text-slate-400">
              {stats ? `${stats.neverSyncedCount} pendentes de sync` : "..."}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-medium text-slate-400">Alerta de Margem</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-rose-400">{stats?.lowMarginCount ?? 0} Produtos</div>
            <div className="text-[11px] text-rose-400/80">Margem menor que 15%</div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros Avançados */}
      <Card className="border-slate-800 bg-slate-900/40 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {/* Busca Textual */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por Nome, SKU, Slug, Marca..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950/60 pl-9 text-slate-200 border-slate-800"
            />
          </div>

          {/* Categoria */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              aria-label="Filtrar por categoria"
              className="w-full rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="ALL">Todas as Categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Fornecedor */}
          <div>
            <select
              value={selectedSupplier}
              onChange={(e) => {
                setSelectedSupplier(e.target.value);
                setPage(1);
              }}
              aria-label="Filtrar por fornecedor"
              className="w-full rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="ALL">Todos os Fornecedores</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Comercial */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              aria-label="Filtrar por status comercial"
              className="w-full rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="ALL">Todos os Status</option>
              <option value="ACTIVE">Ativo (Venda Pública)</option>
              <option value="INACTIVE">Inativo (Pausado)</option>
              <option value="DRAFT">Rascunho (Em Edição)</option>
              <option value="ARCHIVED">Arquivado (Histórico)</option>
            </select>
          </div>

          {/* Filtro de Estoque / Sync */}
          <div>
            <select
              value={selectedStockStatus}
              onChange={(e) => {
                setSelectedStockStatus(e.target.value);
                setPage(1);
              }}
              aria-label="Filtrar por status de estoque"
              className="w-full rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="ALL">Todos os Estoques</option>
              <option value="IN_STOCK">Em Estoque (&gt; 0)</option>
              <option value="LOW_STOCK">Estoque Baixo (&lt;= 5)</option>
              <option value="OUT_OF_STOCK">Esgotado (0)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Tabela de Produtos */}
      <Card className="border-slate-800 bg-slate-900/60">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="w-[60px] text-slate-400">Foto</TableHead>
              <TableHead className="text-slate-400">SKU / Produto</TableHead>
              <TableHead className="text-slate-400">Categoria & Fornecedor</TableHead>
              <TableHead className="text-right text-slate-400">Custo DropHub</TableHead>
              <TableHead className="text-right text-slate-400">Preço Venda</TableHead>
              <TableHead className="text-right text-slate-400">Margem</TableHead>
              <TableHead className="text-center text-slate-400">Estoque</TableHead>
              <TableHead className="text-center text-slate-400">Status</TableHead>
              <TableHead className="text-center text-slate-400">Canais</TableHead>
              <TableHead className="text-right text-slate-400">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="h-32 text-center text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                    Carregando catálogo...
                  </div>
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-32 text-center text-slate-400">
                  Nenhum produto encontrado com os filtros selecionados.
                </TableCell>
              </TableRow>
            ) : (
              products.map((p) => {
                const coverImage = p.images?.find((img) => img.isCover)?.url || p.images?.[0]?.url;
                const primarySupplier = p.supplierProducts?.[0] || (p.supplier ? { supplierName: p.supplier.name } : null);

                return (
                  <TableRow key={p.id} className="border-slate-800/60 hover:bg-slate-800/40">
                    {/* Thumbnail */}
                    <TableCell>
                      <div className="h-10 w-10 overflow-hidden rounded bg-slate-800 flex items-center justify-center border border-slate-700">
                        {coverImage ? (
                          <img src={coverImage} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-slate-500" />
                        )}
                      </div>
                    </TableCell>

                    {/* SKU & Nome */}
                    <TableCell>
                      <div className="font-mono text-xs text-indigo-400 font-semibold">{p.sku}</div>
                      <div className="font-medium text-slate-200 line-clamp-1">{p.name}</div>
                      {p.brand && <div className="text-[10px] text-slate-400">Marca: {p.brand}</div>}
                    </TableCell>

                    {/* Categoria & Fornecedor */}
                    <TableCell>
                      <div className="text-xs text-slate-300">{p.category?.name || "Sem categoria"}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        {primarySupplier ? (
                          <span className="text-sky-400 font-medium">{primarySupplier.supplierName}</span>
                        ) : (
                          <span className="text-slate-500 italic">Sem fornecedor</span>
                        )}
                      </div>
                    </TableCell>

                    {/* Custo */}
                    <TableCell className="text-right font-mono text-xs text-slate-300">
                      {formatCurrency(p.costPrice)}
                    </TableCell>

                    {/* Preço de Venda */}
                    <TableCell className="text-right font-mono text-xs font-semibold text-emerald-400">
                      {formatCurrency(p.sellingPrice)}
                    </TableCell>

                    {/* Margem */}
                    <TableCell className="text-right">
                      <span
                        className={`text-xs font-mono font-medium ${
                          p.marginPercentage < 15
                            ? "text-rose-400"
                            : p.marginPercentage < 30
                            ? "text-amber-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {formatPercent(p.marginPercentage)}
                      </span>
                      <div className="text-[10px] text-slate-400 font-mono">+{formatCurrency(p.profit)}</div>
                    </TableCell>

                    {/* Estoque */}
                    <TableCell className="text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ${
                          p.stock === 0
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : p.stock <= 5
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        }`}
                      >
                        {p.stock} un
                      </span>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          p.status === "ACTIVE"
                            ? "success"
                            : p.status === "INACTIVE"
                            ? "warning"
                            : p.status === "DRAFT"
                            ? "info"
                            : "danger"
                        }
                      >
                        {p.status === "ACTIVE"
                          ? "Ativo"
                          : p.status === "INACTIVE"
                          ? "Inativo"
                          : p.status === "DRAFT"
                          ? "Rascunho"
                          : "Arquivado"}
                      </Badge>
                    </TableCell>

                    {/* Marketplaces */}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {p.marketplaceListings && p.marketplaceListings.length > 0 ? (
                          p.marketplaceListings.map((ml) => (
                            <span
                              key={ml.id}
                              title={`${ml.channel}: ${ml.status}`}
                              className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                ml.status === "ACTIVE"
                                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                                  : "bg-slate-800 text-slate-400 border border-slate-700"
                              }`}
                            >
                              {ml.channel.slice(0, 3)}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-500">-</span>
                        )}
                      </div>
                    </TableCell>

                    {/* Ações */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Detalhe Operacional & Dropshipping"
                          onClick={() => openDetailModal(p.id)}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-400 hover:bg-slate-800"
                        >
                          <Layers className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          title="Sincronizar com Fornecedor"
                          onClick={() => handleSyncSingleProduct(p.id)}
                          disabled={isSyncing}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-sky-400 hover:bg-slate-800"
                        >
                          <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          title="Editar Produto"
                          onClick={() => handleOpenEditModal(p)}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          title="Excluir Produto"
                          onClick={() => handleDeleteProduct(p)}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-800 p-4">
            <span className="text-xs text-slate-400">
              Página {page} de {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="border-slate-800 bg-slate-950 text-slate-300"
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="border-slate-800 bg-slate-950 text-slate-300"
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ======================================================== */}
      {/* MODAL: DETALHE OPERACIONAL & DROPSHIPPING DO PRODUTO     */}
      {/* ======================================================== */}
      {detailProduct && (
        <Modal
          isOpen={!!detailProduct}
          onClose={() => setDetailProduct(null)}
          title={`Detalhe Operacional: ${detailProduct.name}`}
          className="max-w-4xl"
        >
          <div className="space-y-6">
            {/* Abas do Detalhe */}
            <div className="flex border-b border-slate-800">
              <button
                onClick={() => setDetailTab("commercial")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  detailTab === "commercial"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-300"
                }`}
              >
                1. Comercial & Preços
              </button>
              <button
                onClick={() => setDetailTab("supplier")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  detailTab === "supplier"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-300"
                }`}
              >
                2. Fornecedores ({detailProduct.supplierProducts?.length || 0})
              </button>
              <button
                onClick={() => setDetailTab("stock")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  detailTab === "stock"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-300"
                }`}
              >
                3. Estoque & Operação
              </button>
              <button
                onClick={() => setDetailTab("marketplaces")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  detailTab === "marketplaces"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-300"
                }`}
              >
                4. Marketplaces ({detailProduct.marketplaceListings?.length || 0})
              </button>
              <button
                onClick={() => setDetailTab("audit")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  detailTab === "audit"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-300"
                }`}
              >
                5. Histórico de Alterações ({detailProduct.auditLogs?.length || 0})
              </button>
            </div>

            {/* CONTEÚDO DA ABA 1: COMERCIAL */}
            {detailTab === "commercial" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-slate-800 bg-slate-950 p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Identificação</h4>
                  <div className="text-sm">
                    <span className="text-slate-500">Nome:</span> <strong className="text-white">{detailProduct.name}</strong>
                  </div>
                  <div className="text-sm">
                    <span className="text-slate-500">SKU:</span> <strong className="text-indigo-400 font-mono">{detailProduct.sku}</strong>
                  </div>
                  <div className="text-sm">
                    <span className="text-slate-500">Slug:</span> <span className="text-slate-300 font-mono">{detailProduct.slug}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-slate-500">Categoria:</span> <span className="text-slate-300">{detailProduct.category?.name || "-"}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-slate-500">Status Comercial:</span>{" "}
                    <Badge variant={detailProduct.status === "ACTIVE" ? "success" : "neutral"}>{detailProduct.status}</Badge>
                  </div>
                </Card>

                <Card className="border-slate-800 bg-slate-950 p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Métricas Financeiras</h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Custo Contábil DropHub:</span>
                    <strong className="text-slate-300 font-mono">{formatCurrency(detailProduct.costPrice)}</strong>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Preço de Venda Atual:</span>
                    <strong className="text-emerald-400 font-mono">{formatCurrency(detailProduct.sellingPrice)}</strong>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Lucro Bruto Unitário:</span>
                    <strong className="text-emerald-400 font-mono">+{formatCurrency(detailProduct.profit)}</strong>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Margem Comercial:</span>
                    <strong className="text-indigo-400 font-mono">{formatPercent(detailProduct.marginPercentage)}</strong>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Markup sobre Custo:</span>
                    <strong className="text-indigo-400 font-mono">{formatPercent(detailProduct.markupPercentage)}</strong>
                  </div>
                </Card>
              </div>
            )}

            {/* CONTEÚDO DA ABA 2: FORNECEDORES */}
            {detailTab === "supplier" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">
                    Relacionamentos ativos entre este produto e os catálogos externos dos fornecedores parceiros.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => handleSyncSingleProduct(detailProduct.id)}
                    disabled={isSyncing}
                    className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                    Sincronizar Fornecedor Agora
                  </Button>
                </div>

                {detailProduct.supplierProducts && detailProduct.supplierProducts.length > 0 ? (
                  <div className="space-y-3">
                    {detailProduct.supplierProducts.map((sp) => (
                      <Card key={sp.id} className="border-slate-800 bg-slate-950 p-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-xs text-slate-500 block">Fornecedor</span>
                            <strong className="text-sky-400">{sp.supplierName}</strong>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500 block">SKU Externo</span>
                            <span className="font-mono text-slate-300">{sp.externalSku || "-"}</span>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500 block">Custo Fornecedor</span>
                            <span className="font-mono text-emerald-400 font-semibold">{formatCurrency(sp.supplierCost)}</span>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500 block">Estoque Externo</span>
                            <span className="font-mono text-slate-200">{sp.supplierStock} unidades</span>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-slate-900 flex flex-wrap items-center justify-between text-xs text-slate-400">
                          <div>
                            Última Sincronização:{" "}
                            {sp.lastSyncedAt ? new Date(sp.lastSyncedAt).toLocaleString("pt-BR") : "Nunca"}
                          </div>
                          {sp.lastSyncError && (
                            <div className="text-rose-400 flex items-center gap-1 font-medium">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {sp.lastSyncError}
                            </div>
                          )}
                          {sp.supplierUrl && (
                            <a
                              href={sp.supplierUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-400 hover:underline flex items-center gap-1"
                            >
                              Ver no Fornecedor <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center border border-dashed border-slate-800 rounded-lg text-slate-500 text-sm">
                    Nenhum fornecedor vinculado a este produto no momento.
                  </div>
                )}
              </div>
            )}

            {/* CONTEÚDO DA ABA 3: ESTOQUE */}
            {detailTab === "stock" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-slate-800 bg-slate-950 p-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase">Saldo Físico / Virtual</h4>
                  <div className="text-2xl font-bold text-white mt-2 font-mono">{detailProduct.stock} un</div>
                  <p className="text-xs text-slate-500 mt-1">Disponível para venda no storefront</p>
                </Card>

                <Card className="border-slate-800 bg-slate-950 p-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase">Vendas Registradas</h4>
                  <div className="text-2xl font-bold text-emerald-400 mt-2 font-mono">{detailProduct.salesCount} vendas</div>
                  <p className="text-xs text-slate-500 mt-1">Itens convertidos em pedidos</p>
                </Card>

                <Card className="border-slate-800 bg-slate-950 p-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase">Ledger de Movimentações</h4>
                  <div className="text-sm text-slate-300 mt-2">
                    {detailProduct.stockMovementsCount || 0} lançamentos registrados
                  </div>
                  <a
                    href="/admin/estoque"
                    className="text-xs text-indigo-400 hover:underline mt-2 inline-block font-medium"
                  >
                    Ver extrato completo no Kardex &rarr;
                  </a>
                </Card>
              </div>
            )}

            {/* CONTEÚDO DA ABA 4: MARKETPLACES */}
            {detailTab === "marketplaces" && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">
                  Status de publicação deste produto nos canais externos integrados.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {["SHOPEE", "MERCADO_LIVRE", "AMAZON", "TEST"].map((channel) => {
                    const listing = detailProduct.marketplaceListings?.find((ml) => ml.channel === channel);

                    return (
                      <Card key={channel} className="border-slate-800 bg-slate-950 p-4 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <strong className="text-sm text-white">{channel}</strong>
                            <Badge variant={listing?.status === "ACTIVE" ? "success" : "neutral"}>
                              {listing?.status || "NÃO PUBLICADO"}
                            </Badge>
                          </div>
                          <div className="text-xs text-slate-400 space-y-1">
                            <div>Preço no Canal: {listing?.marketplacePrice ? formatCurrency(listing.marketplacePrice) : "Padrão"}</div>
                            <div>Estoque no Canal: {listing?.marketplaceStock ?? detailProduct.stock} un</div>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-slate-900 flex justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                const res = await fetch("/api/admin/catalog/marketplaces", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    action: "PUBLISH",
                                    productId: detailProduct.id,
                                    channels: [channel],
                                  }),
                                });
                                const json = await res.json();
                                if (json.success) {
                                  alert(`Publicação no canal ${channel} processada com sucesso!`);
                                  openDetailModal(detailProduct.id);
                                } else {
                                  alert(json.error || "Erro ao publicar no canal.");
                                }
                              } catch (e) {
                                alert("Erro ao comunicar com API de marketplace.");
                              }
                            }}
                            className="border-slate-800 text-xs text-indigo-400 hover:bg-slate-900"
                          >
                            Publicar no {channel}
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CONTEÚDO DA ABA 5: HISTÓRICO DE AUDITORIA */}
            {detailTab === "audit" && (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  Trilha de auditoria imutável de alterações de preço, custo, fornecedor e status.
                </p>

                {detailProduct.auditLogs && detailProduct.auditLogs.length > 0 ? (
                  <div className="space-y-2">
                    {detailProduct.auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded border border-slate-800 bg-slate-950 p-3 text-xs flex items-center justify-between"
                      >
                        <div>
                          <span className="font-semibold text-indigo-400">{log.field}</span>:{" "}
                          <span className="line-through text-slate-500">{log.oldValue || "(vazio)"}</span> &rarr;{" "}
                          <strong className="text-emerald-400">{log.newValue}</strong>
                          {log.reason && <div className="text-[11px] text-slate-400 mt-0.5">Motivo: {log.reason}</div>}
                        </div>
                        <div className="text-right text-slate-500 text-[11px]">
                          <div>{new Date(log.createdAt).toLocaleString("pt-BR")}</div>
                          <div>{log.user?.name || "Sistema / Admin"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center border border-dashed border-slate-800 rounded-lg text-slate-500 text-sm">
                    Nenhum registro de alteração para este produto.
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL: NOVO PRODUTO / EDIÇÃO COMPLETA                     */}
      {/* ======================================================== */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingProduct ? `Editar Produto: ${editingProduct.sku}` : "Novo Produto no Catálogo"}
          className="max-w-3xl"
        >
          <form onSubmit={handleSaveProduct} className="space-y-4">
            {/* Abas do Formulário */}
            <div className="flex border-b border-slate-800">
              <button
                type="button"
                onClick={() => setActiveFormTab("basic")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeFormTab === "basic"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-300"
                }`}
              >
                1. Informações Básicas
              </button>
              <button
                type="button"
                onClick={() => setActiveFormTab("commercial")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeFormTab === "commercial"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-300"
                }`}
              >
                2. Precificação & Margem
              </button>
              <button
                type="button"
                onClick={() => setActiveFormTab("supplier")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeFormTab === "supplier"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-300"
                }`}
              >
                3. Fornecedor & Dropshipping
              </button>
              <button
                type="button"
                onClick={() => setActiveFormTab("images")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeFormTab === "images"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-300"
                }`}
              >
                4. Fotos ({formImages.length})
              </button>
            </div>

            {/* ABA 1: BÁSICO */}
            {activeFormTab === "basic" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Nome do Produto *</label>
                    <Input
                      required
                      value={formName}
                      onChange={(e) => {
                        setFormName(e.target.value);
                        if (!editingProduct) {
                          setFormSlug(
                            e.target.value
                              .toLowerCase()
                              .replace(/[^\w\s-]/g, "")
                              .replace(/[\s_-]+/g, "-")
                          );
                        }
                      }}
                      placeholder="Ex: Fone Bluetooth Pro Max"
                      className="bg-slate-950 border-slate-800 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">SKU Comercial *</label>
                    <Input
                      required
                      value={formSku}
                      onChange={(e) => setFormSku(e.target.value.toUpperCase())}
                      placeholder="Ex: FONE-PRO-001"
                      className="bg-slate-950 border-slate-800 text-indigo-400 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Categoria</label>
                    <select
                      value={formCategoryId}
                      onChange={(e) => setFormCategoryId(e.target.value)}
                      className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                    >
                      <option value="">Selecione uma categoria</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Marca</label>
                    <Input
                      value={formBrand}
                      onChange={(e) => setFormBrand(e.target.value)}
                      placeholder="Ex: DropHub Sound"
                      className="bg-slate-950 border-slate-800 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Status Comercial *</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as any)}
                      className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                    >
                      <option value="ACTIVE">Ativo (Visível e Vendável)</option>
                      <option value="INACTIVE">Inativo (Pausado)</option>
                      <option value="DRAFT">Rascunho (Não publicado)</option>
                      <option value="ARCHIVED">Arquivado (Descontinuado)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Tags (separadas por vírgula)</label>
                  <Input
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="Ex: bluetooth, fone, sem fio, lancamento"
                    className="bg-slate-950 border-slate-800 text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Descrição Completa *</label>
                  <textarea
                    required
                    rows={4}
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Detalhes completos do produto..."
                    className="w-full rounded-md border border-slate-800 bg-slate-950 p-3 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* ABA 2: PRECIFICAÇÃO */}
            {activeFormTab === "commercial" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Custo do Produto (R$) *</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formCostPrice}
                      onChange={(e) => setFormCostPrice(parseFloat(e.target.value) || 0)}
                      className="bg-slate-950 border-slate-800 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Preço de Venda (R$) *</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formSellingPrice}
                      onChange={(e) => setFormSellingPrice(parseFloat(e.target.value) || 0)}
                      className="bg-slate-950 border-slate-800 text-emerald-400 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Estoque Vendável (un) *</label>
                    <Input
                      type="number"
                      min="0"
                      required
                      value={formStock}
                      onChange={(e) => setFormStock(parseInt(e.target.value, 10) || 0)}
                      className="bg-slate-950 border-slate-800 text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Preço Mínimo (Piso Comercial R$)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formMinPrice}
                      onChange={(e) => setFormMinPrice(e.target.value)}
                      placeholder="Ex: 89.90"
                      className="bg-slate-950 border-slate-800 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Margem Alvo (%)</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formTargetMargin}
                      onChange={(e) => {
                        const m = parseFloat(e.target.value) || 0;
                        setFormTargetMargin(e.target.value);
                        if (formCostPrice > 0 && m > 0 && m < 100) {
                          const suggested = formCostPrice / (1 - m / 100);
                          setFormSellingPrice(Number(suggested.toFixed(2)));
                        }
                      }}
                      placeholder="Ex: 35"
                      className="bg-slate-950 border-slate-800 text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ABA 3: FORNECEDOR */}
            {activeFormTab === "supplier" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Fornecedor Principal</label>
                    <select
                      value={formSupplierId}
                      onChange={(e) => setFormSupplierId(e.target.value)}
                      className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                    >
                      <option value="">Nenhum fornecedor</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">SKU / ID no Fornecedor</label>
                    <Input
                      value={formExternalSku}
                      onChange={(e) => setFormExternalSku(e.target.value)}
                      placeholder="Ex: SUP-ALI-9988"
                      className="bg-slate-950 border-slate-800 text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">URL Externa do Produto no Fornecedor</label>
                  <Input
                    type="url"
                    value={formSupplierUrl}
                    onChange={(e) => setFormSupplierUrl(e.target.value)}
                    placeholder="https://fornecedor.com/produto/123"
                    className="bg-slate-950 border-slate-800 text-white"
                  />
                </div>
              </div>
            )}

            {/* ABA 4: FOTOS */}
            {activeFormTab === "images" && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    type="url"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="Cole a URL da imagem (https://...)"
                    className="bg-slate-950 border-slate-800 text-white"
                  />
                  <Button type="button" onClick={handleAddImageUrl} className="bg-indigo-600 hover:bg-indigo-500">
                    Adicionar
                  </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {formImages.map((img, index) => (
                    <div
                      key={index}
                      className={`relative rounded border p-2 flex flex-col items-center gap-2 ${
                        img.isCover ? "border-indigo-500 bg-indigo-500/10" : "border-slate-800 bg-slate-950"
                      }`}
                    >
                      <img src={img.url} alt={`Foto ${index}`} className="h-24 w-full object-cover rounded" />
                      <div className="flex items-center gap-1 w-full justify-between mt-1">
                        <button
                          type="button"
                          onClick={() => handleSetCoverImage(index)}
                          className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                            img.isCover ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          {img.isCover ? "Capa" : "Tornar Capa"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="text-rose-400 hover:text-rose-300 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botões do Modal */}
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-500">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editingProduct ? "Salvar Alterações" : "Cadastrar Produto"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL: IMPORTAÇÃO EM LOTE (CSV / JSON) COM PREVIEW/COMMIT */}
      {/* ======================================================== */}
      {isImportModalOpen && (
        <Modal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          title="Importação de Catálogo em Lote"
          className="max-w-4xl"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="text-xs text-slate-400 font-medium">Formato dos Dados:</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 text-sm text-slate-300">
                  <input
                    type="radio"
                    name="importFormat"
                    value="CSV"
                    checked={importFormat === "CSV"}
                    onChange={() => setImportFormat("CSV")}
                  />
                  CSV (Separado por vírgula ou ponto-e-vírgula)
                </label>
                <label className="flex items-center gap-1 text-sm text-slate-300">
                  <input
                    type="radio"
                    name="importFormat"
                    value="JSON"
                    checked={importFormat === "JSON"}
                    onChange={() => setImportFormat("JSON")}
                  />
                  JSON (Array de Objetos)
                </label>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-slate-400 font-medium">Cole o conteúdo ou arquivo:</label>
                <button
                  type="button"
                  onClick={() => {
                    if (importFormat === "CSV") {
                      setImportRawData(
                        "sku,name,description,costPrice,sellingPrice,stock,category,supplier\nFONE-PRO-01,Fone Pro Max,Fone bluetooth com cancelamento,45.00,129.90,50,Eletrônicos,Fornecedor Alpha\nRELOGIO-SMART-01,Smartwatch Ultra,Relogio inteligente prova dagua,80.00,249.90,30,Acessórios,Fornecedor Beta"
                      );
                    } else {
                      setImportRawData(
                        JSON.stringify(
                          [
                            {
                              sku: "FONE-PRO-01",
                              name: "Fone Pro Max",
                              description: "Fone bluetooth com cancelamento",
                              costPrice: 45.0,
                              sellingPrice: 129.9,
                              stock: 50,
                              categoryName: "Eletrônicos",
                              supplierName: "Fornecedor Alpha",
                            },
                          ],
                          null,
                          2
                        )
                      );
                    }
                  }}
                  className="text-xs text-indigo-400 hover:underline"
                >
                  Carregar Exemplo de Teste
                </button>
              </div>
              <textarea
                rows={6}
                value={importRawData}
                onChange={(e) => setImportRawData(e.target.value)}
                placeholder={importFormat === "CSV" ? "sku,name,costPrice,sellingPrice,stock..." : '[{ "sku": "...", "name": "..." }]'}
                className="w-full rounded-md border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-between items-center">
              <Button
                type="button"
                onClick={handleGenerateImportPreview}
                disabled={!importRawData.trim() || isPreviewLoading}
                className="bg-indigo-600 hover:bg-indigo-500"
              >
                {isPreviewLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                1. Gerar Pré-visualização (Preview)
              </Button>

              {importPreview && (
                <Button
                  type="button"
                  onClick={handleCommitImport}
                  disabled={!importPreview.summary.canCommit || isCommitLoading}
                  className="bg-emerald-600 hover:bg-emerald-500"
                >
                  {isCommitLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                  2. Confirmar e Gravar ({importPreview.validCount} itens)
                </Button>
              )}
            </div>

            {/* Resultado do Preview */}
            {importPreview && (
              <div className="mt-4 space-y-3 border-t border-slate-800 pt-4">
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 block">Total Linhas</span>
                    <strong className="text-white text-base">{importPreview.totalRows}</strong>
                  </div>
                  <div className="bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
                    <span className="text-emerald-400 block">Válidos</span>
                    <strong className="text-emerald-400 text-base">{importPreview.validCount}</strong>
                  </div>
                  <div className="bg-indigo-500/10 p-2 rounded border border-indigo-500/20">
                    <span className="text-indigo-400 block">Novos / Atualiz.</span>
                    <strong className="text-indigo-400 text-base">
                      {importPreview.newCount} / {importPreview.updateCount}
                    </strong>
                  </div>
                  <div className="bg-rose-500/10 p-2 rounded border border-rose-500/20">
                    <span className="text-rose-400 block">Erros / Duplicados</span>
                    <strong className="text-rose-400 text-base">
                      {importPreview.invalidCount + importPreview.duplicateInFileCount}
                    </strong>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
                  {importPreview.rows.map((row: any) => (
                    <div
                      key={row.rowNumber}
                      className={`p-2 rounded border flex items-center justify-between ${
                        row.isValid
                          ? "bg-slate-950 border-slate-800 text-slate-300"
                          : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-500">#{row.rowNumber}</span>
                        <strong className="font-mono">{row.data.sku}</strong>
                        <span>- {row.data.name}</span>
                      </div>
                      <div>
                        {row.isValid ? (
                          <Badge variant={row.action === "CREATE" ? "success" : "info"}>
                            {row.action === "CREATE" ? "CRIAR" : "ATUALIZAR"}
                          </Badge>
                        ) : (
                          <span className="text-rose-400 text-[11px]">{row.errors.join(", ")}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL: PRICING ASSISTANT & SIMULADOR FINANCEIRO          */}
      {/* ======================================================== */}
      {isPricingModalOpen && (
        <Modal
          isOpen={isPricingModalOpen}
          onClose={() => setIsPricingModalOpen(false)}
          title="Assistente de Precificação & Calculadora de Margem"
          className="max-w-2xl"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Calcule preços sugeridos utilizando as regras matemáticas oficiais do DropHub baseadas em margem e markup.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Custo do Produto (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={calcCost}
                  onChange={(e) => {
                    setCalcCost(parseFloat(e.target.value) || 0);
                  }}
                  className="bg-slate-950 border-slate-800 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Margem Alvo Desejada (%)</label>
                <Input
                  type="number"
                  step="0.5"
                  value={calcMargin}
                  onChange={(e) => {
                    setCalcMargin(parseFloat(e.target.value) || 0);
                  }}
                  className="bg-slate-950 border-slate-800 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Frete Estimado (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={calcShipping}
                  onChange={(e) => setCalcShipping(parseFloat(e.target.value) || 0)}
                  className="bg-slate-950 border-slate-800 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Arredondamento Psicológico</label>
                <select
                  value={calcRounding}
                  onChange={(e) => setCalcRounding(e.target.value)}
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                >
                  <option value="PSYCHOLOGICAL_99">Terminação .99 (Ex: R$ 99,99)</option>
                  <option value="PSYCHOLOGICAL_90">Terminação .90 (Ex: R$ 99,90)</option>
                  <option value="ROUND_UP_INTEGER">Arredondar para cima (Ex: R$ 100,00)</option>
                  <option value="NONE">Sem arredondamento</option>
                </select>
              </div>
            </div>

            <Button type="button" onClick={runPricingSimulation} className="w-full bg-indigo-600 hover:bg-indigo-500">
              Calcular Preço Sugerido
            </Button>

            {pricingSimulation && (
              <Card className="border-slate-800 bg-slate-950 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Preço de Venda Sugerido:</span>
                  <span className="text-2xl font-bold text-emerald-400 font-mono">
                    {formatCurrency(pricingSimulation.suggestedPrice)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-slate-900">
                  <div>
                    <span className="text-slate-500 block">Lucro Estimado</span>
                    <strong className="text-emerald-400 font-mono">+{formatCurrency(pricingSimulation.profit)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Margem Efetiva</span>
                    <strong className="text-indigo-400 font-mono">
                      {formatPercent(pricingSimulation.marginPercentage)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Markup</span>
                    <strong className="text-indigo-400 font-mono">
                      {formatPercent(pricingSimulation.markupPercentage)}
                    </strong>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
