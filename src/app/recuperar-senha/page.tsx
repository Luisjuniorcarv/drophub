"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { KeyRound, ArrowLeft, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";

export default function PasswordRecoveryPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [devToken, setDevToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Não foi possível processar a solicitação.");
      }

      if (data.devToken) {
        setDevToken(data.devToken);
      }
      setSubmitted(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao solicitar recuperação de senha.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Voltar para Login */}
      <div className="absolute top-6 left-6 z-20">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para o login
        </Link>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-600 text-white font-black text-xl shadow-lg shadow-emerald-600/30 mb-3">
          DH
        </div>
        <h2 className="text-2xl font-black tracking-tight text-white">
          Recuperação de Senha
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Informe seu e-mail para receber as instruções de redefinição
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-3xl sm:px-10">
          {errorMessage && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {submitted ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-white text-base">Instruções enviadas!</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Se o e-mail <strong>{email}</strong> estiver cadastrado em nossa base, você receberá um link de recuperação em instantes.
              </p>

              {devToken && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-left text-xs text-amber-300 space-y-2">
                  <div className="font-bold flex items-center gap-1">
                    <span>⚡ Modo de Desenvolvimento:</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Token gerado para teste direto:
                  </p>
                  <Link
                    href={`/redefinir-senha?token=${devToken}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors"
                  >
                    Redefinir Agora <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              <div className="pt-4">
                <Link
                  href="/login"
                  className="inline-block px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors"
                >
                  Voltar para o Login
                </Link>
              </div>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <Input
                  label="Seu E-mail Cadastrado *"
                  type="email"
                  required
                  placeholder="seuemail@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                <KeyRound className="w-4 h-4 mr-2" /> Enviar Link de Recuperação
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
