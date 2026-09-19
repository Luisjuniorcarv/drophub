import React from "react";
import Link from "next/link";
import { Header } from "@/components/storefront/Header";
import { Footer } from "@/components/storefront/Footer";
import { ShieldCheck, Lock, FileText, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Política de Privacidade & LGPD - DropHub",
  description: "Entenda como tratamos e protegemos seus dados pessoais de acordo com a Lei Geral de Proteção de Dados (LGPD).",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 w-full">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-600 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar ao início
          </Link>
          <div className="flex items-center gap-2.5 text-emerald-600 font-bold text-xs uppercase tracking-widest mb-1">
            <ShieldCheck className="w-4 h-4" /> Conformidade Legal
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Política de Privacidade & Proteção de Dados (LGPD)
          </h1>
          <p className="text-xs text-slate-500 mt-1">Última atualização: Setembro de 2026</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-10 shadow-sm space-y-8 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" /> 1. Compromisso com a Privacidade
            </h2>
            <p>
              O <strong>DropHub</strong> valoriza a segurança e a confidencialidade das informações dos seus usuários e clientes. Esta política descreve como coletamos, usamos, armazenamos e protegemos seus dados pessoais, em estrita observância à Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 - LGPD).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-emerald-600" /> 2. Dados Coletados e Finalidades
            </h2>
            <p>Coletamos exclusivamente os dados necessários para a prestação dos nossos serviços:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><strong>Identificação e Contato:</strong> Nome completo, e-mail, telefone e CPF para emissão de pedidos, autenticação e comunicação sobre o status da compra.</li>
              <li><strong>Entrega:</strong> Endereço completo (logradouro, número, bairro, cidade, estado, CEP) para despacho e rastreamento das mercadorias.</li>
              <li><strong>Pagamentos:</strong> O DropHub adota conformidade com o padrão <strong>Zero PCI Scope</strong>. Números de cartão de crédito e códigos de segurança (CVV) são tokenizados diretamente pelo gateway de pagamento e nunca são armazenados em nossos servidores.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              3. Compartilhamento Seguro de Dados
            </h2>
            <p>
              Seus dados pessoais só são compartilhados com parceiros estritamente necessários para a execução do contrato de compra e venda (ex: gateways de pagamento e transportadoras logísticas). Não comercializamos nem transferimos suas informações para terceiros para fins de marketing não autorizado.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              4. Seus Direitos como Titular dos Dados
            </h2>
            <p>Conforme o art. 18 da LGPD, você possui o direito de:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Confirmar a existência de tratamento e acessar seus dados;</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados em sua área &ldquo;Minha Conta&rdquo;;</li>
              <li>Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários;</li>
              <li>Revogar o consentimento a qualquer momento.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              5. Encarregado de Dados (DPO) e Contato
            </h2>
            <p>
              Para esclarecer dúvidas sobre esta política ou exercer seus direitos de privacidade, entre em contato com nosso Encarregado de Proteção de Dados pelo e-mail: <strong>privacidade@drophub.com.br</strong>.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
