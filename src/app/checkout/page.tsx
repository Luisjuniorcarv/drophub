"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/storefront/Header";
import { Footer } from "@/components/storefront/Footer";
import { useCart } from "@/components/storefront/CartContext";
import { trackFbEvent } from "@/components/analytics/MetaPixel";
import {
  ShieldCheck,
  CreditCard,
  QrCode,
  Truck,
  ArrowRight,
  Lock,
  User,
  MapPin,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, isLoading: isCartLoading } = useCart();

  const [customerData, setCustomerData] = useState({
    name: "",
    email: "",
    cpf: "",
    phone: "",
  });

  const [addressData, setAddressData] = useState({
    postalCode: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "SP",
  });

  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Load existing customer data if logged in
  useEffect(() => {
    if (cart.items.length > 0) {
      trackFbEvent("InitiateCheckout", {
        num_items: cart.itemsCount,
        value: cart.totalAmount,
        currency: "BRL",
      });
    }

    fetch("/api/auth/customer/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data.customer) {
          setIsAuthenticated(true);
          setCustomerData({
            name: data.customer.name || "",
            email: data.customer.email || "",
            cpf: data.customer.cpf || "",
            phone: data.customer.phone || "",
          });

          if (data.customer.addresses && data.customer.addresses.length > 0) {
            const def = data.customer.addresses[0];
            setAddressData({
              postalCode: def.postalCode || "",
              street: def.street || "",
              number: def.number || "",
              complement: def.complement || "",
              neighborhood: def.neighborhood || "",
              city: def.city || "",
              state: def.state || "SP",
            });
          }
        }
      })
      .catch(() => {});
  }, []);

  async function handleCepLookup(cepValue: string) {
    const cleanCep = cepValue.replace(/\D/g, "");
    setAddressData((prev) => ({ ...prev, postalCode: cleanCep }));

    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        if (res.ok) {
          const via = await res.json();
          if (!via.erro) {
            setAddressData((prev) => ({
              ...prev,
              street: via.logradouro || prev.street,
              neighborhood: via.bairro || prev.neighborhood,
              city: via.localidade || prev.city,
              state: via.uf || prev.state,
            }));
          }
        }
      } catch {
        // Fallback gracioso
      }
    }
  }

  async function handleCheckoutSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");

    if (cart.items.length === 0) {
      setErrorMessage("Seu carrinho está vazio.");
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        customer: {
          name: customerData.name.trim(),
          email: customerData.email.trim(),
          cpf: customerData.cpf.replace(/\D/g, ""),
          phone: customerData.phone.trim(),
        },
        shippingAddress: {
          street: addressData.street.trim(),
          number: addressData.number.trim(),
          complement: addressData.complement?.trim() || null,
          neighborhood: addressData.neighborhood.trim(),
          city: addressData.city.trim(),
          state: addressData.state.trim().toUpperCase(),
          postalCode: addressData.postalCode.replace(/\D/g, ""),
        },
        items: cart.items.map((it) => ({
          productId: it.productId,
          variantId: it.variantId || null,
          quantity: it.quantity,
        })),
        paymentMethod,
        notes: notes.trim() || null,
      };

      const res = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Ocorreu um erro ao processar o pedido.");
        return;
      }

      if (data.success && data.order) {
        // Redireciona para a tela de pagamento com o ID do pedido e o trackingToken
        router.push(
          `/checkout/pagamento?orderId=${data.order.id}&token=${data.order.trackingToken}`
        );
      }
    } catch (err: any) {
      setErrorMessage("Erro de comunicação ao processar pedido. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isCartLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <Link href="/carrinho" className="hover:text-emerald-600">Carrinho</Link>
            <span>/</span>
            <span className="text-slate-800 dark:text-slate-200 font-semibold">Checkout Seguro</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Lock className="w-6 h-6 text-emerald-600" /> Finalização de Pedido
          </h1>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleCheckoutSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Customer & Address Form */}
          <div className="lg:col-span-8 space-y-6">
            {/* Customer Identification */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h2 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-600" /> 1. Dados Pessoais
                </h2>
                {!isAuthenticated && (
                  <Link href="/login" className="text-xs text-emerald-600 hover:underline font-semibold">
                    Já possui conta? Entrar
                  </Link>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerData.name}
                    onChange={(e) => setCustomerData({ ...customerData, name: e.target.value })}
                    placeholder="Ex: João da Silva"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    E-mail para Confirmação *
                  </label>
                  <input
                    type="email"
                    required
                    value={customerData.email}
                    onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
                    placeholder="seuemail@exemplo.com"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    CPF (somente números) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={14}
                    value={customerData.cpf}
                    onChange={(e) => setCustomerData({ ...customerData, cpf: e.target.value })}
                    placeholder="000.000.000-00"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Telefone / WhatsApp *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerData.phone}
                    onChange={(e) => setCustomerData({ ...customerData, phone: e.target.value })}
                    placeholder="(11) 99999-9999"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Delivery Address */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h2 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-600" /> 2. Endereço de Entrega
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    CEP *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={9}
                    value={addressData.postalCode}
                    onChange={(e) => handleCepLookup(e.target.value)}
                    placeholder="00000-000"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Rua / Avenida *
                  </label>
                  <input
                    type="text"
                    required
                    value={addressData.street}
                    onChange={(e) => setAddressData({ ...addressData, street: e.target.value })}
                    placeholder="Ex: Av. Paulista"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Número *
                  </label>
                  <input
                    type="text"
                    required
                    value={addressData.number}
                    onChange={(e) => setAddressData({ ...addressData, number: e.target.value })}
                    placeholder="123"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Complemento
                  </label>
                  <input
                    type="text"
                    value={addressData.complement}
                    onChange={(e) => setAddressData({ ...addressData, complement: e.target.value })}
                    placeholder="Apto 101, Bloco B"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Bairro *
                  </label>
                  <input
                    type="text"
                    required
                    value={addressData.neighborhood}
                    onChange={(e) => setAddressData({ ...addressData, neighborhood: e.target.value })}
                    placeholder="Centro"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Cidade *
                  </label>
                  <input
                    type="text"
                    required
                    value={addressData.city}
                    onChange={(e) => setAddressData({ ...addressData, city: e.target.value })}
                    placeholder="São Paulo"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Estado (UF) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    value={addressData.state}
                    onChange={(e) => setAddressData({ ...addressData, state: e.target.value.toUpperCase() })}
                    placeholder="SP"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
              <h2 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <CreditCard className="w-5 h-5 text-emerald-600" /> 3. Forma de Pagamento
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("PIX")}
                  className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                    paymentMethod === "PIX"
                      ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 shadow-md"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                  }`}
                >
                  <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-slate-900 dark:text-white block">
                      Pix Instantâneo
                    </span>
                    <span className="text-xs text-slate-500 mt-0.5 block">
                      Aprovação imediata. QR Code e código copia e cola gerados no próximo passo.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("CREDIT_CARD")}
                  className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                    paymentMethod === "CREDIT_CARD"
                      ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 shadow-md"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                  }`}
                >
                  <div className="p-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white shrink-0">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-slate-900 dark:text-white block">
                      Cartão de Crédito
                    </span>
                    <span className="text-xs text-slate-500 mt-0.5 block">
                      Parcelamento em até 12x com proteção e tokenização Mercado Pago.
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
              <h3 className="font-bold text-base text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
                Itens do Pedido ({cart.itemsCount})
              </h3>

              <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
                {cart.items.map((item) => (
                  <div key={`${item.productId}-${item.variantId || "default"}`} className="flex gap-3 text-xs">
                    <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-[10px]">
                          Foto
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">{item.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {item.quantity}x de{" "}
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                          item.unitPrice
                        )}
                      </p>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                        item.totalPrice
                      )}
                    </span>
                  </div>
                ))}
              </div>

              {/* Price Calculation */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      cart.subtotalAmount
                    )}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>Frete</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {cart.shippingCost === 0
                      ? "Grátis"
                      : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                          cart.shippingCost
                        )}
                  </span>
                </div>

                <div className="flex justify-between text-base font-extrabold text-slate-900 dark:text-white pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span>Total</span>
                  <span className="text-emerald-600 dark:text-emerald-400 text-xl">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      cart.totalAmount
                    )}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || cart.items.length === 0}
                className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm text-center shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isSubmitting ? "Processando Pedido..." : "Ir para o Pagamento"} <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Trust Badges */}
            <div className="p-4 bg-slate-100/70 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Garantia & Proteção
              </div>
              <p className="text-[11px] leading-relaxed">
                Ambiente 100% criptografado. Pagamentos processados com segurança pelo Mercado Pago.
              </p>
            </div>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  );
}
