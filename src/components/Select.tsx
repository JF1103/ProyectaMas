import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}

export default function Select({ label, value, onChange, options, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <div className={`relative ${className}`}>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>{label}</label>
      <button type="button" onClick={() => setOpen(!open)}
        className="input-field flex items-center justify-between">
        <span style={{ color: selected ? 'var(--color-text)' : 'var(--color-text-subtle)' }}>
          {selected?.label || 'Seleccionar...'}
        </span>
        <ChevronDown size={16} style={{ color: 'var(--color-text-subtle)', flexShrink: 0 }}
          className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl overflow-hidden shadow-xl animate-fade-in"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          {options.map((o) => (
            <button key={o.value} type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
              style={{ color: o.value === value ? 'var(--color-accent)' : 'var(--color-text)' }}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
