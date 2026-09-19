"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import {
  calculateAdvancedPricing,
  calculatePriceFromMargin,
  calculatePriceFromMarkup,
  CostBreakdown,
} from "@/lib/finance-math";
import {
  Calculator,
  HelpCircle,
  TrendingUp,
  DollarSign,
  Percent,
  Check,
  RotateCcw,
} from "lucide-react";

interface MarginCalculatorWidgetProps {
  initialCost?: number;
  initialPrice?: number;
  onPriceChange?: (newPrice: number) => void;
  className?: string;
}

export function MarginCalculatorWidget({
  initialCost = 0,
  initialPrice = 0,
  onPriceChange,
  className,
}: MarginCalculatorWidgetProps) {
  const [productCost, setProductCost] = useState<number>(initialCost);
  const [sellingPrice, setSellingPrice] = useState<number>(initialPrice);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [gatewayFee, setGatewayFee] = useState<number>(0);
  const [taxes, setTaxes] = useState<number>(0);
  const [adSpend, setAdSpend] = useState<number>(0);
  const [otherCosts, setOtherCosts] = useState<number>(0);

  // Modo de Cálculo Reverso
  const [targetMargin, setTargetMargin] = useState<number>(50);
  const [targetMarkup, setTargetMarkup] = useState<number>(100);

  useEffect(() => {
    setProductCost(initialCost);
  }, [initialCost]);

  useEffect(() => {
    setSellingPrice(initialPrice);
  }, [initialPrice]);

  const costs: CostBreakdown = {
    productCost,
    shippingCost,
    gatewayFee,
    taxes,
    adSpend,
    otherCosts,
  };

  const metrics = calculateAdvancedPricing(costs, sellingPrice);

  const priceByMargin = calculatePriceFromMargin(metrics.totalCost, targetMargin);
  const priceByMarkup = calculatePriceFromMarkup(metrics.totalCost, targetMarkup);

  const applyCalculatedPrice = (price: number) => {
    setSellingPrice(price);
    if (onPriceChange) onPriceChange(price);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              Calculadora de Margem & Precificação
            </h3>
            <p className="text-xs text-slate-400">
              Simulação de custos diretos, margem líquida e markup em tempo real
            </p>
          </div>
        </div>
      </div>

      {/* Grid de Custos Detalhados */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          1. Detalhamento de Custos Diretos
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Input
            label="Custo Fornecedor (R$)"
            type="number"
            step="0.01"
            min="0"
            value={productCost || ""}
            onChange={(e) => setProductCost(parseFloat(e.target.value) || 0)}
            className="bg-slate-950 border-slate-800 text-white"
          />
          <Input
            label="Frete Estimado (R$)"
            type="number"
            step="0.01"
            min="0"
            value={shippingCost || ""}
            onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
            className="bg-slate-950 border-slate-800 text-white"
          />
          <Input
            label="Taxa Gateway (R$)"
            type="number"
            step="0.01"
            min="0"
            value={gatewayFee || ""}
            onChange={(e) => setGatewayFee(parseFloat(e.target.value) || 0)}
            className="bg-slate-950 border-slate-800 text-white"
          />
          <Input
            label="Impostos / DAS (R$)"
            type="number"
            step="0.01"
            min="0"
            value={taxes || ""}
            onChange={(e) => setTaxes(parseFloat(e.target.value) || 0)}
            className="bg-slate-950 border-slate-800 text-white"
          />
          <Input
            label="Custo Anúncios CPA (R$)"
            type="number"
            step="0.01"
            min="0"
            value={adSpend || ""}
            onChange={(e) => setAdSpend(parseFloat(e.target.value) || 0)}
            className="bg-slate-950 border-slate-800 text-white"
          />
          <Input
            label="Outros Custos (R$)"
            type="number"
            step="0.01"
            min="0"
            value={otherCosts || ""}
            onChange={(e) => setOtherCosts(parseFloat(e.target.value) || 0)}
            className="bg-slate-950 border-slate-800 text-white"
          />
        </div>
      </div>

      {/* Preço de Venda Atual e Resultado */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          2. Preço de Venda & Indicadores em Tempo Real
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <Input
            label="Preço de Venda Praticado (R$)"
            type="number"
            step="0.01"
            min="0"
            value={sellingPrice || ""}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              setSellingPrice(val);
              if (onPriceChange) onPriceChange(val);
            }}
            className="bg-slate-950 border-slate-800 text-white font-bold text-base text-emerald-400"
          />

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">Custo Total Consolidado:</span>
            <span className="text-sm font-bold text-white font-mono">
              {formatCurrency(metrics.totalCost)}
            </span>
          </div>
        </div>
      </div>

      {/* Cards de Métricas em Tempo Real */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
        {/* Lucro Líquido */}
        <div
          className={`p-3.5 rounded-xl border ${
            metrics.isProfitable
              ? "bg-emerald-950/40 border-emerald-800/80 text-emerald-300"
              : "bg-rose-950/40 border-rose-800/80 text-rose-300"
          }`}
        >
          <span className="text-[11px] font-semibold uppercase block opacity-80">
            Lucro Líquido
          </span>
          <span className="text-lg font-black font-mono mt-1 block">
            {formatCurrency(metrics.profit)}
          </span>
        </div>

        {/* Margem */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-white">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-slate-400 block">
              Margem (% Venda)
            </span>
            <span
              title="Margem = (Lucro / Preço de Venda) * 100"
              className="text-slate-500 hover:text-slate-300 cursor-help"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </span>
          </div>
          <span className="text-lg font-black font-mono text-emerald-400 mt-1 block">
            {formatPercent(metrics.marginPercentage)}
          </span>
        </div>

        {/* Markup % */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-white">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-slate-400 block">
              Markup (% Custo)
            </span>
            <span
              title="Markup = (Lucro / Custo Total) * 100"
              className="text-slate-500 hover:text-slate-300 cursor-help"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </span>
          </div>
          <span className="text-lg font-black font-mono text-blue-400 mt-1 block">
            {formatPercent(metrics.markupPercentage)}
          </span>
        </div>

        {/* Multiplicador */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-white">
          <span className="text-[11px] font-semibold uppercase text-slate-400 block">
            Multiplicador
          </span>
          <span className="text-lg font-black font-mono text-purple-400 mt-1 block">
            {metrics.markupMultiplier.toFixed(2)}x
          </span>
        </div>
      </div>

      {/* Ferramentas de Cálculo Reverso */}
      <div className="pt-4 border-t border-slate-800 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          3. Precificação Reversa Automática
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Por Margem Alvo */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">
                Alvo por Margem Desejada
              </span>
              <span className="text-xs text-emerald-400 font-mono">
                {targetMargin}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="range"
                min="5"
                max="90"
                step="5"
                value={targetMargin}
                onChange={(e) => setTargetMargin(parseInt(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-[10px] text-slate-400 block">Preço Sugerido:</span>
                <span className="text-sm font-bold text-white font-mono">
                  {formatCurrency(priceByMargin)}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyCalculatedPrice(priceByMargin)}
                className="text-xs text-emerald-400 border-emerald-700/60 hover:bg-emerald-950/40"
              >
                <Check className="w-3.5 h-3.5 mr-1" /> Aplicar
              </Button>
            </div>
          </div>

          {/* Por Markup Alvo */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">
                Alvo por Markup Desejado
              </span>
              <span className="text-xs text-blue-400 font-mono">
                {targetMarkup}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="range"
                min="20"
                max="300"
                step="10"
                value={targetMarkup}
                onChange={(e) => setTargetMarkup(parseInt(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-[10px] text-slate-400 block">Preço Sugerido:</span>
                <span className="text-sm font-bold text-white font-mono">
                  {formatCurrency(priceByMarkup)}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyCalculatedPrice(priceByMarkup)}
                className="text-xs text-blue-400 border-blue-700/60 hover:bg-blue-950/40"
              >
                <Check className="w-3.5 h-3.5 mr-1" /> Aplicar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
