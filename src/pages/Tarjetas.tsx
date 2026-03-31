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
import { Plus, Pencil, Trash2, CreditCard, ChevronDown, ChevronUp } from 'lucide-react';
import type { Tarjeta, CuotaTarjeta } from '../types';
import clsx from 'clsx';

const CARD_COLORS = ['#6c63ff', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316'];

export default function Tarjetas() {
  const { mesActual, añoActual, tarjetas, cuotasTarjeta, addTarjeta, updateTarjeta, deleteTarjeta, addCuotaTarjeta, updateCuotaTarjeta, deleteCuotaTarjeta, config } = useStore();
  const sym = config.moneda === 'ARS' ? '$' : config.moneda === 'USD' ? 'US$' : config.moneda;
  const fmt = (v: number) => formatCurrency(v, sym);

  const [showCardModal, setShowCardModal] = useState(false);
  const [showCuotaModal, setShowCuotaModal] = useState(false);
  const [editingCard, setEditingCard] = useState<Tarjeta | null>(null);
  const [editingCuota, setEditingCuota] = useState<CuotaTarjeta | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [expandedCard, setExpandedCard] = useState<Record<string, boolean>>({});

  const [cardForm, setCardForm] = useState({ nombre: '', banco: '', diaCierre: '20', diaVencimiento: '10', color: CARD_COLORS[0] });

  const [cuotaForm, setCuotaForm] = useState({
  descripcion: '',
  montoTotal: '',
  cuotasTotal: '12',
  fechaInicio: new Date().toISOString().slice(0, 10),
  nota: ''
});

  function openAddCard() { setCardForm({ nombre: '', banco: '', diaCierre: '20', diaVencimiento: '10', color: CARD_COLORS[0] }); setEditingCard(null); setShowCardModal(true); }
  function openEditCard(t: Tarjeta) { setCardForm({ nombre: t.nombre, banco: t.banco, diaCierre: String(t.diaCierre), diaVencimiento: String(t.diaVencimiento), color: t.color }); setEditingCard(t); setShowCardModal(true); }

  function saveCard() {
    if (!cardForm.nombre) return;
    const base = { nombre: cardForm.nombre, banco: cardForm.banco, diaCierre: parseInt(cardForm.diaCierre), diaVencimiento: parseInt(cardForm.diaVencimiento), color: cardForm.color };
    editingCard ? updateTarjeta(editingCard.id, base) : addTarjeta(base);
    setShowCardModal(false);
  }

  function openAddCuota(tarjetaId: string) {
  setSelectedCardId(tarjetaId);
  setCuotaForm({
    descripcion: '',
    montoTotal: '',
    cuotasTotal: '12',
    fechaInicio: new Date().toISOString().slice(0, 10),
    nota: ''
  });
  setEditingCuota(null);
  setShowCuotaModal(true);
}
  function openEditCuota(c: CuotaTarjeta) {
    setSelectedCardId(c.tarjetaId);
    setCuotaForm({
  descripcion: c.descripcion,
  montoTotal: String(c.montoTotal).replace('.', ','),
  cuotasTotal: String(c.cuotasTotal),
  fechaInicio: c.fechaInicio,
  nota: c.nota || ''
});
    setEditingCuota(c); setShowCuotaModal(true);
  }

  function saveCuota() {
  const montoTotal = parseCurrencyInput(cuotaForm.montoTotal);
  const cuotasTotal = parseInt(cuotaForm.cuotasTotal) || 1;

  if (!cuotaForm.descripcion || montoTotal <= 0) return;

  const valorCuota = montoTotal / cuotasTotal;

  const base = {
    tarjetaId: selectedCardId,
    descripcion: cuotaForm.descripcion,
    montoTotal,
    cuotasTotal,
    valorCuota,
    fechaInicio: cuotaForm.fechaInicio,
    nota: cuotaForm.nota
  };

  editingCuota ? updateCuotaTarjeta(editingCuota.id, base) : addCuotaTarjeta(base);
  setShowCuotaModal(false);
}

  return (
    <div className="animate-fade-in">
      <Header title="Tarjetas de Crédito" />
      <div className="flex items-center justify-between mb-6">
        <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{tarjetas.length} tarjeta{tarjetas.length !== 1 ? 's' : ''} registrada{tarjetas.length !== 1 ? 's' : ''}</div>
        <button className="btn-primary" onClick={openAddCard}><Plus size={16} />Nueva tarjeta</button>
      </div>

      {tarjetas.length === 0 ? (
        <EmptyState icon={<CreditCard size={28} />} title="Sin tarjetas registradas"
          description="Agregá tus tarjetas de crédito para gestionar cuotas y consumos."
          action={<button className="btn-primary" onClick={openAddCard}><Plus size={16} />Agregar tarjeta</button>} />
      ) : (
        <div className="space-y-4">
          {tarjetas.map((t) => {
            const cuotas = cuotasTarjeta
  .filter((c) => c.tarjetaId === t.id)
  .flatMap((c) => {
    const progress = getInstallmentProgress(c.fechaInicio, c.cuotasTotal, mesActual, añoActual);
    return progress.activa
      ? [{ ...c, cuotaActual: progress.cuotaActual, cuotasRestantes: progress.cuotasRestantes }]
      : [];
  });

const totalMes = cuotas.reduce((acc, c) => acc + c.valorCuota, 0);
            const isExpanded = expandedCard[t.id];

            return (
              <div key={t.id} className="card overflow-hidden">
                {/* Card header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: t.color }}>
                      <CreditCard size={16} className="text-white" />
                    </div>
                    <div>
                      <div className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{t.nombre}</div>
                      <div className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{t.banco} · Cierra día {t.diaCierre} · Vence día {t.diaVencimiento}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-1.5 rounded-lg hover:bg-white/10" onClick={() => openEditCard(t)}><Pencil size={14} style={{ color: 'var(--color-text-muted)' }} /></button>
                    <button className="p-1.5 rounded-lg hover:bg-white/10" onClick={() => deleteTarjeta(t.id)}><Trash2 size={14} style={{ color: 'var(--color-danger)' }} /></button>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3 p-3 rounded-xl" style={{ background: 'var(--color-surface-2)' }}>
                  <div>
                    <div className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>Impacto mensual</div>
                    <div className="font-bold text-lg" style={{ color: t.color }}>{fmt(totalMes)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>Cuotas activas</div>
                    <div className="font-semibold" style={{ color: 'var(--color-text)' }}>{cuotas.length}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => openAddCuota(t.id)}>
                    <Plus size={13} />Agregar cuota
                  </button>
                  {cuotas.length > 0 && (
                    <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => setExpandedCard({ ...expandedCard, [t.id]: !isExpanded })}>
                      {isExpanded ? <><ChevronUp size={13} />Ocultar</> : <><ChevronDown size={13} />Ver {cuotas.length} cuota{cuotas.length !== 1 ? 's' : ''}</>}
                    </button>
                  )}
                </div>

                {isExpanded && cuotas.length > 0 && (
                  <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                    {cuotas.map((c) => (
                      <div key={c.id} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'var(--color-surface-2)' }}>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm" style={{ color: 'var(--color-text)', wordBreak: 'break-word' }}>{c.descripcion}</div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-subtle)' }}>
                            Cuota {c.cuotaActual} de {c.cuotasTotal} · Restan {c.cuotasRestantes} · {fmt(c.valorCuota)}/cuota
                          </div>
                          {c.nota && <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{c.nota}</div>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{fmt(c.valorCuota)}</span>
                          <button className="p-1.5 rounded-lg hover:bg-white/10" onClick={() => openEditCuota(c)}><Pencil size={12} style={{ color: 'var(--color-text-muted)' }} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-white/10" onClick={() => deleteCuotaTarjeta(c.id)}><Trash2 size={12} style={{ color: 'var(--color-danger)' }} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCardModal && (
        <Modal title={editingCard ? 'Editar tarjeta' : 'Nueva tarjeta'} onClose={() => setShowCardModal(false)}>
          <div className="space-y-4">
            <Field label="Nombre de la tarjeta" value={cardForm.nombre} onChange={(v) => setCardForm({ ...cardForm, nombre: v })} placeholder="Ej: Visa Platinum" />
            <Field label="Banco / Entidad" value={cardForm.banco} onChange={(v) => setCardForm({ ...cardForm, banco: v })} placeholder="Ej: Banco Galicia" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Día de cierre" value={cardForm.diaCierre} onChange={(v) => setCardForm({ ...cardForm, diaCierre: v })} type="number" min={1} max={31} />
              <Field label="Día de vencimiento" value={cardForm.diaVencimiento} onChange={(v) => setCardForm({ ...cardForm, diaVencimiento: v })} type="number" min={1} max={31} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>Color</label>
              <div className="flex gap-2 flex-wrap">
                {CARD_COLORS.map((c) => (
                  <button key={c} onClick={() => setCardForm({ ...cardForm, color: c })}
                    className="w-8 h-8 rounded-lg transition-transform hover:scale-110"
                    style={{ background: c, outline: cardForm.color === c ? `3px solid white` : 'none', outlineOffset: '2px' }} />
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={() => setShowCardModal(false)}>Cancelar</button>
              <button className="btn-primary flex-1" onClick={saveCard}>{editingCard ? 'Guardar' : 'Agregar'}</button>
            </div>
          </div>
        </Modal>
      )}

      {showCuotaModal && (
        <Modal title={editingCuota ? 'Editar cuota' : 'Nueva cuota en tarjeta'} onClose={() => setShowCuotaModal(false)}>
          <div className="space-y-4">
            <Field label="Descripción" value={cuotaForm.descripcion} onChange={(v) => setCuotaForm({ ...cuotaForm, descripcion: v })} placeholder="Ej: Heladera Samsung" />
            <CurrencyInput label="Monto total" value={cuotaForm.montoTotal} onChange={(v) => setCuotaForm({ ...cuotaForm, montoTotal: v })} symbol={sym} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cuotas totales" value={cuotaForm.cuotasTotal} onChange={(v) => setCuotaForm({ ...cuotaForm, cuotasTotal: v })} type="number" min={1} />
            </div>
            {cuotaForm.montoTotal && cuotaForm.cuotasTotal && (
              <div className="p-3 rounded-xl" style={{ background: 'var(--color-surface-2)' }}>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Valor por cuota: </span>
                <span className="text-sm font-bold" style={{ color: 'var(--color-accent)' }}>
                  {fmt(parseCurrencyInput(cuotaForm.montoTotal) / (parseInt(cuotaForm.cuotasTotal) || 1))}
                </span>
              </div>
            )}
            <DatePicker label="Fecha de inicio" value={cuotaForm.fechaInicio} onChange={(v) => setCuotaForm({ ...cuotaForm, fechaInicio: v })} />
            <Textarea label="Nota (opcional)" value={cuotaForm.nota} onChange={(v) => setCuotaForm({ ...cuotaForm, nota: v })} rows={2} />
            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={() => setShowCuotaModal(false)}>Cancelar</button>
              <button className="btn-primary flex-1" onClick={saveCuota}>{editingCuota ? 'Guardar' : 'Agregar'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
