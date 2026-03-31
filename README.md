# Proyecta+

**Proyecta+** es una aplicación web de finanzas personales pensada para usuarios de Latinoamérica que quieren organizar, visualizar y proyectar su economía mensual de forma simple, clara y moderna.

La app permite registrar ingresos, gastos fijos, gastos variables, gastos extra, tarjetas de crédito, cuotas automáticas, cuotas independientes, metas de ahorro y divisas, con foco en una experiencia visual premium y orientada a la toma de decisiones.

## Objetivo

Proyecta+ no busca solo anotar gastos. Busca ayudar al usuario a responder preguntas concretas como:

- cuánto dinero tengo realmente disponible
- cuánto puedo ahorrar este mes
- cuánto me impactan mis cuotas
- qué gastos están por vencer
- cuánto podría comprar en otras monedas
- cómo evoluciona mi situación mes a mes

## Estado actual del proyecto

Versión web en desarrollo activo.

Actualmente la app funciona con almacenamiento local mediante Zustand + persist, lo que permite mantener datos en el navegador del usuario durante el uso local. En futuras versiones se planea incorporar persistencia remota para sincronización entre dispositivos y escalabilidad comercial.

## Stack tecnológico

- React
- TypeScript
- Vite
- Zustand
- Tailwind CSS
- Recharts
- Lucide React

## Funcionalidades actuales

### 1. Dashboard principal
- Resumen del mes actual
- Ingresos del mes
- Total de gastos
- Disponible real
- Ahorro estimado
- Presupuesto del mes
- Distribución del gasto
- Top categorías
- Accesos rápidos
- Alertas de vencimientos próximos
- Saludo personalizado según configuración

### 2. Navegación temporal
- Navegación por meses y años
- Visualización histórica por período
- Soporte para revisar meses anteriores
- Base para comparaciones futuras más avanzadas

### 3. Ingresos
- Alta de ingresos mensuales
- Edición y eliminación
- Asociación por mes y año

### 4. Gastos fijos
- Alta de gastos recurrentes
- Estado pendiente o pagado
- Fecha de vencimiento
- Nota opcional
- Duplicación de gastos de un mes a otro
- Alertas automáticas cuando faltan 1 o 2 días para vencer

### 5. Gastos variables y extras
- Registro de gastos variables
- Registro de gastos extra
- Categorización
- Nota opcional
- Cálculo dentro del presupuesto mensual

### 6. Tarjetas de crédito
- Alta de tarjetas
- Banco o entidad
- Día de cierre
- Día de vencimiento
- Color identificador
- Gestión de cuotas por tarjeta

### 7. Cuotas automáticas en tarjeta
- Se cargan una sola vez
- Se proyectan automáticamente a los meses siguientes
- Cálculo automático de:
  - cuota actual
  - cuotas restantes
  - impacto mensual
- Soporta múltiples cantidades de cuotas

### 8. Cuotas independientes
- Registro de préstamos, financiaciones o pagos en cuotas sin tarjeta
- Proyección automática mensual
- Cálculo de cuota actual y restantes
- Impacto mensual en el presupuesto

### 9. Proyección y ahorro
- Dinero disponible del mes
- Ahorro posible estimado
- Porcentaje del ingreso gastado
- Análisis general del período
- Metas de ahorro con historial mensual

### 10. Metas de ahorro con historial
- Creación de metas
- Objetivo total
- Fecha límite opcional
- Aporte inicial
- Aportes mensuales posteriores
- Persistencia histórica por mes
- Si se avanza de mes, la meta arrastra el acumulado anterior
- Si se vuelve a meses previos, muestra el valor histórico real de ese mes

### 11. Divisas
- Cotizaciones actualizadas
- Conversión entre moneda base y otras divisas
- Soporte actual para:
  - USD
  - EUR
  - GBP
  - CNY
  - BRL
  - CLP
- Visualización con banderas
- Cálculo de cuánto se podría comprar con el disponible actual

### 12. Configuración
- Nombre para mostrar
- Moneda
- País
- Tema claro / oscuro
- Personalización básica de la experiencia

### 13. UI/UX
- Diseño oscuro premium
- Modo claro
- Transiciones suaves entre temas
- Inputs monetarios mejorados
- Componentes reutilizables
- Enfoque visual tipo fintech

## Cómo se usa

### Flujo básico de uso
1. Elegir o revisar el mes actual
2. Cargar ingresos
3. Cargar gastos fijos
4. Cargar gastos variables y extras
5. Registrar tarjetas y cuotas
6. Registrar cuotas independientes si existen
7. Revisar dashboard y proyección
8. Consultar divisas
9. Definir metas de ahorro
10. Navegar meses anteriores o futuros para proyectar

### Uso de cuotas automáticas
- El usuario crea una cuota una sola vez
- Indica fecha de inicio y cantidad total de cuotas
- La app calcula automáticamente en qué cuota va según el mes visualizado

### Uso de metas
- El usuario crea una meta con un objetivo total
- Indica un aporte inicial
- En los meses siguientes puede agregar aportes
- La app conserva el historial mensual real

## Público objetivo

Proyecta+ está orientada a usuarios de Latinoamérica que necesitan tener control cotidiano sobre su dinero, especialmente:

- empleados en relación de dependencia
- profesionales independientes
- freelancers
- familias
- personas con tarjetas y cuotas activas
- usuarios que ahorran en moneda local y/o divisas
- personas que necesitan organizar gastos mensuales reales sin complejidad bancaria

## Problema que resuelve

Muchas personas manejan su economía con:
- memoria
- notas sueltas
- Excel improvisado
- aplicaciones demasiado complejas
- apps bancarias que no muestran una visión completa

Proyecta+ resuelve esto con una herramienta:
- visual
- simple
- moderna
- útil para el día a día
- orientada a la proyección

## Propuesta de valor

Proyecta+ ayuda a que el usuario sienta:

**“Tengo mi dinero a la vista y puedo anticiparme.”**

No solo registra movimientos. También permite entender:
- cuánto queda realmente
- qué compromisos vienen
- cuánto impactan las cuotas
- cómo evoluciona el ahorro

## Alcance actual

### Ya implementado
- estructura de navegación
- dashboard funcional
- ingresos
- gastos fijos
- gastos variables
- tarjetas
- cuotas automáticas
- cuotas independientes
- proyección
- metas con historial
- divisas
- configuración
- persistencia local

### Pendiente / roadmap
- persistencia remota
- autenticación real
- exportación PDF completa
- comparativas más avanzadas
- alertas push o email
- reportes por categoría
- sincronización entre dispositivos
- backend y modelo SaaS
- app mobile

## Persistencia de datos

Actualmente los datos se guardan en el navegador mediante almacenamiento local.

### Importante
- GitHub no guarda datos del usuario
- Esta versión conserva datos localmente en el dispositivo actual
- En una futura versión se implementará persistencia remota para evitar pérdida de información y permitir sincronización entre web y mobile

## Próximos pasos

- cerrar la versión web estable
- documentar arquitectura
- preparar backend y base remota
- lanzar versión beta
- iterar con feedback real
- luego avanzar a la app mobile

## Visión del producto

Proyecta+ apunta a convertirse en una solución financiera cotidiana para Latinoamérica:
- simple para quien no sabe de finanzas
- útil para quien sí quiere proyectar
- accesible desde web y luego mobile
- clara, visual y comercialmente escalable