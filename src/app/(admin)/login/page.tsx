"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ShieldCheck, Lock, AlertCircle, ArrowLeft, User, UserCheck } from "lucide-react";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");

  const [activeTab, setActiveTab] = useState<"CUSTOMER" | "ADMIN">(
    from?.startsWith("/admin") ? "ADMIN" : "CUSTOMER"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setIsLoading(true);

    try {
      const endpoint = activeTab === "ADMIN" ? "/api/auth/login" : "/api/auth/customer/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "E-mail ou senha incorretos.");
        setIsLoading(false);
        return;
      }

      // Sucesso: Redireciona para rota apropriada
      if (from) {
        router.push(from);
      } else {
        router.push(activeTab === "ADMIN" ? "/admin" : "/minha-conta");
      }
      router.refresh();
    } catch {
      setErrorMessage("Erro de conexão. Tente novamente.");
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-3xl sm:px-10">
      {/* Tabs */}
      <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 mb-6">
        <button
          type="button"
          onClick={() => {
            setActiveTab("CUSTOMER");
            setErrorMessage("");
          }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === "CUSTOMER"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <User className="w-3.5 h-3.5" /> Sou Cliente
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("ADMIN");
            setErrorMessage("");
          }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === "ADMIN"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Painel Admin
        </button>
      </div>

      {errorMessage && (
        <div className="mb-6 p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <Input
            label="E-mail"
            type="email"
            id="email"
            required
            autoComplete="email"
            placeholder={activeTab === "ADMIN" ? "admin@drophub.com" : "seuemail@exemplo.com"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 text-xs"
          />
        </div>

        <div>
          <Input
            label="Senha"
            type="password"
            id="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 text-xs"
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
          isLoading={isLoading}
        >
          <Lock className="w-4 h-4 mr-2" />
          {activeTab === "ADMIN" ? "Entrar no Painel Admin" : "Acessar Minha Conta"}
        </Button>
      </form>

      {/* Customer footer links */}
      {activeTab === "CUSTOMER" && (
        <div className="mt-6 pt-6 border-t border-slate-800 text-center text-xs text-slate-400 space-y-2">
          <p>
            Não tem uma conta de cliente?{" "}
            <Link href="/cadastro" className="text-emerald-400 hover:underline font-bold">
              Cadastre-se grátis
            </Link>
          </p>
          <p>
            <Link href="/recuperar-senha" className="text-slate-500 hover:text-slate-300">
              Esqueceu sua senha?
            </Link>
          </p>
        </div>
      )}

      {/* Admin credentials hint */}
      {activeTab === "ADMIN" && (
        <div className="mt-6 pt-6 border-t border-slate-800 text-xs text-slate-400 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-300 font-medium mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Credenciais Administrativas (Seed):
          </div>
          <p className="text-slate-400 font-mono text-[11px]">
            Usuário: <span className="text-emerald-300">admin@drophub.com</span>
          </p>
          <p className="text-slate-400 font-mono text-[11px]">
            Senha: <span className="text-emerald-300">admin123456</span>
          </p>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Voltar para Home */}
      <div className="absolute top-6 left-6 z-20">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para o início
        </Link>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-600 text-white font-black text-xl shadow-lg shadow-emerald-600/30 mb-3">
          DH
        </div>
        <h2 className="text-2xl font-black tracking-tight text-white">
          Drop<span className="text-emerald-500">Hub</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Faça login para acompanhar pedidos ou gerenciar a loja
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <Suspense fallback={<div className="p-8 text-center text-slate-400 text-xs">Carregando formulário...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
