import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useMemo } from 'react';
import type {
  AppState,
  Ingreso,
  GastoFijo,
  GastoVariable,
  Tarjeta,
  CuotaTarjeta,
  CuotaIndependiente,
  MetaAhorro,
  MetaAhorroRegistro,
  AppConfig
} from '../types';
import { getCurrentMonth, generateId, getInstallmentProgress } from '../utils/format';

const { mes, año } = getCurrentMonth();

interface AppStore extends AppState {
  setMes: (mes: number, año: number) => void;

  // Ingresos
  addIngreso: (i: Omit<Ingreso, 'id'>) => void;
  updateIngreso: (id: string, i: Partial<Ingreso>) => void;
  deleteIngreso: (id: string) => void;

  // Gastos fijos
  addGastoFijo: (g: Omit<GastoFijo, 'id'>) => void;
  updateGastoFijo: (id: string, g: Partial<GastoFijo>) => void;
  deleteGastoFijo: (id: string) => void;
  toggleGastoFijoPagado: (id: string) => void;
  duplicarGastosFijos: (desdeMes: number, desdeAño: number, haciaMes: number, haciaAño: number) => void;

  // Gastos variables
  addGastoVariable: (g: Omit<GastoVariable, 'id'>) => void;
  updateGastoVariable: (id: string, g: Partial<GastoVariable>) => void;
  deleteGastoVariable: (id: string) => void;

  // Tarjetas
  addTarjeta: (t: Omit<Tarjeta, 'id'>) => void;
  updateTarjeta: (id: string, t: Partial<Tarjeta>) => void;
  deleteTarjeta: (id: string) => void;

  // Cuotas tarjeta
  addCuotaTarjeta: (c: Omit<CuotaTarjeta, 'id'>) => void;
  updateCuotaTarjeta: (id: string, c: Partial<CuotaTarjeta>) => void;
  deleteCuotaTarjeta: (id: string) => void;

  // Cuotas independientes
  addCuotaIndependiente: (c: Omit<CuotaIndependiente, 'id'>) => void;
  updateCuotaIndependiente: (id: string, c: Partial<CuotaIndependiente>) => void;
  deleteCuotaIndependiente: (id: string) => void;

  // Metas
  addMeta: (m: Omit<MetaAhorro, 'id'>, acumuladoInicial?: number, mes?: number, año?: number) => void;
  updateMeta: (id: string, m: Partial<MetaAhorro>) => void;
  deleteMeta: (id: string) => void;
  setMetaAporteMensual: (metaId: string, aporte: number, mes: number, año: number) => void;

