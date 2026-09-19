"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { User, AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    cpf: "",
    phone: "",
    password: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/customer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Ocorreu um erro ao criar a conta.");
        setIsLoading(false);
        return;
      }

      // Sucesso: Redireciona para Minha Conta
      router.push("/minha-conta");
      router.refresh();
    } catch {
      setErrorMessage("Erro de comunicação com o servidor.");
      setIsLoading(false);
    }
  };

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
          Crie sua Conta
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Acompanhe seus pedidos com facilidade e segurança
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-3xl sm:px-10">
          {errorMessage && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <Input
                label="Nome Completo *"
                type="text"
                required
                placeholder="Ex: Maria Santos"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 text-xs"
              />
            </div>

            <div>
              <Input
                label="E-mail *"
                type="email"
                required
                placeholder="seuemail@exemplo.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 text-xs"
              />
            </div>

            <div>
              <Input
                label="CPF (somente números) *"
                type="text"
                required
                maxLength={14}
                placeholder="000.000.000-00"
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 text-xs"
              />
            </div>

            <div>
              <Input
                label="Telefone / WhatsApp *"
                type="text"
                required
                placeholder="(11) 99999-9999"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 text-xs"
              />
            </div>

            <div>
              <Input
                label="Senha de Acesso (mínimo 6 caracteres) *"
                type="password"
                required
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
              <User className="w-4 h-4 mr-2" /> Criar Minha Conta
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800 text-center text-xs text-slate-400">
            <p>
              Já possui cadastro?{" "}
              <Link href="/login" className="text-emerald-400 hover:underline font-bold">
                Fazer login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
