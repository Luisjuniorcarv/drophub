"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  BarChart3,
  Calendar,
  ArrowLeft,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Info,
  Download,
  Receipt,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatPercent, formatDate } from "@/lib/formatters";
import { DREStatement, DailyFinancialItem, PeriodType } from "@/modules/finance/types";

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "month", label: "Mês Atual" },
  { value: "last_month", label: "Mês Anterior" },
  { value: "custom", label: "Personalizado" },
];

export default function DREPage() {
  const [period, setPeriod] = useState<PeriodType>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [dreData, setDreData] = useState<DREStatement | null>(null);
  const [dailySeries, setDailySeries] = useState<DailyFinancialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDRE = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append("period", period);
      if (period === "custom") {
        if (customStart) params.append("startDate", customStart);
        if (customEnd) params.append("endDate", customEnd);
      }

      const res = await fetch(`/api/admin/finance/dre?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Erro ao carregar DRE.");
      }

      setDreData(json.data);
      setDailySeries(json.data.dailySeries || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [period, customStart, customEnd]);

  useEffect(() => {
    fetchDRE();
  }, [fetchDRE]);

  const metrics = dreData?.metrics;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin/financeiro"
              className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Hub Financeiro
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            DRE Gerencial Simplificado
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold">
              Competência & Caixa
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Demonstrativo de Resultado do Exercício com segregação de receita, CPV e despesas operacionais.
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                period === opt.value
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Inputs if custom selected */}
      {period === "custom" && (
        <Card className="bg-slate-900 border-slate-800 p-4">
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <span>Data Inicial:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1 text-white font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <span>Data Final:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1 text-white font-mono"
              />
            </div>
            <Button
              onClick={fetchDRE}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-1 h-auto"
            >
              Filtrar
            </Button>
          </div>
        </Card>
      )}

      {/* Legal & Educational Alert */}
      <div className="p-3.5 rounded-lg bg-blue-950/40 border border-blue-800/60 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-200 leading-relaxed">
          <span className="font-semibold text-white">Aviso Gerencial:</span> Este relatório é um
          Demonstrativo de Resultados gerencial para controle operacional e tomada de decisões
          estratégicas do dropshipping. Não substitui contabilidade formal ou livro fiscal.
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center text-slate-400 text-sm animate-pulse">
          Calculando demonstrativo financeiro consolidado no banco de dados...
        </div>
      ) : error ? (
        <div className="p-8 text-center text-rose-400 text-sm">{error}</div>
      ) : metrics ? (
        <div className="space-y-6">
          {/* Top 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-slate-900 border-slate-800 p-4">
              <span className="text-xs text-slate-400 font-medium">Receita Líquida</span>
              <div className="text-2xl font-bold font-mono text-white mt-1">
                {formatCurrency(metrics.netRevenue)}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {metrics.ordersCount} pedidos válidos | Ticket Médio: {formatCurrency(metrics.averageTicket)}
              </span>
            </Card>

            <Card className="bg-slate-900 border-slate-800 p-4">
              <span className="text-xs text-slate-400 font-medium">Lucro Bruto (Margem Bruta)</span>
              <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                {formatCurrency(metrics.grossProfit)}
              </div>
              <span className="text-[11px] text-emerald-500 font-semibold mt-1 block">
                {formatPercent(metrics.grossMarginPercentage)} sobre a receita
              </span>
            </Card>

            <Card className="bg-slate-900 border-slate-800 p-4">
              <span className="text-xs text-slate-400 font-medium">Despesas Operacionais Totais</span>
              <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
                {formatCurrency(metrics.totalExpenses)}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Fixas + Variáveis do período
              </span>
            </Card>

            <Card className="bg-slate-900 border-slate-800 p-4">
              <span className="text-xs text-slate-400 font-medium">Lucro Operacional Líquido</span>
              <div
                className={`text-2xl font-bold font-mono mt-1 ${
                  metrics.operatingProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {formatCurrency(metrics.operatingProfit)}
              </div>
              <span
                className={`text-[11px] font-semibold mt-1 block ${
                  metrics.operatingProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                Margem Operacional: {formatPercent(metrics.operatingMarginPercentage)}
              </span>
            </Card>
          </div>

          {/* DRE Statement Table Formatted like Classic Accounting */}
          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <CardHeader className="border-slate-800 bg-slate-850/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  <div>
                    <CardTitle className="text-white text-base">Demonstrativo de Resultado</CardTitle>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Período de Apuração: {dreData?.period.label}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono text-slate-400">Moeda: BRL (R$)</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-950 text-slate-400 text-xs border-slate-800">
                  <TableRow className="border-slate-800">
                    <TableHead className="w-2/3">Linha / Rubrica Contábil</TableHead>
                    <TableHead className="text-right">Composição</TableHead>
                    <TableHead className="text-right">Valor Consolidado (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-slate-800 text-xs font-mono">
                  {/* 1. Receita Bruta */}
                  <TableRow className="border-slate-800 bg-slate-900/60 font-semibold text-white">
                    <TableCell className="font-sans text-emerald-400">
                      (+) RECEITA BRUTA DE VENDAS
                    </TableCell>
                    <TableCell className="text-right text-slate-400">100.0%</TableCell>
                    <TableCell className="text-right text-white">
                      {formatCurrency(metrics.grossRevenue)}
                    </TableCell>
                  </TableRow>

                  {/* 1.1 Deduções */}
                  <TableRow className="border-slate-850 text-slate-400">
                    <TableCell className="pl-6 font-sans">(-) Descontos Concedidos</TableCell>
                    <TableCell className="text-right text-slate-500">—</TableCell>
                    <TableCell className="text-right text-rose-400">
                      - {formatCurrency(metrics.discounts)}
                    </TableCell>
                  </TableRow>

                  <TableRow className="border-slate-850 text-slate-400">
                    <TableCell className="pl-6 font-sans">(-) Pedidos Reembolsados</TableCell>
                    <TableCell className="text-right text-slate-500">—</TableCell>
                    <TableCell className="text-right text-rose-400">
                      - {formatCurrency(metrics.refunds)}
                    </TableCell>
                  </TableRow>

                  {/* 2. Receita Líquida */}
                  <TableRow className="border-slate-800 bg-slate-850/60 font-semibold text-white">
                    <TableCell className="font-sans text-blue-400">
                      (=) RECEITA OPERACIONAL LÍQUIDA
                    </TableCell>
                    <TableCell className="text-right text-slate-400">
                      {formatPercent(
                        metrics.grossRevenue > 0
                          ? (metrics.netRevenue / metrics.grossRevenue) * 100
                          : 0
                      )}
                    </TableCell>
                    <TableCell className="text-right text-white font-bold">
                      {formatCurrency(metrics.netRevenue)}
                    </TableCell>
                  </TableRow>

                  {/* 3. CPV */}
                  <TableRow className="border-slate-850 text-slate-400">
                    <TableCell className="pl-6 font-sans">
                      (-) Custo das Mercadorias / Produtos Vendidos (CPV Snapshot)
                    </TableCell>
                    <TableCell className="text-right text-slate-500">
                      {formatPercent(
                        metrics.netRevenue > 0 ? (metrics.cpv / metrics.netRevenue) * 100 : 0
                      )}
                    </TableCell>
                    <TableCell className="text-right text-rose-400">
                      - {formatCurrency(metrics.cpv)}
                    </TableCell>
                  </TableRow>

                  {/* 4. Lucro Bruto */}
                  <TableRow className="border-slate-800 bg-slate-850/80 font-bold text-white">
                    <TableCell className="font-sans text-emerald-400">
                      (=) LUCRO BRUTO OPERACIONAL
                    </TableCell>
                    <TableCell className="text-right text-emerald-400">
                      {formatPercent(metrics.grossMarginPercentage)}
                    </TableCell>
                    <TableCell className="text-right text-emerald-400">
                      {formatCurrency(metrics.grossProfit)}
                    </TableCell>
                  </TableRow>

                  {/* 5. Despesas Variáveis */}
                  <TableRow className="border-slate-850 text-slate-300 font-semibold">
                    <TableCell className="pl-4 font-sans text-amber-400">
                      (-) DESPESAS VARIÁVEIS DE VENDA
                    </TableCell>
                    <TableCell className="text-right text-slate-500">—</TableCell>
                    <TableCell className="text-right text-amber-400">
                      - {formatCurrency(metrics.variableExpenses.total)}
                    </TableCell>
                  </TableRow>

                  <TableRow className="border-slate-850 text-slate-400">
                    <TableCell className="pl-8 font-sans">Marketing & Tráfego Pago (Ads)</TableCell>
                    <TableCell className="text-right text-slate-500">—</TableCell>
                    <TableCell className="text-right text-slate-400">
                      - {formatCurrency(metrics.variableExpenses.marketingAds)}
                    </TableCell>
                  </TableRow>

                  <TableRow className="border-slate-850 text-slate-400">
                    <TableCell className="pl-8 font-sans">Logística & Embalagens Extras</TableCell>
                    <TableCell className="text-right text-slate-500">—</TableCell>
                    <TableCell className="text-right text-slate-400">
                      - {formatCurrency(metrics.variableExpenses.logisticsExtra)}
                    </TableCell>
                  </TableRow>

                  <TableRow className="border-slate-850 text-slate-400">
                    <TableCell className="pl-8 font-sans">Impostos & Taxas Variáveis</TableCell>
                    <TableCell className="text-right text-slate-500">—</TableCell>
                    <TableCell className="text-right text-slate-400">
                      - {formatCurrency(metrics.variableExpenses.taxes)}
                    </TableCell>
                  </TableRow>

                  {/* 6. Despesas Operacionais Fixas */}
                  <TableRow className="border-slate-850 text-slate-300 font-semibold">
                    <TableCell className="pl-4 font-sans text-amber-400">
                      (-) DESPESAS OPERACIONAIS FIXAS & ADM
                    </TableCell>
                    <TableCell className="text-right text-slate-500">—</TableCell>
                    <TableCell className="text-right text-amber-400">
                      - {formatCurrency(metrics.operationalExpenses.total)}
                    </TableCell>
                  </TableRow>

                  <TableRow className="border-slate-850 text-slate-400">
                    <TableCell className="pl-8 font-sans">Ferramentas, SaaS & Softwares</TableCell>
                    <TableCell className="text-right text-slate-500">—</TableCell>
                    <TableCell className="text-right text-slate-400">
                      - {formatCurrency(metrics.operationalExpenses.tools)}
                    </TableCell>
                  </TableRow>

                  <TableRow className="border-slate-850 text-slate-400">
                    <TableCell className="pl-8 font-sans">Domínio & Servidores VPS</TableCell>
                    <TableCell className="text-right text-slate-500">—</TableCell>
                    <TableCell className="text-right text-slate-400">
                      - {formatCurrency(metrics.operationalExpenses.domain)}
                    </TableCell>
                  </TableRow>

                  <TableRow className="border-slate-850 text-slate-400">
                    <TableCell className="pl-8 font-sans">Outras Despesas Administrativas</TableCell>
                    <TableCell className="text-right text-slate-500">—</TableCell>
                    <TableCell className="text-right text-slate-400">
                      - {formatCurrency(metrics.operationalExpenses.other)}
                    </TableCell>
                  </TableRow>

                  {/* 7. Lucro Operacional Final */}
                  <TableRow className="border-t-2 border-emerald-600 bg-slate-950 font-bold text-sm">
                    <TableCell className="font-sans text-white">
                      (=) RESULTADO OPERACIONAL LÍQUIDO (EBITDA ESTIMADO)
                    </TableCell>
                    <TableCell
                      className={`text-right ${
                        metrics.operatingProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {formatPercent(metrics.operatingMarginPercentage)}
                    </TableCell>
                    <TableCell
                      className={`text-right ${
                        metrics.operatingProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {formatCurrency(metrics.operatingProfit)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Daily Evolution Table */}
          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <CardHeader className="border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white text-base">Evolução Diária do Período</CardTitle>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Histórico detalhado por data de receita, custos e lucro operacional
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-850 border-slate-800 text-slate-400 text-xs">
                  <TableRow className="border-slate-800">
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Receita Bruta</TableHead>
                    <TableHead className="text-right">Deduções</TableHead>
                    <TableHead className="text-right">CPV</TableHead>
                    <TableHead className="text-right">Despesas</TableHead>
                    <TableHead className="text-right">Lucro Diário</TableHead>
                    <TableHead className="text-center">Pedidos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-slate-800 text-xs font-mono text-slate-300">
                  {dailySeries.map((item) => (
                    <TableRow key={item.date} className="border-slate-800 hover:bg-slate-800/40">
                      <TableCell className="font-semibold text-white">
                        {item.formattedDate} <span className="text-slate-500 font-normal">({item.date})</span>
                      </TableCell>
                      <TableCell className="text-right text-slate-200">
                        {formatCurrency(item.grossRevenue)}
                      </TableCell>
                      <TableCell className="text-right text-rose-400">
                        {item.discounts + item.refunds > 0
                          ? `- ${formatCurrency(item.discounts + item.refunds)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right text-slate-400">
                        {item.cpv > 0 ? formatCurrency(item.cpv) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-amber-400">
                        {item.expenses > 0 ? formatCurrency(item.expenses) : "—"}
                      </TableCell>
                      <TableCell
                        className={`text-right font-bold ${
                          item.profit > 0
                            ? "text-emerald-400"
                            : item.profit < 0
                            ? "text-rose-400"
                            : "text-slate-500"
                        }`}
                      >
                        {formatCurrency(item.profit)}
                      </TableCell>
                      <TableCell className="text-center text-slate-400">
                        {item.ordersCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
