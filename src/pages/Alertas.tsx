import { useStore } from '../store';
import { formatCurrency, daysUntilDue, getMonthName } from '../utils/format';
import Header from '../components/Header';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { GastoFijo } from '../types';
import type { ReactNode } from 'react';

export default function Alertas() {
  const { gastosFijos, mesActual, añoActual, config } = useStore();
  const sym = config.moneda === 'ARS' ? '$' : 'US$';
  const fmt = (v: number) => formatCurrency(v, sym);
  const navigate = useNavigate();

  const monthGastos = gastosFijos.filter((g) => g.mes === mesActual && g.año === añoActual);

  const vencidos = monthGastos.filter((g) => g.estado !== 'pagado' && daysUntilDue(g.fechaVencimiento, mesActual, añoActual) < 0);
  const hoy = monthGastos.filter((g) => g.estado !== 'pagado' && daysUntilDue(g.fechaVencimiento, mesActual, añoActual) === 0);
  const manana = monthGastos.filter((g) => g.estado !== 'pagado' && daysUntilDue(g.fechaVencimiento, mesActual, añoActual) === 1);
  const dosDias = monthGastos.filter((g) => g.estado !== 'pagado' && daysUntilDue(g.fechaVencimiento, mesActual, añoActual) === 2);
  const pagados = monthGastos.filter((g) => g.estado === 'pagado');
  const proximos = monthGastos.filter((g) => g.estado !== 'pagado' && daysUntilDue(g.fechaVencimiento, mesActual, añoActual) > 2);

  function Group({ title, items, color, icon }: { title: string; items: GastoFijo[]; color: string; icon: ReactNode }) {
    if (items.length === 0) return null;
    return (
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <span style={{ color }}>{icon}</span>
          <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{title}</h3>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>{items.length}</span>
        </div>
        <div className="space-y-2">
          {items.map((g) => (
            <div key={g.id} className="card-sm flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{g.nombre}</div>
                <div className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{g.categoria} · Vence día {g.fechaVencimiento}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{fmt(g.monto)}</div>
                <div className="text-xs" style={{ color }}>{g.estado === 'pagado' ? 'Pagado' : daysUntilDue(g.fechaVencimiento, mesActual, añoActual) < 0 ? 'Vencido' : `Día ${g.fechaVencimiento}`}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalPendiente = [...vencidos, ...hoy, ...manana, ...dosDias, ...proximos].reduce((a, g) => a + g.monto, 0);

  return (
    <div className="animate-fade-in">
      <Header title="Centro de Alertas" subtitle={`${getMonthName(mesActual)} ${añoActual}`} />

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card text-center">
          <div className="text-2xl font-bold" style={{ color: 'var(--color-danger)' }}>{vencidos.length + hoy.length}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Urgentes</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold" style={{ color: 'var(--color-warning)' }}>{manana.length + dosDias.length}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Próximos</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>{pagados.length}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Pagados</div>
        </div>
      </div>

      {totalPendiente > 0 && (
        <div className="card mb-6">
          <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Total pendiente de pago</div>
          <div className="text-2xl font-bold mt-1" style={{ color: 'var(--color-danger)' }}>{fmt(totalPendiente)}</div>
        </div>
      )}

      <Group title="Vencidos" items={vencidos} color="var(--color-danger)" icon={<AlertTriangle size={16} />} />
      <Group title="Vencen hoy" items={hoy} color="var(--color-danger)" icon={<AlertTriangle size={16} />} />
      <Group title="Vencen mañana" items={manana} color="var(--color-warning)" icon={<Clock size={16} />} />
      <Group title="Vencen en 2 días" items={dosDias} color="var(--color-warning)" icon={<Clock size={16} />} />
      <Group title="Próximos vencimientos" items={proximos} color="var(--color-text-muted)" icon={<Clock size={16} />} />
      <Group title="Pagados" items={pagados} color="var(--color-success)" icon={<CheckCircle size={16} />} />

      {monthGastos.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle size={40} className="mx-auto mb-3" style={{ color: 'var(--color-success)' }} />
          <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Sin gastos fijos este mes</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>Cargá tus gastos fijos para ver las alertas de vencimientos.</p>
          <button className="btn-primary" onClick={() => navigate('/gastos-fijos')}>Ir a gastos fijos</button>
        </div>
      )}
    </div>
  );
}
