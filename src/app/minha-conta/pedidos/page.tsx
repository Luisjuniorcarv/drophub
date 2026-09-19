import { redirect } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/storefront/Header";
import { Footer } from "@/components/storefront/Footer";
import { getCustomerSession } from "@/modules/customer/auth";
import { listCustomerOrders } from "@/modules/storefront/service";
import { Package, ArrowRight, ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function CustomerOrdersListPage(props: Props) {
  const session = await getCustomerSession();
  if (!session) {
    redirect("/login?from=/minha-conta/pedidos");
  }

  const searchParams = await props.searchParams;
  const page = Math.max(1, Number(searchParams.page) || 1);

  const { orders, pagination } = await listCustomerOrders(session.id, page, 10);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <Link href="/" className="hover:text-emerald-600">Início</Link>
          <span>/</span>
          <Link href="/minha-conta" className="hover:text-emerald-600">Minha Conta</Link>
          <span>/</span>
          <span className="text-slate-800 dark:text-slate-200 font-semibold">Meus Pedidos</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
              <Package className="w-6 h-6 text-emerald-600" /> Histórico de Pedidos
            </h1>
            <span className="text-xs text-slate-500 font-medium">
              {pagination.total} {pagination.total === 1 ? "pedido encontrado" : "pedidos encontrados"}
            </span>
          </div>

          {orders.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              <ShoppingBag className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">Nenhum pedido realizado</p>
              <p className="mt-1">Você ainda não efetuou compras no DropHub.</p>
              <Link
                href="/produtos"
                className="mt-4 inline-block px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold"
              >
                Conhecer Produtos
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {orders.map((o) => (
                <div key={o.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                  <div>
                    <Link
                      href={`/minha-conta/pedidos/${o.id}`}
                      className="font-extrabold text-slate-900 dark:text-white hover:text-emerald-600 text-base"
                    >
                      {o.orderNumber}
                    </Link>
                    <p className="text-slate-500 mt-0.5">
                      Data: {new Date(o.createdAt).toLocaleDateString("pt-BR")} • Quantidade: {o.itemsCount} {o.itemsCount === 1 ? "item" : "itens"}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6">
                    <div className="text-left sm:text-right">
                      <span className="font-black text-slate-900 dark:text-white text-base block">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                          o.totalAmount
                        )}
                      </span>
                      <span className="text-[11px] font-bold uppercase text-emerald-600">
                        {o.status}
                      </span>
                    </div>

                    <Link
                      href={`/minha-conta/pedidos/${o.id}`}
                      className="px-4 py-2 bg-slate-900 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                    >
                      Detalhes <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6 border-t border-slate-100 dark:border-slate-800">
              {page > 1 && (
                <Link
                  href={`/minha-conta/pedidos?page=${page - 1}`}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-800"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Link>
              )}
              <span className="text-xs font-semibold px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                Página {page} de {pagination.totalPages}
              </span>
              {page < pagination.totalPages && (
                <Link
                  href={`/minha-conta/pedidos?page=${page + 1}`}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-800"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
