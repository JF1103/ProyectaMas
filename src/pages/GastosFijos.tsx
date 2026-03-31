import { useState } from 'react';
import { useStore } from '../store';
import { formatCurrency, daysUntilDue, getMonthName } from '../utils/format';
import { CATEGORIES, CATEGORY_ICONS, CATEGORY_COLORS } from '../types';
import Header from '../components/Header';
import Modal from '../components/Modal';
import Field from '../components/Field';
import { Textarea } from '../components/Field';
import CurrencyInput, { parseCurrencyInput } from '../components/CurrencyInput';
import Select from '../components/Select';
import EmptyState from '../components/EmptyState';
import { Plus, Pencil, Trash2, Receipt, CheckCircle, Clock, AlertTriangle, Copy } from 'lucide-react';
import type { GastoFijo, Category } from '../types';
import clsx from 'clsx';

interface Form {
  nombre: string; categoria: Category; monto: string;
  fechaVencimiento: string; nota: string;
}
const emptyForm: Form = { nombre: '', categoria: 'Otros', monto: '', fechaVencimiento: '10', nota: '' };

export default function GastosFijos() {
  const { mesActual, añoActual, gastosFijos, addGastoFijo, updateGastoFijo, deleteGastoFijo, toggleGastoFijoPagado, duplicarGastosFijos, config } = useStore();
  const sym = config.moneda === 'ARS' ? '$' : config.moneda === 'USD' ? 'US$' : config.moneda;
  const fmt = (v: number) => formatCurrency(v, sym);

  const monthGastos = gastosFijos.filter((g) => g.mes === mesActual && g.año === añoActual);
  const total = monthGastos.reduce((acc, g) => acc + g.monto, 0);
  const pagados = monthGastos.filter((g) => g.estado === 'pagado');
  const pendientes = monthGastos.filter((g) => g.estado === 'pendiente');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<GastoFijo | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [expandNota, setExpandNota] = useState<Record<string, boolean>>({});

  function openAdd() { setForm(emptyForm); setEditing(null); setShowModal(true); }
  function openEdit(g: GastoFijo) {
    setForm({ nombre: g.nombre, categoria: g.categoria, monto: String(g.monto).replace('.', ','), fechaVencimiento: String(g.fechaVencimiento), nota: g.nota || '' });
    setEditing(g); setShowModal(true);
  }

  function save() {
    const monto = parseCurrencyInput(form.monto);
    if (!form.nombre || monto <= 0) return;
    const base = { nombre: form.nombre, categoria: form.categoria, monto, fechaVencimiento: parseInt(form.fechaVencimiento) || 1, estado: 'pendiente' as const, nota: form.nota, mes: mesActual, año: añoActual };
    editing ? updateGastoFijo(editing.id, { ...base, estado: editing.estado }) : addGastoFijo(base);
    setShowModal(false);
  }

  function getDueBadge(g: GastoFijo) {
    if (g.estado === 'pagado') return null;
    const days = daysUntilDue(g.fechaVencimiento, mesActual, añoActual);
    if (days < 0) return <span className="badge-danger">Vencido</span>;
    if (days === 0) return <span className="badge-danger">Vence hoy</span>;
    if (days === 1) return <span className="badge-warning">Vence mañana</span>;
    if (days === 2) return <span className="badge-warning">En 2 días</span>;
    return null;
  }

  const prevMonth = mesActual === 1 ? { m: 12, a: añoActual - 1 } : { m: mesActual - 1, a: añoActual };
  const hasPrevMonth = gastosFijos.some((g) => g.mes === prevMonth.m && g.año === prevMonth.a);

  return (
    <div className="animate-fade-in">
      <Header title="Gastos Fijos" />

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <div className="text-2xl font-bold" style={{ color: 'var(--color-danger)' }}>{fmt(total)}</div>
          <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''} · {pagados.length} pagado{pagados.length !== 1 ? 's' : ''} — {getMonthName(mesActual)} {añoActual}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {hasPrevMonth && (
            <button className="btn-secondary" onClick={() => duplicarGastosFijos(prevMonth.m, prevMonth.a, mesActual, añoActual)}>
              <Copy size={15} />Duplicar del mes anterior
            </button>
          )}
          <button className="btn-primary" onClick={openAdd}><Plus size={16} />Agregar</button>
        </div>
      </div>

      {monthGastos.length === 0 ? (
        <EmptyState icon={<Receipt size={28} />} title="Sin gastos fijos este mes"
          description="Cargá tus gastos recurrentes: alquiler, servicios, suscripciones, etc."
          action={<button className="btn-primary" onClick={openAdd}><Plus size={16} />Agregar gasto fijo</button>} />
      ) : (
        <div className="space-y-3">
          {monthGastos.sort((a, b) => a.fechaVencimiento - b.fechaVencimiento).map((g) => {
            const isExpanded = expandNota[g.id];
            const nota = g.nota || '';
            const isLongNota = nota.length > 80;
            const color = CATEGORY_COLORS[g.categoria];

            return (
              <div key={g.id} className={clsx('card transition-all', g.estado === 'pagado' && 'opacity-60')}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>
                    <span className="text-lg">{CATEGORY_ICONS[g.categoria]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <div className="font-semibold text-sm" style={{ color: 'var(--color-text)', textDecoration: g.estado === 'pagado' ? 'line-through' : 'none' }}>
                          {g.nombre}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-subtle)' }}>
                          {g.categoria} · Vence día {g.fechaVencimiento}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getDueBadge(g)}
                        {g.estado === 'pagado' && <span className="badge-success">Pagado</span>}
                        <div className="text-base font-bold" style={{ color: 'var(--color-text)' }}>{fmt(g.monto)}</div>
                      </div>
                    </div>
                    {nota && (
                      <div className="mt-2 text-xs rounded-lg p-2" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
                        {isLongNota && !isExpanded ? nota.slice(0, 80) + '...' : nota}
                        {isLongNota && (
                          <button className="ml-1 font-medium" style={{ color: 'var(--color-accent)' }}
                            onClick={() => setExpandNota({ ...expandNota, [g.id]: !isExpanded })}>
                            {isExpanded ? 'ver menos' : 'ver más'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <button className="btn-secondary flex-1 justify-center py-1.5" onClick={() => toggleGastoFijoPagado(g.id)}>
                    {g.estado === 'pagado' ? <><Clock size={14} />Marcar pendiente</> : <><CheckCircle size={14} />Marcar pagado</>}
                  </button>
                  <button className="p-2 rounded-lg hover:bg-white/10 transition-colors" onClick={() => openEdit(g)}>
                    <Pencil size={15} style={{ color: 'var(--color-text-muted)' }} />
                  </button>
                  <button className="p-2 rounded-lg hover:bg-white/10 transition-colors" onClick={() => deleteGastoFijo(g.id)}>
                    <Trash2 size={15} style={{ color: 'var(--color-danger)' }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? 'Editar gasto fijo' : 'Nuevo gasto fijo'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <Field label="Nombre" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} placeholder="Ej: Alquiler" />
            <Select label="Categoría" value={form.categoria} onChange={(v) => setForm({ ...form, categoria: v as Category })}
              options={CATEGORIES.map((c) => ({ value: c, label: `${CATEGORY_ICONS[c]} ${c}` }))} />
            <CurrencyInput label="Monto" value={form.monto} onChange={(v) => setForm({ ...form, monto: v })} symbol={sym} />
            <Field label="Día de vencimiento (1-31)" value={form.fechaVencimiento}
              onChange={(v) => setForm({ ...form, fechaVencimiento: v })} type="number" min={1} max={31} placeholder="Ej: 10" />
            <Textarea label="Nota (opcional)" value={form.nota} onChange={(v) => setForm({ ...form, nota: v })} placeholder="Observaciones..." rows={2} />
            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary flex-1" onClick={save}>{editing ? 'Guardar' : 'Agregar'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
