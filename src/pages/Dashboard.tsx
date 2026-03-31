import { useStore, useMonthData } from '../store';
import { formatCurrency, getMonthName, daysUntilDue, percentage } from '../utils/format';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../types';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import ProgressBar from '../components/ProgressBar';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { AlertTriangle, TrendingUp, TrendingDown, Wallet, CreditCard, Layers, PiggyBank, DollarSign, Receipt } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { mesActual, añoActual, gastosFijos, config } = useStore();
  const data = useMonthData(mesActual, añoActual);
  const navigate = useNavigate();

  const sym = config.moneda === 'ARS' ? '$' : config.moneda === 'USD' ? 'US$' : config.moneda;

  const fmt = (v: number) => formatCurrency(v, sym);

  // Alerts: fixed expenses due within 2 days and unpaid
  const alerts = gastosFijos.filter((g) => {
    if (g.mes !== mesActual || g.año !== añoActual || g.estado === 'pagado') return false;
    const days = daysUntilDue(g.fechaVencimiento, mesActual, añoActual);
    return days >= 0 && days <= 2;
  });

  // Category breakdown for pie
  const allVariables = data.gastosVariables;
  const catMap: Record<string, number> = {};
  allVariables.forEach((g) => {
    catMap[g.categoria] = (catMap[g.categoria] || 0) + g.monto;
  });

  const catData = Object.entries(catMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const pctGastado = percentage(data.totalGastos, data.totalIngresos);

  const disponibleValue =
    data.disponible < 0
      ? `- ${fmt(Math.abs(data.disponible))}`
      : fmt(data.disponible);

  const disponibleColor =
    data.disponible > 0
      ? 'var(--color-success)'
      : data.disponible < 0
        ? 'var(--color-danger)'
        : 'var(--color-text)';

  const disponibleIcon =
    data.disponible > 0
      ? '🟢'
      : data.disponible < 0
        ? '🔴'
        : '⚪';

  return (
    <div className="animate-fade-in">
      <Header
  title={config.nombre?.trim() ? `Hola, ${config.nombre} 👋` : 'Hola 👋'}
  subtitle={`Resumen de ${getMonthName(mesActual)} ${añoActual}`}
/>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div
          className="mb-6 p-4 rounded-xl flex items-start gap-3"
          style={{
            background: 'color-mix(in srgb, var(--color-warning) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)'
          }}
        >
          <AlertTriangle size={18} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <div className="font-semibold text-sm" style={{ color: 'var(--color-warning)' }}>
              {alerts.length} vencimiento{alerts.length > 1 ? 's' : ''} próximo{alerts.length > 1 ? 's' : ''}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {alerts.map((a) => {
                const d = daysUntilDue(a.fechaVencimiento, mesActual, añoActual);
                const when = d === 0 ? 'hoy' : d === 1 ? 'mañana' : 'en 2 días';
                return `${a.nombre} vence ${when}`;
              }).join(' · ')}
            </div>
          </div>
        </div>
      )}

      {/* Main metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Ingresos del mes" value={fmt(data.totalIngresos)} icon="💰" color="var(--color-success)" />
        <StatCard label="Total gastos" value={fmt(data.totalGastos)} icon="📊" color="var(--color-danger)" />
        <StatCard
          label="Disponible real"
          value={disponibleValue}
          icon={disponibleIcon}
          color={disponibleColor}
        />
        <StatCard label="Ahorro estimado" value={fmt(data.ahorroEstimado)} icon="🐖" color="var(--color-accent)" />
      </div>

      {/* Budget progress */}
      {data.totalIngresos > 0 && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
              Presupuesto del mes
            </span>
            <span
              className="text-sm font-semibold"
              style={{ color: pctGastado > 90 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}
            >
              {pctGastado}% utilizado
            </span>
          </div>
          <ProgressBar value={data.totalGastos} max={data.totalIngresos} showLabel />
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div>
              <div className="text-xs mb-0.5" style={{ color: 'var(--color-text-subtle)' }}>Gastos fijos</div>
              <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{fmt(data.totalFijos)}</div>
            </div>
            <div>
              <div className="text-xs mb-0.5" style={{ color: 'var(--color-text-subtle)' }}>Variables + extras</div>
              <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{fmt(data.totalVariables + data.totalExtras)}</div>
            </div>
            <div>
              <div className="text-xs mb-0.5" style={{ color: 'var(--color-text-subtle)' }}>Cuotas totales</div>
              <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{fmt(data.totalCuotasTarjeta + data.totalCuotasIndep)}</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Breakdown */}
        <div className="card">
          <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--color-text)' }}>Distribución del gasto</h3>
          <div className="space-y-3">
            {[
              { label: 'Gastos fijos', value: data.totalFijos, icon: <Receipt size={14} />, nav: '/gastos-fijos' },
              { label: 'Gastos variables', value: data.totalVariables, icon: <TrendingDown size={14} />, nav: '/gastos-variables' },
              { label: 'Gastos extra', value: data.totalExtras, icon: <TrendingUp size={14} />, nav: '/gastos-variables' },
              { label: 'Cuotas tarjetas', value: data.totalCuotasTarjeta, icon: <CreditCard size={14} />, nav: '/tarjetas' },
              { label: 'Cuotas independientes', value: data.totalCuotasIndep, icon: <Layers size={14} />, nav: '/cuotas' },
            ].map(({ label, value, icon, nav }) => (
              <div key={label} className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate(nav)}>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-white/10"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
                >
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>{fmt(value)}</span>
                  </div>
                  <ProgressBar value={value} max={data.totalGastos || 1} height={4} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="card">
          <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--color-text)' }}>Top categorías (variables)</h3>
          {catData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40">
              <span className="text-sm" style={{ color: 'var(--color-text-subtle)' }}>Sin datos este mes</span>
            </div>
          ) : (
            <>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={catData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={60} strokeWidth={0}>
                      {catData.map((entry) => (
                        <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name as keyof typeof CATEGORY_COLORS] || '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => fmt(Number(v))}
                      contentStyle={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 12,
                        fontSize: 12
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-2">
                {catData.slice(0, 4).map((c) => (
                  <div key={c.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{ background: CATEGORY_COLORS[c.name as keyof typeof CATEGORY_COLORS] || '#94a3b8' }}
                      />
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {CATEGORY_ICONS[c.name as keyof typeof CATEGORY_ICONS]} {c.name}
                      </span>
                    </div>
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>{fmt(c.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="card">
        <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--color-text)' }}>Acceso rápido</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: <TrendingUp size={20} />, label: 'Ingresos', to: '/ingresos', color: 'var(--color-success)' },
            { icon: <Wallet size={20} />, label: 'Gastos fijos', to: '/gastos-fijos', color: 'var(--color-warning)' },
            { icon: <CreditCard size={20} />, label: 'Tarjetas', to: '/tarjetas', color: 'var(--color-accent)' },
            { icon: <PiggyBank size={20} />, label: 'Proyección', to: '/proyeccion', color: 'var(--color-accent-2)' },
            { icon: <Layers size={20} />, label: 'Cuotas', to: '/cuotas', color: '#f97316' },
            { icon: <DollarSign size={20} />, label: 'Divisas', to: '/divisas', color: '#14b8a6' },
          ].map(({ icon, label, to, color }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all hover:scale-105"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
              >
                {icon}
              </div>
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}