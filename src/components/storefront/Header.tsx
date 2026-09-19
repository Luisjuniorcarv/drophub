"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Search,
  User,
  Menu,
  X,
  ShieldCheck,
  Truck,
  ChevronDown,
} from "lucide-react";
import { useCart } from "./CartContext";

export function Header() {
  const router = useRouter();
  const { cart, setIsCartOpen } = useCart();
  const [searchTerm, setSearchTerm] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [customer, setCustomer] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/customer/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data.customer) {
          setCustomer(data.customer);
        } else {
          setCustomer(null);
        }
      })
      .catch(() => setCustomer(null));
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/busca?q=${encodeURIComponent(searchTerm.trim())}`);
    }
  }

  return (
    <>
      {/* Top Notification Bar */}
      <div className="bg-slate-900 text-slate-300 text-xs py-2 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <Truck className="w-3.5 h-3.5" /> Frete Grátis acima de R$ 199
            </span>
            <span className="hidden sm:inline text-slate-500">•</span>
            <span className="hidden sm:flex items-center gap-1 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Compra 100% Segura & Garantida
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin" className="hover:text-white transition-colors text-slate-400">
              Painel Admin
            </Link>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
            {/* Logo */}
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform">
                  DH
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-xl sm:text-2xl tracking-tight text-slate-900 dark:text-white leading-none">
                    Drop<span className="text-emerald-600">Hub</span>
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mt-0.5">
                    Store
                  </span>
                </div>
              </Link>

              {/* Navigation Desktop */}
              <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
                <Link href="/" className="hover:text-emerald-600 transition-colors">
                  Início
                </Link>
                <Link href="/produtos" className="hover:text-emerald-600 transition-colors">
                  Catálogo
                </Link>
                <Link href="/produtos?sort=newest" className="hover:text-emerald-600 transition-colors">
                  Novidades
                </Link>
              </nav>
            </div>

            {/* Search Bar Desktop */}
            <div className="hidden lg:flex flex-1 max-w-md mx-4">
              <form onSubmit={handleSearch} className="relative w-full">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar produtos, marcas, modelos..."
                  className="w-full bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white pl-10 pr-4 py-2.5 rounded-full text-sm border border-transparent focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition-all"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </form>
            </div>

            {/* User Actions */}
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Account */}
              {customer ? (
                <Link
                  href="/minha-conta"
                  className="flex items-center gap-2 p-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors text-sm font-medium"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                    {customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden sm:flex flex-col text-left leading-tight">
                    <span className="text-xs text-slate-400">Olá,</span>
                    <span className="font-semibold truncate max-w-[100px]">{customer.name.split(" ")[0]}</span>
                  </div>
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors text-sm font-medium"
                >
                  <User className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  <span className="hidden sm:inline">Entrar</span>
                </Link>
              )}

              {/* Cart Button */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-all flex items-center gap-2"
                aria-label="Abrir Carrinho"
              >
                <ShoppingBag className="w-5 h-5 text-emerald-600" />
                <span className="hidden sm:inline text-xs font-bold">
                  {cart.subtotalAmount > 0 ? `R$ ${cart.subtotalAmount.toFixed(2)}` : "Carrinho"}
                </span>
                {cart.itemsCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-extrabold flex items-center justify-center shadow-sm">
                    {cart.itemsCount}
                  </span>
                )}
              </button>

              {/* Mobile Menu Trigger */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Search Bar Mobile */}
          <div className="lg:hidden pb-3">
            <form onSubmit={handleSearch} className="relative w-full">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar produtos..."
                className="w-full bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white pl-9 pr-4 py-2 rounded-lg text-sm border border-transparent focus:border-emerald-500 focus:outline-none"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </form>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-4 space-y-2 animate-fadeIn">
            <Link
              href="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-slate-800 dark:text-slate-200 font-medium hover:bg-slate-100 dark:hover:bg-slate-900"
            >
              Início
            </Link>
            <Link
              href="/produtos"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-slate-800 dark:text-slate-200 font-medium hover:bg-slate-100 dark:hover:bg-slate-900"
            >
              Todos os Produtos
            </Link>
            <Link
              href="/carrinho"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-slate-800 dark:text-slate-200 font-medium hover:bg-slate-100 dark:hover:bg-slate-900"
            >
              Meu Carrinho ({cart.itemsCount})
            </Link>
            <Link
              href={customer ? "/minha-conta" : "/login"}
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-slate-800 dark:text-slate-200 font-medium hover:bg-slate-100 dark:hover:bg-slate-900"
            >
              {customer ? "Minha Conta" : "Entrar / Cadastrar"}
            </Link>
          </div>
        )}
      </header>
    </>
  );
}
