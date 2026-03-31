import { useState, useEffect, useCallback } from 'react';
import { useStore, useMonthData } from '../store';
import { formatCurrency } from '../utils/format';
import Header from '../components/Header';
import CurrencyInput, { parseCurrencyInput } from '../components/CurrencyInput';
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Rate { code: string; name: string; symbol: string; buy?: number; sell?: number; price?: number; flag: string; }
interface FetchedRates { [key: string]: number }

const CURRENCIES: Rate[] = [
  { code: 'USD', name: 'Dólar estadounidense', symbol: 'US$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', name: 'Libra esterlina', symbol: '£', flag: '🇬🇧' },
  { code: 'CNY', name: 'Yuan chino', symbol: '¥', flag: '🇨🇳' },
  { code: 'BRL', name: 'Real brasileño', symbol: 'R$', flag: '🇧🇷' },
  { code: 'CLP', name: 'Peso chileno', symbol: 'CLP$', flag: '🇨🇱' },
];

export default function Divisas() {
  const { mesActual, añoActual, config } = useStore();
  const data = useMonthData(mesActual, añoActual);
  const sym = config.moneda === 'ARS' ? '$' : 'US$';
  const fmt = (v: number) => formatCurrency(v, sym);

  const [rates, setRates] = useState<FetchedRates>({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [error, setError] = useState('');
  const [convertAmount, setConvertAmount] = useState('');
  const [fromCode, setFromCode] = useState('USD');

  const fetchRates = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      if (!res.ok) throw new Error('Error al obtener cotizaciones');
      const json = await res.json();
      setRates(json.rates);
      setLastUpdated(new Date().toLocaleString('es-AR'));
    } catch {
      // Fallback with approximate rates
      setRates({ ARS: 1050, EUR: 0.92, GBP: 0.79, CNY: 7.24, BRL: 4.97, CLP: 900 });
      setLastUpdated(new Date().toLocaleString('es-AR') + ' (estimado)');
      setError('No se pudo conectar a la API. Mostrando valores aproximados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchRates, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchRates]);

  function convertTo(targetCode: string): number {
    const amount = parseCurrencyInput(convertAmount);
    if (!amount || !rates[targetCode]) return 0;
    const baseIsARS = config.moneda === 'ARS';
    if (baseIsARS && rates['ARS'] && rates[targetCode]) {
      return amount / rates['ARS'] * rates[targetCode];
    }
    return amount * rates[targetCode];
  }

  function getRateDisplay(code: string): number {
    if (!rates[code] || !rates['ARS']) return 0;
    const arsPerCode = rates['ARS'] / rates[code];
    return arsPerCode;
  }

  const available = data.disponible;
  const convertedAvailable = (code: string) => {
    if (!rates[code] || !rates['ARS']) return 0;
    return available / rates['ARS'] * rates[code];
  };

  return (
    <div className="animate-fade-in">
      <Header title="Divisas y Cotizaciones" />

      {error && (
        <div className="mb-4 p-3 rounded-xl text-xs" style={{ background: 'color-mix(in srgb, var(--color-warning) 12%, transparent)', color: 'var(--color-warning)', border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)' }}>
          {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Actualizado: {lastUpdated || '—'} · Base: USD
        </div>
        <button className="btn-secondary py-1.5 px-3 text-xs" onClick={fetchRates} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {/* Rate cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        {CURRENCIES.map((c) => {
          const arsRate = getRateDisplay(c.code);
          return (
            <div key={c.code} className="card-sm cursor-pointer hover:border-accent transition-colors"
              onClick={() => setFromCode(c.code)}
              style={{ borderColor: fromCode === c.code ? 'var(--color-accent)' : 'var(--color-border)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xl">{c.flag}</span>
                <span className="badge-accent">{c.code}</span>
              </div>
              <div className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{c.name}</div>
              {config.moneda === 'ARS' && arsRate > 0 && (
                <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  $ {arsRate.toLocaleString('es-AR', { maximumFractionDigits: 2 })} por {c.symbol}1
                </div>
              )}
              {!arsRate && loading && (
                <div className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>Cargando...</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Converter */}
      <div className="card mb-6">
        <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--color-text)' }}>Conversor de monedas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <CurrencyInput label={`Monto en ${config.moneda}`} value={convertAmount} onChange={setConvertAmount}
              symbol={sym} placeholder="Ingresá un monto" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Convertir a</label>
            <div className="grid grid-cols-2 gap-2">
              {CURRENCIES.filter((c) => c.code !== config.moneda).map((c) => {
                const converted = convertTo(c.code);
                return (
                  <div key={c.code} className="p-3 rounded-xl" style={{ background: 'var(--color-surface-2)' }}>
                    <div className="text-xs mb-1" style={{ color: 'var(--color-text-subtle)' }}>{c.flag} {c.code}</div>
                    <div className="font-bold text-sm" style={{ color: 'var(--color-accent)' }}>
                      {converted > 0 ? `${c.symbol} ${converted.toLocaleString('es-AR', { maximumFractionDigits: 6 })}` : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* What I could buy with available balance */}
      {available > 0 && (
        <div className="card">
          <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--color-text)' }}>Con tu disponible actual ({fmt(available)}) podrías comprar…</h3>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>Equivalencias aproximadas de tu dinero disponible del mes</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {CURRENCIES.map((c) => {
              const amount = convertedAvailable(c.code);
              if (amount <= 0) return null;
              return (
                <div key={c.code} className="p-3 rounded-xl" style={{ background: 'var(--color-surface-2)' }}>
                  <div className="text-base mb-1">{c.flag}</div>
                  <div className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>
                    {c.symbol} {amount.toLocaleString('es-AR', { maximumFractionDigits: 4 })}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{c.name}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
