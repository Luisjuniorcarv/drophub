"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Zap,
  Check,
  ShieldCheck,
  Truck,
  RotateCcw,
  Minus,
  Plus,
  ArrowRight,
} from "lucide-react";
import { useCart } from "@/components/storefront/CartContext";

interface ProductViewProps {
  product: {
    id: string;
    name: string;
    slug: string;
    sku: string;
    description: string;
    shortDescription?: string | null;
    sellingPrice: number;
    stock: number;
    inStock: boolean;
    category?: { id: string; name: string; slug: string } | null;
    images: Array<{ id: string; url: string; altText: string; isCover: boolean }>;
    variants: Array<{
      id: string;
      sku: string;
      name: string;
      attributes: any;
      sellingPrice: number;
      stock: number;
      inStock: boolean;
    }>;
  };
}

export function ProductView({ product }: ProductViewProps) {
  const router = useRouter();
  const { addItem } = useCart();

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    product.variants.length > 0 ? product.variants[0].id : null
  );
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [isBuyingNow, setIsBuyingNow] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState(false);

  const activeVariant = product.variants.find((v) => v.id === selectedVariantId) || null;

  const currentPrice = activeVariant ? activeVariant.sellingPrice : product.sellingPrice;
  const currentStock = activeVariant ? activeVariant.stock : product.stock;
  const isAvailable = currentStock > 0;
  const currentSku = activeVariant ? activeVariant.sku : product.sku;

  const formattedPrice = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(currentPrice);

  const images = product.images.length > 0 ? product.images : [{ id: "def", url: "", altText: product.name, isCover: true }];
  const mainImage = images[selectedImageIndex] || images[0];

  async function handleAddToCart() {
    if (!isAvailable) return;
    try {
      setIsAdding(true);
      await addItem(product.id, selectedVariantId, quantity);
      setAddedFeedback(true);
      setTimeout(() => setAddedFeedback(false), 2500);
    } finally {
      setIsAdding(false);
    }
  }

  async function handleBuyNow() {
    if (!isAvailable) return;
    try {
      setIsBuyingNow(true);
      await addItem(product.id, selectedVariantId, quantity);
      router.push("/checkout");
    } finally {
      setIsBuyingNow(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
      {/* Left Column: Gallery */}
      <div className="lg:col-span-7 space-y-4">
        {/* Main Image */}
        <div className="aspect-square bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex items-center justify-center relative">
          {mainImage.url ? (
            <img
              src={mainImage.url}
              alt={mainImage.altText || product.name}
              className="w-full h-full object-cover object-center"
            />
          ) : (
            <div className="text-slate-400 text-sm">Sem Imagem</div>
          )}

          {!isAvailable && (
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center">
              <span className="bg-red-600 text-white text-sm font-bold px-4 py-1.5 rounded-full uppercase tracking-wider">
                Esgotado
              </span>
            </div>
          )}
        </div>

        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {images.map((img, idx) => (
              <button
                key={img.id}
                onClick={() => setSelectedImageIndex(idx)}
                className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                  selectedImageIndex === idx
                    ? "border-emerald-600 scale-95 shadow-md"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-400"
                }`}
              >
                <img src={img.url} alt={img.altText || product.name} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right Column: Information & Actions */}
      <div className="lg:col-span-5 space-y-6">
        <div>
          {product.category && (
            <Link
              href={`/categoria/${product.category.slug}`}
              className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              {product.category.name}
            </Link>
          )}

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1 leading-tight">
            {product.name}
          </h1>

          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
            <span>SKU: <strong className="text-slate-700 dark:text-slate-300">{currentSku}</strong></span>
            <span>•</span>
            <span className={isAvailable ? "text-emerald-600 font-semibold" : "text-red-500 font-semibold"}>
              {isAvailable ? `Em estoque (${currentStock} un.)` : "Indisponível"}
            </span>
          </div>
        </div>

        {/* Price Card */}
        <div className="p-5 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900/50">
          <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Preço à vista no Pix ou Cartão:</span>
          <div className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {formattedPrice}
          </div>
          <span className="text-xs text-slate-600 dark:text-slate-400 mt-1 block">
            ou em até <strong>12x no cartão de crédito</strong>
          </span>
        </div>

        {/* Variant Selector */}
        {product.variants.length > 0 && (
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Escolha a Variação:
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVariantId(v.id)}
                  className={`p-3 rounded-xl border text-left text-xs font-semibold transition-all ${
                    selectedVariantId === v.id
                      ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 shadow-sm"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-400"
                  }`}
                >
                  <div className="truncate font-bold">{v.name}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v.sellingPrice)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quantity and Actions */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Quantidade:</span>
            <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1 || !isAvailable}
                className="p-2.5 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="px-4 text-sm font-bold text-slate-900 dark:text-white">{quantity}</span>
              <button
                onClick={() => setQuantity(Math.min(currentStock, quantity + 1))}
                disabled={quantity >= currentStock || !isAvailable}
                className="p-2.5 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleAddToCart}
              disabled={!isAvailable || isAdding}
              className={`flex-1 py-4 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                addedFeedback
                  ? "bg-emerald-700 text-white"
                  : "bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white shadow-md disabled:opacity-50"
              }`}
            >
              {addedFeedback ? (
                <>
                  <Check className="w-5 h-5 text-emerald-300" /> Adicionado ao Carrinho!
                </>
              ) : (
                <>
                  <ShoppingBag className="w-5 h-5" /> Adicionar ao Carrinho
                </>
              )}
            </button>

            <button
              onClick={handleBuyNow}
              disabled={!isAvailable || isBuyingNow}
              className="flex-1 py-4 px-6 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Zap className="w-5 h-5" /> Comprar Agora
            </button>
          </div>
        </div>

        {/* Benefits Box */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Frete Grátis para todo o Brasil.</span>
          </div>
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Garantia de 30 dias com devolução facilitada.</span>
          </div>
          <div className="flex items-center gap-3">
            <RotateCcw className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Código de rastreamento enviado automaticamente após o envio.</span>
          </div>
        </div>

        {/* Description */}
        <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
          <h2 className="font-bold text-base text-slate-900 dark:text-white mb-3">
            Descrição do Produto
          </h2>
          <div className="prose dark:prose-invert text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-line">
            {product.description}
          </div>
        </div>
      </div>
    </div>
  );
}
