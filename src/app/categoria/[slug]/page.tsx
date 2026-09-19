import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/storefront/Header";
import { Footer } from "@/components/storefront/Footer";
import { ProductCard } from "@/components/storefront/ProductCard";
import { prisma } from "@/lib/prisma";
import { getStorefrontProducts } from "@/modules/storefront/service";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
}

export async function generateMetadata(props: Props) {
  const { slug } = await props.params;
  const category = await prisma.category.findFirst({
    where: { slug, active: true },
  });

  if (!category) return { title: "Categoria não encontrada - DropHub" };

  return {
    title: `${category.name} - DropHub Store`,
    description: category.description || `Confira as melhores ofertas e produtos na categoria ${category.name}.`,
  };
}

export default async function CategoryPage(props: Props) {
  const { slug } = await props.params;
  const searchParams = await props.searchParams;
  const sort = (searchParams.sort as any) || "newest";
  const page = Math.max(1, Number(searchParams.page) || 1);

  const category = await prisma.category.findFirst({
    where: { slug, active: true },
  });

  if (!category) notFound();

  const { products, pagination } = await getStorefrontProducts({
    categorySlug: slug,
    sort,
    page,
    limit: 12,
  });

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <Link href="/" className="hover:text-emerald-600 transition-colors">Início</Link>
          <span>/</span>
          <Link href="/produtos" className="hover:text-emerald-600 transition-colors">Produtos</Link>
          <span>/</span>
          <span className="text-emerald-600 font-semibold">{category.name}</span>
        </div>

        {/* Header Category */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 mb-8 shadow-sm">
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            {category.name}
          </h1>
          {category.description && (
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-2 max-w-2xl">
              {category.description}
            </p>
          )}
          <span className="inline-block mt-3 text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full">
            {pagination.total} {pagination.total === 1 ? "produto disponível" : "produtos disponíveis"}
          </span>
        </div>

        {/* Product Grid */}
        {products.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
            <Search className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Nenhum produto nesta categoria</h3>
            <p className="text-xs text-slate-500 mt-1">Explore outras categorias ou volte ao início.</p>
            <Link
              href="/produtos"
              className="mt-4 inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              Ver Catálogo Completo
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
                href={`/categoria/${slug}?page=${page - 1}&sort=${sort}`}
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
                href={`/categoria/${slug}?page=${page + 1}&sort=${sort}`}
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
