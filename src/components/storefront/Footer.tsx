import React from "react";
import Link from "next/link";
import { ShieldCheck, Truck, CreditCard, RotateCcw, Lock } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 text-sm mt-20">
      {/* Trust Badges */}
      <div className="border-b border-slate-800 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-950/80 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-800/40">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-semibold text-white">Frete Grátis</h4>
              <p className="text-xs text-slate-400 mt-0.5">Frete Grátis para todo o Brasil em todos os pedidos.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-950/80 text-blue-400 flex items-center justify-center shrink-0 border border-blue-800/40">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-semibold text-white">Pix & Cartão</h4>
              <p className="text-xs text-slate-400 mt-0.5">Pagamento instantâneo via Pix ou em até 12x no cartão.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-950/80 text-purple-400 flex items-center justify-center shrink-0 border border-purple-800/40">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-semibold text-white">Compra Garantida</h4>
              <p className="text-xs text-slate-400 mt-0.5">Satisfação garantida ou seu dinheiro de volta.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-950/80 text-amber-400 flex items-center justify-center shrink-0 border border-amber-800/40">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-semibold text-white">Segurança Total</h4>
              <p className="text-xs text-slate-400 mt-0.5">Dados protegidos por criptografia de ponta a ponta.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Brand Column */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
              DH
            </div>
            <span className="font-bold text-xl text-white">
              Drop<span className="text-emerald-500">Hub</span>
            </span>
          </div>
          <p className="text-xs leading-relaxed text-slate-400">
            Sua loja online de confiança com os melhores produtos, entrega ágil, rastreamento transparente e atendimento de excelência.
          </p>
        </div>

        {/* Quick Links */}
        <div>
          <h5 className="font-semibold text-white mb-4 text-xs uppercase tracking-wider">Navegação</h5>
          <ul className="space-y-2.5 text-xs">
            <li>
              <Link href="/" className="hover:text-white transition-colors">Início</Link>
            </li>
            <li>
              <Link href="/produtos" className="hover:text-white transition-colors">Todos os Produtos</Link>
            </li>
            <li>
              <Link href="/busca" className="hover:text-white transition-colors">Buscar no Catálogo</Link>
            </li>
            <li>
              <Link href="/carrinho" className="hover:text-white transition-colors">Meu Carrinho</Link>
            </li>
          </ul>
        </div>

        {/* Customer Account */}
        <div>
          <h5 className="font-semibold text-white mb-4 text-xs uppercase tracking-wider">Minha Conta</h5>
          <ul className="space-y-2.5 text-xs">
            <li>
              <Link href="/minha-conta" className="hover:text-white transition-colors">Painel do Cliente</Link>
            </li>
            <li>
              <Link href="/minha-conta/pedidos" className="hover:text-white transition-colors">Meus Pedidos</Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-white transition-colors">Entrar</Link>
            </li>
            <li>
              <Link href="/cadastro" className="hover:text-white transition-colors">Criar Conta</Link>
            </li>
          </ul>
        </div>

        {/* Legal & Privacy */}
        <div>
          <h5 className="font-semibold text-white mb-4 text-xs uppercase tracking-wider">Institucional & LGPD</h5>
          <ul className="space-y-2.5 text-xs">
            <li>
              <Link href="/politica-de-privacidade" className="hover:text-white transition-colors">Política de Privacidade</Link>
            </li>
            <li>
              <Link href="/recuperar-senha" className="hover:text-white transition-colors">Recuperação de Senha</Link>
            </li>
            <li>
              <span className="text-slate-500">Atendimento: suporte@drophub.com.br</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        <p>DropHub © 2026 - Todos os direitos reservados. CNPJ: 00.000.000/0001-00.</p>
      </div>
    </footer>
  );
}
