import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MONTHS } from '../utils/format';

interface Props {
  label?: string;
  value?: string;
  onChange: (v: string) => void;
  className?: string;
}

export default function DatePicker({ label, value, onChange, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const now = new Date();

  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const parsed = value ? new Date(value + 'T00:00:00') : null;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  }

  function selectDay(day: number) {
    const d = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(d);
    setOpen(false);
  }

  const displayValue = parsed
    ? `${String(parsed.getDate()).padStart(2, '0')}/${String(parsed.getMonth() + 1).padStart(2, '0')}/${parsed.getFullYear()}`
    : '';

  const days = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

  return (
    <div className={`relative ${className}`} ref={ref}>
      {label && <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>{label}</label>}
      <input readOnly value={displayValue} placeholder="dd/mm/aaaa" onClick={() => setOpen(!open)}
        className="input-field cursor-pointer" style={{ caretColor: 'transparent' }} />
      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 rounded-2xl p-4 w-72 shadow-xl animate-fade-in"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <ChevronLeft size={15} style={{ color: 'var(--color-text-muted)' }} />
            </button>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <ChevronRight size={15} style={{ color: 'var(--color-text-muted)' }} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {days.map((d) => (
              <div key={d} className="text-center text-xs font-medium py-1" style={{ color: 'var(--color-text-subtle)' }}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected = parsed && parsed.getDate() === day && parsed.getMonth() === viewMonth && parsed.getFullYear() === viewYear;
              const isToday = now.getDate() === day && now.getMonth() === viewMonth && now.getFullYear() === viewYear;
              return (
                <button key={day} onClick={() => selectDay(day)}
                  className="text-center text-xs py-1.5 rounded-lg transition-colors font-medium"
                  style={{
                    background: isSelected ? 'var(--color-accent)' : 'transparent',
                    color: isSelected ? 'white' : isToday ? 'var(--color-accent)' : 'var(--color-text)',
                    fontWeight: isToday ? '700' : undefined,
                  }}>
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
