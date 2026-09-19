"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ShoppingBag, Check, Eye } from "lucide-react";
import { useCart } from "./CartContext";

export interface ProductCardProps {
  id: string;
  name: string;
  slug: string;
  sku: string;
  shortDescription?: string | null;
  sellingPrice: number;
  stock: number;
  inStock: boolean;
  coverImage?: string;
  category?: { id: string; name: string; slug: string } | null;
  variantsCount?: number;
}

export function ProductCard({
  id,
  name,
  slug,
  sellingPrice,
  inStock,
  coverImage,
  category,
  variantsCount = 0,
}: ProductCardProps) {
  const { addItem } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(false);

  async function handleQuickAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    // Se possui variantes, direciona para a página do produto para seleção da variante
    if (variantsCount > 0) {
      window.location.href = `/produto/${slug}`;
      return;
    }

    try {
      setIsAdding(true);
      await addItem(id, null, 1);
      setAddedSuccess(true);
      setTimeout(() => setAddedSuccess(false), 2000);
    } finally {
      setIsAdding(false);
    }
  }

  const formattedPrice = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(sellingPrice);

  return (
    <div className="group flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
      {/* Product Image Link */}
      <Link href={`/produto/${slug}`} className="relative aspect-square bg-slate-100 dark:bg-slate-800 overflow-hidden block">
        {coverImage ? (
          <img
            src={coverImage}
            alt={name}
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
            Sem Imagem
          </div>
        )}

        {/* Category Badge */}
        {category && (
          <span className="absolute top-3 left-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-slate-700 dark:text-slate-300 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
            {category.name}
          </span>
        )}

        {/* Stock Badge */}
        {!inStock && (
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center">
            <span className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Esgotado
            </span>
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          <Link href={`/produto/${slug}`} className="block">
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base line-clamp-2 hover:text-emerald-600 transition-colors">
              {name}
            </h3>
          </Link>

          {variantsCount > 0 && (
            <span className="inline-block mt-1.5 text-[11px] text-slate-500 font-medium">
              {variantsCount} {variantsCount === 1 ? "opção disponível" : "opções disponíveis"}
            </span>
          )}
        </div>

        {/* Price & Action */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
          <div>
            <span className="text-xs text-slate-400 block font-medium">Por apenas</span>
            <span className="text-lg sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {formattedPrice}
            </span>
          </div>

          {inStock ? (
            <button
              onClick={handleQuickAdd}
              disabled={isAdding}
              className={`p-2.5 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 transition-all ${
                addedSuccess
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-900 hover:bg-emerald-600 dark:bg-slate-800 dark:hover:bg-emerald-600 text-white"
              }`}
              title={variantsCount > 0 ? "Ver opções" : "Adicionar ao carrinho"}
            >
              {addedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                </>
              ) : variantsCount > 0 ? (
                <>
                  <Eye className="w-4 h-4" />
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" />
                </>
              )}
            </button>
          ) : (
            <span className="text-xs text-slate-400 font-medium">Indisponível</span>
          )}
        </div>
      </div>
    </div>
  );
}
