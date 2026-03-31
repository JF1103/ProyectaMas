// Format number as currency: 1.000.000,00
export function formatCurrency(value: number, symbol = '$'): string {
  const absValue = Math.abs(value);
  const formatted = absValue.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol} ${formatted}`;
}

export function formatCurrencyCompact(value: number, symbol = '$'): string {
  if (value >= 1_000_000) {
    return `${symbol} ${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${symbol} ${(value / 1_000).toFixed(1)}K`;
  }
  return formatCurrency(value, symbol);
}

export function parseCurrency(str: string): number {
  // Remove all non-numeric except comma and minus
  const clean = str.replace(/[^\d,\-]/g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

export function formatInputCurrency(str: string): string {
  const raw = str.replace(/[^\d,]/g, '');
  const parts = raw.split(',');
  const intPart = parts[0].replace(/\./g, '');
  const formattedInt = intPart ? parseInt(intPart, 10).toLocaleString('es-AR') : '';
  if (parts.length > 1) {
    return `${formattedInt},${parts[1].slice(0, 2)}`;
  }
  return formattedInt;
}

export const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

export function getMonthName(mes: number): string {
  return MONTHS[mes - 1] || '';
}

export function getCurrentMonth(): { mes: number; año: number } {
  const now = new Date();
  return { mes: now.getMonth() + 1, año: now.getFullYear() };
}

export function getDaysInMonth(mes: number, año: number): number {
  return new Date(año, mes, 0).getDate();
}

export function isDateToday(day: number, mes: number, año: number): boolean {
  const now = new Date();
  return now.getDate() === day && (now.getMonth() + 1) === mes && now.getFullYear() === año;
}

export function daysUntilDue(day: number, mes: number, año: number): number {
  const now = new Date();
  const due = new Date(año, mes - 1, day);
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function percentage(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function getPeriodIndex(mes: number, año: number) {
  return año * 12 + (mes - 1);
}

export function getDatePeriodIndex(fecha: string) {
  const d = new Date(`${fecha}T00:00:00`);
  return getPeriodIndex(d.getMonth() + 1, d.getFullYear());
}

export function getInstallmentProgress(fechaInicio: string, cuotasTotal: number, mes: number, año: number) {
  const inicio = getDatePeriodIndex(fechaInicio);
  const actual = getPeriodIndex(mes, año);
  const diff = actual - inicio;

  const activa = diff >= 0 && diff < cuotasTotal;

  return {
    activa,
    cuotaActual: activa ? diff + 1 : 0,
    cuotasRestantes: activa ? cuotasTotal - (diff + 1) : 0,
  };
}