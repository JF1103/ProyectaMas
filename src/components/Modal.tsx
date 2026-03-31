import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

export default function Modal({ title, onClose, children, wide }: Props) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: wide ? '680px' : '540px' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <X size={18} style={{ color: 'var(--color-text-muted)' }} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
