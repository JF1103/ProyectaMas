import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Ingresos from './pages/Ingresos'
import GastosFijos from './pages/GastosFijos'
import GastosVariables from './pages/GastosVariables'
import Tarjetas from './pages/Tarjetas'
import Cuotas from './pages/Cuotas'
import Proyeccion from './pages/Proyeccion'
import Divisas from './pages/Divisas'
import Historial from './pages/Historial'
import Exportar from './pages/Exportar'
import Alertas from './pages/Alertas'
import Configuracion from './pages/Configuracion'
import { useStore } from './store'

function AppInner() {
  const store = useStore?.()
  const tema = store?.config?.tema ?? 'dark'

  useEffect(() => {
    document.documentElement.classList.toggle('light', tema === 'light')
  }, [tema])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg, #0f172a)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 md:p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/ingresos" element={<Ingresos />} />
            <Route path="/gastos-fijos" element={<GastosFijos />} />
            <Route path="/gastos-variables" element={<GastosVariables />} />
            <Route path="/tarjetas" element={<Tarjetas />} />
            <Route path="/cuotas" element={<Cuotas />} />
            <Route path="/proyeccion" element={<Proyeccion />} />
            <Route path="/divisas" element={<Divisas />} />
            <Route path="/historial" element={<Historial />} />
            <Route path="/exportar" element={<Exportar />} />
            <Route path="/alertas" element={<Alertas />} />
            <Route path="/configuracion" element={<Configuracion />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  )
}