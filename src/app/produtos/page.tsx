import Link from "next/link";
import { Header } from "@/components/storefront/Header";
import { Footer } from "@/components/storefront/Footer";
import { ProductCard } from "@/components/storefront/ProductCard";
import { getStorefrontProducts, getStorefrontCategories } from "@/modules/storefront/service";
import { SlidersHorizontal, ChevronLeft, ChevronRight, Search } from "lucide-react";

interface Props {
  searchParams: Promise<{
    categorySlug?: string;
    categoria?: string;
    q?: string;
    busca?: string;
    sort?: string;
    page?: string;
    minPrice?: string;
    maxPrice?: string;
  }>;
}

export default async function CatalogPage(props: Props) {
  const searchParams = await props.searchParams;
  const categorySlug = searchParams.categorySlug || searchParams.categoria || undefined;
  const search = searchParams.q || searchParams.busca || undefined;
  const sort = (searchParams.sort as any) || "newest";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const minPrice = searchParams.minPrice ? Number(searchParams.minPrice) : undefined;
  const maxPrice = searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined;

  const [categories, { products, pagination }] = await Promise.all([
    getStorefrontCategories(),
    getStorefrontProducts({
      categorySlug,
      search,
      sort,
      page,
      minPrice,
      maxPrice,
      limit: 12,
    }),
  ]);

  const activeCategory = categories.find((c) => c.slug === categorySlug);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
        {/* Breadcrumbs & Title */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <Link href="/" className="hover:text-emerald-600 transition-colors">Início</Link>
            <span>/</span>
            <Link href="/produtos" className="text-slate-800 dark:text-slate-200 font-medium">Catálogo</Link>
            {activeCategory && (
              <>
                <span>/</span>
                <span className="text-emerald-600 font-semibold">{activeCategory.name}</span>
              </>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {activeCategory ? activeCategory.name : search ? `Busca: "${search}"` : "Todos os Produtos"}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Mostrando {products.length} de {pagination.total} produtos disponíveis
              </p>
            </div>

            {/* Sort Controls */}
            <form method="GET" action="/produtos" className="flex items-center gap-2">
              {categorySlug && <input type="hidden" name="categorySlug" value={categorySlug} />}
              {search && <input type="hidden" name="q" value={search} />}
              <label htmlFor="sort-select" className="text-xs font-semibold text-slate-600 dark:text-slate-400 shrink-0">
                Ordenar por:
              </label>
              <select
                id="sort-select"
                name="sort"
                defaultValue={sort}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="newest">Mais Recentes</option>
                <option value="price_asc">Menor Preço</option>
                <option value="price_desc">Maior Preço</option>
                <option value="name_asc">Nome (A-Z)</option>
              </select>
              <button
                type="submit"
                className="px-3 py-2 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-emerald-600 transition-colors"
              >
                Filtrar
              </button>
            </form>
          </div>
        </div>

        {/* Layout: Sidebar Categories + Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          {/* Sidebar */}
          <aside className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-6">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-emerald-600" /> Categorias
              </h3>
              <div className="space-y-1">
                <Link
                  href="/produtos"
                  className={`block px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    !categorySlug
                      ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  Todas as Categorias
                </Link>
                {categories.map((c) => (
                  <Link
                    key={c.id}
                    href={`/produtos?categorySlug=${c.slug}`}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                      categorySlug === c.slug
                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span>{c.name}</span>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">
                      {c.productsCount}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </aside>

          {/* Product Grid & Pagination */}
          <div className="lg:col-span-3 space-y-8">
            {products.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
                <Search className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Nenhum produto encontrado</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Tente alterar seus termos de busca ou selecionar outra categoria.
                </p>
                <Link
                  href="/produtos"
                  className="mt-4 inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors"
                >
                  Ver Todos os Produtos
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {products.map((product) => (
                  <ProductCard key={product.id} {...product} />
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-6">
                {page > 1 && (
                  <Link
                    href={`/produtos?page=${page - 1}${categorySlug ? `&categorySlug=${categorySlug}` : ""}${
                      search ? `&q=${search}` : ""
                    }&sort=${sort}`}
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
                    href={`/produtos?page=${page + 1}${categorySlug ? `&categorySlug=${categorySlug}` : ""}${
                      search ? `&q=${search}` : ""
                    }&sort=${sort}`}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
