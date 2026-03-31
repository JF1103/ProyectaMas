import { useState } from 'react';
import { useStore } from '../store';
import { formatCurrency, getMonthName } from '../utils/format';
import { CATEGORIES, CATEGORY_ICONS, CATEGORY_COLORS } from '../types';
import Header from '../components/Header';
import Modal from '../components/Modal';
import Field from '../components/Field';
import { Textarea } from '../components/Field';
import CurrencyInput, { parseCurrencyInput } from '../components/CurrencyInput';
import Select from '../components/Select';
import EmptyState from '../components/EmptyState';
import DatePicker from '../components/DatePicker';
import { Plus, Pencil, Trash2, ShoppingCart } from 'lucide-react';
import type { GastoVariable, Category } from '../types';
import clsx from 'clsx';

interface Form { descripcion: string; categoria: Category; monto: string; fecha: string; tipo: 'variable' | 'extra'; nota: string; }
const emptyForm: Form = { descripcion: '', categoria: 'Otros', monto: '', fecha: new Date().toISOString().slice(0, 10), tipo: 'variable', nota: '' };

export default function GastosVariables() {
  const { mesActual, añoActual, gastosVariables, addGastoVariable, updateGastoVariable, deleteGastoVariable, config } = useStore();
  const sym = config.moneda === 'ARS' ? '$' : config.moneda === 'USD' ? 'US$' : config.moneda;
  const fmt = (v: number) => formatCurrency(v, sym);

  const monthGastos = gastosVariables.filter((g) => g.mes === mesActual && g.año === añoActual);
  const variables = monthGastos.filter((g) => g.tipo === 'variable');
  const extras = monthGastos.filter((g) => g.tipo === 'extra');
  const totalVar = variables.reduce((acc, g) => acc + g.monto, 0);
  const totalExtra = extras.reduce((acc, g) => acc + g.monto, 0);
  const total = totalVar + totalExtra;

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<GastoVariable | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [activeTab, setActiveTab] = useState<'todos' | 'variable' | 'extra'>('todos');
  const [expandNota, setExpandNota] = useState<Record<string, boolean>>({});

  function openAdd() { setForm(emptyForm); setEditing(null); setShowModal(true); }
  function openEdit(g: GastoVariable) {
    setForm({ descripcion: g.descripcion, categoria: g.categoria, monto: String(g.monto).replace('.', ','), fecha: g.fecha, tipo: g.tipo, nota: g.nota || '' });
    setEditing(g); setShowModal(true);
  }

  function save() {
    const monto = parseCurrencyInput(form.monto);
    if (!form.descripcion || monto <= 0) return;
    const base = { descripcion: form.descripcion, categoria: form.categoria, monto, fecha: form.fecha, tipo: form.tipo, nota: form.nota, mes: mesActual, año: añoActual };
    editing ? updateGastoVariable(editing.id, base) : addGastoVariable(base);
    setShowModal(false);
  }

  // Category totals for top categories
  const catMap: Record<string, number> = {};
  monthGastos.forEach((g) => { catMap[g.categoria] = (catMap[g.categoria] || 0) + g.monto; });
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

  const displayed = activeTab === 'todos' ? monthGastos : monthGastos.filter((g) => g.tipo === activeTab);

  return (
    <div className="animate-fade-in">
      <Header title="Gastos Variables" />

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <div className="text-2xl font-bold" style={{ color: 'var(--color-warning)' }}>{fmt(total)}</div>
          <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Variables: {fmt(totalVar)} · Extras: {fmt(totalExtra)} — {getMonthName(mesActual)} {añoActual}
          </div>
        </div>
        <button className="btn-primary" onClick={openAdd}><Plus size={16} />Agregar</button>
      </div>

      {/* Top categories */}
      {topCats.length > 0 && (
        <div className="card mb-6">
          <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--color-text)' }}>Top categorías</h3>
          <div className="space-y-2">
            {topCats.map(([cat, val]) => {
              const color = CATEGORY_COLORS[cat as Category] || '#94a3b8';
              const pct = Math.round((val / total) * 100);
              return (
                <div key={cat} className="flex items-center gap-3">
                  <span className="text-base w-6 flex-shrink-0">{CATEGORY_ICONS[cat as Category]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{cat}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{pct}%</span>
                        <span className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>{fmt(val)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: 'var(--color-surface-2)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {([['todos', 'Todos'], ['variable', 'Variables'], ['extra', 'Extras']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={clsx('px-4 py-2 rounded-xl text-sm font-medium transition-colors', activeTab === key ? 'text-white' : '')}
            style={{ background: activeTab === key ? 'var(--color-accent)' : 'var(--color-surface-2)', color: activeTab === key ? 'white' : 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
            {label}
          </button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <EmptyState icon={<ShoppingCart size={28} />} title="Sin gastos este mes"
          description="Registrá tus compras, salidas y gastos no planificados."
          action={<button className="btn-primary" onClick={openAdd}><Plus size={16} />Agregar gasto</button>} />
      ) : (
        <div className="space-y-2">
          {[...displayed].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((g) => {
            const color = CATEGORY_COLORS[g.categoria] || '#94a3b8';
            const nota = g.nota || '';
            const isLong = nota.length > 80;
            const isExp = expandNota[g.id];

            return (
              <div key={g.id} className="card-sm flex flex-col gap-2">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>
                    <span className="text-base">{CATEGORY_ICONS[g.categoria]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate" style={{ color: 'var(--color-text)' }}>{g.descripcion}</div>
                        <div className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{g.categoria} · {g.fecha}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={g.tipo === 'extra' ? 'badge-warning' : 'badge-accent'}>{g.tipo === 'extra' ? 'Extra' : 'Variable'}</span>
                        <div className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{fmt(g.monto)}</div>
                        <button className="p-1.5 rounded-lg hover:bg-white/10" onClick={() => openEdit(g)}>
                          <Pencil size={13} style={{ color: 'var(--color-text-muted)' }} />
                        </button>
                        <button className="p-1.5 rounded-lg hover:bg-white/10" onClick={() => deleteGastoVariable(g.id)}>
                          <Trash2 size={13} style={{ color: 'var(--color-danger)' }} />
                        </button>
                      </div>
                    </div>
                    {nota && (
                      <div className="mt-1.5 text-xs rounded-lg p-2" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
                        {isLong && !isExp ? nota.slice(0, 80) + '...' : nota}
                        {isLong && (
                          <button className="ml-1 font-medium" style={{ color: 'var(--color-accent)' }}
                            onClick={() => setExpandNota({ ...expandNota, [g.id]: !isExp })}>
                            {isExp ? 'ver menos' : 'ver más'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? 'Editar gasto' : 'Nuevo gasto'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <Field label="Descripción" value={form.descripcion} onChange={(v) => setForm({ ...form, descripcion: v })} placeholder="Ej: Salida a comer" />
            <Select label="Categoría" value={form.categoria} onChange={(v) => setForm({ ...form, categoria: v as Category })}
              options={CATEGORIES.map((c) => ({ value: c, label: `${CATEGORY_ICONS[c]} ${c}` }))} />
            <CurrencyInput label="Monto" value={form.monto} onChange={(v) => setForm({ ...form, monto: v })} symbol={sym} />
            <DatePicker label="Fecha" value={form.fecha} onChange={(v) => setForm({ ...form, fecha: v })} />
            <Select label="Tipo" value={form.tipo} onChange={(v) => setForm({ ...form, tipo: v as 'variable' | 'extra' })}
              options={[{ value: 'variable', label: 'Variable' }, { value: 'extra', label: 'Extra (no planificado)' }]} />
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
