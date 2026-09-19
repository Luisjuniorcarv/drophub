import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/storefront/Header";
import { Footer } from "@/components/storefront/Footer";
import { getCustomerSession } from "@/modules/customer/auth";
import { getStorefrontOrder } from "@/modules/storefront/service";
import {
  CheckCircle2,
  Clock,
  Truck,
  Package,
  MapPin,
  CreditCard,
  QrCode,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export async function generateMetadata(props: Props) {
  const { id } = await props.params;
  return {
    title: `Pedido ${id.slice(0, 8)} - DropHub Store`,
  };
}

export default async function OrderDetailPage(props: Props) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const token = searchParams.token || null;

  const session = await getCustomerSession();

  let order: any = null;
  try {
    order = await getStorefrontOrder({
      orderId: id,
      customerId: session?.id || null,
      trackingToken: token,
    });
  } catch (error: any) {
    if (error.message === "FORBIDDEN") {
      redirect("/login");
    }
    notFound();
  }

  const isPaid = order.status === "PAID" || order.status === "PROCESSING" || order.status === "SHIPPED" || order.status === "DELIVERED";

  const formattedSubtotal = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(order.subtotalAmount);

  const formattedShipping =
    order.shippingCost === 0
      ? "Grátis"
      : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(order.shippingCost);

  const formattedTotal = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(order.totalAmount);

  const formattedDate = new Date(order.createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
        {/* Header Summary */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 mb-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  Pedido {order.orderNumber}
                </h1>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    isPaid
                      ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300"
                      : "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300"
                  }`}
                >
                  {isPaid ? "PAGO / CONFIRMADO" : "AGUARDANDO PAGAMENTO"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Realizado em {formattedDate}</p>
            </div>

            {!isPaid && (
              <Link
                href={`/checkout/pagamento?orderId=${order.id}${order.trackingToken ? `&token=${encodeURIComponent(order.trackingToken)}` : ""}`}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all"
              >
                Efetuar Pagamento Agora <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          {/* Status Timeline */}
          <div className="pt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
              Status do Pedido
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className={`p-4 rounded-2xl border ${
                order.status ? "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/30" : "border-slate-200 opacity-50"
              }`}>
                <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4" /> 1. Pedido Criado
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Recebido com sucesso</p>
              </div>

              <div className={`p-4 rounded-2xl border ${
                isPaid ? "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/30" : "border-slate-200 opacity-50"
              }`}>
                <div className={`flex items-center gap-2 font-bold text-xs ${isPaid ? "text-emerald-600" : "text-slate-400"}`}>
                  <CreditCard className="w-4 h-4" /> 2. Pagamento
                </div>
                <p className="text-[11px] text-slate-500 mt-1">{isPaid ? "Aprovado e conciliado" : "Pendente"}</p>
              </div>

              <div className={`p-4 rounded-2xl border ${
                order.status === "SHIPPED" || order.status === "DELIVERED"
                  ? "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/30"
                  : "border-slate-200 dark:border-slate-800 opacity-50"
              }`}>
                <div className="flex items-center gap-2 font-bold text-xs text-slate-400">
                  <Package className="w-4 h-4" /> 3. Em Separação
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Preparação para envio</p>
              </div>

              <div className={`p-4 rounded-2xl border ${
                order.status === "DELIVERED"
                  ? "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/30"
                  : "border-slate-200 dark:border-slate-800 opacity-50"
              }`}>
                <div className="flex items-center gap-2 font-bold text-xs text-slate-400">
                  <Truck className="w-4 h-4" /> 4. Entrega
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Envio e rastreamento</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Items List */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
              <h3 className="font-bold text-base text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
                Itens Comprados ({order.items.length})
              </h3>

              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {order.items.map((it: any) => (
                  <div key={it.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                        {it.image ? (
                          <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 text-[10px]">
                            Foto
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={it.slug ? `/produto/${it.slug}` : "/produtos"}
                          className="font-bold text-slate-900 dark:text-white hover:text-emerald-600 truncate block"
                        >
                          {it.name}
                        </Link>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          SKU: {it.sku} • {it.quantity} un. x {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(it.unitPrice)}
                        </span>
                      </div>
                    </div>

                    <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(it.totalPrice)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pacotes & Rastreamento em Tempo Real */}
            {order.shipments && order.shipments.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
                <h3 className="font-bold text-base text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-emerald-600" /> Pacotes & Rastreamento ({order.shipments.length} envio(s))
                </h3>

                <div className="space-y-4">
                  {order.shipments.map((shp: any, idx: number) => (
                    <div key={shp.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            Pacote #{idx + 1} — {shp.carrier}
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            Código: <span className="font-mono text-emerald-600 font-bold">{shp.trackingNumber}</span>
                          </span>
                        </div>

                        {shp.trackingUrl && (
                          <a
                            href={shp.trackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 transition-all self-start sm:self-auto"
                          >
                            Acompanhar na Transportadora <ArrowRight className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>

                      {shp.trackings && shp.trackings.length > 0 && (
                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80 space-y-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                            Eventos de Rastreio:
                          </span>
                          <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                            {shp.trackings.map((t: any) => (
                              <div key={t.id} className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                <div>
                                  <span className="font-medium text-slate-900 dark:text-white">{t.description}</span>
                                  {t.location && <span className="text-slate-500 text-[11px] ml-1">({t.location})</span>}
                                  <span className="text-[10px] text-slate-400 block font-mono">
                                    {new Date(t.timestamp).toLocaleString("pt-BR")}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Delivery Address & Customer Data */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
              <h3 className="font-bold text-base text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600" /> Endereço de Entrega
              </h3>

              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p className="font-semibold text-slate-900 dark:text-white">{order.customer?.name}</p>
                <p>
                  {order.shippingAddress?.street}, {order.shippingAddress?.number}
                  {order.shippingAddress?.complement && ` - ${order.shippingAddress.complement}`}
                </p>
                <p>
                  {order.shippingAddress?.neighborhood} - {order.shippingAddress?.city} / {order.shippingAddress?.state}
                </p>
                <p>CEP: {order.shippingAddress?.postalCode}</p>
              </div>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-3 shadow-sm">
              <h3 className="font-bold text-base text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
                Resumo Financeiro
              </h3>

              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>Subtotal dos Produtos</span>
                  <span className="font-bold text-slate-900 dark:text-white">{formattedSubtotal}</span>
                </div>
                <div className="flex justify-between">
                  <span>Frete</span>
                  <span className="font-bold text-slate-900 dark:text-white">{formattedShipping}</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-slate-900 dark:text-white pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span>Total do Pedido</span>
                  <span className="text-emerald-600 dark:text-emerald-400 text-xl">{formattedTotal}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <Link
                  href="/produtos"
                  className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl font-bold text-xs text-center block transition-colors"
                >
                  Continuar Comprando
                </Link>
                {session && (
                  <Link
                    href="/minha-conta/pedidos"
                    className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium text-xs text-center block transition-colors"
                  >
                    Ver Todos os Meus Pedidos
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
