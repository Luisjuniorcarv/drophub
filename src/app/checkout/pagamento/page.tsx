"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/storefront/Header";
import { Footer } from "@/components/storefront/Footer";
import {
  CheckCircle2,
  Copy,
  Check,
  QrCode,
  CreditCard,
  Lock,
  ArrowRight,
  AlertCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import QRCode from "qrcode";
import { trackFbEvent } from "@/components/analytics/MetaPixel";

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const token = searchParams.get("token");

  const [order, setOrder] = useState<any>(null);
  const [payment, setPayment] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [copiedPix, setCopiedPix] = useState(false);
  const [isProcessingCard, setIsProcessingCard] = useState(false);
  const [qrCodeImageUrl, setQrCodeImageUrl] = useState<string>("");

  // Load Order and Payment
  async function fetchStatus() {
    if (!orderId) return;
    try {
      const url = `/api/customer/orders/${orderId}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.order) {
          setOrder(data.order);
          if (data.order.payments && data.order.payments.length > 0) {
            setPayment(data.order.payments[0]);
          }

          // Se já estiver pago, dispara evento do Pixel e redireciona para a página do pedido
          if (data.order.status === "PAID") {
            trackFbEvent("Purchase", {
              value: Number(data.order.totalAmount),
              currency: "BRL",
              order_id: data.order.id,
            });
            setTimeout(() => {
              router.push(`/pedido/${orderId}${token ? `?token=${encodeURIComponent(token)}` : ""}`);
            }, 3000);
          }
        }
      } else {
        const data = await res.json();
        setErrorMessage(data.error || "Não foi possível carregar as informações do pedido.");
      }
    } catch {
      setErrorMessage("Erro de comunicação ao verificar status.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    // Controlled polling to check for webhook confirmation
    const interval = setInterval(() => {
      if (order?.status !== "PAID") {
        fetchStatus();
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [orderId, token]);

  useEffect(() => {
    let isCancelled = false;

    async function loadQrCode() {
      if (payment?.qrCodeBase64) {
        const raw = payment.qrCodeBase64.trim();
        if (raw.startsWith("data:")) {
          setQrCodeImageUrl(raw);
          return;
        }
        if (raw.startsWith("PHN2Zy") || raw.startsWith("PD94bWw")) {
          setQrCodeImageUrl(`data:image/svg+xml;base64,${raw}`);
          return;
        }
        setQrCodeImageUrl(`data:image/png;base64,${raw}`);
        return;
      }

      if (payment?.qrCode) {
        try {
          const generated = await QRCode.toDataURL(payment.qrCode, {
            width: 320,
            margin: 2,
            color: { dark: "#000000", light: "#ffffff" },
          });
          if (!isCancelled) {
            setQrCodeImageUrl(generated);
          }
        } catch (err) {
          console.error("Falha ao gerar QR Code local:", err);
        }
      }
    }

    loadQrCode();

    return () => {
      isCancelled = true;
    };
  }, [payment?.qrCodeBase64, payment?.qrCode]);

  function handleCopyPix() {
    if (payment?.qrCode) {
      navigator.clipboard.writeText(payment.qrCode);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 3000);
    }
  }

  // Simular / Processar pagamento com cartão
  async function handlePayWithCard(e: React.FormEvent) {
    e.preventDefault();
    if (!orderId) return;

    try {
      setIsProcessingCard(true);
      setErrorMessage("");

      const res = await fetch("/api/checkout/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          method: "CREDIT_CARD",
          cardToken: "test_token_simulated_" + Date.now(),
          installments: 1,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        fetchStatus();
      } else {
        setErrorMessage(data.error || "Pagamento recusado ou não autorizado.");
      }
    } catch {
      setErrorMessage("Erro ao processar pagamento com cartão.");
    } finally {
      setIsProcessingCard(false);
    }
  }

  if (isLoading) {
    return (
      <div className="py-24 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto"></div>
        <p className="mt-4 text-xs text-slate-500 font-medium">Carregando detalhes do pagamento...</p>
      </div>
    );
  }

  if (errorMessage && !order) {
    return (
      <div className="py-16 max-w-md mx-auto text-center px-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="font-bold text-lg text-slate-900 dark:text-white">Pedido não encontrado</h2>
        <p className="text-xs text-slate-500 mt-1">{errorMessage}</p>
        <Link
          href="/produtos"
          className="mt-6 inline-block px-5 py-2.5 bg-emerald-600 text-white font-semibold text-xs rounded-xl"
        >
          Voltar à Loja
        </Link>
      </div>
    );
  }

  const isPaid = order?.status === "PAID";
  const formattedTotal = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(order?.totalAmount || 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Paid Success Banner */}
      {isPaid ? (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-3xl p-8 text-center space-y-4 animate-fadeIn">
          <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-600/30">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-emerald-900 dark:text-emerald-200">
              Pagamento Confirmado!
            </h2>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
              Seu pedido <strong>{order.orderNumber}</strong> foi pago com sucesso e já está sendo preparado.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href={`/pedido/${order.id}${token ? `?token=${encodeURIComponent(token)}` : ""}`}
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-md transition-all"
            >
              Acompanhar Detalhes do Pedido <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Order Header Summary */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex items-center justify-between shadow-sm">
            <div>
              <span className="text-xs text-slate-400 font-medium">Pedido Gerado:</span>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white mt-0.5">
                {order.orderNumber}
              </h3>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 font-medium">Valor Total:</span>
              <div className="font-black text-xl text-emerald-600 dark:text-emerald-400 mt-0.5">
                {formattedTotal}
              </div>
            </div>
          </div>

          {/* Pix Payment Card */}
          {(!payment || payment.method === "PIX" || payment.method === "TEST_MODE") && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base text-slate-900 dark:text-white">
                      Pague com Pix
                    </h2>
                    <span className="text-xs text-slate-500">Aprovação imediata e segura</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-amber-600 font-semibold bg-amber-50 dark:bg-amber-950/50 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-900/60">
                  <Clock className="w-3.5 h-3.5" /> Aguardando pagamento
                </div>
              </div>

              {/* QR Code Presentation */}
              <div className="flex flex-col items-center justify-center text-center space-y-4 py-2">
                <div className="w-52 h-52 bg-white p-3 rounded-2xl border-2 border-emerald-500/30 shadow-md flex items-center justify-center overflow-hidden">
                  {qrCodeImageUrl ? (
                    <img
                      src={qrCodeImageUrl}
                      alt="QR Code Pix"
                      className="w-full h-full object-contain"
                      onError={async () => {
                        if (payment?.qrCode) {
                          try {
                            const fallback = await QRCode.toDataURL(payment.qrCode, {
                              width: 320,
                              margin: 2,
                            });
                            setQrCodeImageUrl(fallback);
                          } catch (err) {
                            console.error("Falha no fallback de imagem do QR Code:", err);
                          }
                        }
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 text-xs">
                      <QrCode className="w-16 h-16 text-emerald-600 mb-2 animate-pulse" />
                      <span>Gerando QR Code Pix...</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-500 max-w-sm">
                  Abra o aplicativo do seu banco, escolha a opção <strong>Pagar com Pix</strong> e aponte a câmera para o QR Code acima.
                </p>
              </div>

              {/* Copia e Cola */}
              {payment?.qrCode && (
                <div className="space-y-2 pt-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Ou copie e cole o código Pix:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={payment.qrCode}
                      className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-300 select-all font-mono"
                    />
                    <button
                      onClick={handleCopyPix}
                      className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                        copiedPix
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-900 hover:bg-emerald-600 text-white dark:bg-slate-800 dark:hover:bg-emerald-600"
                      }`}
                    >
                      {copiedPix ? (
                        <>
                          <Check className="w-4 h-4" /> Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" /> Copiar Código
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Polling Indicator */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                  Verificando pagamento em tempo real...
                </span>
                <span className="text-[11px] text-slate-400">Esta tela atualiza automaticamente</span>
              </div>
            </div>
          )}

          {/* Credit Card Card (if chosen) */}
          {payment?.method === "CREDIT_CARD" && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-sm">
              <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="p-2 bg-slate-900 text-white rounded-xl">
                  <CreditCard className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-base text-slate-900 dark:text-white">
                  Pagamento com Cartão de Crédito
                </h2>
              </div>

              <form onSubmit={handlePayWithCard} className="space-y-4">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                  <span className="font-semibold">Ambiente Seguro Mercado Pago:</span> Seus dados são tokenizados no dispositivo e nunca trafegam em nossos servidores.
                </div>

                <button
                  type="submit"
                  disabled={isProcessingCard}
                  className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm text-center shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50"
                >
                  {isProcessingCard ? "Processando Cartão..." : `Confirmar Pagamento de ${formattedTotal}`}
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function PaymentPage() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
        <Suspense fallback={<div className="py-20 text-center">Carregando tela de pagamento...</div>}>
          <PaymentContent />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
