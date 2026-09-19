import { redirect } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/storefront/Header";
import { Footer } from "@/components/storefront/Footer";
import { getCustomerSession } from "@/modules/customer/auth";
import { prisma } from "@/lib/prisma";
import { listCustomerOrders } from "@/modules/storefront/service";
import { User, Package, MapPin, LogOut, ArrowRight, ShieldCheck } from "lucide-react";

export default async function CustomerAccountPage() {
  const session = await getCustomerSession();
  if (!session) {
    redirect("/login?from=/minha-conta");
  }

  const [customer, { orders }] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: session.id },
      include: {
        addresses: { orderBy: { createdAt: "desc" } },
      },
    }),
    listCustomerOrders(session.id, 1, 5),
  ]);

  if (!customer) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
        {/* Profile Header */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-emerald-600/20">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Olá, {customer.name}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {customer.email} • {customer.phone}
              </p>
            </div>
          </div>

          <form action="/api/auth/customer/logout" method="POST">
            <button
              type="submit"
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/50 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" /> Sair da Conta
            </button>
          </form>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Recent Orders */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h2 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-600" /> Meus Pedidos Recentes
                </h2>
                <Link href="/minha-conta/pedidos" className="text-xs font-semibold text-emerald-600 hover:underline">
                  Ver Todos
                </Link>
              </div>

              {orders.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  Você ainda não possui pedidos realizados.
                  <div className="mt-3">
                    <Link
                      href="/produtos"
                      className="inline-block px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold"
                    >
                      Explorar Produtos
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {orders.map((o) => (
                    <div key={o.id} className="py-3.5 flex items-center justify-between gap-4 text-xs">
                      <div>
                        <Link
                          href={`/minha-conta/pedidos/${o.id}`}
                          className="font-bold text-slate-900 dark:text-white hover:text-emerald-600 text-sm"
                        >
                          {o.orderNumber}
                        </Link>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(o.createdAt).toLocaleDateString("pt-BR")} • {o.itemsCount} {o.itemsCount === 1 ? "item" : "itens"}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="font-extrabold text-slate-900 dark:text-white text-sm block">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                              o.totalAmount
                            )}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-emerald-600">
                            {o.status}
                          </span>
                        </div>

                        <Link
                          href={`/minha-conta/pedidos/${o.id}`}
                          className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Addresses & Security */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
              <h3 className="font-bold text-base text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600" /> Endereços Salvos
              </h3>

              {customer.addresses.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhum endereço cadastrado ainda.</p>
              ) : (
                <div className="space-y-3">
                  {customer.addresses.map((addr) => (
                    <div key={addr.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-0.5 text-slate-600 dark:text-slate-400">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {addr.street}, {addr.number} {addr.complement && `(${addr.complement})`}
                      </p>
                      <p>{addr.neighborhood} - {addr.city} / {addr.state}</p>
                      <p className="text-[11px] text-slate-400">CEP: {addr.postalCode}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
