import React from "react";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { formatCurrency, formatPercent, formatDate } from "@/lib/formatters";
import {
  Package,
  ShoppingCart,
  Users,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  ArrowUpRight,
  Truck,
  Coins,
  ArrowUpCircle,
  ArrowDownCircle,
  BarChart3,
  CalendarCheck,
  Receipt,
  PieChart,
} from "lucide-react";
import Link from "next/link";
import { OrderStatus } from "@prisma/client";

// Status Badge Helper
function getStatusBadge(status: OrderStatus) {
  switch (status) {
    case OrderStatus.PAID:
      return <Badge variant="success">Pago</Badge>;
    case OrderStatus.DELIVERED:
      return <Badge variant="success">Entregue</Badge>;
    case OrderStatus.SHIPPED:
      return <Badge variant="info">Enviado</Badge>;
    case OrderStatus.SENT_TO_SUPPLIER:
      return <Badge variant="info">No Fornecedor</Badge>;
    case OrderStatus.PROCESSING:
      return <Badge variant="info">Processando</Badge>;
    case OrderStatus.AWAITING_PAYMENT:
      return <Badge variant="warning">Aguardando Pagamento</Badge>;
    case OrderStatus.CANCELLED:
      return <Badge variant="danger">Cancelado</Badge>;
    case OrderStatus.REFUNDED:
      return <Badge variant="danger">Reembolsado</Badge>;
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
}

export default async function AdminDashboardPage() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Consultas reais e agregadas no PostgreSQL
  const [
    activeProductsCount,
    totalProductsCount,
    suppliersCount,
    categoriesCount,
    customersCount,
    allOrders,
    ordersTodayCount,
    allActiveProducts,
    recentOrders,
    expensesSum,
  ] = await Promise.all([
    prisma.product.count({ where: { status: "ACTIVE" } }),
    prisma.product.count(),
    prisma.supplier.count(),
    prisma.category.count(),
    prisma.customer.count(),
    prisma.order.findMany({
      select: {
        id: true,
        status: true,
        totalAmount: true,
        totalCostAmount: true,
        estimatedProfit: true,
        createdAt: true,
      },
    }),
    prisma.order.count({
      where: {
        createdAt: {
          gte: startOfToday,
        },
      },
    }),
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        sku: true,
        costPrice: true,
        sellingPrice: true,
        stock: true,
      },
    }),
    prisma.order.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        items: true,
      },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
    }),
  ]);

  // Cálculos de Pedidos e Financeiro
  const validOrders = allOrders.filter(
    (o) => o.status !== OrderStatus.CANCELLED && o.status !== OrderStatus.REFUNDED
  );

  const totalRevenue = validOrders.reduce((acc, o) => acc + Number(o.totalAmount), 0);
  const totalCost = validOrders.reduce((acc, o) => acc + Number(o.totalCostAmount), 0);
  const totalGrossProfit = totalRevenue - totalCost;
  const totalExpenses = Number(expensesSum._sum.amount || 0);
  const totalOperatingProfit = totalGrossProfit - totalExpenses;
  const averageTicket = validOrders.length > 0 ? totalRevenue / validOrders.length : 0;
  const operatingMargin = totalRevenue > 0 ? (totalOperatingProfit / totalRevenue) * 100 : 0;

  // Status breakdown
  const statusCounts: Record<string, number> = {};
  Object.values(OrderStatus).forEach((st) => {
    statusCounts[st] = 0;
  });
  allOrders.forEach((o) => {
    statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
  });

  // Cálculos do Catálogo
  let totalCatalogCostValue = 0;
  let totalCatalogPotentialRevenue = 0;
  let totalMarginSum = 0;

  const productsWithMargins = allActiveProducts.map((p) => {
    const cost = Number(p.costPrice);
    const selling = Number(p.sellingPrice);
    const profit = selling - cost;
    const margin = selling > 0 ? (profit / selling) * 100 : 0;
    const markup = cost > 0 ? (profit / cost) * 100 : 0;

    totalCatalogCostValue += cost * p.stock;
    totalCatalogPotentialRevenue += selling * p.stock;
    totalMarginSum += margin;

    return {
      ...p,
      cost,
      selling,
      profit,
      margin,
      markup,
    };
  });

  const averageActiveMargin =
    productsWithMargins.length > 0 ? totalMarginSum / productsWithMargins.length : 0;

  const sortedByMargin = [...productsWithMargins].sort((a, b) => b.margin - a.margin);
  const topMarginProducts = sortedByMargin.slice(0, 3);
  const lowestMarginProducts = sortedByMargin.slice(-3).reverse();

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Visão Geral do DropHub
            <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" /> PostgreSQL Online
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Métricas comerciais, financeiras e operacionais calculadas com precisão em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/pedidos"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
          >
            <ShoppingCart className="w-3.5 h-3.5" /> Ver Pedidos ({allOrders.length})
          </Link>
          <Link
            href="/admin/clientes"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <Users className="w-3.5 h-3.5" /> Clientes ({customersCount})
          </Link>
        </div>
      </div>

      {/* Grid 1: Métricas Comerciais e Financeiras de Pedidos */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <Receipt className="w-4 h-4 text-emerald-400" /> Operação Comercial & Faturamento Real
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Receita Bruta Realizada"
            value={formatCurrency(totalRevenue)}
            subtitle={`${validOrders.length} pedidos válidos no histórico`}
            icon={<DollarSign className="w-5 h-5 text-blue-400" />}
            className="bg-slate-900 border-slate-800"
          />

          <StatCard
            title="Lucro Bruto (Vendas - CPV)"
            value={formatCurrency(totalGrossProfit)}
            subtitle={`Margem Bruta: ${formatPercent(totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0)}`}
            icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
            className="bg-slate-900 border-slate-800"
          />

          <StatCard
            title="Lucro Operacional Gerencial"
            value={formatCurrency(totalOperatingProfit)}
            subtitle={`Margem Op.: ${formatPercent(operatingMargin)} (deduz ${formatCurrency(totalExpenses)} de despesas)`}
            icon={<Coins className="w-5 h-5 text-amber-400" />}
            className="bg-slate-900 border-slate-800"
          />

          <StatCard
            title="Ticket Médio"
            value={formatCurrency(averageTicket)}
            subtitle={`${ordersTodayCount} pedidos hoje | ${allOrders.length} totais`}
            icon={<CalendarCheck className="w-5 h-5 text-purple-400" />}
            className="bg-slate-900 border-slate-800"
          />
        </div>
      </div>

      {/* Grid 2: Distribuição de Pedidos por Status */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="border-slate-800">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-white text-sm">Distribuição de Pedidos por Status</CardTitle>
          </div>
          <span className="text-xs text-slate-400">Total: {allOrders.length} pedidos</span>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-center">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div
                key={status}
                className="p-2.5 rounded-lg bg-slate-850 border border-slate-800 hover:border-slate-700 transition-colors"
              >
                <div className="text-lg font-bold text-white font-mono">{count}</div>
                <div className="mt-1">{getStatusBadge(status as OrderStatus)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Grid 3: Métricas de Catálogo & Margem */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-emerald-400" /> Métricas Operacionais do Catálogo
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Margem Média do Catálogo"
            value={formatPercent(averageActiveMargin)}
            subtitle="Média dos produtos ativos"
            icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
            className="bg-slate-900 border-slate-800"
          />

          <StatCard
            title="Valor de Custo em Estoque"
            value={formatCurrency(totalCatalogCostValue)}
            subtitle="Investimento total em estoque"
            icon={<Coins className="w-5 h-5 text-amber-400" />}
            className="bg-slate-900 border-slate-800"
          />

          <StatCard
            title="Potencial de Venda (Estoque)"
            value={formatCurrency(totalCatalogPotentialRevenue)}
            subtitle="Faturamento potencial bruto"
            icon={<DollarSign className="w-5 h-5 text-blue-400" />}
            className="bg-slate-900 border-slate-800"
          />

          <StatCard
            title="Produtos Ativos / Total"
            value={`${activeProductsCount} / ${totalProductsCount}`}
            subtitle={`${suppliersCount} fornecedores | ${categoriesCount} categorias`}
            icon={<Package className="w-5 h-5 text-purple-400" />}
            className="bg-slate-900 border-slate-800"
          />
        </div>
      </div>

      {/* Grid 4: Maiores e Menores Margens do Catálogo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Margens */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="border-slate-800">
            <div className="flex items-center gap-2">
              <ArrowUpCircle className="w-4 h-4 text-emerald-400" />
              <CardTitle className="text-white text-sm">Produtos com Maior Margem (%)</CardTitle>
            </div>
            <span className="text-xs text-emerald-400 font-semibold">Alta Rentabilidade</span>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody className="divide-slate-800 text-slate-300 text-xs">
                {topMarginProducts.map((p) => (
                  <TableRow key={p.id} className="border-slate-800 hover:bg-slate-800/40">
                    <TableCell className="font-medium text-white max-w-xs truncate">
                      {p.name}
                    </TableCell>
                    <TableCell className="font-mono text-slate-400">
                      Custo: {formatCurrency(p.cost)}
                    </TableCell>
                    <TableCell className="font-mono text-white">
                      Venda: {formatCurrency(p.selling)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800">
                        {formatPercent(p.margin)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Menores Margens */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="border-slate-800">
            <div className="flex items-center gap-2">
              <ArrowDownCircle className="w-4 h-4 text-amber-400" />
              <CardTitle className="text-white text-sm">Produtos com Menor Margem (%)</CardTitle>
            </div>
            <span className="text-xs text-amber-400 font-semibold">Giro / Oportunidade</span>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody className="divide-slate-800 text-slate-300 text-xs">
                {lowestMarginProducts.map((p) => (
                  <TableRow key={p.id} className="border-slate-800 hover:bg-slate-800/40">
                    <TableCell className="font-medium text-white max-w-xs truncate">
                      {p.name}
                    </TableCell>
                    <TableCell className="font-mono text-slate-400">
                      Custo: {formatCurrency(p.cost)}
                    </TableCell>
                    <TableCell className="font-mono text-white">
                      Venda: {formatCurrency(p.selling)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-950 border border-amber-800">
                        {formatPercent(p.margin)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Pedidos Recentes do Banco */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="border-slate-800">
          <div>
            <CardTitle className="text-white text-base">Últimos Pedidos Registrados</CardTitle>
            <p className="text-xs text-slate-400 mt-0.5">
              Histórico com atualização de status auditada ({allOrders.length} pedidos totais)
            </p>
          </div>
          <Link
            href="/admin/pedidos"
            className="text-xs text-emerald-400 hover:underline inline-flex items-center gap-1"
          >
            Ver Todos os Pedidos <ArrowUpRight className="w-3 h-3" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-850 border-slate-800 text-slate-400">
              <TableRow className="border-slate-800">
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead>Valor Total</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-slate-800 text-slate-300">
              {recentOrders.map((order) => (
                <TableRow key={order.id} className="hover:bg-slate-800/40 border-slate-800">
                  <TableCell className="font-mono text-xs font-semibold text-emerald-400">
                    {order.orderNumber}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-medium text-white">{order.customer.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{order.customer.email}</div>
                  </TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell className="text-xs text-slate-400">
                    {order.items.map((it) => `${it.quantity}x ${it.name}`).join(", ")}
                  </TableCell>
                  <TableCell className="font-medium text-white text-xs font-mono">
                    {formatCurrency(Number(order.totalAmount))}
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">
                    {formatDate(order.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
