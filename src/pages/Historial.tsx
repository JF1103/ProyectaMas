import { useState } from 'react';
import { useStore, useMonthData } from '../store';
import { formatCurrency, getMonthName, MONTHS } from '../utils/format';
import Header from '../components/Header';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function Historial() {
  const store = useStore();
  const { config } = store;
  const sym = config.moneda === 'ARS' ? '$' : 'US$';
  const fmt = (v: number) => formatCurrency(v, sym);

  const now = new Date();
  const currentYear = now.getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear];

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [compareMode, setCompareMode] = useState<'month' | 'year'>('month');

  // Build monthly data for selected year
  const monthlyData = MONTHS.map((name, idx) => {
    const m = idx + 1;
    const d = {
      mes: getMonthName(m),
      ingresos: store.ingresos.filter((x) => x.mes === m && x.año === selectedYear).reduce((a, x) => a + x.monto, 0),
      gastos: [
        ...store.gastosFijos.filter((x) => x.mes === m && x.año === selectedYear),
        ...store.gastosVariables.filter((x) => x.mes === m && x.año === selectedYear),
        ...store.cuotasTarjeta.filter((x) => x.mes === m && x.año === selectedYear),
        ...store.cuotasIndependientes.filter((x) => x.mes === m && x.año === selectedYear),
      ].reduce((a, x) => a + ('monto' in x ? x.monto : 'valorCuota' in x ? x.valorCuota : 0), 0),
    };
    return { ...d, ahorro: Math.max(0, d.ingresos - d.gastos) };
  });

  // Annual totals
  const yearTotal = {
    ingresos: monthlyData.reduce((a, x) => a + x.ingresos, 0),
    gastos: monthlyData.reduce((a, x) => a + x.gastos, 0),
    ahorro: monthlyData.reduce((a, x) => a + x.ahorro, 0),
  };

  // Compare current vs previous month
  const { mesActual, añoActual } = store;
  const prevMes = mesActual === 1 ? 12 : mesActual - 1;
  const prevAño = mesActual === 1 ? añoActual - 1 : añoActual;
  const curData = useMonthData(mesActual, añoActual);
  const prevData = useMonthData(prevMes, prevAño);

  function delta(cur: number, prev: number) {
    if (prev === 0) return null;
    return ((cur - prev) / prev) * 100;
  }

  function DeltaBadge({ cur, prev, inverse }: { cur: number; prev: number; inverse?: boolean }) {
    const d = delta(cur, prev);
    if (d === null) return <span className="badge-accent">Sin datos</span>;
    const isGood = inverse ? d < 0 : d > 0;
    const isNeutral = Math.abs(d) < 1;
    if (isNeutral) return <span className="badge-accent flex items-center gap-1"><Minus size={10} />Sin cambio</span>;
    return (
      <span className={isGood ? 'badge-success' : 'badge-danger'} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
        {isGood ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
        {Math.abs(d).toFixed(1)}%
      </span>
    );
  }

  function getText(label: string, cur: number, prev: number, inverse = false): string {
    const d = delta(cur, prev);
    if (d === null) return `No hay datos del mes anterior para ${label.toLowerCase()}.`;
    const diff = Math.abs(cur - prev);
    const dir = cur > prev ? 'más' : 'menos';
    if (Math.abs(d) < 1) return `${label}: sin cambios significativos respecto al mes anterior.`;
    return `Este mes tuviste ${dir} ${label.toLowerCase()} que el mes anterior: ${fmt(diff)} de diferencia.`;
  }

  return (
    <div className="animate-fade-in">
      <Header title="Historial" subtitle="Análisis histórico de tus finanzas" />

      {/* Year tabs */}
      <div className="flex gap-2 mb-6">
        {years.map((y) => (
          <button key={y} onClick={() => setSelectedYear(y)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ background: selectedYear === y ? 'var(--color-accent)' : 'var(--color-surface-2)', color: selectedYear === y ? 'white' : 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
            {y}
          </button>
        ))}
      </div>

      {/* Annual summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card">
          <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Ingresos {selectedYear}</div>
          <div className="text-lg font-bold" style={{ color: 'var(--color-success)' }}>{fmt(yearTotal.ingresos)}</div>
        </div>
        <div className="card">
          <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Gastos {selectedYear}</div>
          <div className="text-lg font-bold" style={{ color: 'var(--color-danger)' }}>{fmt(yearTotal.gastos)}</div>
        </div>
        <div className="card">
          <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Ahorro {selectedYear}</div>
          <div className="text-lg font-bold" style={{ color: 'var(--color-accent)' }}>{fmt(yearTotal.ahorro)}</div>
        </div>
      </div>

      {/* Monthly chart */}
      <div className="card mb-6">
        <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--color-text)' }}>Evolución mensual {selectedYear}</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'var(--color-text-subtle)' }} tickFormatter={(v) => v.slice(0, 3)} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-subtle)' }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
              <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="ingresos" fill="var(--color-success)" radius={[4, 4, 0, 0]} name="Ingresos" />
              <Bar dataKey="gastos" fill="var(--color-danger)" radius={[4, 4, 0, 0]} name="Gastos" />
              <Bar dataKey="ahorro" fill="var(--color-accent)" radius={[4, 4, 0, 0]} name="Ahorro" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Month comparison */}
      <div className="card">
        <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--color-text)' }}>
          Comparación: {getMonthName(mesActual)} {añoActual} vs {getMonthName(prevMes)} {prevAño}
        </h3>
        <div className="space-y-3">
          {[
            { label: 'Ingresos', cur: curData.totalIngresos, prev: prevData.totalIngresos },
            { label: 'Gastos totales', cur: curData.totalGastos, prev: prevData.totalGastos, inverse: true },
            { label: 'Gastos fijos', cur: curData.totalFijos, prev: prevData.totalFijos, inverse: true },
            { label: 'Gastos variables', cur: curData.totalVariables + curData.totalExtras, prev: prevData.totalVariables + prevData.totalExtras, inverse: true },
            { label: 'Cuotas', cur: curData.totalCuotasTarjeta + curData.totalCuotasIndep, prev: prevData.totalCuotasTarjeta + prevData.totalCuotasIndep, inverse: true },
            { label: 'Ahorro', cur: curData.ahorroEstimado, prev: prevData.ahorroEstimado },
          ].map(({ label, cur, prev, inverse }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{fmt(prev)} → {fmt(cur)}</span>
                  <DeltaBadge cur={cur} prev={prev} inverse={inverse} />
                </div>
              </div>
              <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{getText(label, cur, prev, inverse)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