  // Config
  updateConfig: (c: Partial<AppConfig>) => void;
}

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      mesActual: mes,
      añoActual: año,

      ingresos: [],
      gastosFijos: [],
      gastosVariables: [],
      tarjetas: [],
      cuotasTarjeta: [],
      cuotasIndependientes: [],

      metas: [],
      metasRegistros: [],

      config: {
        moneda: 'ARS',
        pais: 'Argentina',
        tema: 'dark',
        nombre: '',
      },

      setMes: (mesActual, añoActual) => set({ mesActual, añoActual }),

      addIngreso: (i) =>
        set((s) => ({ ingresos: [...s.ingresos, { ...i, id: generateId() }] })),
      updateIngreso: (id, i) =>
        set((s) => ({ ingresos: s.ingresos.map((x) => (x.id === id ? { ...x, ...i } : x)) })),
      deleteIngreso: (id) =>
        set((s) => ({ ingresos: s.ingresos.filter((x) => x.id !== id) })),

      addGastoFijo: (g) =>
        set((s) => ({ gastosFijos: [...s.gastosFijos, { ...g, id: generateId() }] })),
      updateGastoFijo: (id, g) =>
        set((s) => ({ gastosFijos: s.gastosFijos.map((x) => (x.id === id ? { ...x, ...g } : x)) })),
      deleteGastoFijo: (id) =>
        set((s) => ({ gastosFijos: s.gastosFijos.filter((x) => x.id !== id) })),
      toggleGastoFijoPagado: (id) =>
        set((s) => ({
          gastosFijos: s.gastosFijos.map((x) =>
            x.id === id ? { ...x, estado: x.estado === 'pagado' ? 'pendiente' : 'pagado' } : x
          ),
        })),
      duplicarGastosFijos: (desdeMes, desdeAño, haciaMes, haciaAño) =>
        set((s) => {
          const origen = s.gastosFijos.filter((g) => g.mes === desdeMes && g.año === desdeAño);
          const nuevos = origen.map((g) => ({
            ...g,
            id: generateId(),
            mes: haciaMes,
            año: haciaAño,
            estado: 'pendiente' as const,
          }));
          return { gastosFijos: [...s.gastosFijos, ...nuevos] };
        }),

      addGastoVariable: (g) =>
        set((s) => ({ gastosVariables: [...s.gastosVariables, { ...g, id: generateId() }] })),
      updateGastoVariable: (id, g) =>
        set((s) => ({ gastosVariables: s.gastosVariables.map((x) => (x.id === id ? { ...x, ...g } : x)) })),
      deleteGastoVariable: (id) =>
        set((s) => ({ gastosVariables: s.gastosVariables.filter((x) => x.id !== id) })),

      addTarjeta: (t) =>
        set((s) => ({ tarjetas: [...s.tarjetas, { ...t, id: generateId() }] })),
      updateTarjeta: (id, t) =>
        set((s) => ({ tarjetas: s.tarjetas.map((x) => (x.id === id ? { ...x, ...t } : x)) })),
      deleteTarjeta: (id) =>
        set((s) => ({ tarjetas: s.tarjetas.filter((x) => x.id !== id) })),

      addCuotaTarjeta: (c) =>
        set((s) => ({ cuotasTarjeta: [...s.cuotasTarjeta, { ...c, id: generateId() }] })),
      updateCuotaTarjeta: (id, c) =>
        set((s) => ({ cuotasTarjeta: s.cuotasTarjeta.map((x) => (x.id === id ? { ...x, ...c } : x)) })),
      deleteCuotaTarjeta: (id) =>
        set((s) => ({ cuotasTarjeta: s.cuotasTarjeta.filter((x) => x.id !== id) })),

      addCuotaIndependiente: (c) =>
        set((s) => ({ cuotasIndependientes: [...s.cuotasIndependientes, { ...c, id: generateId() }] })),
      updateCuotaIndependiente: (id, c) =>
        set((s) => ({
          cuotasIndependientes: s.cuotasIndependientes.map((x) => (x.id === id ? { ...x, ...c } : x)),
        })),
      deleteCuotaIndependiente: (id) =>
        set((s) => ({ cuotasIndependientes: s.cuotasIndependientes.filter((x) => x.id !== id) })),

      addMeta: (m, acumuladoInicial = 0, mesRegistro = mes, añoRegistro = año) =>
        set((s) => {
          const metaId = generateId();

          const nuevaMeta: MetaAhorro = {
            ...m,
            id: metaId,
          };

          const nuevoRegistro: MetaAhorroRegistro = {
            id: generateId(),
            metaId,
            mes: mesRegistro,
            año: añoRegistro,
            acumulado: acumuladoInicial,
            aporte: acumuladoInicial,
          };

          return {
            metas: [...s.metas, nuevaMeta],
            metasRegistros: [...s.metasRegistros, nuevoRegistro],
          };
        }),

      updateMeta: (id, m) =>
        set((s) => ({
          metas: s.metas.map((x) => (x.id === id ? { ...x, ...m } : x)),
        })),

      deleteMeta: (id) =>
        set((s) => ({
          metas: s.metas.filter((x) => x.id !== id),
          metasRegistros: s.metasRegistros.filter((r) => r.metaId !== id),
        })),

      setMetaAporteMensual: (metaId, aporte, mesActualRegistro, añoActualRegistro) =>
        set((s) => {
          const periodIndex = añoActualRegistro * 12 + mesActualRegistro;

          const registrosMeta = s.metasRegistros
            .filter((r) => r.metaId === metaId)
            .sort((a, b) => a.año * 12 + a.mes - (b.año * 12 + b.mes));

          const registroExistente = registrosMeta.find(
            (r) => r.mes === mesActualRegistro && r.año === añoActualRegistro
          );

          let acumuladoAnterior = 0;
          const anteriores = registrosMeta.filter((r) => r.año * 12 + r.mes < periodIndex);

          if (anteriores.length > 0) {
            acumuladoAnterior = anteriores[anteriores.length - 1].acumulado;
          }

          const nuevoAcumulado = acumuladoAnterior + aporte;

          let nuevosRegistros = [...s.metasRegistros];

          if (registroExistente) {
            nuevosRegistros = nuevosRegistros.map((r) =>
              r.id === registroExistente.id ? { ...r, aporte, acumulado: nuevoAcumulado } : r
            );
          } else {
            nuevosRegistros.push({
              id: generateId(),
              metaId,
              mes: mesActualRegistro,
              año: añoActualRegistro,
              aporte,
              acumulado: nuevoAcumulado,
            });
          }

          return { metasRegistros: nuevosRegistros };
        }),

      updateConfig: (c) =>
        set((s) => ({ config: { ...s.config, ...c } })),
    }),
    { name: 'proyecta-plus-storage' }
  )
);

