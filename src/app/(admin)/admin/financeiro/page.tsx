import React from "react";
import Link from "next/link";
import {
  DollarSign,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  Wallet,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Coins,
  ShieldCheck,
  BarChart3,
  Percent,
  TrendingDown,
  PieChart,
  Tag,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getFinancialDRE, getCashFlow } from "@/modules/finance/service";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { formatCurrency, formatPercent, formatDate } from "@/lib/formatters";

export default async function FinanceHubPage() {
  // Buscar DRE e Caixa consolidados dos últimos 30 dias
  const [dre30d, cashFlow30d, recentExpenses, expensesByCategory] = await Promise.all([
    getFinancialDRE("30d"),
    getCashFlow("30d"),
    prisma.expense.findMany({
      take: 5,
      orderBy: { date: "desc" },
    }),
    prisma.expense.groupBy({
      by: ["category"],
      _sum: { amount: true },
      _count: { id: true },
    }),
  ]);

  const metrics = dre30d.metrics;

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Módulo Financeiro & DRE
            <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Apuração Real (PostgreSQL)
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Visão consolidada de faturamento, custos de produtos vendidos, despesas e lucro operacional.
          </p>
        </div>

        {/* Action Hub Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/financeiro/dre"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Abrir DRE Gerencial
          </Link>
          <Link
            href="/admin/financeiro/despesas"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <Receipt className="w-3.5 h-3.5" /> Gerenciar Despesas
          </Link>
          <Link
            href="/admin/financeiro/fluxo-caixa"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <Wallet className="w-3.5 h-3.5" /> Fluxo de Caixa
          </Link>
        </div>
      </div>

      {/* Grid 1: Quatro Pilares Financeiros (Últimos 30 Dias) */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-emerald-400" /> Resultados Consolidados (Últimos 30 Dias)
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Receita Líquida Realizada"
            value={formatCurrency(metrics.netRevenue)}
            subtitle={`${metrics.ordersCount} vendas válidas | Bruto: ${formatCurrency(metrics.grossRevenue)}`}
            icon={<DollarSign className="w-5 h-5 text-blue-400" />}
            className="bg-slate-900 border-slate-800"
          />

          <StatCard
            title="Lucro Bruto (Margem Bruta)"
            value={formatCurrency(metrics.grossProfit)}
            subtitle={`Margem Bruta: ${formatPercent(metrics.grossMarginPercentage)} (Receita - CPV)`}
            icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
            className="bg-slate-900 border-slate-800"
          />

          <StatCard
            title="Despesas Operacionais"
            value={formatCurrency(metrics.totalExpenses)}
            subtitle={`Fixas: ${formatCurrency(metrics.operationalExpenses.total)} | Variáveis: ${formatCurrency(metrics.variableExpenses.total)}`}
            icon={<TrendingDown className="w-5 h-5 text-amber-400" />}
            className="bg-slate-900 border-slate-800"
          />

          <StatCard
            title="Lucro Operacional Líquido"
            value={formatCurrency(metrics.operatingProfit)}
            subtitle={`Margem Operacional: ${formatPercent(metrics.operatingMarginPercentage)}`}
            icon={<Coins className="w-5 h-5 text-emerald-400" />}
            className="bg-slate-900 border-slate-800"
          />
        </div>
      </div>

      {/* Grid 2: Navegação em Módulos e Resumo de Despesas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card de Atalhos / Navegação */}
        <Card className="bg-slate-900 border-slate-800 lg:col-span-1">
          <CardHeader className="border-slate-800">
            <CardTitle className="text-white text-sm">Ferramentas Financeiras</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <Link
              href="/admin/financeiro/dre"
              className="flex items-center justify-between p-3 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white group-hover:text-emerald-400 transition-colors">
                    DRE Gerencial Completo
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Filtros por dia, mês e demonstrativo detalhado
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </Link>

            <Link
              href="/admin/financeiro/despesas"
              className="flex items-center justify-between p-3 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Receipt className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white group-hover:text-amber-400 transition-colors">
                    Despesas & Custos Fixos
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Lançamento de anúncios, servidores e taxas
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </Link>

            <Link
              href="/admin/financeiro/fluxo-caixa"
              className="flex items-center justify-between p-3 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white group-hover:text-blue-400 transition-colors">
                    Fluxo de Caixa
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Saldo disponível e extrato de recebimentos
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </Link>
          </CardContent>
        </Card>

        {/* Despesas por Categoria */}
        <Card className="bg-slate-900 border-slate-800 lg:col-span-2">
          <CardHeader className="border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-amber-400" />
                <CardTitle className="text-white text-sm">Distribuição de Despesas por Categoria</CardTitle>
              </div>
              <Link
                href="/admin/financeiro/despesas"
                className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
              >
                Ver Lançamentos <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-850 border-slate-800 text-slate-400 text-xs">
                <TableRow className="border-slate-800">
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-center">Lançamentos</TableHead>
                  <TableHead className="text-right">Total Gasto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-slate-800 text-slate-300 text-xs font-mono">
                {expensesByCategory.map((c) => (
                  <TableRow key={c.category} className="border-slate-800 hover:bg-slate-800/40">
                    <TableCell className="font-sans font-medium text-white flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-amber-400" />
                      {c.category}
                    </TableCell>
                    <TableCell className="text-center text-slate-400">
                      {c._count.id}
                    </TableCell>
                    <TableCell className="text-right font-bold text-rose-400">
                      - {formatCurrency(Number(c._sum.amount || 0))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Despesas Recentes */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-400" />
              <CardTitle className="text-white text-sm">Últimas Despesas Registradas</CardTitle>
            </div>
            <Link
              href="/admin/financeiro/despesas"
              className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
            >
              Ver Todas <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-850 border-slate-800 text-slate-400 text-xs">
              <TableRow className="border-slate-800">
                <TableHead>Título</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-slate-800 text-slate-300 text-xs">
              {recentExpenses.map((e) => (
                <TableRow key={e.id} className="border-slate-800 hover:bg-slate-800/40">
                  <TableCell className="font-semibold text-white">{e.title}</TableCell>
                  <TableCell>
                    <Badge variant="neutral">{e.category}</Badge>
                  </TableCell>
                  <TableCell className="text-slate-400 font-mono">{formatDate(e.date)}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-rose-400">
                    - {formatCurrency(Number(e.amount))}
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
