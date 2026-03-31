interface Props {
  value: number;
  max?: number;
  color?: string;
  height?: number;
  showLabel?: boolean;
}

export default function ProgressBar({ value, max = 100, color = 'var(--color-accent)', height = 6, showLabel }: Props) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const barColor = pct > 90 ? 'var(--color-danger)' : pct > 70 ? 'var(--color-warning)' : color;

  return (
    <div className="w-full">
      <div className="w-full rounded-full overflow-hidden" style={{ height, background: 'var(--color-surface-2)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1">
          <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{Math.round(pct)}% gastado</span>
        </div>
      )}
    </div>
  );
}
