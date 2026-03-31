interface Props {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
  min?: string | number;
  max?: string | number;
  required?: boolean;
  readOnly?: boolean;
}

export default function Field({ label, value, onChange, placeholder, type = 'text', className = '', min, max, required, readOnly }: Props) {
  return (
    <div className={className}>
      {label && <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>{label}</label>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field"
        min={min}
        max={max}
        required={required}
        readOnly={readOnly}
      />
    </div>
  );
}

interface TextareaProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}

export function Textarea({ label, value, onChange, placeholder, className = '', rows = 3 }: TextareaProps) {
  return (
    <div className={className}>
      {label && <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>{label}</label>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="input-field resize-none"
        style={{ resize: 'none' }}
      />
    </div>
  );
}
