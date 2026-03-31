import { useState } from 'react';
import { useStore, useMonthData, useMetasDelMes } from '../store';
import { formatCurrency, getMonthName, percentage } from '../utils/format';
import Header from '../components/Header';
import Modal from '../components/Modal';
import Field from '../components/Field';
import CurrencyInput, { parseCurrencyInput } from '../components/CurrencyInput';
import DatePicker from '../components/DatePicker';
import ProgressBar from '../components/ProgressBar';
import { Target, Plus, Pencil, Trash2 } from 'lucide-react';
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';
import type { MetaAhorro } from '../types';

interface MetaForm {
  descripcion: string;
  montoObjetivo: string;
  aporteInicial: string;
  fechaLimite: string;
}

const emptyMeta: MetaForm = {
  descripcion: '',
  montoObjetivo: '',
  aporteInicial: '0',
  fechaLimite: ''
};

export default function Proyeccion() {
  const { mesActual, añoActual, addMeta, updateMeta, deleteMeta, setMetaAporteMensual, config } = useStore();
  const metas = useMetasDelMes(mesActual, añoActual);
  const data = useMonthData(mesActual, añoActual);
  const sym = config.moneda === 'ARS' ? '$' : config.moneda === 'USD' ? 'US$' : config.moneda;
  const fmt = (v: number) => formatCurrency(v, sym);

  const [showMeta, setShowMeta] = useState(false);
  const [editingMeta, setEditingMeta] = useState<MetaAhorro | null>(null);
  const [metaForm, setMetaForm] = useState<MetaForm>(emptyMeta);

  function openAddMeta() {
    setMetaForm(emptyMeta);
    setEditingMeta(null);
    setShowMeta(true);
  }

  function openEditMeta(m: MetaAhorro) {
    setMetaForm({
      descripcion: m.descripcion,
      montoObjetivo: String(m.montoObjetivo).replace('.', ','),
      aporteInicial: '0',
      fechaLimite: m.fechaLimite || ''
    });
    setEditingMeta(m);
    setShowMeta(true);
  }

  function saveMeta() {
    const montoObjetivo = parseCurrencyInput(metaForm.montoObjetivo);
    const aporteInicial = parseCurrencyInput(metaForm.aporteInicial);

    if (!metaForm.descripcion || montoObjetivo <= 0) return;

    const base = {
      descripcion: metaForm.descripcion,
      montoObjetivo,
      fechaLimite: metaForm.fechaLimite || undefined
    };

    if (editingMeta) {
      updateMeta(editingMeta.id, base);

      if (aporteInicial > 0) {
        setMetaAporteMensual(editingMeta.id, aporteInicial, mesActual, añoActual);
      }
    } else {
      addMeta(base, aporteInicial, mesActual, añoActual);
    }

    setShowMeta(false);
  }

  const pctGastado = percentage(data.totalGastos, data.totalIngresos);
  const pctAhorro = percentage(data.ahorroEstimado, data.totalIngresos);

  return (
    <div className="animate-fade-in">
      <Header title="Proyección y Ahorro" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="card">
          <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Dinero disponible</div>
          <div
            className="text-xl font-bold"
            style={{ color: data.disponible >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}
          >
            {fmt(data.disponible)}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>Luego de todos los gastos</div>
        </div>

        <div className="card">
          <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Ahorro posible</div>
          <div className="text-xl font-bold" style={{ color: 'var(--color-accent)' }}>{fmt(data.ahorroEstimado)}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>{pctAhorro}% de los ingresos</div>
        </div>

        <div className="card">
          <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Comprometido en cuotas</div>
          <div className="text-xl font-bold" style={{ color: 'var(--color-warning)' }}>
            {fmt(data.totalCuotasTarjeta + data.totalCuotasIndep)}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>Este mes</div>
        </div>

        <div className="card">
          <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>% del ingreso gastado</div>
          <div
            className="text-xl font-bold"
            style={{ color: pctGastado > 90 ? 'var(--color-danger)' : 'var(--color-text)' }}
          >
            {pctGastado}%
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>De {fmt(data.totalIngresos)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="card flex flex-col items-center">
          <h3 className="font-semibold text-sm mb-2 self-start" style={{ color: 'var(--color-text)' }}>
            Uso del presupuesto
          </h3>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="70%"
                innerRadius="60%"
                outerRadius="90%"
                startAngle={180}
                endAngle={0}
                data={[
                  {
                    value: Math.min(pctGastado, 100),
                    fill:
                      pctGastado > 90
                        ? 'var(--color-danger)'
                        : pctGastado > 70
                        ? 'var(--color-warning)'
                        : 'var(--color-accent)'
                  }
                ]}
              >
                <RadialBar dataKey="value" cornerRadius={6} background={{ fill: 'var(--color-surface-2)' }} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center -mt-8">
            <div className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>{pctGastado}%</div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>del ingreso utilizado</div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--color-text)' }}>
            Análisis de {getMonthName(mesActual)}
          </h3>
          <div className="space-y-4">
            {data.totalIngresos === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Cargá tus ingresos para ver la proyección.
              </p>
            ) : (
              <>
                {data.disponible >= 0 ? (
                  <div
                    className="p-3 rounded-xl"
                    style={{
                      background: 'color-mix(in srgb, var(--color-success) 10%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--color-success) 20%, transparent)'
                    }}
                  >
                    <div className="text-sm font-semibold" style={{ color: 'var(--color-success)' }}>
                      Cerrás el mes en positivo
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      Te quedan {fmt(data.disponible)} disponibles para ahorrar o gastar.
                    </div>
                  </div>
                ) : (
                  <div
                    className="p-3 rounded-xl"
                    style={{
                      background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--color-danger) 20%, transparent)'
                    }}
                  >
                    <div className="text-sm font-semibold" style={{ color: 'var(--color-danger)' }}>
                      Gastos superan los ingresos
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      Estás {fmt(Math.abs(data.disponible))} por encima de tus ingresos.
                    </div>
                  </div>
                )}

                {pctAhorro > 0 && (
                  <div
                    className="p-3 rounded-xl"
                    style={{
                      background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--color-accent) 20%, transparent)'
                    }}
                  >
                    <div className="text-sm font-semibold" style={{ color: 'var(--color-accent)' }}>
                      Podés ahorrar {fmt(data.ahorroEstimado)} este mes
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      Eso es el {pctAhorro}% de tus ingresos totales.
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {[
                    { label: 'Ingresos totales', value: data.totalIngresos, color: 'var(--color-success)' },
                    { label: 'Gastos fijos', value: data.totalFijos, color: 'var(--color-danger)' },
                    { label: 'Gastos variables', value: data.totalVariables + data.totalExtras, color: 'var(--color-warning)' },
                    { label: 'Cuotas', value: data.totalCuotasTarjeta + data.totalCuotasIndep, color: '#8b5cf6' },
                    {
                      label: 'Disponible final',
                      value: data.disponible,
                      color: data.disponible >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                      bold: true
                    }
                  ].map(({ label, value, color, bold }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                      <span className={`text-xs ${bold ? 'font-bold text-sm' : 'font-medium'}`} style={{ color }}>
                        {fmt(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>Metas de ahorro</h3>
          <button className="btn-primary py-1.5 px-3 text-xs" onClick={openAddMeta}>
            <Plus size={13} />
            Nueva meta
          </button>
        </div>

        {metas.length === 0 ? (
          <div className="text-center py-8">
            <Target size={32} className="mx-auto mb-3" style={{ color: 'var(--color-text-subtle)' }} />
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Sin metas de ahorro. ¡Creá tu primera meta!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {metas.map((m) => {
              const pct = percentage(m.acumulado, m.montoObjetivo);

              return (
                <div key={m.id} className="surface-2">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Target size={16} style={{ color: 'var(--color-accent)' }} />
                      <div>
                        <div className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>
                          {m.descripcion}
                        </div>
                        {m.fechaLimite && (
                          <div className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
                            Meta: {m.fechaLimite}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button className="p-1.5 rounded-lg hover:bg-white/10" onClick={() => openEditMeta(m)}>
                        <Pencil size={13} style={{ color: 'var(--color-text-muted)' }} />
                      </button>
                      <button className="p-1.5 rounded-lg hover:bg-white/10" onClick={() => deleteMeta(m.id)}>
                        <Trash2 size={13} style={{ color: 'var(--color-danger)' }} />
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                    <span>Acumulado: {fmt(m.acumulado)}</span>
                    <span>Objetivo: {fmt(m.montoObjetivo)}</span>
                  </div>

                  <ProgressBar value={m.acumulado} max={m.montoObjetivo} color="var(--color-accent)" height={8} />

                  <div className="flex items-center justify-between text-xs mt-1">
                    <span style={{ color: 'var(--color-text-subtle)' }}>
                      Aporte del mes: {fmt(m.aporteDelMes)}
                    </span>
                    <span
                      className="font-semibold"
                      style={{ color: pct >= 100 ? 'var(--color-success)' : 'var(--color-accent)' }}
                    >
                      {pct >= 100 ? 'Meta alcanzada!' : `${pct}% alcanzado`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showMeta && (
        <Modal title={editingMeta ? 'Editar meta' : 'Nueva meta de ahorro'} onClose={() => setShowMeta(false)}>
          <div className="space-y-4">
            <Field
              label="Descripción"
              value={metaForm.descripcion}
              onChange={(v) => setMetaForm({ ...metaForm, descripcion: v })}
              placeholder="Ej: Viaje a Europa"
            />

            <CurrencyInput
              label="Monto objetivo"
              value={metaForm.montoObjetivo}
              onChange={(v) => setMetaForm({ ...metaForm, montoObjetivo: v })}
              symbol={sym}
            />

            <CurrencyInput
              label={editingMeta ? 'Agregar aporte este mes' : 'Aporte inicial'}
              value={metaForm.aporteInicial}
              onChange={(v) => setMetaForm({ ...metaForm, aporteInicial: v })}
              symbol={sym}
            />

            <DatePicker
              label="Fecha límite (opcional)"
              value={metaForm.fechaLimite}
              onChange={(v) => setMetaForm({ ...metaForm, fechaLimite: v })}
            />

            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={() => setShowMeta(false)}>
                Cancelar
              </button>
              <button className="btn-primary flex-1" onClick={saveMeta}>
                {editingMeta ? 'Guardar' : 'Crear meta'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}