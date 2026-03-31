import { useStore } from '../store';
import { getMonthName } from '../utils/format';
import { Moon, Sun } from 'lucide-react';

interface Props {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: Props) {
  const { mesActual, añoActual, config, updateConfig } = useStore();

  function toggleTheme() {
    const newTheme = config.tema === 'dark' ? 'light' : 'dark';
    updateConfig({ tema: newTheme });
    document.documentElement.classList.toggle('light', newTheme === 'light');
  }

  return (
    <div className="flex items-start justify-between mb-6 md:mb-8 pt-2">
      <div className="pl-12 md:pl-0">
        <h1 className="text-xl md:text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{title}</h1>
        {subtitle ? (
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{subtitle}</p>
        ) : (
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {getMonthName(mesActual)} {añoActual}
          </p>
        )}
      </div>
      <button onClick={toggleTheme} className="btn-secondary p-2.5">
        {config.tema === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      </button>
    </div>
  );
}