type CuotaTarjetaActiva = CuotaTarjeta & {
  cuotaActual: number;
  cuotasRestantes: number;
};

type CuotaIndependienteActiva = CuotaIndependiente & {
  cuotaActual: number;
  cuotasRestantes: number;
};

// Selectors
export function useMonthData(mes: number, año: number) {
  const ingresosBase = useStore((s) => s.ingresos);
  const gastosFijosBase = useStore((s) => s.gastosFijos);
  const gastosVariablesBase = useStore((s) => s.gastosVariables);
  const cuotasTarjetaBase = useStore((s) => s.cuotasTarjeta);
  const cuotasIndependientesBase = useStore((s) => s.cuotasIndependientes);

  return useMemo(() => {
    const ingresos = ingresosBase.filter((x) => x.mes === mes && x.año === año);
    const gastosFijos = gastosFijosBase.filter((x) => x.mes === mes && x.año === año);
    const gastosVariables = gastosVariablesBase.filter((x) => x.mes === mes && x.año === año);

    const cuotasTarjeta: CuotaTarjetaActiva[] = cuotasTarjetaBase.flatMap((x) => {
      const progress = getInstallmentProgress(x.fechaInicio, x.cuotasTotal, mes, año);
      return progress.activa
        ? [{ ...x, cuotaActual: progress.cuotaActual, cuotasRestantes: progress.cuotasRestantes }]
        : [];
    });

    const cuotasIndependientes: CuotaIndependienteActiva[] = cuotasIndependientesBase.flatMap((x) => {
      const progress = getInstallmentProgress(x.fechaInicio, x.cuotasTotal, mes, año);
      return progress.activa
        ? [{ ...x, cuotaActual: progress.cuotaActual, cuotasRestantes: progress.cuotasRestantes }]
        : [];
    });

    const totalIngresos = ingresos.reduce((acc, x) => acc + x.monto, 0);
    const totalFijos = gastosFijos.reduce((acc, x) => acc + x.monto, 0);
    const totalVariables = gastosVariables.filter((x) => x.tipo === 'variable').reduce((acc, x) => acc + x.monto, 0);
    const totalExtras = gastosVariables.filter((x) => x.tipo === 'extra').reduce((acc, x) => acc + x.monto, 0);
    const totalCuotasTarjeta = cuotasTarjeta.reduce((acc, x) => acc + x.valorCuota, 0);
    const totalCuotasIndep = cuotasIndependientes.reduce((acc, x) => acc + x.valorCuota, 0);

    const totalGastos = totalFijos + totalVariables + totalExtras + totalCuotasTarjeta + totalCuotasIndep;
    const disponible = totalIngresos - totalGastos;
    const ahorroEstimado = Math.max(0, disponible);

    return {
      ingresos,
      gastosFijos,
      gastosVariables,
      cuotasTarjeta,
      cuotasIndependientes,
      totalIngresos,
      totalFijos,
      totalVariables,
      totalExtras,
      totalCuotasTarjeta,
      totalCuotasIndep,
      totalGastos,
      disponible,
      ahorroEstimado,
    };
  }, [
    ingresosBase,
    gastosFijosBase,
    gastosVariablesBase,
    cuotasTarjetaBase,
    cuotasIndependientesBase,
    mes,
    año,
  ]);
}

type MetaAhorroView = MetaAhorro & {
  acumulado: number;
  aporteDelMes: number;
};

export function useMetasDelMes(mes: number, año: number) {
  const metas = useStore((s) => s.metas);
  const metasRegistros = useStore((s) => s.metasRegistros);

  return useMemo(() => {
    const periodIndex = año * 12 + mes;

    return metas.map((meta): MetaAhorroView => {
      const registrosMeta = metasRegistros
        .filter((r) => r.metaId === meta.id)
        .sort((a, b) => (a.año * 12 + a.mes) - (b.año * 12 + b.mes));

      const registroDelMes = registrosMeta.find((r) => r.mes === mes && r.año === año);

      if (registroDelMes) {
        return {
          ...meta,
          acumulado: registroDelMes.acumulado,
          aporteDelMes: registroDelMes.aporte,
        };
      }

      const anteriores = registrosMeta.filter((r) => (r.año * 12 + r.mes) < periodIndex);
      const ultimoAnterior = anteriores.length > 0 ? anteriores[anteriores.length - 1] : null;

      return {
        ...meta,
        acumulado: ultimoAnterior?.acumulado ?? 0,
        aporteDelMes: 0,
      };
    });
  }, [metas, metasRegistros, mes, año]);
}