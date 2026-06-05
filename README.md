# FinApp – Finanzas del Hogar 💙

App web de finanzas personales para **Juli y Mari**. Reemplaza el Excel mensual con una experiencia fintech moderna, colaborativa y en tiempo real.

---

## 🏗 Estructura del proyecto

```
finapp/
├── index.html          # App completa (sin build)
├── styles.css          # Estilos fintech responsive
├── script.js           # Toda la lógica (vanilla JS)
├── supabase-schema.sql # Base de datos + RLS
└── README.md
```

---

## ⚡ Setup rápido (15 minutos)

### PASO 1 – Crear proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com) → New Project
2. Nombre: `finapp`, Region: más cercana a Argentina (São Paulo)
3. Esperar que termine de crear (~2 min)

### PASO 2 – Ejecutar el esquema SQL

1. En Supabase → **SQL Editor** → New Query
2. Pegar el contenido completo de `supabase-schema.sql`
3. Ejecutar (Run)

### PASO 3 – Activar Realtime

1. Ir a **Database → Replication**
2. Habilitar para las tablas:
   - `incomes`
   - `fixed_expenses`
   - `variable_expenses`
   - `card_transactions`
   - `independent_installments`

### PASO 4 – Crear los usuarios

1. Ir a **Authentication → Users → Add User**
2. Crear usuario Juli:
   - Email: `juli@tuemail.com`
   - Password: (la que quieran)
   - ✅ Auto Confirm User
3. Crear usuario Mari igual

### PASO 5 – Configurar la URL y Key en el código

Abrir `script.js`, las primeras líneas:

```javascript
const SUPABASE_URL  = 'https://TU-PROJECT-ID.supabase.co';
const SUPABASE_ANON = 'TU-ANON-KEY-AQUI';
```

Los valores están en: **Settings → API**:
- `Project URL` → va en `SUPABASE_URL`
- `anon public` key → va en `SUPABASE_ANON`

### PASO 6 – Crear el hogar y vincular usuarios

En **SQL Editor** de Supabase:

```sql
-- 1. Crear el hogar
INSERT INTO households (name)
VALUES ('Hogar de Juli y Mari')
RETURNING id;
```

Copiá el UUID que devuelve. Luego:

```sql
-- 2. Vincular Juli (reemplazá el UUID y el email)
UPDATE profiles
SET household_id  = 'UUID-DEL-HOGAR',
    display_name  = 'Juli',
    avatar_color  = '#4f79f7'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'juli@tuemail.com'
);

-- 3. Vincular Mari
UPDATE profiles
SET household_id  = 'UUID-DEL-HOGAR',
    display_name  = 'Mari',
    avatar_color  = '#f77fbf'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'mari@tuemail.com'
);
```

> **⚠️ Importante:** Los perfiles se crean cuando el usuario hace su primer login. Si no aparecen en la tabla `profiles`, primero iniciá sesión una vez y luego corré el UPDATE.

---

## 🚀 Subir a Netlify

1. Comprimir los 4 archivos en un ZIP (o subir la carpeta al repositorio)
2. En [netlify.com](https://netlify.com) → Add new site → Deploy manually
3. Arrastrar la carpeta o el ZIP
4. ¡Listo! La URL quedará algo como `https://finapp-juli-mari.netlify.app`

**No requiere configuración adicional en Netlify.** Todo corre en el navegador.

---

## 📱 Funcionalidades

| Sección | Descripción |
|---|---|
| 🏠 Dashboard | Resumen del mes, saldo disponible, alertas, gráficos |
| 💰 Ingresos | Sueldo Juli, Mari, ingresos extras |
| 🏠 Gastos Fijos | Lista preconfigurada + estados pagado/pendiente |
| 🛒 Gastos Variables | Con categorías, filtros, métodos de pago |
| 💳 Tarjetas | 4 tarjetas preconfiguradas, consumos en ARS/USD |
| 📂 Importar | Subir CSV/XLSX del resumen del banco con preview |
| 📅 Cuotas | Cuotas independientes con progreso visual |
| 📊 Ahorro | Proyección, metas, escenarios de reducción |
| 💵 Dólar | Cotización oficial en tiempo real (DolarAPI) |
| 📈 Anual | Resumen mes a mes con gráfico de barras |
| 📤 Exportar | JSON y CSV, imprimir/PDF |
| ⚙️ Config | Perfil, tema, reset del mes |

---

## 🔄 Sincronización en tiempo real

- Si **Juli** carga un gasto, **Mari** lo ve actualizado automáticamente (y viceversa)
- Funciona usando **Supabase Realtime** (WebSockets)
- El indicador de estado muestra: `Guardando…` / `Guardado` / `Error` / `Sin conexión`
- Si se pierde internet, aparece aviso. Los datos no se pierden (quedan en Supabase al reconectar)

---

## 💵 API del Dólar

Fuente principal: **DolarAPI.com** (datos del BCRA)
- Fuente secundaria: **ArgentinaDatos.com**
- Si ambas fallan: muestra la última cotización guardada en localStorage
- La cotización se cachea 30 minutos para no saturar la API
- Se guarda una copia histórica en Supabase (`dollar_rates`)

---

## 🔒 Seguridad

- **Row Level Security** activa en todas las tablas
- Solo usuarios del mismo `household_id` pueden ver/editar los datos
- Nadie externo puede acceder aunque tenga la URL
- La `anon key` de Supabase es pública por diseño (así funciona el cliente JS), pero las policies RLS garantizan el aislamiento de datos

---

## 🛠 Mantenimiento

### Cambiar la contraseña de un usuario
En Supabase → Authentication → Users → Reset Password

### Agregar un nuevo mes
El selector de mes/año está siempre visible. Al cambiar el mes, la app carga los datos de ese período automáticamente.

### Duplicar gastos fijos del mes anterior
En la sección "Gastos Fijos" → botón **"Duplicar mes anterior"**. Solo duplica los que no existan ya.

### Borrar datos de un mes
Configuración → "Zona peligrosa" → Borrar todos los datos de este mes.

---

## 📋 Tarjetas predeterminadas

La app viene con 4 tarjetas configuradas:
- **Visa crédito Juli** (azul)
- **Mercado Pago Juli** (cyan)
- **Visa crédito Mari** (violeta)
- **Mastercard Mari** (rojo)

Podés editarlas, eliminarlas o agregar nuevas desde la sección Tarjetas.

---

## 🐛 Problemas frecuentes

| Problema | Solución |
|---|---|
| "Sin hogar asignado" | Ejecutar el SQL del Paso 6 |
| No se sincronizan los datos | Activar Realtime en Supabase (Paso 3) |
| Error de login | Verificar que el usuario esté en Auth → Users |
| El dólar no carga | Verificar conexión; se mostrará la última cotización guardada |
| Los datos no se guardan | Verificar `SUPABASE_URL` y `SUPABASE_ANON` en `script.js` |

---

## ❤️ Hecho con amor para Juli y Mari

UUID: 5d7e9f4e-e0aa-4928-b620-d97f88034901