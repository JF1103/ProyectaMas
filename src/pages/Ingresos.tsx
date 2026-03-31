import { useState } from 'react';
import { useStore } from '../store';
import { formatCurrency, getMonthName } from '../utils/format';
import Header from '../components/Header';
import Modal from '../components/Modal';
import Field from '../components/Field';
import CurrencyInput, { parseCurrencyInput } from '../components/CurrencyInput';
import EmptyState from '../components/EmptyState';
import { Plus, Pencil, Trash2, TrendingUp } from 'lucide-react';
import type { Ingreso } from '../types';

interface Form { descripcion: string; monto: string; fecha: string; }
const emptyForm: Form = { descripcion: '', monto: '', fecha: new Date().toISOString().slice(0, 10) };

export default function Ingresos() {
  const { mesActual, añoActual, ingresos, addIngreso, updateIngreso, deleteIngreso, config } = useStore();
  const sym = config.moneda === 'ARS' ? '$' : config.moneda === 'USD' ? 'US$' : config.moneda;
  const fmt = (v: number) => formatCurrency(v, sym);
  const monthIngresos = ingresos.filter((x) => x.mes === mesActual && x.año === añoActual);
  const total = monthIngresos.reduce((acc, x) => acc + x.monto, 0);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Ingreso | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);

  function openAdd() { setForm(emptyForm); setEditing(null); setShowModal(true); }
  function openEdit(i: Ingreso) {
    setForm({ descripcion: i.descripcion, monto: String(i.monto).replace('.', ','), fecha: i.fecha });
    setEditing(i); setShowModal(true);
  }

  function save() {
    const monto = parseCurrencyInput(form.monto);
    if (!form.descripcion || monto <= 0) return;
    const base = { descripcion: form.descripcion, monto, fecha: form.fecha, mes: mesActual, año: añoActual };
    editing ? updateIngreso(editing.id, base) : addIngreso(base);
    setShowModal(false);
  }

  return (
    <div className="animate-fade-in">
      <Header title="Ingresos" />
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>{fmt(total)}</div>
          <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{monthIngresos.length} fuente{monthIngresos.length !== 1 ? 's' : ''} de ingreso — {getMonthName(mesActual)} {añoActual}</div>
        </div>
        <button className="btn-primary" onClick={openAdd}><Plus size={16} />Agregar</button>
      </div>

      {monthIngresos.length === 0 ? (
        <EmptyState icon={<TrendingUp size={28} />} title="Sin ingresos este mes"
          description="Registrá tu sueldo o fuentes de ingreso del mes."
          action={<button className="btn-primary" onClick={openAdd}><Plus size={16} />Agregar ingreso</button>} />
      ) : (
        <div className="space-y-3">
          {monthIngresos.map((i) => (
            <div key={i.id} className="card flex items-center justify-between gap-4 hover:border-accent transition-colors"
              style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--color-success) 15%, transparent)' }}>
                  <TrendingUp size={18} style={{ color: 'var(--color-success)' }} />
                </div>
                <div>
                  <div className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{i.descripcion}</div>
                  <div className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{i.fecha}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-lg font-bold" style={{ color: 'var(--color-success)' }}>{fmt(i.monto)}</div>
                <button className="p-2 rounded-lg hover:bg-white/10 transition-colors" onClick={() => openEdit(i)}>
                  <Pencil size={15} style={{ color: 'var(--color-text-muted)' }} />
                </button>
                <button className="p-2 rounded-lg hover:bg-white/10 transition-colors" onClick={() => deleteIngreso(i.id)}>
                  <Trash2 size={15} style={{ color: 'var(--color-danger)' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? 'Editar ingreso' : 'Nuevo ingreso'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <Field label="Descripción" value={form.descripcion} onChange={(v) => setForm({ ...form, descripcion: v })} placeholder="Ej: Sueldo principal" />
            <CurrencyInput label="Monto" value={form.monto} onChange={(v) => setForm({ ...form, monto: v })} symbol={sym} />
            <Field label="Fecha" value={form.fecha} onChange={(v) => setForm({ ...form, fecha: v })} type="date" />
            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary flex-1" onClick={save}>
                {editing ? 'Guardar cambios' : 'Agregar ingreso'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
