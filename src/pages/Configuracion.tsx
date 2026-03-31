import { useState } from 'react';
import { useStore } from '../store';
import Header from '../components/Header';
import Field from '../components/Field';
import Select from '../components/Select';
import { Sun, Moon, User, Globe, DollarSign } from 'lucide-react';

const PAISES = ['Argentina', 'Mexico', 'Colombia', 'Chile', 'Uruguay', 'Peru', 'España', 'Otro'];
const MONEDAS = [
  { value: 'ARS', label: '$ ARS — Peso argentino' },
  { value: 'MXN', label: '$ MXN — Peso mexicano' },
  { value: 'COP', label: '$ COP — Peso colombiano' },
  { value: 'CLP', label: '$ CLP — Peso chileno' },
  { value: 'UYU', label: '$ UYU — Peso uruguayo' },
  { value: 'PEN', label: 'S/ PEN — Sol peruano' },
  { value: 'EUR', label: '€ EUR — Euro' },
  { value: 'USD', label: 'US$ USD — Dólar' },
];

export default function Configuracion() {
  const { config, updateConfig } = useStore();
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function toggleTheme() {
    const newTheme = config.tema === 'dark' ? 'light' : 'dark';
    updateConfig({ tema: newTheme });
    document.documentElement.classList.toggle('light', newTheme === 'light');
  }

  return (
    <div className="animate-fade-in max-w-lg">
      <Header title="Configuración" subtitle="Preferencias de la aplicación" />

      <div className="space-y-4">
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <User size={18} style={{ color: 'var(--color-accent)' }} />
            <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>Perfil</h3>
          </div>
          <Field label="Tu nombre (opcional)" value={config.nombre} onChange={(v) => updateConfig({ nombre: v })} placeholder="Ej: Juan" />
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <Globe size={18} style={{ color: 'var(--color-accent)' }} />
            <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>Región y moneda</h3>
          </div>
          <div className="space-y-3">
            <Select label="País" value={config.pais} onChange={(v) => updateConfig({ pais: v })}
              options={PAISES.map((p) => ({ value: p, label: p }))} />
            <Select label="Moneda principal" value={config.moneda} onChange={(v) => updateConfig({ moneda: v })}
              options={MONEDAS} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            {config.tema === 'dark' ? <Moon size={18} style={{ color: 'var(--color-accent)' }} /> : <Sun size={18} style={{ color: 'var(--color-accent)' }} />}
            <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>Apariencia</h3>
          </div>
          <div className="flex gap-3">
            {(['dark', 'light'] as const).map((t) => (
              <button key={t} onClick={() => { updateConfig({ tema: t }); document.documentElement.classList.toggle('light', t === 'light'); }}
                className="flex-1 py-3 rounded-xl flex flex-col items-center gap-2 transition-all"
                style={{ background: config.tema === t ? 'var(--color-accent)' : 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: config.tema === t ? 'white' : 'var(--color-text-muted)' }}>
                {t === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                <span className="text-xs font-medium">{t === 'dark' ? 'Oscuro' : 'Claro'}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Acerca de Proyecta+</div>
          <div className="text-xs space-y-1" style={{ color: 'var(--color-text-muted)' }}>
            <div>Versión 1.0.0</div>
            <div>Tu asistente de finanzas personales</div>
            <div>Datos almacenados localmente en tu dispositivo</div>
          </div>
        </div>
      </div>
    </div>
  );
}
