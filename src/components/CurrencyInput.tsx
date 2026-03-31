import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { formatInputCurrency } from '../utils/format';

interface Props {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  symbol?: string;
}

export default function CurrencyInput({ label, value, onChange, placeholder = '0,00', className = '', symbol = '$' }: Props) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^\d,]/g, '');
    onChange(raw);
  }

  const display = focused ? value : (value ? formatInputCurrency(value) : '');

  return (
    <div className={className}>
      {label && <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>{label}</label>}
      <div className="relative">
  <span
    className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium pointer-events-none"
    style={{ color: 'var(--color-text-subtle)' }}
  >
    {symbol}
  </span>

  <input
    ref={inputRef}
    type="text"
    inputMode="decimal"
    className="input-field"
    style={{ paddingLeft: '2rem' }}
    value={display}
    onChange={handleChange}
    onFocus={() => setFocused(true)}
    onBlur={() => setFocused(false)}
    placeholder={placeholder}
  />
</div>
    </div>
  );
}

export function parseCurrencyInput(value: string): number {
  const clean = value.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}
