interface Props {
  label: string;
  value: string | number;
  icon?: string;
  sub?: string;
  color?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export default function StatCard({ label, value, icon, sub, color = 'var(--color-accent)', trend }: Props) {
  return (
    <div className="card flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <div className="text-xl font-bold tracking-tight" style={{ color }}>
        {value}
      </div>
      {sub && (
        <div className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-subtle)' }}>
          {trend === 'up' && <span style={{ color: 'var(--color-danger)' }}>↑</span>}
          {trend === 'down' && <span style={{ color: 'var(--color-success)' }}>↓</span>}
          {sub}
        </div>
      )}
    </div>
  );
}
