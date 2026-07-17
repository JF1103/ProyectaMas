-- ============================================================
-- FINAPP – ESQUEMA SUPABASE
-- Personal Finance App for Juli & Mari
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- FUNCIÓN: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLA: households
-- Un hogar agrupa a los dos usuarios
-- ============================================================
CREATE TABLE households (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT 'Mi Hogar',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: profiles
-- Perfil extendido de cada usuario de auth.users
-- ============================================================
CREATE TABLE profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id   UUID REFERENCES households(id) ON DELETE SET NULL,
  display_name   TEXT NOT NULL DEFAULT 'Usuario',
  avatar_color   TEXT DEFAULT '#4f79f7',
  role           TEXT DEFAULT 'member',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- FUNCIÓN HELPER: obtener household_id del usuario actual
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_household_id()
RETURNS UUID AS $$
  SELECT household_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- TABLA: incomes – Ingresos mensuales
-- ============================================================
CREATE TABLE incomes (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id  UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  month         SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year          SMALLINT NOT NULL CHECK (year BETWEEN 2020 AND 2099),
  description   TEXT NOT NULL,
  amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
  person        TEXT DEFAULT 'Ambos', -- Juli | Mari | Ambos | Otro
  income_date   DATE,
  notes         TEXT,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_incomes_updated_at BEFORE UPDATE ON incomes FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE INDEX idx_incomes_hh_ym ON incomes(household_id, year, month);

-- ============================================================
-- TABLA: fixed_expenses – Gastos fijos mensuales
-- ============================================================
CREATE TABLE fixed_expenses (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id  UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  month         SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year          SMALLINT NOT NULL CHECK (year BETWEEN 2020 AND 2099),
  description   TEXT NOT NULL,
  amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
  category      TEXT DEFAULT 'General',
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  due_date      DATE,
  person        TEXT DEFAULT 'Ambos',
  notes         TEXT,
  sort_order    INTEGER DEFAULT 0,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_fixed_updated_at BEFORE UPDATE ON fixed_expenses FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE INDEX idx_fixed_hh_ym ON fixed_expenses(household_id, year, month);

-- ============================================================
-- TABLA: variable_expenses – Gastos variables/extras
-- ============================================================
CREATE TABLE variable_expenses (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  month           SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year            SMALLINT NOT NULL CHECK (year BETWEEN 2020 AND 2099),
  description     TEXT NOT NULL,
  amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
  category        TEXT DEFAULT 'General',
  expense_date    DATE,
  person          TEXT DEFAULT 'Ambos',
  payment_method  TEXT DEFAULT 'efectivo', -- efectivo | débito | crédito | transferencia | otro
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_variable_updated_at BEFORE UPDATE ON variable_expenses FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE INDEX idx_variable_hh_ym ON variable_expenses(household_id, year, month);
CREATE INDEX idx_variable_category ON variable_expenses(household_id, category);

-- ============================================================
-- TABLA: credit_cards – Tarjetas de crédito
-- ============================================================
CREATE TABLE credit_cards (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id  UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  holder        TEXT NOT NULL,
  bank          TEXT,
  last_four     TEXT,
  color         TEXT DEFAULT '#4f79f7',
  is_active     BOOLEAN DEFAULT true,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_cards_updated_at BEFORE UPDATE ON credit_cards FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE INDEX idx_cards_hh ON credit_cards(household_id);

-- ============================================================
-- TABLA: card_summaries – Resumen mensual de cada tarjeta
-- ============================================================
CREATE TABLE card_summaries (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id       UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  household_id  UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  month         SMALLINT NOT NULL,
  year          SMALLINT NOT NULL,
  total_amount  NUMERIC(14,2) DEFAULT 0,
  paid_amount   NUMERIC(14,2) DEFAULT 0,
  closing_date  DATE,
  due_date      DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(card_id, month, year)
);
CREATE TRIGGER trg_card_summaries_updated_at BEFORE UPDATE ON card_summaries FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- TABLA: card_transactions – Consumos de tarjeta
-- ============================================================
CREATE TABLE card_transactions (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id                UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  household_id           UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  month                  SMALLINT NOT NULL,
  year                   SMALLINT NOT NULL,
  description            TEXT NOT NULL,
  amount_ars             NUMERIC(14,2) DEFAULT 0,
  amount_usd             NUMERIC(14,2) DEFAULT 0,
  currency               TEXT DEFAULT 'ARS' CHECK (currency IN ('ARS','USD')),
  dollar_rate            NUMERIC(10,2),
  converted_ars          NUMERIC(14,2) DEFAULT 0,
  total_installments     INTEGER DEFAULT 1,
  current_installment    INTEGER DEFAULT 1,
  remaining_installments INTEGER DEFAULT 0,
  status                 TEXT DEFAULT 'pending' CHECK (status IN ('pending','paid','finished')),
  transaction_date       DATE,
  notes                  TEXT,
  imported               BOOLEAN DEFAULT false,
  created_by             UUID REFERENCES auth.users(id),
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_card_tx_updated_at BEFORE UPDATE ON card_transactions FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE INDEX idx_card_tx_card_ym ON card_transactions(card_id, year, month);
CREATE INDEX idx_card_tx_hh_ym   ON card_transactions(household_id, year, month);

-- ============================================================
-- TABLA: independent_installments – Cuotas independientes
-- ============================================================
CREATE TABLE independent_installments (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id           UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  description            TEXT NOT NULL,
  total_amount           NUMERIC(14,2) NOT NULL DEFAULT 0,
  installment_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_installments     INTEGER NOT NULL DEFAULT 1,
  paid_installments      INTEGER DEFAULT 0,
  remaining_installments INTEGER DEFAULT 0,
  start_date             DATE,
  status                 TEXT DEFAULT 'active' CHECK (status IN ('active','finished','paused')),
  person                 TEXT DEFAULT 'Ambos',
  notes                  TEXT,
  created_by             UUID REFERENCES auth.users(id),
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_installments_updated_at BEFORE UPDATE ON independent_installments FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE INDEX idx_installments_hh ON independent_installments(household_id, status);

-- ============================================================
-- TABLA: saving_goals – Meta de ahorro mensual
-- ============================================================
CREATE TABLE saving_goals (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id       UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  month              SMALLINT NOT NULL,
  year               SMALLINT NOT NULL,
  monthly_goal       NUMERIC(14,2) DEFAULT 0,
  ideal_percentage   NUMERIC(5,2) DEFAULT 20,
  minimum_reserve    NUMERIC(14,2) DEFAULT 0,
  goal_description   TEXT,
  goal_type          TEXT DEFAULT 'general',
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, month, year)
);
CREATE TRIGGER trg_goals_updated_at BEFORE UPDATE ON saving_goals FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- TABLA: dollar_rates – Cotizaciones del dólar guardadas
-- ============================================================
CREATE TABLE dollar_rates (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id  UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  buy_rate      NUMERIC(10,2),
  sell_rate     NUMERIC(10,2),
  blue_buy      NUMERIC(10,2),
  blue_sell     NUMERIC(10,2),
  source        TEXT,
  rate_date     DATE,
  fetched_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_dollar_hh ON dollar_rates(household_id, fetched_at DESC);

-- ============================================================
-- TABLA: imports_log – Historial de importaciones
-- ============================================================
CREATE TABLE imports_log (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  card_id         UUID REFERENCES credit_cards(id),
  month           SMALLINT NOT NULL,
  year            SMALLINT NOT NULL,
  filename        TEXT,
  rows_imported   INTEGER DEFAULT 0,
  rows_skipped    INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'success',
  notes           TEXT,
  imported_by     UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE households            ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE incomes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_expenses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE variable_expenses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards          ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_summaries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE independent_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE saving_goals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE dollar_rates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE imports_log           ENABLE ROW LEVEL SECURITY;

-- ---- HOUSEHOLDS ----
CREATE POLICY "Ver propio hogar" ON households
  FOR SELECT USING (id = get_user_household_id());
CREATE POLICY "Crear hogar" ON households
  FOR INSERT WITH CHECK (true);

-- ---- PROFILES ----
CREATE POLICY "Ver perfil propio" ON profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "Ver miembros del hogar" ON profiles
  FOR SELECT USING (household_id = get_user_household_id());
CREATE POLICY "Crear perfil propio" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "Actualizar perfil propio" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- ---- INCOMES ----
CREATE POLICY "Hogar puede todo en incomes" ON incomes
  USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

-- ---- FIXED EXPENSES ----
CREATE POLICY "Hogar puede todo en fixed_expenses" ON fixed_expenses
  USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

-- ---- VARIABLE EXPENSES ----
CREATE POLICY "Hogar puede todo en variable_expenses" ON variable_expenses
  USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

-- ---- CREDIT CARDS ----
CREATE POLICY "Hogar puede todo en credit_cards" ON credit_cards
  USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

-- ---- CARD SUMMARIES ----
CREATE POLICY "Hogar puede todo en card_summaries" ON card_summaries
  USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

-- ---- CARD TRANSACTIONS ----
CREATE POLICY "Hogar puede todo en card_transactions" ON card_transactions
  USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

-- ---- INDEPENDENT INSTALLMENTS ----
CREATE POLICY "Hogar puede todo en independent_installments" ON independent_installments
  USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

-- ---- SAVING GOALS ----
CREATE POLICY "Hogar puede todo en saving_goals" ON saving_goals
  USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

-- ---- DOLLAR RATES ----
CREATE POLICY "Hogar puede todo en dollar_rates" ON dollar_rates
  USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

-- ---- IMPORTS LOG ----
CREATE POLICY "Hogar puede todo en imports_log" ON imports_log
  USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

-- ============================================================
-- MIGRACIÓN: expense_movements
-- Historial de ajustes sobre gastos fijos y variables
-- Ejecutar en Supabase Dashboard > SQL Editor
-- ============================================================
CREATE TABLE IF NOT EXISTS expense_movements (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id   UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expense_type   TEXT NOT NULL CHECK (expense_type IN ('fixed', 'variable')),
  expense_id     UUID NOT NULL,
  movement_type  TEXT NOT NULL CHECK (movement_type IN ('add', 'subtract')),
  amount         NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  date           DATE,
  description    TEXT NOT NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE expense_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hogar puede todo en expense_movements" ON expense_movements
  USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

-- Índice para búsquedas por gasto
CREATE INDEX IF NOT EXISTS idx_expense_movements_expense_id ON expense_movements(expense_id);

-- ============================================================
-- MIGRACIÓN: budgeted_amount en gastos fijos y variables
-- Ejecutar en Supabase Dashboard > SQL Editor
-- ============================================================
ALTER TABLE fixed_expenses
  ADD COLUMN IF NOT EXISTS budgeted_amount NUMERIC(14,2) DEFAULT 0;
UPDATE fixed_expenses
  SET budgeted_amount = amount
  WHERE budgeted_amount IS NULL OR budgeted_amount = 0;

ALTER TABLE variable_expenses
  ADD COLUMN IF NOT EXISTS budgeted_amount NUMERIC(14,2) DEFAULT 0;
UPDATE variable_expenses
  SET budgeted_amount = amount
  WHERE budgeted_amount IS NULL OR budgeted_amount = 0;

-- ============================================================
-- MIGRACIÓN: Fechas de cierre y vencimiento en tarjetas
-- Ejecutar en Supabase Dashboard > SQL Editor
-- ============================================================
ALTER TABLE credit_cards
  ADD COLUMN IF NOT EXISTS closing_date DATE;
ALTER TABLE credit_cards
  ADD COLUMN IF NOT EXISTS due_date DATE;

-- ============================================================
-- MIGRACIÓN: card_transaction_monthly_status
-- Estado pagado/pendiente por mes para cada consumo de tarjeta.
-- Ejecutar en Supabase Dashboard > SQL Editor
-- ============================================================
CREATE TABLE IF NOT EXISTS card_transaction_monthly_status (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  transaction_id  UUID NOT NULL REFERENCES card_transactions(id) ON DELETE CASCADE,
  month           SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year            SMALLINT NOT NULL CHECK (year BETWEEN 2020 AND 2099),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  paid_at         TIMESTAMPTZ,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(transaction_id, month, year)
);

CREATE TRIGGER trg_card_txn_monthly_status_updated_at
  BEFORE UPDATE ON card_transaction_monthly_status
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_ctms_hh_ym
  ON card_transaction_monthly_status(household_id, year, month);

CREATE INDEX IF NOT EXISTS idx_ctms_txn_id
  ON card_transaction_monthly_status(transaction_id);

ALTER TABLE card_transaction_monthly_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hogar puede todo en card_transaction_monthly_status"
  ON card_transaction_monthly_status
  USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

-- ============================================================
-- MIGRACIÓN: Corregir consumos USD con converted_ars = 0
-- Ejecutar en Supabase Dashboard > SQL Editor
-- Solo aplica a registros que tienen amount_usd > 0 y dollar_rate > 0
-- pero converted_ars = 0 (cargados antes de esta corrección).
-- ============================================================
UPDATE card_transactions
SET
  converted_ars = amount_usd * dollar_rate,
  amount_ars    = amount_usd * dollar_rate
WHERE
  currency      = 'USD'
  AND amount_usd  > 0
  AND dollar_rate > 0
  AND (converted_ars IS NULL OR converted_ars = 0);

-- ============================================================
-- MIGRACIÓN: Fechas automáticas por regla para tarjetas
-- Ejecutar en Supabase Dashboard > SQL Editor
-- Columnas opcionales; no borran ni modifican datos existentes.
-- ============================================================
ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS auto_dates_enabled BOOLEAN DEFAULT false;
ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS closing_day        SMALLINT;
ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS due_day            SMALLINT;
ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS due_month_offset   SMALLINT DEFAULT 0;

-- ============================================================
-- MIGRACIÓN: Cierre de mes (sobrante -> ingreso "Resto del mes pasado")
-- Ejecutar en Supabase Dashboard > SQL Editor
-- Columnas opcionales; no borran ni modifican datos existentes.
-- source = 'month_closeover' identifica ingresos generados automáticamente
-- por el cierre de mes; linked_month/linked_year apuntan al mes cerrado.
-- ============================================================
ALTER TABLE incomes ADD COLUMN IF NOT EXISTS source       TEXT;
ALTER TABLE incomes ADD COLUMN IF NOT EXISTS linked_month SMALLINT;
ALTER TABLE incomes ADD COLUMN IF NOT EXISTS linked_year  SMALLINT;

-- ============================================================
-- ACTIVAR REALTIME (ejecutar en Supabase Dashboard > Replication)
-- O agregar tablas en: Settings > API > Realtime
-- ============================================================
-- Las siguientes tablas necesitan Realtime habilitado:
-- incomes, fixed_expenses, variable_expenses,
-- card_transactions, card_transaction_monthly_status,
-- independent_installments, saving_goals,
-- expense_movements

-- ============================================================
-- NOTAS DE CONFIGURACIÓN
-- ============================================================
-- 1. Crear ambos usuarios en Supabase Auth (Authentication > Users)
--    - Juli: juli@tudominio.com
--    - Mari: mari@tudominio.com
--
-- 2. Después de que cada usuario haga su primer login,
--    se creará su perfil automáticamente.
--
-- 3. Crear un household manualmente y vincular ambos perfiles:
--    INSERT INTO households (name) VALUES ('Hogar de Juli y Mari')
--    RETURNING id;
--
--    -- Copiar el UUID y usarlo en:
--    UPDATE profiles SET household_id = 'UUID-DEL-HOGAR' WHERE id IN (
--      (SELECT id FROM auth.users WHERE email = 'juli@email.com'),
--      (SELECT id FROM auth.users WHERE email = 'mari@email.com')
--    );
--    UPDATE profiles SET display_name = 'Juli'
--      WHERE id = (SELECT id FROM auth.users WHERE email = 'juli@email.com');
--    UPDATE profiles SET display_name = 'Mari'
--      WHERE id = (SELECT id FROM auth.users WHERE email = 'mari@email.com');
