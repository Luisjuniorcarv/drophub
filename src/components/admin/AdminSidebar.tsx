"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Boxes,
  Truck,
  Users,
  ShoppingCart,
  DollarSign,
  Zap,
  Sparkles,
  Settings,
  Store,
  FolderTree,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigationItems = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Produtos", href: "/admin/produtos", icon: Package },
  { name: "Estoque", href: "/admin/estoque", icon: Boxes },
  { name: "Categorias", href: "/admin/categorias", icon: FolderTree },
  { name: "Fornecedores", href: "/admin/fornecedores", icon: Truck },
  { name: "Operação", href: "/admin/operacao", icon: Zap },
  { name: "Fulfillment", href: "/admin/fulfillment", icon: Send },
  { name: "Clientes", href: "/admin/clientes", icon: Users },
  { name: "Pedidos", href: "/admin/pedidos", icon: ShoppingCart },
  { name: "Financeiro", href: "/admin/financeiro", icon: DollarSign },
  { name: "Automações", href: "/admin/automacoes", icon: Zap },
  { name: "Assistente IA", href: "/admin/ia", icon: Sparkles },
  { name: "Configurações", href: "/admin/configuracoes", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between hidden md:flex shrink-0">
      <div>
        {/* Brand */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-emerald-600/20">
            DH
          </div>
          <div>
            <span className="font-bold text-white text-base tracking-tight">DropHub</span>
            <span className="text-[10px] block text-emerald-400 font-semibold uppercase tracking-wider">
              Control Panel
            </span>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="p-3 space-y-1">
          {navigationItems.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 font-semibold"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                )}
              >
                <Icon className={cn("w-4 h-4", isActive ? "text-emerald-400" : "text-slate-400")} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer link to public store */}
      <div className="p-4 border-t border-slate-800">
        <Link
          href="/produtos"
          target="_blank"
          className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg transition-colors border border-slate-700/60"
        >
          <Store className="w-3.5 h-3.5 text-emerald-400" />
          Ver Loja Pública
        </Link>
      </div>
    </aside>
  );
}
