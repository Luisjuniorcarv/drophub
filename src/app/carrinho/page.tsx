"use client";

import React from "react";
import Link from "next/link";
import { Header } from "@/components/storefront/Header";
import { Footer } from "@/components/storefront/Footer";
import { useCart } from "@/components/storefront/CartContext";
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, ShieldCheck, Truck } from "lucide-react";

export default function CartPage() {
  const { cart, updateQuantity, removeItem, clearCart, isLoading } = useCart();

  const formattedSubtotal = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cart.subtotalAmount);

  const formattedShipping =
    cart.shippingCost === 0
      ? "Grátis"
      : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cart.shippingCost);

  const formattedTotal = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cart.totalAmount);

  const freeShippingDifference = 199 - cart.subtotalAmount;

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
        {/* Title */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              <ShoppingBag className="w-7 h-7 text-emerald-600" /> Meu Carrinho de Compras
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Revise os itens selecionados antes de prosseguir para o pagamento seguro.
            </p>
          </div>

          {cart.items.length > 0 && (
            <button
              onClick={() => clearCart()}
              className="text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors"
            >
              Limpar Carrinho
            </button>
          )}
        </div>

        {cart.items.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center max-w-xl mx-auto shadow-sm">
            <ShoppingBag className="w-16 h-16 stroke-[1.2] text-slate-300 dark:text-slate-700 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Seu carrinho está vazio</h2>
            <p className="text-xs text-slate-500 mt-1">
              Você ainda não adicionou nenhum item. Navegue pelo nosso catálogo e aproveite as melhores ofertas!
            </p>
            <Link
              href="/produtos"
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
            >
              Explorar Catálogo <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Items Column */}
            <div className="lg:col-span-8 space-y-4">
              {/* Free Shipping Alert */}
              {freeShippingDifference > 0 ? (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl flex items-center gap-3 text-xs text-amber-800 dark:text-amber-300">
                  <Truck className="w-5 h-5 shrink-0 text-amber-600" />
                  <span>
                    Adicione mais{" "}
                    <strong>
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                        freeShippingDifference
                      )}
                    </strong>{" "}
                    para garantir <strong>Frete Grátis</strong> para todo o Brasil!
                  </span>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl flex items-center gap-3 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                  <Truck className="w-5 h-5 shrink-0 text-emerald-600" />
                  <span>Parabéns! Seu pedido atingiu o valor para <strong>Frete Grátis</strong>.</span>
                </div>
              )}

              {/* Items Card */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80 shadow-sm">
                {cart.items.map((item) => (
                  <div
                    key={`${item.productId}-${item.variantId || "default"}`}
                    className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    {/* Thumbnail + Name */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                            Foto
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <Link
                          href={`/produto/${item.slug}`}
                          className="font-bold text-sm sm:text-base text-slate-900 dark:text-white hover:text-emerald-600 transition-colors line-clamp-2"
                        >
                          {item.name}
                        </Link>
                        {item.variant && (
                          <span className="text-xs text-slate-500 mt-0.5 block">Opção: {item.variant.name}</span>
                        )}
                        <span className="text-xs text-slate-400 block mt-0.5">SKU: {item.sku}</span>
                        <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block sm:hidden">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                            item.totalPrice
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Quantity & Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                      {/* Quantity Selector */}
                      <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800">
                        <button
                          onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-3 text-xs font-bold text-slate-800 dark:text-slate-200">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                          disabled={item.quantity >= item.availableStock}
                          className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Total Price Desktop */}
                      <div className="hidden sm:block text-right min-w-[100px]">
                        <span className="text-base font-extrabold text-slate-900 dark:text-white">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                            item.totalPrice
                          )}
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          {item.quantity}x de{" "}
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                            item.unitPrice
                          )}
                        </span>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => removeItem(item.productId, item.variantId)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                        title="Remover produto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary Column */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
                <h3 className="font-bold text-base text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
                  Resumo do Pedido
                </h3>

                <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Subtotal ({cart.itemsCount} itens)</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formattedSubtotal}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Entrega / Frete</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formattedShipping}</span>
                  </div>

                  <div className="flex justify-between text-base font-extrabold text-slate-900 dark:text-white pt-3 border-t border-slate-100 dark:border-slate-800">
                    <span>Total a Pagar</span>
                    <span className="text-emerald-600 dark:text-emerald-400 text-xl">{formattedTotal}</span>
                  </div>
                </div>

                <div className="pt-2 space-y-2.5">
                  <Link
                    href="/checkout"
                    className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm text-center shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all"
                  >
                    Prosseguir para o Checkout <ArrowRight className="w-4 h-4" />
                  </Link>

                  <Link
                    href="/produtos"
                    className="w-full py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold text-xs text-center block transition-colors"
                  >
                    Continuar Comprando
                  </Link>
                </div>
              </div>

              {/* Security Guarantee Box */}
              <div className="p-4 bg-slate-100/70 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> Compra Segura
                </div>
                <p className="leading-relaxed text-[11px]">
                  Processamento protegido com criptografia de ponta a ponta. Seus dados financeiros nunca são salvos em nossos servidores.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
