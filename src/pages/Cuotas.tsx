import { useState } from 'react';
import { useStore } from '../store';
import { formatCurrency, getMonthName, getInstallmentProgress } from '../utils/format';
import Header from '../components/Header';
import Modal from '../components/Modal';
import Field from '../components/Field';
import { Textarea } from '../components/Field';
import CurrencyInput, { parseCurrencyInput } from '../components/CurrencyInput';
import EmptyState from '../components/EmptyState';
import DatePicker from '../components/DatePicker';
import { Plus, Pencil, Trash2, Layers } from 'lucide-react';
import type { CuotaIndependiente } from '../types';

interface Form {
  descripcion: string;
  montoTotal: string;
  cuotasTotal: string;
  fechaInicio: string;
  nota: string;
}

const emptyForm: Form = {
  descripcion: '',
  montoTotal: '',
  cuotasTotal: '12',
  fechaInicio: new Date().toISOString().slice(0, 10),
  nota: ''
};

export default function Cuotas() {
  const { mesActual, añoActual, cuotasIndependientes, addCuotaIndependiente, updateCuotaIndependiente, deleteCuotaIndependiente, config } = useStore();
  const sym = config.moneda === 'ARS' ? '$' : config.moneda === 'USD' ? 'US$' : config.moneda;
  const fmt = (v: number) => formatCurrency(v, sym);

  const monthCuotas = cuotasIndependientes.flatMap((c) => {
  const progress = getInstallmentProgress(c.fechaInicio, c.cuotasTotal, mesActual, añoActual);
  return progress.activa
    ? [{ ...c, cuotaActual: progress.cuotaActual, cuotasRestantes: progress.cuotasRestantes }]
    : [];
});
  const total = monthCuotas.reduce((acc, c) => acc + c.valorCuota, 0);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CuotaIndependiente | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);

  function openAdd() { setForm(emptyForm); setEditing(null); setShowModal(true); }
  function openEdit(c: CuotaIndependiente) {
    setForm({
  descripcion: c.descripcion,
  montoTotal: String(c.montoTotal).replace('.', ','),
  cuotasTotal: String(c.cuotasTotal),
  fechaInicio: c.fechaInicio,
  nota: c.nota || ''
});
    setEditing(c); setShowModal(true);
  }

  function save() {
  const montoTotal = parseCurrencyInput(form.montoTotal);
  const cuotasTotal = parseInt(form.cuotasTotal) || 1;

  if (!form.descripcion || montoTotal <= 0) return;

  const valorCuota = montoTotal / cuotasTotal;

  const base = {
    descripcion: form.descripcion,
    montoTotal,
    cuotasTotal,
    valorCuota,
    fechaInicio: form.fechaInicio,
    nota: form.nota
  };

  editing ? updateCuotaIndependiente(editing.id, base) : addCuotaIndependiente(base);
  setShowModal(false);
}

  return (
    <div className="animate-fade-in">
      <Header title="Cuotas Independientes" />

      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>{fmt(total)}</div>
          <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {monthCuotas.length} obligación{monthCuotas.length !== 1 ? 'es' : ''} — {getMonthName(mesActual)} {añoActual}
          </div>
        </div>
        <button className="btn-primary" onClick={openAdd}><Plus size={16} />Agregar</button>
      </div>

      <div className="mb-6 p-4 rounded-xl text-sm" style={{ background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)', color: 'var(--color-text-muted)' }}>
        Las cuotas independientes son préstamos, financiaciones o pagos en cuotas sin tarjeta de crédito. Se incluyen en el cálculo mensual de gastos.
      </div>

      {monthCuotas.length === 0 ? (
        <EmptyState icon={<Layers size={28} />} title="Sin cuotas independientes"
          description="Cargá préstamos personales, financiaciones o pagos en cuotas sin tarjeta."
          action={<button className="btn-primary" onClick={openAdd}><Plus size={16} />Agregar cuota</button>} />
      ) : (
        <div className="space-y-3">
          {monthCuotas.map((c) => {
            const pctRestante = Math.round((c.cuotasRestantes / c.cuotasTotal) * 100);
            return (
              <div key={c.id} className="card">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)' }}>
                      <Layers size={18} style={{ color: 'var(--color-accent)' }} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm" style={{ color: 'var(--color-text)', wordBreak: 'break-word' }}>{c.descripcion}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-subtle)' }}>Inicio: {c.fechaInicio}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <div className="font-bold" style={{ color: 'var(--color-accent)' }}>{fmt(c.valorCuota)}/mes</div>
                      <div className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>Total: {fmt(c.montoTotal)}</div>
                    </div>
                    <button className="p-1.5 rounded-lg hover:bg-white/10" onClick={() => openEdit(c)}><Pencil size={14} style={{ color: 'var(--color-text-muted)' }} /></button>
                    <button className="p-1.5 rounded-lg hover:bg-white/10" onClick={() => deleteCuotaIndependiente(c.id)}><Trash2 size={14} style={{ color: 'var(--color-danger)' }} /></button>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
                    Cuota {c.cuotaActual} de {c.cuotasTotal} · Restan {c.cuotasRestantes}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{pctRestante}% restante</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: 'var(--color-surface-2)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pctRestante}%`, background: 'var(--color-accent)' }} />
                </div>
                {c.nota && <div className="mt-2 text-xs rounded-lg p-2" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>{c.nota}</div>}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? 'Editar cuota' : 'Nueva cuota independiente'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <Field label="Descripción" value={form.descripcion} onChange={(v) => setForm({ ...form, descripcion: v })} placeholder="Ej: Préstamo personal Banco X" />
            <CurrencyInput label="Monto total" value={form.montoTotal} onChange={(v) => setForm({ ...form, montoTotal: v })} symbol={sym} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cuotas totales" value={form.cuotasTotal} onChange={(v) => setForm({ ...form, cuotasTotal: v })} type="number" min={1} />
            </div>
            {form.montoTotal && form.cuotasTotal && (
              <div className="p-3 rounded-xl" style={{ background: 'var(--color-surface-2)' }}>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Valor por cuota: </span>
                <span className="text-sm font-bold" style={{ color: 'var(--color-accent)' }}>
                  {fmt(parseCurrencyInput(form.montoTotal) / (parseInt(form.cuotasTotal) || 1))}
                </span>
              </div>
            )}
            <DatePicker label="Fecha de inicio" value={form.fechaInicio} onChange={(v) => setForm({ ...form, fechaInicio: v })} />
            <Textarea label="Nota (opcional)" value={form.nota} onChange={(v) => setForm({ ...form, nota: v })} rows={2} />
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
