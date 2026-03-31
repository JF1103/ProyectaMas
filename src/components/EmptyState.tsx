import type { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
        <span style={{ color: 'var(--color-text-subtle)' }}>{icon}</span>
      </div>
      <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>{title}</h3>
      <p className="text-sm max-w-xs mb-5" style={{ color: 'var(--color-text-muted)' }}>{description}</p>
      {action}
    </div>
  );
}
