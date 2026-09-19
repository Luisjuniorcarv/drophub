"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Calendar,
  Receipt,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Coins,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { CashFlowStatement, PeriodType } from "@/modules/finance/types";

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "month", label: "Mês Atual" },
  { value: "last_month", label: "Mês Anterior" },
];

export default function CashFlowPage() {
  const [period, setPeriod] = useState<PeriodType>("30d");
  const [cashFlowData, setCashFlowData] = useState<CashFlowStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCashFlow = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ period });
      const res = await fetch(`/api/admin/finance/cash-flow?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Erro ao carregar fluxo de caixa.");
      }

      setCashFlowData(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchCashFlow();
  }, [fetchCashFlow]);

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
            Fluxo de Caixa Operacional
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-normal">
              Entradas x Saídas Reais
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Extrato cronológico de pagamentos recebidos e desembolsos operacionais realizados.
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

      {loading ? (
        <div className="p-16 text-center text-slate-400 text-sm animate-pulse">
          Carregando movimentações de caixa do banco de dados...
        </div>
      ) : error ? (
        <div className="p-8 text-center text-rose-400 text-sm">{error}</div>
      ) : cashFlowData ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-slate-900 border-slate-800 p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-medium">Total de Entradas (Recebimentos)</span>
                <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                  + {formatCurrency(cashFlowData.totalInflow)}
                </div>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Pagamentos aprovados no período
                </span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
              </div>
            </Card>

            <Card className="bg-slate-900 border-slate-800 p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-medium">Total de Saídas (Desembolsos)</span>
                <div className="text-2xl font-bold font-mono text-rose-400 mt-1">
                  - {formatCurrency(cashFlowData.totalOutflow)}
                </div>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Despesas operacionais e custos
                </span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5 text-rose-400" />
              </div>
            </Card>

            <Card className="bg-slate-900 border-slate-800 p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-medium">Saldo Líquido de Caixa</span>
                <div
                  className={`text-2xl font-bold font-mono mt-1 ${
                    cashFlowData.netCashBalance >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {formatCurrency(cashFlowData.netCashBalance)}
                </div>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  {cashFlowData.period.label}
                </span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                <Coins className="w-5 h-5 text-amber-400" />
              </div>
            </Card>
          </div>

          {/* Timeline Table */}
          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <CardHeader className="border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white text-base">Extrato de Movimentações de Caixa</CardTitle>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {cashFlowData.entries.length} lançamentos registrados no período
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {cashFlowData.entries.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <Wallet className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-300">
                    Nenhuma movimentação de caixa no período selecionado.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-850 border-slate-800 text-slate-400 text-xs">
                    <TableRow className="border-slate-800">
                      <TableHead>Tipo</TableHead>
                      <TableHead>Data / Hora</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-slate-800 text-xs font-mono text-slate-300">
                    {cashFlowData.entries.map((item) => (
                      <TableRow key={item.id} className="border-slate-800 hover:bg-slate-800/40">
                        <TableCell>
                          {item.type === "INFLOW" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[11px] font-sans font-semibold">
                              <ArrowDownLeft className="w-3 h-3" /> Entrada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 text-[11px] font-sans font-semibold">
                              <ArrowUpRight className="w-3 h-3" /> Saída
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-400">{formatDate(item.date)}</TableCell>
                        <TableCell className="font-sans text-slate-300">{item.category}</TableCell>
                        <TableCell className="font-sans text-white font-medium max-w-sm truncate">
                          {item.description}
                        </TableCell>
                        <TableCell
                          className={`text-right font-bold ${
                            item.type === "INFLOW" ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {item.type === "INFLOW" ? "+" : "-"} {formatCurrency(item.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
