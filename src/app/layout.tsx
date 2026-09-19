import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/storefront/CartContext";
import { CartDrawer } from "@/components/storefront/CartDrawer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "DropHub - Loja Oficial & Plataforma de E-commerce",
  description: "Plataforma completa e profissional para operação de dropshipping e comércio eletrônico com os melhores produtos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased font-sans">
        <CartProvider>
          {children}
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}

