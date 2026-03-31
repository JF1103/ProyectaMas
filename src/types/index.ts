export type Category =
  | 'Vivienda' | 'Servicios' | 'Transporte' | 'Alimentacion' | 'Salud'
  | 'Educacion' | 'Entretenimiento' | 'Tecnologia' | 'Ropa' | 'Deporte'
  | 'Seguros' | 'Mascotas' | 'Otros';

export const CATEGORIES: Category[] = [
  'Vivienda','Servicios','Transporte','Alimentacion','Salud',
  'Educacion','Entretenimiento','Tecnologia','Ropa','Deporte',
  'Seguros','Mascotas','Otros'
];

export const CATEGORY_ICONS: Record<Category, string> = {
  Vivienda: '🏠', Servicios: '⚡', Transporte: '🚗', Alimentacion: '🛒',
  Salud: '💊', Educacion: '📚', Entretenimiento: '🎬', Tecnologia: '💻',
  Ropa: '👕', Deporte: '🏋️', Seguros: '🛡️', Mascotas: '🐾', Otros: '📌'
};

export const CATEGORY_COLORS: Record<Category, string> = {
  Vivienda: '#6c63ff', Servicios: '#f59e0b', Transporte: '#3b82f6',
  Alimentacion: '#22c55e', Salud: '#ec4899', Educacion: '#8b5cf6',
  Entretenimiento: '#f97316', Tecnologia: '#06b6d4', Ropa: '#a855f7',
  Deporte: '#14b8a6', Seguros: '#64748b', Mascotas: '#f43f5e', Otros: '#94a3b8'
};

export interface Ingreso {
  id: string;
  descripcion: string;
  monto: number;
  fecha: string;
  mes: number;
  año: number;
}

export interface GastoFijo {
  id: string;
  nombre: string;
  categoria: Category;
  monto: number;
  fechaVencimiento: number;
  estado: 'pendiente' | 'pagado';
  nota?: string;
  mes: number;
  año: number;
}

export interface GastoVariable {
  id: string;
  descripcion: string;
  categoria: Category;
  monto: number;
  fecha: string;
  tipo: 'variable' | 'extra';
  nota?: string;
  mes: number;
  año: number;
}

export interface Tarjeta {
  id: string;
  nombre: string;
  banco: string;
  diaCierre: number;
  diaVencimiento: number;
  color: string;
}

export interface CuotaTarjeta {
  id: string;
  tarjetaId: string;
  descripcion: string;
  montoTotal: number;
  cuotasTotal: number;
  valorCuota: number;
  fechaInicio: string;
  nota?: string;
}

export interface CuotaIndependiente {
  id: string;
  descripcion: string;
  montoTotal: number;
  cuotasTotal: number;
  valorCuota: number;
  fechaInicio: string;
  nota?: string;
}

export interface MetaAhorro {
  id: string;
  descripcion: string;
  montoObjetivo: number;
  fechaLimite?: string;
}

export interface MetaAhorroRegistro {
  id: string;
  metaId: string;
  mes: number;
  año: number;
  acumulado: number;
  aporte: number;
}

export interface AppConfig {
  moneda: string;
  pais: string;
  tema: 'dark' | 'light';
  nombre: string;
}

export interface AppState {
  // Navigation
  mesActual: number;
  añoActual: number;

  // Data
  ingresos: Ingreso[];
  gastosFijos: GastoFijo[];
  gastosVariables: GastoVariable[];
  tarjetas: Tarjeta[];
  cuotasTarjeta: CuotaTarjeta[];
  cuotasIndependientes: CuotaIndependiente[];
  metas: MetaAhorro[];
  metasRegistros: MetaAhorroRegistro[];
  config: AppConfig;
}
