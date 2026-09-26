import Link from "next/link";
import { Header } from "@/components/storefront/Header";
import { Footer } from "@/components/storefront/Footer";
import { ProductCard } from "@/components/storefront/ProductCard";
import { getStorefrontProducts } from "@/modules/storefront/service";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

interface Props {
  searchParams?: Promise<{
    q?: string;
    busca?: string;
    sort?: string;
    page?: string;
  }>;
}

export async function generateMetadata(props: Props) {
  const resolvedParams = props?.searchParams ? await props.searchParams : {};
  const searchParams = resolvedParams || {};
  const q = searchParams.q || searchParams.busca || "";
  return {
    title: q ? `Busca por "${q}" - DropHub Store` : "Busca de Produtos - DropHub Store",
  };
}

export default async function SearchPage(props: Props) {
  const resolvedParams = props?.searchParams ? await props.searchParams : {};
  const searchParams = resolvedParams || {};
  const search = searchParams.q || searchParams.busca || "";
  const sort = (searchParams.sort as any) || "newest";
  const page = Math.max(1, Number(searchParams.page) || 1);

  const { products, pagination } = await getStorefrontProducts({
    search: search || undefined,
    sort,
    page,
    limit: 12,
  });

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
        {/* Search Header */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 mb-8 shadow-sm">
          <h1 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Search className="w-6 h-6 text-emerald-600" />
            {search ? (
              <span>
                Resultados para: <span className="text-emerald-600 font-extrabold">&ldquo;{search}&rdquo;</span>
              </span>
            ) : (
              "Buscar Produtos"
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2">
            Encontramos {pagination.total} {pagination.total === 1 ? "produto correspondente" : "produtos correspondentes"}
          </p>

          <form method="GET" action="/busca" className="mt-4 flex gap-2 max-w-md">
            <input
              type="text"
              name="q"
              defaultValue={search}
              placeholder="Digite o nome, SKU ou modelo..."
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors"
            >
              Buscar
            </button>
          </form>
        </div>

        {/* Product Grid */}
        {products.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
            <Search className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Nenhum resultado encontrado</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Verifique a ortografia ou tente termos mais genéricos para encontrar o que procura.
            </p>
            <Link
              href="/produtos"
              className="mt-4 inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              Ver Todos os Produtos
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} {...product} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-10">
            {page > 1 && (
              <Link
                href={`/busca?q=${encodeURIComponent(search)}&page=${page - 1}&sort=${sort}`}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </Link>
            )}

            <span className="text-xs font-semibold px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300">
              Página {page} de {pagination.totalPages}
            </span>

            {page < pagination.totalPages && (
              <Link
                href={`/busca?q=${encodeURIComponent(search)}&page=${page + 1}&sort=${sort}`}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
