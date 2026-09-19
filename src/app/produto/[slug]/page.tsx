import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/storefront/Header";
import { Footer } from "@/components/storefront/Footer";
import { ProductView } from "./ProductView";
import { getStorefrontProductBySlug } from "@/modules/storefront/service";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(props: Props) {
  const { slug } = await props.params;
  const product = await getStorefrontProductBySlug(slug);

  if (!product) return { title: "Produto não encontrado - DropHub" };

  return {
    title: `${product.name} - DropHub Store`,
    description: product.shortDescription || product.description.slice(0, 160),
    openGraph: {
      title: product.name,
      description: product.shortDescription || product.description.slice(0, 160),
      images: product.images[0]?.url ? [{ url: product.images[0].url }] : [],
    },
  };
}

export default async function ProductDetailPage(props: Props) {
  const { slug } = await props.params;
  const product = await getStorefrontProductBySlug(slug);

  if (!product) notFound();

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-6 truncate">
          <Link href="/" className="hover:text-emerald-600 transition-colors shrink-0">Início</Link>
          <span>/</span>
          <Link href="/produtos" className="hover:text-emerald-600 transition-colors shrink-0">Produtos</Link>
          {product.category && (
            <>
              <span>/</span>
              <Link href={`/categoria/${product.category.slug}`} className="hover:text-emerald-600 transition-colors shrink-0">
                {product.category.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-slate-800 dark:text-slate-200 font-semibold truncate">{product.name}</span>
        </div>

        {/* Product Interactive View */}
        <ProductView product={product} />
      </main>

      <Footer />
    </div>
  );
}
