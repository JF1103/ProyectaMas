import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, Receipt, CreditCard, Layers,
  PiggyBank, DollarSign, History, Settings, FileDown,
  Bell, ChevronLeft, ChevronRight, X, Menu
} from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../store';
import { getMonthName, MONTHS } from '../utils/format';
import clsx from 'clsx';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/ingresos', icon: TrendingUp, label: 'Ingresos' },
  { to: '/gastos-fijos', icon: Receipt, label: 'Gastos Fijos' },
  { to: '/gastos-variables', icon: Receipt, label: 'Gastos Variables' },
  { to: '/tarjetas', icon: CreditCard, label: 'Tarjetas' },
  { to: '/cuotas', icon: Layers, label: 'Cuotas' },
  { to: '/proyeccion', icon: PiggyBank, label: 'Proyección' },
  { to: '/divisas', icon: DollarSign, label: 'Divisas' },
  { to: '/historial', icon: History, label: 'Historial' },
  { to: '/exportar', icon: FileDown, label: 'Exportar PDF' },
  { to: '/alertas', icon: Bell, label: 'Alertas' },
  { to: '/configuracion', icon: Settings, label: 'Configuración' },
];

export default function Sidebar() {
  const { mesActual, añoActual, setMes } = useStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const location = useLocation();
  const now = new Date();
  const currentRealMes = now.getMonth() + 1;
  const currentRealAño = now.getFullYear();

  function prevMonth() {
    let m = mesActual - 1, a = añoActual;
    if (m < 1) { m = 12; a--; }
    const minAño = currentRealAño - 2;
    if (a < minAño) return;
    setMes(m, a);
  }

  function nextMonth() {
    let m = mesActual + 1, a = añoActual;
    if (m > 12) { m = 1; a++; }
    if (a > currentRealAño || (a === currentRealAño && m > currentRealMes)) return;
    setMes(m, a);
  }

  const isAtEnd = mesActual === currentRealMes && añoActual === currentRealAño;
  const isAtStart = mesActual === 1 && añoActual === currentRealAño - 2;

  function pickMonth(m: number, a: number) {
    setMes(m, a);
    setShowMonthPicker(false);
  }

  const years = [currentRealAño - 2, currentRealAño - 1, currentRealAño];

  const SidebarContent = () => (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)' }}>
      {/* Logo */}
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-accent)' }}>
            <span className="text-white font-bold text-sm">P+</span>
          </div>
          <div>
            <div className="font-bold text-base" style={{ color: 'var(--color-text)' }}>Proyecta<span style={{ color: 'var(--color-accent)' }}>+</span></div>
            <div className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>Finanzas personales</div>
          </div>
        </div>
      </div>

      {/* Month Navigator */}
      <div className="px-4 pb-4">
        <div className="rounded-xl p-3 relative" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between">
            <button onClick={prevMonth} disabled={isAtStart} className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-colors">
              <ChevronLeft size={16} style={{ color: 'var(--color-text-muted)' }} />
            </button>
            <button onClick={() => setShowMonthPicker(true)} className="text-center flex-1 hover:opacity-80 transition-opacity">
              <div className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{getMonthName(mesActual)}</div>
              <div className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{añoActual}</div>
            </button>
            <button onClick={nextMonth} disabled={isAtEnd} className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-colors">
              <ChevronRight size={16} style={{ color: 'var(--color-text-muted)' }} />
            </button>
          </div>

          {showMonthPicker && (
            <div className="absolute left-0 top-full mt-2 z-50 w-72 rounded-2xl p-4 shadow-xl animate-fade-in"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Seleccionar mes</span>
                <button onClick={() => setShowMonthPicker(false)} className="p-1 rounded hover:bg-white/10">
                  <X size={14} style={{ color: 'var(--color-text-muted)' }} />
                </button>
              </div>
              {years.map((a) => (
                <div key={a} className="mb-3">
                  <div className="text-xs font-semibold mb-2 px-1" style={{ color: 'var(--color-text-subtle)' }}>{a}</div>
                  <div className="grid grid-cols-4 gap-1">
                    {MONTHS.map((mn, idx) => {
                      const m = idx + 1;
                      const disabled = a === currentRealAño && m > currentRealMes;
                      const active = m === mesActual && a === añoActual;
                      return (
                        <button key={m} onClick={() => !disabled && pickMonth(m, a)} disabled={disabled}
                          className={clsx('py-1.5 text-xs rounded-lg transition-colors font-medium', {
                            'opacity-30 cursor-not-allowed': disabled,
                            'text-white': active,
                            'hover:bg-white/10': !disabled && !active,
                          })}
                          style={{ background: active ? 'var(--color-accent)' : 'transparent', color: active ? 'white' : 'var(--color-text)' }}>
                          {mn.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '0 1rem 0.75rem' }} />

      {/* Nav Links */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
              isActive
                ? 'text-white'
                : 'hover:bg-white/5'
            )}
            style={({ isActive }) => isActive ? { background: 'var(--color-accent)', color: 'white' } : { color: 'var(--color-text-muted)' }}>
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button className="fixed top-4 left-4 z-50 p-2 rounded-xl md:hidden"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        onClick={() => setMobileOpen(!mobileOpen)}>
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}
          style={{ background: 'rgba(0,0,0,0.5)' }} />
      )}

      {/* Mobile sidebar */}
      <div className={clsx('fixed top-0 left-0 h-full w-64 z-40 md:hidden transition-transform duration-300',
        mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
        <SidebarContent />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-col w-60 h-full shrink-0 sticky top-0">
        <SidebarContent />
      </div>
    </>
  );
}
