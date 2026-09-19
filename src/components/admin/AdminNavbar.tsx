"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon, Shield, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SessionUser } from "@/types";

interface AdminNavbarProps {
  user: SessionUser;
}

export function AdminNavbar({ user }: AdminNavbarProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Erro ao deslogar:", err);
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="h-16 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-medium text-slate-200">
          Olá, <span className="font-semibold text-white">{user.name}</span>
        </h1>
        <Badge variant={user.role === "ADMIN" ? "success" : "info"} size="sm">
          <Shield className="w-3 h-3 mr-1" />
          {user.role}
        </Badge>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <p className="text-xs text-slate-400 font-mono">{user.email}</p>
        </div>

        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-rose-400 bg-slate-800 hover:bg-rose-950/30 border border-slate-700 hover:border-rose-800/60 rounded-lg transition-colors disabled:opacity-50"
          title="Encerrar Sessão"
        >
          {isLoggingOut ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
          ) : (
            <LogOut className="w-3.5 h-3.5" />
          )}
          <span>Sair</span>
        </button>
      </div>
    </header>
  );
}
