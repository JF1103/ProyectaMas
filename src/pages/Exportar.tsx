import { useRef, useState } from 'react';
import { useStore, useMonthData } from '../store';
import { formatCurrency, getMonthName } from '../utils/format';
import Header from '../components/Header';
import { FileDown, Download } from 'lucide-react';
import jsPDF from 'jspdf';

export default function Exportar() {
  const store = useStore();
  const { mesActual, añoActual, config } = store;
  const data = useMonthData(mesActual, añoActual);
  const sym = config.moneda === 'ARS' ? '$' : config.moneda === 'USD' ? 'US$' : config.moneda;
  const fmt = (v: number) => formatCurrency(v, sym);
  const [loading, setLoading] = useState(false);

  async function generatePDF() {
    setLoading(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W = 210;
      const margin = 16;
      let y = 20;

      // Header
      doc.setFillColor(108, 99, 255);
      doc.rect(0, 0, W, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Proyecta+', margin, 15);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Resumen mensual — ${getMonthName(mesActual)} ${añoActual}`, margin, 23);
      y = 40;

      const line = (text: string, value: string, bold = false) => {
        doc.setFontSize(10);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setTextColor(60, 60, 80);
        doc.text(text, margin, y);
        doc.setTextColor(bold ? 30 : 80, bold ? 30 : 80, bold ? 80 : 100);
        doc.text(value, W - margin, y, { align: 'right' });
        y += 7;
      };

      const section = (title: string) => {
        y += 3;
        doc.setFillColor(240, 240, 255);
        doc.rect(margin - 2, y - 5, W - margin * 2 + 4, 9, 'F');
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(108, 99, 255);
        doc.text(title, margin, y);
        y += 8;
      };

      // Ingresos
      section('INGRESOS');
      data.ingresos.forEach((i) => line(i.descripcion, fmt(i.monto)));
      line('Total ingresos', fmt(data.totalIngresos), true);

      // Gastos fijos
      if (data.gastosFijos.length) {
        section('GASTOS FIJOS');
        data.gastosFijos.forEach((g) => line(g.nombre, fmt(g.monto)));
        line('Total gastos fijos', fmt(data.totalFijos), true);
      }

      // Gastos variables
      if (data.gastosVariables.length) {
        section('GASTOS VARIABLES Y EXTRAS');
        data.gastosVariables.forEach((g) => line(`${g.descripcion} (${g.tipo})`, fmt(g.monto)));
        line('Total variables', fmt(data.totalVariables + data.totalExtras), true);
      }

      // Cuotas
      if (data.cuotasTarjeta.length + data.cuotasIndependientes.length > 0) {
        section('CUOTAS');
        [...data.cuotasTarjeta, ...data.cuotasIndependientes].forEach((c) => {
          const desc = 'descripcion' in c ? c.descripcion : '';
          const val = 'valorCuota' in c ? c.valorCuota : 0;
          line(desc, fmt(val));
        });
        line('Total cuotas', fmt(data.totalCuotasTarjeta + data.totalCuotasIndep), true);
      }

      // Summary
      y += 5;
      section('RESUMEN');
      line('Total ingresos', fmt(data.totalIngresos));
      line('Total gastos', fmt(data.totalGastos));
      line('Disponible real', fmt(data.disponible), true);
      line('Ahorro estimado', fmt(data.ahorroEstimado), true);

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 170);
      doc.text(`Generado por Proyecta+ — ${new Date().toLocaleDateString('es-AR')}`, W / 2, 287, { align: 'center' });

      doc.save(`proyecta-${getMonthName(mesActual).toLowerCase()}-${añoActual}.pdf`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-in max-w-lg">
      <Header title="Exportar PDF" subtitle="Descargá el resumen mensual" />

      <div className="card mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)' }}>
            <FileDown size={20} style={{ color: 'var(--color-accent)' }} />
          </div>
          <div>
            <div className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>Resumen {getMonthName(mesActual)} {añoActual}</div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>PDF profesional con todos los datos del mes</div>
          </div>
        </div>

        <div className="space-y-2 mb-5">
          {[
            { label: 'Ingresos', value: fmt(data.totalIngresos), color: 'var(--color-success)' },
            { label: 'Gastos fijos', value: fmt(data.totalFijos), color: 'var(--color-danger)' },
            { label: 'Gastos variables', value: fmt(data.totalVariables + data.totalExtras), color: 'var(--color-warning)' },
            { label: 'Cuotas', value: fmt(data.totalCuotasTarjeta + data.totalCuotasIndep), color: '#8b5cf6' },
            { label: 'Disponible', value: fmt(data.disponible), color: data.disponible >= 0 ? 'var(--color-success)' : 'var(--color-danger)' },
            { label: 'Ahorro estimado', value: fmt(data.ahorroEstimado), color: 'var(--color-accent)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
              <span className="text-xs font-bold" style={{ color }}>{value}</span>
            </div>
          ))}
        </div>

        <button className="btn-primary w-full justify-center py-3" onClick={generatePDF} disabled={loading}>
          <Download size={17} />
          {loading ? 'Generando PDF...' : `Descargar PDF — ${getMonthName(mesActual)} ${añoActual}`}
        </button>
      </div>
    </div>
  );
}
