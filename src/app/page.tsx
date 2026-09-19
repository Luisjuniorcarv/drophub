import Link from "next/link";
import { Header } from "@/components/storefront/Header";
import { Footer } from "@/components/storefront/Footer";
import { ProductCard } from "@/components/storefront/ProductCard";
import { getStorefrontHome } from "@/modules/storefront/service";
import { ArrowRight, Sparkles, TrendingUp, ShieldCheck, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { categories, featuredProducts, recentProducts } = await getStorefrontHome();

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-emerald-950 via-slate-900 to-slate-950 text-white py-16 sm:py-24">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.15),transparent_50%)]" />
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-6 backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Novidades & Ofertas Especiais de Lançamento
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight max-w-4xl mx-auto leading-tight">
              Os Melhores Produtos com{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                Entrega Rápida & Garantida
              </span>
            </h1>

            <p className="mt-6 text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Descubra tendências selecionadas com preços exclusivos, pagamento facilitado via Pix com aprovação imediata ou até 12x no cartão.
            </p>

            <div className="mt-10 flex flex-wrap gap-4 justify-center">
              <Link
                href="/produtos"
                className="px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-base shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all flex items-center gap-2"
              >
                Explorar Todos os Produtos <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/busca"
                className="px-8 py-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-white font-semibold text-base border border-slate-700 backdrop-blur-sm transition-all"
              >
                Buscar Ofertas
              </Link>
            </div>
          </div>
        </section>

        {/* Categories Bar */}
        {categories.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-20">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 shadow-xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" /> Navegue por Categorias
                </h2>
                <Link href="/produtos" className="text-xs text-emerald-600 font-semibold hover:underline">
                  Ver Todas
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/categoria/${cat.slug}`}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-100 dark:border-slate-800 text-center transition-all group"
                  >
                    <span className="block font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate">
                      {cat.name}
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5 block">
                      {cat.productsCount} {cat.productsCount === 1 ? "produto" : "produtos"}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Featured Products */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-end justify-between mb-8">
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Destaques da Loja</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
                Produtos Mais Populares
              </h2>
            </div>
            <Link
              href="/produtos"
              className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 group"
            >
              Ver catálogo completo <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {featuredProducts.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <p className="text-slate-500">Nenhum produto cadastrado no catálogo.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} {...product} />
              ))}
            </div>
          )}
        </section>

        {/* Value Proposition Banner */}
        <section className="bg-emerald-900 text-white py-12 my-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-800 flex items-center justify-center shrink-0">
                <Zap className="w-6 h-6 text-emerald-300" />
              </div>
              <div>
                <h4 className="font-bold text-lg">Pix Instantâneo</h4>
                <p className="text-xs text-emerald-200 mt-1">
                  Pague com QR Code e tenha a aprovação do seu pedido em segundos.
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-800 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 text-emerald-300" />
              </div>
              <div>
                <h4 className="font-bold text-lg">Compra Protegida</h4>
                <p className="text-xs text-emerald-200 mt-1">
                  Seus dados e pagamentos protegidos pelos mais altos padrões de segurança.
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-800 flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6 text-emerald-300" />
              </div>
              <div>
                <h4 className="font-bold text-lg">Rastreamento Transparente</h4>
                <p className="text-xs text-emerald-200 mt-1">
                  Acompanhe cada etapa do envio direto na sua conta ou via e-mail.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Products */}
        {recentProducts.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="flex items-end justify-between mb-8">
              <div>
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Novos Lançamentos</span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
                  Acabaram de Chegar
                </h2>
              </div>
              <Link
                href="/produtos?sort=newest"
                className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 group"
              >
                Ver novidades <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {recentProducts.map((product) => (
                <ProductCard key={product.id} {...product} />
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
