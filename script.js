/* ============================================================
   FINAPP – script.js
   Aplicación de finanzas personales para Juli y Mari
   ============================================================ */

'use strict';

/* ============================================================
   1. CONFIGURACIÓN – Reemplazá estos valores con los tuyos
   ============================================================ */
const SUPABASE_URL  = 'https://ufputoqrinzifxyczcuu.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmcHV0b3FyaW56aWZ4eWN6Y3V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NjgyNzMsImV4cCI6MjA5MzQ0NDI3M30.cmP3UCHmb4WU29KkaivecDTwL-zyQfQ0306qISc7YI8';

/* ============================================================
   2. ESTADO GLOBAL DE LA APP
   ============================================================ */
const APP = {
  supabase:      null,
  session:       null,
  profile:       null,
  householdId:   null,
  currentMonth:  new Date().getMonth() + 1,
  currentYear:   new Date().getFullYear(),
  currentSection:'dashboard',
  syncChannels:  [],
  dollarRate:        null,
  lastActiveCardId:  null,
  theme:             localStorage.getItem('finapp-theme') || 'dark',

  // Cache local temporal
  cache: {
    incomes:      [],
    fixedExpenses:[],
    varExpenses:  [],
    cards:        [],
    cardTxns:     {},   // { cardId: [txns] }
    installments: [],
    savingGoal:   null,
  }
};

/* ============================================================
   3. INICIALIZACIÓN
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initSupabase();
  await checkSession();
  bindGlobalEvents();
});

function initSupabase() {
  const { createClient } = supabase;
  APP.supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
}

async function checkSession() {
  try {
    const { data: { session } } = await APP.supabase.auth.getSession();
    if (session) {
      APP.session = session;
      await loadProfile();
      showApp();
    } else {
      showLogin();
    }
  } catch (e) {
    console.error('Error de sesión:', e);
    showLogin();
  }
}

/* ============================================================
   4. AUTENTICACIÓN
   ============================================================ */
async function login(email, password) {
  setBtnLoading('login-btn', true);
  hideEl('login-error');
  try {
    const { data, error } = await APP.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    APP.session = data.session;
    await loadProfile();
    showApp();
  } catch (e) {
    showEl('login-error');
    $('login-error').textContent = translateAuthError(e.message);
  } finally {
    setBtnLoading('login-btn', false);
  }
}

async function logout() {
  confirmAction('¿Cerrar sesión?', async () => {
    stopPolling();
    clearTimeout(_rtRefreshTimer);
    unsubscribeRealtime();
    _pendingRefresh = false;
    const badge = document.getElementById('pending-changes-badge');
    if (badge) badge.style.display = 'none';
    await APP.supabase.auth.signOut();
    APP.session = null; APP.profile = null; APP.householdId = null;
    Object.keys(APP.cache).forEach(k => { APP.cache[k] = Array.isArray(APP.cache[k]) ? [] : (typeof APP.cache[k] === 'object' && APP.cache[k] !== null ? {} : null); });
    showLogin();
    toast('Sesión cerrada', 'info');
  });
}

async function loadProfile() {
  const uid = APP.session.user.id;
  const { data, error } = await APP.supabase
    .from('profiles').select('*').eq('id', uid).maybeSingle();

  if (error || !data) {
    // Crear perfil si no existe
    const name = APP.session.user.email?.split('@')[0] || 'Usuario';
    const { data: newProfile } = await APP.supabase
      .from('profiles')
      .insert({ id: uid, display_name: name })
      .select().single();
    APP.profile = newProfile;
  } else {
    APP.profile = data;
  }
  APP.householdId = APP.profile?.household_id || null;
}

function translateAuthError(msg) {
  if (msg.includes('Invalid login'))   return 'Email o contraseña incorrectos.';
  if (msg.includes('Email not confirmed')) return 'Confirmá tu email antes de ingresar.';
  if (msg.includes('Too many requests')) return 'Demasiados intentos. Esperá unos minutos.';
  return msg || 'Error al iniciar sesión.';
}

/* ============================================================
   5. TEMA CLARO/OSCURO
   ============================================================ */
function initTheme() {
  document.documentElement.setAttribute('data-theme', APP.theme);
  updateThemeIcons();
}

function toggleTheme() {
  APP.theme = APP.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', APP.theme);
  localStorage.setItem('finapp-theme', APP.theme);
  updateThemeIcons();
}

function updateThemeIcons() {
  const isDark = APP.theme === 'dark';
  $('theme-icon-moon').classList.toggle('hidden', !isDark);
  $('theme-icon-sun').classList.toggle('hidden', isDark);
}

/* ============================================================
   6. MOSTRAR/OCULTAR PANTALLAS
   ============================================================ */
function showLogin() {
  showEl('login-screen');
  hideEl('app');
}

async function showApp() {
  hideEl('login-screen');
  showEl('app');
  initMonthSelectors();
  updateUserUI();
  await loadCurrentSection();
  subscribeRealtime();
  startPolling();
}

function updateUserUI() {
  const name = APP.profile?.display_name || 'Usuario';
  const initial = name.charAt(0).toUpperCase();
  setText('sidebar-username', name);
  setText('sidebar-household', APP.householdId ? 'Hogar compartido' : 'Sin hogar asignado');
  setText('sidebar-avatar', initial);
  setText('header-avatar', initial);
  if (APP.profile?.avatar_color) {
    $('sidebar-avatar').style.background = APP.profile.avatar_color;
    $('header-avatar').style.background = APP.profile.avatar_color;
  }
}

/* ============================================================
   7. NAVEGACIÓN Y SECCIONES
   ============================================================ */
function navigateTo(section) {
  APP.currentSection = section;

  // Activar nav items
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.section === section);
  });

  // Mostrar sección
  document.querySelectorAll('.section').forEach(s => {
    s.classList.remove('section--active');
  });
  const sEl = $(`section-${section}`);
  if (sEl) sEl.classList.add('section--active');

  // Título del header
  const titles = {
    dashboard: 'Dashboard', ingresos: 'Ingresos',
    'gastos-fijos': 'Gastos Fijos', 'gastos-variables': 'Gastos Variables',
    tarjetas: 'Tarjetas',
    cuotas: 'Cuotas Independientes', ahorro: 'Ahorro y Proyección',
    dolar: 'Dólar Argentina', anual: 'Resumen Anual',
    exportar: 'Exportar / Backup', configuracion: 'Configuración'
  };
  setText('header-title', titles[section] || section);

  loadCurrentSection();

  // Cerrar sidebar en mobile
  if (window.innerWidth <= 768) closeMobileSidebar();
}

async function loadCurrentSection() {
  if (!APP.householdId) {
    if (APP.currentSection !== 'configuracion') {
      renderNoHousehold();
      return;
    }
  }
  const s = APP.currentSection;
  if (s === 'dashboard')         await renderDashboard();
  else if (s === 'ingresos')     await renderIngresos();
  else if (s === 'gastos-fijos') await renderGastosFijos();
  else if (s === 'gastos-variables') await renderGastosVariables();
  else if (s === 'tarjetas')     await renderTarjetas();
else if (s === 'cuotas')       await renderCuotas();
  else if (s === 'ahorro')       await renderAhorro();
  else if (s === 'dolar')        await renderDolar();
  else if (s === 'anual')        await renderAnual();
  else if (s === 'exportar')     renderExportar();
  else if (s === 'configuracion') renderConfiguracion();
}

function renderNoHousehold() {
  ['dashboard','ingresos','gastos-fijos','gastos-variables','tarjetas','cuotas','ahorro','dolar','anual'].forEach(s => {
    const el = $(`section-${s}`);
    if (el) el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🏠</div>
        <h3>Sin hogar asignado</h3>
        <p>Tu cuenta no está vinculada a un hogar. Pedile a quien configuró Supabase que te asigne a un household.<br>Ver README para instrucciones.</p>
        <a href="#" class="btn btn--primary" style="margin-top:1rem" onclick="navigateTo('configuracion')">Ir a Configuración</a>
      </div>`;
  });
}

/* ============================================================
   8. SELECTORES DE MES Y AÑO
   ============================================================ */
function initMonthSelectors() {
  const mSel = $('month-select');
  const ySel = $('year-select');
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  mSel.innerHTML = meses.map((m, i) =>
    `<option value="${i+1}" ${i+1===APP.currentMonth?'selected':''}>${m}</option>`).join('');

  const curYear = new Date().getFullYear();
  ySel.innerHTML = Array.from({length:6}, (_,i) => curYear-2+i)
    .map(y => `<option value="${y}" ${y===APP.currentYear?'selected':''}>${y}</option>`).join('');

  updateHeaderMonth();
}

function updateHeaderMonth() {
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const label = `${meses[APP.currentMonth-1]} ${APP.currentYear}`;
  setText('header-month-text', label);
  setText('mobile-month-text', label);
}

function changeMonth(delta) {
  let m = APP.currentMonth + delta;
  let y = APP.currentYear;
  if (m > 12) { m = 1; y++; }
  if (m < 1)  { m = 12; y--; }
  APP.currentMonth = m; APP.currentYear = y;
  $('month-select').value = m;
  $('year-select').value = y;
  updateHeaderMonth();
  loadCurrentSection();
}

/* ============================================================
   9. SUPABASE – OPERACIONES CRUD GENÉRICAS
   ============================================================ */
async function dbSelect(table, filters = {}) {
  if (!APP.householdId) return [];
  let q = APP.supabase.from(table).select('*').eq('household_id', APP.householdId);
  Object.entries(filters).forEach(([k,v]) => { q = q.eq(k, v); });
  q = q.order('created_at', { ascending: true });
  const { data, error } = await q;
  if (error) { console.error(`DB SELECT ${table}:`, error); return []; }
  return data || [];
}

const TABLES_WITH_CREATED_BY = new Set([
  'incomes', 'fixed_expenses', 'variable_expenses',
  'card_transactions', 'card_transaction_monthly_status',
  'independent_installments', 'expense_movements'
]);

async function dbInsert(table, payload) {
  setSyncStatus('saving');
  const extra = { household_id: APP.householdId };
  if (TABLES_WITH_CREATED_BY.has(table)) extra.created_by = APP.session.user.id;
  const row = { ...payload, ...extra };
  const { data, error } = await APP.supabase.from(table).insert(row).select().single();
  if (error) { setSyncStatus('error'); toast('Error al guardar', 'error'); throw error; }
  setSyncStatus('saved');
  return data;
}

async function dbUpdate(table, id, payload) {
  setSyncStatus('saving');
  const { data, error } = await APP.supabase.from(table).update(payload).eq('id', id).select().single();
  if (error) { setSyncStatus('error'); toast('Error al actualizar', 'error'); throw error; }
  setSyncStatus('saved');
  return data;
}

async function dbDelete(table, id) {
  setSyncStatus('saving');
  const { error } = await APP.supabase.from(table).delete().eq('id', id);
  if (error) { setSyncStatus('error'); toast('Error al eliminar', 'error'); throw error; }
  setSyncStatus('saved');
}

// Upsert del estado mensual de un consumo: no toca card_transactions.status
async function upsertMonthlyStatus(transactionId, month, year, status) {
  setSyncStatus('saving');
  const { error } = await APP.supabase
    .from('card_transaction_monthly_status')
    .upsert({
      household_id:   APP.householdId,
      transaction_id: transactionId,
      month,
      year,
      status,
      paid_at:    status === 'paid' ? new Date().toISOString() : null,
      created_by: APP.session.user.id,
      updated_at: new Date().toISOString()
    }, { onConflict: 'transaction_id,month,year' });
  if (error) { setSyncStatus('error'); toast('Error al actualizar estado', 'error'); throw error; }
  setSyncStatus('saved');
}

/* ============================================================
   9b. MOVIMIENTOS DE GASTOS (expense_movements)
   ============================================================ */

// Calcula el gasto real de cada fila exclusivamente desde expense_movements.
// El campo `amount` NO se usa como real; puede ser legacy o de sincronía interna.
// budget = budgeted_amount si > 0, sino amount (compatibilidad con datos viejos).
async function computeRealAmounts(rows) {
  const realMap = {};
  if (!rows.length) return realMap;

  const ids = rows.map(r => r.id);
  rows.forEach(r => { realMap[r.id] = 0; });

  const { data: movs } = await APP.supabase
    .from('expense_movements')
    .select('expense_id, movement_type, amount')
    .eq('household_id', APP.householdId)
    .in('expense_id', ids);

  (movs || []).forEach(m => {
    if (realMap[m.expense_id] !== undefined)
      realMap[m.expense_id] += m.movement_type === 'add' ? +m.amount : -(+m.amount);
  });
  rows.forEach(r => { realMap[r.id] = Math.max(0, realMap[r.id]); });
  return realMap;
}

function openMovementForm(expenseId, expenseType, expenseDesc) {
  const safeDesc = expenseDesc.replace(/`/g, "'");
  openModal(`
    <h2 class="modal-title">Movimiento real · <span style="color:var(--accent)">${safeDesc}</span></h2>
    <p style="font-size:.78rem;color:var(--text-3);margin-bottom:.5rem">Modifica el <strong>gasto real</strong> (no el presupuesto).</p>
    <div class="form-grid">
      <div class="field-row">
        <div class="field-group">
          <label class="field-label">Tipo *</label>
          <select id="mov-type" class="field-select">
            <option value="add">⊕ Sumar al gasto real</option>
            <option value="subtract">⊖ Restar al gasto real</option>
          </select>
        </div>
        <div class="field-group">
          <label class="field-label">Monto *</label>
          <input id="mov-amount" type="number" class="field-input" placeholder="0" min="0.01" step="0.01">
        </div>
      </div>
      <div class="field-row">
        <div class="field-group">
          <label class="field-label">Fecha</label>
          <input id="mov-date" type="date" class="field-input" value="${today()}">
        </div>
        <div class="field-group">
          <label class="field-label">Descripción / Motivo *</label>
          <input id="mov-desc" class="field-input" placeholder="Ej: Segunda compra del mes">
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">Observaciones</label>
        <textarea id="mov-notes" class="field-textarea" rows="2" placeholder="Notas adicionales..."></textarea>
      </div>
      <div class="form-actions">
        <button class="btn btn--ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn--primary" onclick="saveMovement('${expenseId}','${expenseType}')">Guardar movimiento</button>
      </div>
    </div>`);
}

async function saveMovement(expenseId, expenseType) {
  const movType = $('mov-type').value;
  const amount  = parseFloat($('mov-amount').value);
  const date    = $('mov-date').value;
  const desc    = $('mov-desc').value.trim();
  const notes   = $('mov-notes').value.trim();

  if (!desc)                        return toast('Ingresá una descripción', 'warning');
  if (isNaN(amount) || amount <= 0) return toast('Monto inválido', 'warning');

  // Calcular el real actual sumando movimientos existentes (fuente de verdad)
  const { data: existingMovs } = await APP.supabase
    .from('expense_movements')
    .select('movement_type, amount')
    .eq('household_id', APP.householdId)
    .eq('expense_id', expenseId);

  const currentReal = (existingMovs || []).reduce((s, m) =>
    s + (m.movement_type === 'add' ? +m.amount : -(+m.amount)), 0);
  const newReal = currentReal + (movType === 'add' ? amount : -amount);

  if (newReal < 0) return toast(`El monto resultante sería negativo (quedaría ${fmtARS(newReal)}). Revisá el valor.`, 'warning');

  const table = expenseType === 'fixed' ? 'fixed_expenses' : 'variable_expenses';
  try {
    await dbInsert('expense_movements', {
      expense_type: expenseType, expense_id: expenseId,
      movement_type: movType, amount,
      date: date || null, description: desc, notes: notes || null
    });
    // Sincronizar amount con el real calculado desde movimientos
    await dbUpdate(table, expenseId, { amount: Math.max(0, newReal) });
    closeModal();
    toast('Movimiento agregado ✓');
    if (expenseType === 'fixed') renderGastosFijos();
    else renderGastosVariables();
  } catch {}
}

async function viewMovements(expenseId, expenseType, expenseDesc) {
  const movements = await dbSelect('expense_movements', { expense_id: expenseId });
  const safeDesc  = expenseDesc.replace(/`/g,"'");
  const safeId    = expenseId;

  const rows = movements.length
    ? movements.map(m => `<tr>
        <td style="font-size:.8rem">${m.date ? fmtDate(m.date) : '—'}</td>
        <td><span class="badge ${m.movement_type==='add'?'badge--success':'badge--danger'}">${m.movement_type==='add'?'⊕ Suma':'⊖ Resta'}</span></td>
        <td class="mono" style="text-align:right;font-weight:600;color:${m.movement_type==='add'?'var(--success)':'var(--danger)'}">
          ${m.movement_type==='add'?'+':'−'} ${fmtARS(m.amount)}
        </td>
        <td style="font-size:.85rem">${m.description}</td>
        <td style="font-size:.75rem;color:var(--text-3)">${m.notes||'—'}</td>
        <td style="font-size:.75rem;color:var(--text-3)">${new Date(m.created_at).toLocaleDateString('es-AR')}</td>
        <td>
          <button class="icon-btn" title="Eliminar movimiento"
            onclick="deleteMovement('${m.id}','${safeId}','${expenseType}',${m.amount},'${m.movement_type}','${safeDesc.replace(/'/g,"\\'")}')">🗑️</button>
        </td>
      </tr>`).join('')
    : `<tr><td colspan="7"><div class="table-empty">Sin movimientos registrados.</div></td></tr>`;

  openModal(`
    <h2 class="modal-title">Movimientos · <span style="color:var(--accent)">${safeDesc}</span></h2>
    <div class="table-wrap" style="max-height:55vh;overflow-y:auto;margin-bottom:1rem">
      <table class="table">
        <thead><tr>
          <th>Fecha</th><th>Tipo</th><th style="text-align:right">Monto</th>
          <th>Motivo</th><th>Notas</th><th>Cargado</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap">
      <button class="btn btn--primary btn--sm" onclick="closeModal();setTimeout(()=>openMovementForm('${safeId}','${expenseType}','${safeDesc.replace(/'/g,"\\'")}'),150)">+ Agregar movimiento</button>
      <button class="btn btn--ghost" onclick="closeModal()">Cerrar</button>
    </div>`);
}

async function deleteMovement(movId, expenseId, expenseType, movAmount, movType, expenseDesc) {
  confirmAction('¿Eliminar este movimiento? El gasto real se actualizará automáticamente.', async () => {
    const table = expenseType === 'fixed' ? 'fixed_expenses' : 'variable_expenses';

    // Obtener todos los movimientos para calcular el real luego del borrado
    const { data: allMovs } = await APP.supabase
      .from('expense_movements')
      .select('id, movement_type, amount')
      .eq('household_id', APP.householdId)
      .eq('expense_id', expenseId);

    const newReal = Math.max(0, (allMovs || [])
      .filter(m => m.id !== movId)
      .reduce((s, m) => s + (m.movement_type === 'add' ? +m.amount : -(+m.amount)), 0));

    try {
      await dbDelete('expense_movements', movId);
      await dbUpdate(table, expenseId, { amount: newReal });
      toast('Movimiento eliminado');
      if (expenseType === 'fixed') renderGastosFijos();
      else renderGastosVariables();
      setTimeout(() => viewMovements(expenseId, expenseType, expenseDesc), 300);
    } catch {}
  });
}

/* ============================================================
   10. REALTIME – SINCRONIZACIÓN
   ============================================================ */
let _rtRefreshTimer   = null;   // debounce timer para refresh remoto
let _isRefreshing     = false;  // guard para evitar refreshes paralelos
let _pendingRefresh   = false;  // hay cambios remotos esperando (modal abierto)
let _pollInterval     = null;   // fallback polling cada 30s
let _reconnectTimer   = null;   // timer de reconexión realtime

// Comprueba si hay algún modal/overlay visible en pantalla
function isModalOpen() {
  const o = document.getElementById('modal-overlay');
  const c = document.getElementById('confirm-overlay');
  return (o && !o.classList.contains('hidden')) || (c && !c.classList.contains('hidden'));
}

// Programa un refresh con debounce de 600ms para colapsar ráfagas de eventos
function scheduleRealtimeRefresh(reason) {
  clearTimeout(_rtRefreshTimer);
  _rtRefreshTimer = setTimeout(() => refreshCurrentViewFromRemote(reason), 600);
}

// Recarga la vista actual desde remoto de forma segura
async function refreshCurrentViewFromRemote(reason) {
  if (_isRefreshing) return;

  if (isModalOpen()) {
    // El usuario está en un formulario: acumular y avisar
    _pendingRefresh = true;
    const badge = document.getElementById('pending-changes-badge');
    if (badge) badge.style.display = 'flex';
    return;
  }

  _pendingRefresh = false;
  const badge = document.getElementById('pending-changes-badge');
  if (badge) badge.style.display = 'none';

  _isRefreshing = true;
  setSyncStatus('syncing');
  try {
    await loadCurrentSection();
    setSyncStatus('saved');
  } catch(e) {
    console.warn('[RT] refresh error:', e);
    setSyncStatus('error');
    setTimeout(() => setSyncStatus('ready'), 3000);
  } finally {
    _isRefreshing = false;
  }
}

function subscribeRealtime() {
  if (!APP.householdId) return;
  unsubscribeRealtime();
  clearTimeout(_reconnectTimer);
  setSyncStatus('connecting');

  // Tablas con household_id (datos del hogar)
  const householdTables = [
    'incomes', 'fixed_expenses', 'variable_expenses',
    'credit_cards', 'card_summaries', 'card_transactions',
    'card_transaction_monthly_status', 'independent_installments',
    'saving_goals', 'expense_movements', 'imports_log'
  ];

  let firstConnected = false;
  householdTables.forEach(table => {
    try {
      const ch = APP.supabase
        .channel(`rt-${table}-${APP.householdId}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table,
          filter: `household_id=eq.${APP.householdId}`
        }, () => scheduleRealtimeRefresh(table))
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED' && !firstConnected) {
            firstConnected = true;
            setSyncStatus('ready');
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setSyncStatus('reconnecting');
            clearTimeout(_reconnectTimer);
            _reconnectTimer = setTimeout(() => {
              if (APP.householdId) subscribeRealtime();
            }, 6000);
          }
        });
      APP.syncChannels.push(ch);
    } catch(e) { console.warn('[RT] subscribe error for', table, e); }
  });

  // dollar_rates: tabla global sin household_id
  try {
    const chDolar = APP.supabase
      .channel('rt-dollar_rates-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dollar_rates' },
        () => scheduleRealtimeRefresh('dollar_rates'))
      .subscribe();
    APP.syncChannels.push(chDolar);
  } catch(e) { console.warn('[RT] dollar_rates subscribe error', e); }
}

function unsubscribeRealtime() {
  clearTimeout(_reconnectTimer);
  APP.syncChannels.forEach(ch => {
    try { APP.supabase.removeChannel(ch); } catch {}
  });
  APP.syncChannels = [];
}

// Polling de respaldo cada 30s (por si Realtime falla o el WS se desconecta)
function startPolling() {
  stopPolling();
  _pollInterval = setInterval(async () => {
    if (!APP.session || !APP.householdId) return;
    if (isModalOpen() || _isRefreshing) return;
    _isRefreshing = true;
    try { await loadCurrentSection(); }
    catch(e) { console.warn('[Poll]', e); }
    finally { _isRefreshing = false; }
  }, 30000);
}

function stopPolling() {
  if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
}

let _savedResetTimer = null;
function setSyncStatus(status) {
  const dots  = document.querySelectorAll('.sync-dot');
  const texts = document.querySelectorAll('.sync-text');
  const labels = {
    saving:       'Guardando…',
    saved:        'Guardado',
    syncing:      'Sincronizando…',
    ready:        'Listo',
    connecting:   'Conectando…',
    reconnecting: 'Reconectando…',
    error:        'Error',
    offline:      'Sin conexión',
  };
  dots.forEach(d => { d.className = 'sync-dot'; d.classList.add(`sync--${status}`); });
  texts.forEach(t => { t.textContent = labels[status] ?? status; });
  clearTimeout(_savedResetTimer);
  if (status === 'saved') _savedResetTimer = setTimeout(() => setSyncStatus('ready'), 2500);
}

/* ============================================================
   11. UTILIDADES DE FORMATO
   ============================================================ */
const fmtARS = n => new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', minimumFractionDigits:2, maximumFractionDigits:2 }).format(n||0);
const fmtUSD = n => new Intl.NumberFormat('es-AR', { style:'currency', currency:'USD', minimumFractionDigits:2, maximumFractionDigits:2 }).format(n||0);
const fmtPct = n => `${(n||0).toFixed(1)}%`;

// Retorna el equivalente ARS de una transacción de tarjeta.
// USD: usa converted_ars primero; si es 0/null, cae a amount_usd * dollar_rate; si tampoco, 0.
function txnARS(t) {
  if (t.currency !== 'USD') return +t.amount_ars || 0;
  const conv = +t.converted_ars || 0;
  if (conv > 0) return conv;
  const usd  = +t.amount_usd  || 0;
  const rate = +t.dollar_rate || 0;
  return (usd > 0 && rate > 0) ? usd * rate : 0;
}

// ── Fechas automáticas de tarjetas ──────────────────────────
// Mueve sábado o domingo al lunes siguiente.
function getNextBusinessDay(date) {
  const d = new Date(date.getTime());
  const dow = d.getDay(); // 0=dom, 6=sáb
  if (dow === 6) d.setDate(d.getDate() + 2);
  else if (dow === 0) d.setDate(d.getDate() + 1);
  return d;
}

// Detecta la regla automática de una tarjeta por banco/nombre.
// Devuelve { closingDay, dueDay, dueMonthOffset } o null si no hay coincidencia.
function detectCardRule(card) {
  const t = ((card.name || '') + ' ' + (card.bank || '')).toLowerCase();
  if (t.includes('bbva') && t.includes('visa'))
    return { closingDay: 28, dueDay: 5,  dueMonthOffset: 1 };
  if ((t.includes('mercado pago') || t.includes('mercadopago') || t.includes('mp ') || t.startsWith('mp')) && t.includes('mastercard'))
    return { closingDay: 5,  dueDay: 10, dueMonthOffset: 0 };
  if (t.includes('galicia') && t.includes('visa'))
    return { closingDay: 21, dueDay: 1,  dueMonthOffset: 1 };
  if (t.includes('galicia') && t.includes('mastercard'))
    return { closingDay: 21, dueDay: 1,  dueMonthOffset: 1 };
  return null;
}

// Devuelve { closingDate, dueDate } en formato YYYY-MM-DD para el mes/año dado.
// Prioridad: closing_day/due_day guardados > auto-detección > fechas manuales.
// Si auto_dates_enabled === false, retorna directamente las fechas manuales.
function calculateCardDates(card, month, year) {
  const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  let closingDay, dueDay, dueMonthOffset;
  if (card.auto_dates_enabled === false) {
    return { closingDate: card.closing_date || null, dueDate: card.due_date || null };
  }
  if (card.closing_day != null && card.due_day != null) {
    closingDay = +card.closing_day;
    dueDay     = +card.due_day;
    dueMonthOffset = +(card.due_month_offset ?? 0);
  } else {
    const rule = detectCardRule(card);
    if (!rule) return { closingDate: card.closing_date || null, dueDate: card.due_date || null };
    closingDay = rule.closingDay; dueDay = rule.dueDay; dueMonthOffset = rule.dueMonthOffset;
  }
  const closing = getNextBusinessDay(new Date(year, month - 1, closingDay));
  const dueM0   = (month - 1 + dueMonthOffset) % 12;
  const dueY    = year + Math.floor((month - 1 + dueMonthOffset) / 12);
  const due     = getNextBusinessDay(new Date(dueY, dueM0, dueDay));
  return { closingDate: iso(closing), dueDate: iso(due) };
}

const CAT_BADGE = {
  // Gastos fijos
  'Vivienda':        { bg:'rgba(56,189,248,.15)',  color:'#38bdf8' },
  'Servicios':       { bg:'rgba(251,146,60,.15)',  color:'#fb923c' },
  'Transporte':      { bg:'rgba(251,191,36,.15)',  color:'#fbbf24' },
  'Salud':           { bg:'rgba(34,211,174,.15)',  color:'#22d3ae' },
  'Educación':       { bg:'rgba(168,85,247,.15)',  color:'#a855f7' },
  'Entretenimiento': { bg:'rgba(236,72,153,.15)',  color:'#ec4899' },
  'Mascotas':        { bg:'rgba(251,113,133,.15)', color:'#fb7185' },
  'General':         null,
  'Otros':           null,
  // Gastos variables
  'Supermercado':    { bg:'rgba(34,211,174,.15)',  color:'#22d3ae' },
  'Comida':          { bg:'rgba(251,146,60,.15)',  color:'#fb923c' },
  'Salidas':         { bg:'rgba(236,72,153,.15)',  color:'#ec4899' },
  'Ropa':            { bg:'rgba(168,85,247,.15)',  color:'#a855f7' },
  'Farmacia':        { bg:'rgba(244,63,94,.15)',   color:'#f43f5e' },
  'Tecnología':      { bg:'rgba(56,189,248,.15)',  color:'#38bdf8' },
  'Hogar':           { bg:'rgba(251,191,36,.15)',  color:'#fbbf24' },
};

function categoryBadge(cat) {
  const label = cat || 'General';
  const s = CAT_BADGE[label];
  if (!s) return `<span class="badge badge--neutral">${label}</span>`;
  return `<span class="badge" style="background:${s.bg};color:${s.color}">${label}</span>`;
}
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-AR') : '—';
const today   = () => new Date().toISOString().split('T')[0];

function $ (id) { return document.getElementById(id); }
function $q(sel, ctx = document) { return ctx.querySelector(sel); }
function $qa(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }
function showEl(id) { const el = $(id); if (el) el.classList.remove('hidden'); }
function hideEl(id) { const el = $(id); if (el) el.classList.add('hidden'); }
function setText(id, txt) { const el = $(id); if (el) el.textContent = txt; }
function setBtnLoading(id, loading) {
  const el = $(id); if (!el) return;
  $(`${id}-text`)?.classList.toggle('hidden', loading);
  $(`${id}-loading`)?.classList.toggle('hidden', !loading);
  el.disabled = loading;
}

/* ============================================================
   12. TOAST NOTIFICATIONS
   ============================================================ */
function toast(msg, type = 'success', duration = 3000) {
  const icons = { success:'✓', error:'✗', warning:'⚠', info:'ℹ' };
  const container = $('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]||'•'}</span><span class="toast-message">${msg}</span>`;
  container.appendChild(el);
  requestAnimationFrame(() => { el.classList.add('toast--visible'); });
  setTimeout(() => {
    el.classList.remove('toast--visible');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

/* ============================================================
   13. MODAL GENÉRICO
   ============================================================ */
function openModal(html, wide = false) {
  $('modal-body').innerHTML = html;
  $('modal-box').classList.toggle('modal-box--wide', wide);
  showEl('modal-overlay');
  document.body.style.overflow = 'hidden';
  // Enfocar primer input
  setTimeout(() => { const inp = $q('.field-input', $('modal-body')); if (inp) inp.focus(); }, 100);
}

function closeModal() {
  hideEl('modal-overlay');
  document.body.style.overflow = '';
  $('modal-body').innerHTML = '';
  // Si hubo cambios remotos mientras el modal estaba abierto, refrescar ahora
  if (_pendingRefresh) {
    _pendingRefresh = false;
    const badge = document.getElementById('pending-changes-badge');
    if (badge) badge.style.display = 'none';
    refreshCurrentViewFromRemote('post-modal');
  }
}

/* ============================================================
   14. CONFIRMACIÓN
   ============================================================ */
function confirmAction(msg, onOk) {
  setText('confirm-message', msg);
  showEl('confirm-overlay');
  document.body.style.overflow = 'hidden';
  const okBtn = $('confirm-ok-btn');
  const cancelBtn = $('confirm-cancel-btn');
  const close = () => { hideEl('confirm-overlay'); document.body.style.overflow = ''; };
  const newOk = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOk, okBtn);
  newOk.addEventListener('click', () => { close(); onOk(); });
  const newCancel = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
  newCancel.addEventListener('click', close);
}

/* ============================================================
   15. EVENTOS GLOBALES
   ============================================================ */
function bindGlobalEvents() {
  // Login form
  $('login-form').addEventListener('submit', e => {
    e.preventDefault();
    login($('login-email').value.trim(), $('login-password').value);
  });

  // Toggle password
  $('toggle-password').addEventListener('click', () => {
    const inp = $('login-password');
    const isPass = inp.type === 'password';
    inp.type = isPass ? 'text' : 'password';
    $('eye-open').classList.toggle('hidden', isPass);
    $('eye-closed').classList.toggle('hidden', !isPass);
  });

  // Logout
  $('logout-btn').addEventListener('click', logout);

  // Tema
  $('theme-toggle-btn').addEventListener('click', toggleTheme);

  // Navegación sidebar
  document.querySelectorAll('[data-section]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const s = el.dataset.section;
      if (s) navigateTo(s);
    });
  });

  // Sidebar collapse (desktop) / cierre en mobile
  $('sidebar-collapse-btn').addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      closeMobileSidebar();
    } else {
      $('sidebar').classList.toggle('collapsed');
    }
  });

  // Menú hamburguesa (mobile)
  $('menu-toggle-btn').addEventListener('click', openMobileSidebar);

  // Overlay del sidebar
  const sidebarOverlay = document.createElement('div');
  sidebarOverlay.id = 'sidebar-overlay';
  document.body.appendChild(sidebarOverlay);
  sidebarOverlay.addEventListener('click', closeMobileSidebar);

  // Modal close
  $('modal-close-btn').addEventListener('click', closeModal);
  $('modal-overlay').addEventListener('click', e => { if (e.target === $('modal-overlay')) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('modal-overlay').classList.contains('hidden')) closeModal(); });

  // Mes/año
  $('prev-month-btn').addEventListener('click', () => changeMonth(-1));
  $('next-month-btn').addEventListener('click', () => changeMonth(1));
  $('month-select').addEventListener('change', e => { APP.currentMonth = +e.target.value; updateHeaderMonth(); loadCurrentSection(); });
  $('year-select').addEventListener('change',  e => { APP.currentYear  = +e.target.value; updateHeaderMonth(); loadCurrentSection(); });

  // Offline/Online
  window.addEventListener('offline', () => setSyncStatus('offline'));
  window.addEventListener('online',  () => { setSyncStatus('connecting'); subscribeRealtime(); startPolling(); });
}

function openMobileSidebar() {
  $('sidebar').classList.add('mobile-open');
  $('sidebar-overlay').classList.add('visible');
  document.body.style.overflow = 'hidden';
}
function closeMobileSidebar() {
  $('sidebar').classList.remove('mobile-open');
  $('sidebar-overlay').classList.remove('visible');
  document.body.style.overflow = '';
}

/* ============================================================
   16. DASHBOARD
   ============================================================ */
async function renderDashboard() {
  const sec = $('section-dashboard');
  sec.innerHTML = `<div style="display:flex;align-items:center;gap:.5rem;color:var(--text-3);padding:2rem"><span class="spinner"></span> Cargando...</div>`;

  const [incomes, fixed, variable, cards, allTxns, installments] = await Promise.all([
    dbSelect('incomes',    { month: APP.currentMonth, year: APP.currentYear }),
    dbSelect('fixed_expenses', { month: APP.currentMonth, year: APP.currentYear }),
    dbSelect('variable_expenses', { month: APP.currentMonth, year: APP.currentYear }),
    dbSelect('credit_cards'),
    loadCardTxnsForMonth(APP.currentMonth, APP.currentYear),
    dbSelect('independent_installments', { status: 'active' })
  ]);

  const totalIncome        = incomes.reduce((s,r) => s + (+r.amount||0), 0);
  // Real = amount (mantenido en sincronía con movimientos); budget = budgeted_amount
  const totalFixed         = fixed.reduce((s,r) => s + (+r.amount||0), 0);
  const totalFixedBudgeted = fixed.reduce((s,r) => s + (r.budgeted_amount != null ? +r.budgeted_amount : +r.amount||0), 0);
  const totalVariable      = variable.reduce((s,r) => s + (+r.amount||0), 0);
  const totalVarBudgeted   = variable.reduce((s,r) => s + (r.budgeted_amount != null ? +r.budgeted_amount : +r.amount||0), 0);
  const totalCards    = allTxns.reduce((s,r) => s + txnARS(r), 0);
  const totalInstall  = installments.reduce((s,r) => s + (+r.installment_amount||0), 0);
  const totalPaid     = fixed.filter(r=>r.status==='paid').reduce((s,r)=>s+(+r.amount||0),0)
                      + allTxns.filter(r=>r.status==='paid').reduce((s,r)=>s+txnARS(r),0);
  const totalPending  = totalFixed + totalVariable + totalCards + totalInstall - totalPaid;
  const saldo         = totalIncome - totalFixed - totalVariable - totalCards - totalInstall;
  const pctGastado    = totalIncome > 0 ? Math.min(100, ((totalFixed+totalVariable+totalCards+totalInstall)/totalIncome)*100) : 0;

  const dollarRate     = APP.dollarRate?.sell_rate || 0;
  const dolaresAhorro  = dollarRate > 0 && saldo > 0 ? (saldo / dollarRate).toFixed(1) : '—';

  // Alertas
  const alerts = [];
  const today2 = new Date();
  fixed.filter(r => r.status === 'pending' && r.due_date).forEach(r => {
    const due = new Date(r.due_date + 'T00:00:00');
    const diff = Math.ceil((due - today2) / 86400000);
    if (diff <= 5 && diff >= 0) alerts.push({ type:'warning', msg:`${r.description} vence en ${diff} día${diff===1?'':'s'}` });
    if (diff < 0) alerts.push({ type:'danger', msg:`${r.description} venció hace ${Math.abs(diff)} días` });
  });
  if (saldo < 0) alerts.push({ type:'danger', msg:'¡El saldo disponible es negativo!' });
  if (pctGastado > 90) alerts.push({ type:'warning', msg:`Gastaste el ${pctGastado.toFixed(0)}% de tus ingresos` });
  cards.forEach(c => {
    const cs = getCardClosingStatus(c);
    const ds = getCardDueStatus(c);
    if (cs.status === 'today')
      alerts.push({ type:'danger',  msg:`${c.name} cierra hoy` });
    else if (cs.status === 'closed')
      alerts.push({ type:'warning', msg:`${c.name} ya cerró. Podés usarla.` });
    else if (cs.status === 'open' && cs.daysUntil !== null && cs.daysUntil <= 3)
      alerts.push({ type:'warning', msg:`${c.name} cierra en ${cs.daysUntil} día${cs.daysUntil===1?'':'s'}` });
    if (ds.status === 'today')
      alerts.push({ type:'danger',  msg:`${c.name} vence hoy` });
    else if (ds.status === 'open' && ds.daysUntil !== null && ds.daysUntil <= 3)
      alerts.push({ type:'warning', msg:`${c.name} vence en ${ds.daysUntil} día${ds.daysUntil===1?'':'s'}` });
  });

  sec.innerHTML = `
    <div class="dashboard-big-card">
      <div class="dashboard-big-label">Saldo disponible</div>
      <div class="dashboard-big-amount ${saldo>=0?'positive':'negative'}">${fmtARS(saldo)}</div>
      <div class="dashboard-big-sub">${fmtPct(pctGastado)} del ingreso gastado · ${fmtARS(totalIncome)} de ingresos</div>
      ${dollarRate>0?`<div class="dashboard-big-sub">≈ ${dolaresAhorro} USD al dólar de ${fmtARS(dollarRate)}</div>`:''}
      <div style="margin-top:.75rem">
        <div class="progress-bar" style="height:8px">
          <div class="progress-fill ${pctGastado>90?'progress-fill--danger':pctGastado>70?'progress-fill--warning':''}" style="width:${Math.min(100,pctGastado)}%"></div>
        </div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card stat-card--green">
        <div class="stat-top"><span class="card-label">Ingresos</span><span style="font-size:1.2rem">💰</span></div>
        <div class="card-value mono">${fmtARS(totalIncome)}</div>
        <div class="card-sub">${incomes.length} registro${incomes.length!==1?'s':''}</div>
      </div>
      <div class="stat-card stat-card--red">
        <div class="stat-top"><span class="card-label">Gastos Fijos</span><span style="font-size:1.2rem">🏠</span></div>
        <div class="card-value mono">${fmtARS(totalFixed)}</div>
        <div class="card-sub">${fixed.filter(r=>r.status==='paid').length}/${fixed.length} pagados${totalFixed!==totalFixedBudgeted?` · Pres: ${fmtARS(totalFixedBudgeted)}`:''}  </div>
      </div>
      <div class="stat-card stat-card--red">
        <div class="stat-top"><span class="card-label">Variables</span><span style="font-size:1.2rem">🛒</span></div>
        <div class="card-value mono">${fmtARS(totalVariable)}</div>
        <div class="card-sub">${variable.length} gasto${variable.length!==1?'s':''}${totalVariable!==totalVarBudgeted?` · Pres: ${fmtARS(totalVarBudgeted)}`:''}  </div>
      </div>
      <div class="stat-card stat-card--blue">
        <div class="stat-top"><span class="card-label">Tarjetas</span><span style="font-size:1.2rem">💳</span></div>
        <div class="card-value mono">${fmtARS(totalCards)}</div>
        <div class="card-sub">${allTxns.length} consumo${allTxns.length!==1?'s':''}</div>
      </div>
      <div class="stat-card stat-card--yellow">
        <div class="stat-top"><span class="card-label">Cuotas</span><span style="font-size:1.2rem">📅</span></div>
        <div class="card-value mono">${fmtARS(totalInstall)}</div>
        <div class="card-sub">${installments.length} activa${installments.length!==1?'s':''}</div>
      </div>
      <div class="stat-card stat-card--green">
        <div class="stat-top"><span class="card-label">Pagado</span><span style="font-size:1.2rem">✓</span></div>
        <div class="card-value mono">${fmtARS(totalPaid)}</div>
        <div class="card-sub"></div>
      </div>
      <div class="stat-card stat-card--red">
        <div class="stat-top"><span class="card-label">Pendiente</span><span style="font-size:1.2rem">⏳</span></div>
        <div class="card-value mono">${fmtARS(Math.max(0,totalPending))}</div>
        <div class="card-sub"></div>
      </div>
      <div class="stat-card">
        <div class="stat-top"><span class="card-label">Ahorro posible</span><span style="font-size:1.2rem">🏦</span></div>
        <div class="card-value mono ${saldo>=0?'':''}"><span style="color:${saldo>=0?'var(--success)':'var(--danger)'}">${fmtARS(Math.max(0,saldo))}</span></div>
        <div class="card-sub">si se paga todo</div>
      </div>
    </div>

    ${alerts.length ? `
    <div class="alerts-section">
      <h3 style="font-size:.8rem;font-weight:600;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem">Alertas del mes</h3>
      ${alerts.map(a=>`<div class="alert-item alert-item--${a.type}"><span>${a.type==='danger'?'🔴':'🟡'}</span> ${a.msg}</div>`).join('')}
    </div>` : ''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1.25rem">
      <div class="chart-container">
        <div class="chart-title">Distribución de gastos</div>
        ${renderExpensePie(totalFixed, totalVariable, totalCards, totalInstall)}
      </div>
      <div class="chart-container">
        <div class="chart-title">Acciones rápidas</div>
        <div style="display:flex;flex-direction:column;gap:.5rem">
          <button class="btn btn--ghost btn--sm" onclick="navigateTo('ingresos')">+ Agregar ingreso</button>
          <button class="btn btn--ghost btn--sm" onclick="navigateTo('gastos-fijos')">+ Agregar gasto fijo</button>
          <button class="btn btn--ghost btn--sm" onclick="navigateTo('gastos-variables')">+ Agregar gasto variable</button>
          <button class="btn btn--ghost btn--sm" onclick="navigateTo('tarjetas')">+ Registrar consumo</button>
          <button class="btn btn--outline btn--sm" onclick="navigateTo('dolar')">💵 Ver cotización dólar</button>
          <button class="btn btn--outline btn--sm" onclick="navigateTo('ahorro')">📊 Ver proyección de ahorro</button>
        </div>
      </div>
    </div>`;
}

function renderExpensePie(fixed, variable, cards, install) {
  const total = fixed + variable + cards + install;
  if (total === 0) return '<p style="color:var(--text-3);font-size:.8rem">Sin gastos cargados</p>';
  const pct = v => total > 0 ? ((v/total)*100).toFixed(1) : 0;
  const items = [
    { label:'Fijos',    value: fixed,    color:'var(--danger)', pct: pct(fixed) },
    { label:'Variables',value: variable, color:'var(--warning)', pct: pct(variable) },
    { label:'Tarjetas', value: cards,    color:'var(--accent)',  pct: pct(cards) },
    { label:'Cuotas',   value: install,  color:'var(--info)',    pct: pct(install) },
  ].filter(i => i.value > 0);

  return `
    <div class="expense-split-bar">
      ${items.map(i=>`<div class="expense-split-segment" style="width:${i.pct}%;background:${i.color};min-width:${i.value>0?'4px':'0'}"></div>`).join('')}
    </div>
    <div class="split-legend">
      ${items.map(i=>`
        <div class="split-legend-item">
          <div class="split-dot" style="background:${i.color}"></div>
          ${i.label}: ${i.pct}% (${fmtARS(i.value)})
        </div>`).join('')}
    </div>`;
}

/* ============================================================
   17. INGRESOS
   ============================================================ */
async function renderIngresos() {
  const sec = $('section-ingresos');
  const rows = await dbSelect('incomes', { month: APP.currentMonth, year: APP.currentYear });
  APP.cache.incomes = rows;
  const total = rows.reduce((s,r) => s + (+r.amount||0), 0);

  sec.innerHTML = `
    <div class="section-top">
      <div>
        <h2 class="section-title">Ingresos</h2>
        <p class="section-subtitle">Total del mes: <strong class="mono" style="color:var(--success)">${fmtARS(total)}</strong></p>
      </div>
      <div style="display:flex;gap:.5rem">
        <button class="btn btn--ghost btn--sm" onclick="duplicarMesAnterior('incomes')">📋 Duplicar mes anterior</button>
        <button class="btn btn--primary" onclick="openIngresosForm()">+ Agregar ingreso</button>
      </div>
    </div>

    <div class="table-wrap">
      <table class="table">
        <thead><tr>
          <th>Descripción</th><th>Persona</th><th>Fecha</th>
          <th style="text-align:right">Monto</th><th>Notas</th><th></th>
        </tr></thead>
        <tbody id="incomes-tbody">
          ${rows.length === 0
            ? `<tr><td colspan="6"><div class="table-empty">Sin ingresos registrados este mes. <button class="btn btn--primary btn--sm" onclick="openIngresosForm()">Agregar</button></div></td></tr>`
            : rows.map(r => ingresosRow(r)).join('')}
        </tbody>
      </table>
    </div>

    ${rows.length > 0 ? `
    <div style="display:flex;justify-content:flex-end;margin-top:.75rem;padding-right:.5rem">
      <div class="mono" style="font-size:1.2rem;font-weight:700;color:var(--success)">Total: ${fmtARS(total)}</div>
    </div>` : ''}`;
}

function ingresosRow(r) {
  return `<tr>
    <td><strong>${r.description}</strong></td>
    <td><span class="badge badge--info">${r.person||'—'}</span></td>
    <td>${r.income_date ? fmtDate(r.income_date) : '—'}</td>
    <td style="text-align:right" class="mono" style="color:var(--success)"><strong>${fmtARS(r.amount)}</strong></td>
    <td style="color:var(--text-3);font-size:.8rem;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.notes||'—'}</td>
    <td>
      <div class="table-actions">
        <button class="icon-btn" title="Editar" onclick="editIngreso('${r.id}')">✏️</button>
        <button class="icon-btn" title="Eliminar" onclick="deleteIngreso('${r.id}','${r.description.replace(/'/g,"\\'")}')">🗑️</button>
      </div>
    </td>
  </tr>`;
}

function openIngresosForm(data = null) {
  const isEdit = !!data;
  openModal(`
    <h2 class="modal-title">${isEdit ? 'Editar ingreso' : 'Nuevo ingreso'}</h2>
    <div class="form-grid">
      <div class="field-group">
        <label class="field-label">Descripción *</label>
        <input id="inc-desc" class="field-input" placeholder="Ej: Sueldo Juli" value="${data?.description||''}">
      </div>
      <div class="field-row">
        <div class="field-group">
          <label class="field-label">Monto (ARS) *</label>
          <input id="inc-amount" type="number" class="field-input" placeholder="0" min="0" step="0.01" value="${data?.amount||''}">
        </div>
        <div class="field-group">
          <label class="field-label">Persona</label>
          <select id="inc-person" class="field-select">
            ${['Juli','Mari','Ambos','Otro'].map(p=>`<option ${(data?.person||'Ambos')===p?'selected':''}>${p}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field-group">
          <label class="field-label">Fecha (opcional)</label>
          <input id="inc-date" type="date" class="field-input" value="${data?.income_date||''}">
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">Observaciones</label>
        <textarea id="inc-notes" class="field-textarea" placeholder="Notas...">${data?.notes||''}</textarea>
      </div>
      <div class="form-actions">
        <button class="btn btn--ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn--primary" onclick="${isEdit?`updateIngreso('${data.id}')`:'saveIngreso()'}">
          ${isEdit ? 'Guardar cambios' : 'Agregar ingreso'}
        </button>
      </div>
    </div>`);
}

async function saveIngreso() {
  const desc   = $('inc-desc').value.trim();
  const amount = parseFloat($('inc-amount').value);
  if (!desc)         return toast('Ingresá una descripción', 'warning');
  if (isNaN(amount) || amount < 0) return toast('Ingresá un monto válido', 'warning');
  try {
    await dbInsert('incomes', {
      description: desc, amount, person: $('inc-person').value,
      income_date: $('inc-date').value || null,
      notes: $('inc-notes').value.trim() || null,
      month: APP.currentMonth, year: APP.currentYear
    });
    closeModal(); toast('Ingreso agregado ✓'); renderIngresos();
  } catch {}
}

async function updateIngreso(id) {
  const desc   = $('inc-desc').value.trim();
  const amount = parseFloat($('inc-amount').value);
  if (!desc) return toast('Ingresá una descripción', 'warning');
  if (isNaN(amount) || amount < 0) return toast('Monto inválido', 'warning');
  try {
    await dbUpdate('incomes', id, {
      description: desc, amount, person: $('inc-person').value,
      income_date: $('inc-date').value || null,
      notes: $('inc-notes').value.trim() || null
    });
    closeModal(); toast('Ingreso actualizado ✓'); renderIngresos();
  } catch {}
}

async function editIngreso(id) {
  const row = APP.cache.incomes.find(r => r.id === id);
  if (row) openIngresosForm(row);
}

async function deleteIngreso(id, desc) {
  confirmAction(`¿Eliminar "${desc}"?`, async () => {
    await dbDelete('incomes', id);
    toast('Ingreso eliminado', 'info'); renderIngresos();
  });
}

/* ============================================================
   18. GASTOS FIJOS
   ============================================================ */
const DEFAULT_FIXED = [
  'Alquiler','Edesur','Metrogas','Aysa','Gimnasio','Patente',
  'Cel Juli','Cel Mari','Vigilancia','Garage','Nafta','Pilates',
  'Fútbol partido','Fútbol entrenamiento','Polly','Viáticos',
  'Verdulería Vidal','Arba','Arqui','Yoga','Supermercado'
];

async function renderGastosFijos() {
  const sec = $('section-gastos-fijos');
  const rows = await dbSelect('fixed_expenses', { month: APP.currentMonth, year: APP.currentYear });
  APP.cache.fixedExpenses = rows;

  // Real desde movimientos; presupuesto = budgeted_amount > 0 ó amount (legacy)
  const realMap       = await computeRealAmounts(rows);
  const totalBudgeted = rows.reduce((s,r) => s + (+r.budgeted_amount > 0 ? +r.budgeted_amount : +r.amount || 0), 0);
  const totalReal     = rows.reduce((s,r) => s + (realMap[r.id] ?? 0), 0);
  const totalPaid     = rows.filter(r=>r.status==='paid').reduce((s,r)=>s+(realMap[r.id]??0),0);
  const globalDiff    = totalBudgeted - totalReal;   // positivo = restante, negativo = excedido
  const pct           = totalBudgeted > 0 ? Math.min(100, totalReal / totalBudgeted * 100) : 0;

  sec.innerHTML = `
    <div class="section-top">
      <div>
        <h2 class="section-title">Gastos Fijos</h2>
        <p class="section-subtitle">
          Presupuesto: <strong class="mono">${fmtARS(totalBudgeted)}</strong>
          · Real: <strong class="mono" style="color:${globalDiff<-0.01?'var(--danger)':'inherit'}">${fmtARS(totalReal)}</strong>
          ${Math.abs(globalDiff)>0.01
            ?`· <span style="color:${globalDiff>0?'var(--success)':'var(--danger)'}">${globalDiff>0?'↓ Resta':'↑ Excede'} ${fmtARS(Math.abs(globalDiff))}</span>`
            :''}
          · Pagado: <span style="color:var(--success)">${fmtARS(totalPaid)}</span>
        </p>
      </div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        <button class="btn btn--ghost btn--sm" onclick="duplicarMesAnterior('fixed_expenses')">📋 Duplicar mes anterior</button>
        <button class="btn btn--ghost btn--sm" onclick="precargarGastosFijos()">⬇ Precargar lista</button>
        <button class="btn btn--primary" onclick="openFixedForm()">+ Agregar</button>
      </div>
    </div>

    <div class="progress-bar" style="margin-bottom:1rem">
      <div class="progress-fill ${pct>=100?'progress-fill--danger':pct>80?'progress-fill--warning':'progress-fill--success'}" style="width:${Math.min(100,pct)}%"></div>
    </div>
    <p style="font-size:.75rem;color:var(--text-3);margin-bottom:1rem">${pct.toFixed(0)}% del presupuesto utilizado</p>

    <div class="filter-bar">
      <div class="search-input-wrap">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input id="fixed-search" class="field-input" placeholder="Buscar..." oninput="filterFixedTable()">
      </div>
      <select id="fixed-status-filter" class="field-select" style="width:auto" onchange="filterFixedTable()">
        <option value="">Todos</option>
        <option value="pending">Pendiente</option>
        <option value="paid">Pagado</option>
      </select>
    </div>

    <div id="fixed-bulk-bar" style="display:none;align-items:center;gap:.75rem;padding:.5rem .875rem;background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius-md);margin-bottom:.75rem;flex-wrap:wrap">
      <span id="fixed-bulk-count" style="font-size:.85rem;color:var(--text-2);flex:1"></span>
      <button class="btn btn--success btn--sm" onclick="bulkFixedAction('paid')">✓ Marcar pagados</button>
      <button class="btn btn--ghost btn--sm" onclick="bulkFixedAction('pending')">↩ Marcar pendientes</button>
      <button class="btn btn--danger btn--sm" onclick="bulkFixedAction('delete')">🗑 Eliminar</button>
    </div>
    <div class="table-wrap">
      <table class="table" id="fixed-table">
        <thead><tr>
          <th style="width:2rem"><input type="checkbox" id="fixed-select-all" style="accent-color:var(--accent)" onchange="fixedSelectAll(this.checked)" title="Seleccionar todo"></th>
          <th>Descripción</th><th>Categoría</th><th>Persona</th><th>Vencimiento</th>
          <th style="text-align:right">Real / Presupuesto</th><th>Estado</th><th></th>
        </tr></thead>
        <tbody id="fixed-tbody">
          ${rows.length === 0
            ? `<tr><td colspan="8"><div class="table-empty">Sin gastos fijos este mes. <button class="btn btn--ghost btn--sm" onclick="precargarGastosFijos()">Precargar lista</button></div></td></tr>`
            : rows.map(r => fixedRow(r, realMap[r.id] ?? 0)).join('')}
        </tbody>
      </table>
    </div>`;
}

function fixedRow(r, realAmount) {
  // budget: budgeted_amount si fue definido (> 0), sino el amount viejo como fallback
  const budget = +r.budgeted_amount > 0 ? +r.budgeted_amount : (+r.amount || 0);
  const real   = realAmount ?? 0;

  let amountCell;
  if (!budget && !real) {
    amountCell = `<strong class="mono" style="color:var(--text-3)">Sin presupuesto</strong>`;
  } else {
    const diff = budget - real;   // positivo = restante, negativo = excedido
    let diffSpan;
    if (Math.abs(diff) < 0.01) {
      diffSpan = `<span style="color:var(--text-3)">✓ 100%</span>`;
    } else if (diff > 0) {
      diffSpan = `<span style="color:var(--success)">↓ Resta ${fmtARS(diff)}</span>`;
    } else {
      diffSpan = `<span style="color:var(--danger)">↑ Excede ${fmtARS(-diff)}</span>`;
    }
    // Main: presupuesto; sub: real + diferencia
    amountCell = `<strong style="color:${diff<-0.01?'var(--danger)':'inherit'}">${fmtARS(budget)}</strong>
      <br><span style="font-size:.7rem;color:var(--text-3)">Real: ${fmtARS(real)}</span>
      <span style="font-size:.7rem;margin-left:.3rem">${diffSpan}</span>`;
  }

  const statusBadge = r.status === 'paid'
    ? '<span class="badge badge--success">Pagado</span>'
    : '<span class="badge badge--warning">Pendiente</span>';

  return `<tr data-status="${r.status}" data-desc="${r.description.toLowerCase()}">
    <td><input type="checkbox" class="row-check" data-id="${r.id}" style="accent-color:var(--accent)" onchange="updateFixedBulkBar()"></td>
    <td><strong>${r.description}</strong>${r.notes?`<br><span style="font-size:.75rem;color:var(--text-3)">${r.notes}</span>`:''}</td>
    <td>${categoryBadge(r.category||'General')}</td>
    <td style="font-size:.8rem">${r.person||'—'}</td>
    <td style="font-size:.8rem">${r.due_date?fmtDate(r.due_date):'—'}</td>
    <td style="text-align:right" class="mono">${amountCell}</td>
    <td>${statusBadge}</td>
    <td>
      <div class="table-actions">
        <button class="icon-btn" title="${r.status==='paid'?'Marcar pendiente':'Marcar pagado'}"
          onclick="toggleFixedStatus('${r.id}','${r.status}')">${r.status==='paid'?'↩':'✓'}</button>
        <button class="icon-btn" title="Agregar movimiento al gasto real" onclick="openMovementForm('${r.id}','fixed','${r.description.replace(/'/g,"\\'")}')">±</button>
        <button class="icon-btn" title="Ver movimientos" onclick="viewMovements('${r.id}','fixed','${r.description.replace(/'/g,"\\'")}')">≡</button>
        <button class="icon-btn" title="Editar presupuesto" onclick="editFixed('${r.id}')">✏️</button>
        <button class="icon-btn" title="Eliminar" onclick="deleteFixed('${r.id}','${r.description.replace(/'/g,"\\'")}')">🗑️</button>
      </div>
    </td>
  </tr>`;
}

function fixedSelectAll(checked) {
  document.querySelectorAll('#fixed-tbody .row-check').forEach(cb => { cb.checked = checked; });
  updateFixedBulkBar();
}

function updateFixedBulkBar() {
  const checks = [...document.querySelectorAll('#fixed-tbody .row-check')];
  const selected = checks.filter(c => c.checked).length;
  const bar = $('fixed-bulk-bar');
  if (!bar) return;
  bar.style.display = selected > 0 ? 'flex' : 'none';
  $('fixed-bulk-count').textContent = `${selected} seleccionado${selected !== 1 ? 's' : ''}`;
  const allCb = $('fixed-select-all');
  if (allCb) { allCb.indeterminate = selected > 0 && selected < checks.length; allCb.checked = selected > 0 && selected === checks.length; }
}

async function bulkFixedAction(action) {
  const ids = [...document.querySelectorAll('#fixed-tbody .row-check:checked')].map(c => c.dataset.id);
  if (!ids.length) return;
  if (action === 'delete') {
    confirmAction(`¿Eliminar ${ids.length} gasto${ids.length > 1 ? 's' : ''}?`, async () => {
      for (const id of ids) await dbDelete('fixed_expenses', id);
      toast(`${ids.length} eliminado${ids.length > 1 ? 's' : ''} ✓`); renderGastosFijos();
    });
  } else {
    for (const id of ids) await dbUpdate('fixed_expenses', id, { status: action });
    toast(`${ids.length} marcado${ids.length > 1 ? 's' : ''} como ${action === 'paid' ? 'pagados' : 'pendientes'} ✓`);
    renderGastosFijos();
  }
}

function txnSelectAll(checked) {
  document.querySelectorAll('#txn-tbody .row-check').forEach(cb => { cb.checked = checked; });
  updateTxnBulkBar();
}

function updateTxnBulkBar() {
  const checks = [...document.querySelectorAll('#txn-tbody .row-check')];
  const selected = checks.filter(c => c.checked).length;
  const bar = $('txn-bulk-bar');
  if (!bar) return;
  bar.style.display = selected > 0 ? 'flex' : 'none';
  $('txn-bulk-count').textContent = `${selected} seleccionado${selected !== 1 ? 's' : ''}`;
  const allCb = $('txn-select-all');
  if (allCb) { allCb.indeterminate = selected > 0 && selected < checks.length; allCb.checked = selected > 0 && selected === checks.length; }
}

async function bulkTxnAction(action) {
  const ids = [...document.querySelectorAll('#txn-tbody .row-check:checked')].map(c => c.dataset.id);
  if (!ids.length) return;
  if (action === 'delete') {
    confirmAction(`¿Eliminar ${ids.length} consumo${ids.length > 1 ? 's' : ''}?`, async () => {
      for (const id of ids) await dbDelete('card_transactions', id);
      toast(`${ids.length} eliminado${ids.length > 1 ? 's' : ''} ✓`); renderTarjetas();
    });
  } else {
    for (const id of ids) {
      await upsertMonthlyStatus(id, APP.currentMonth, APP.currentYear, action);
    }
    toast(`${ids.length} marcado${ids.length > 1 ? 's' : ''} como ${action === 'paid' ? 'pagados' : 'pendientes'} ✓`);
    renderTarjetas();
  }
}

function filterFixedTable() {
  const search = ($('fixed-search')?.value || '').toLowerCase();
  const status = $('fixed-status-filter')?.value || '';
  $qa('#fixed-tbody tr[data-desc]').forEach(tr => {
    const matchDesc   = tr.dataset.desc?.includes(search);
    const matchStatus = !status || tr.dataset.status === status;
    tr.style.display  = (matchDesc && matchStatus) ? '' : 'none';
  });
}

function openFixedForm(data = null) {
  const isEdit = !!data;
  const cats = ['Vivienda','Servicios','Transporte','Salud','Educación','Entretenimiento','Mascotas','General','Otros'];
  const budgetValue = isEdit ? (data?.budgeted_amount ?? data?.amount ?? '') : '';
  openModal(`
    <h2 class="modal-title">${isEdit?'Editar gasto fijo':'Nuevo gasto fijo'}</h2>
    ${isEdit?`<p style="font-size:.78rem;color:var(--text-3);margin-bottom:.5rem">El monto real solo se modifica con movimientos (±). Acá editás el presupuesto estimado.</p>`:''}
    <div class="form-grid">
      <div class="field-group">
        <label class="field-label">Descripción *</label>
        <input id="fx-desc" class="field-input" placeholder="Ej: Alquiler" value="${data?.description||''}">
      </div>
      <div class="field-row">
        <div class="field-group">
          <label class="field-label">Presupuesto estimado (ARS) *</label>
          <input id="fx-budget" type="number" class="field-input" placeholder="0" min="0" step="0.01" value="${budgetValue}">
        </div>
        <div class="field-group">
          <label class="field-label">Categoría</label>
          <select id="fx-cat" class="field-select">
            ${cats.map(c=>`<option ${(data?.category||'General')===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field-group">
          <label class="field-label">Persona</label>
          <select id="fx-person" class="field-select">
            ${['Juli','Mari','Ambos','Otro'].map(p=>`<option ${(data?.person||'Ambos')===p?'selected':''}>${p}</option>`).join('')}
          </select>
        </div>
        <div class="field-group">
          <label class="field-label">Estado</label>
          <select id="fx-status" class="field-select">
            <option value="pending" ${(data?.status||'pending')==='pending'?'selected':''}>Pendiente</option>
            <option value="paid" ${data?.status==='paid'?'selected':''}>Pagado</option>
          </select>
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">Fecha de vencimiento (opcional)</label>
        <input id="fx-due" type="date" class="field-input" value="${data?.due_date||''}">
      </div>
      <div class="field-group">
        <label class="field-label">Observaciones</label>
        <textarea id="fx-notes" class="field-textarea" placeholder="Notas...">${data?.notes||''}</textarea>
      </div>
      <div class="form-actions">
        <button class="btn btn--ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn--primary" onclick="${isEdit?`updateFixed('${data.id}')`:'saveFixed()'}">
          ${isEdit?'Guardar cambios':'Agregar gasto'}
        </button>
      </div>
    </div>`);
}

async function saveFixed() {
  const desc   = $('fx-desc').value.trim();
  const budget = parseFloat($('fx-budget').value);
  if (!desc)   return toast('Ingresá una descripción', 'warning');
  if (isNaN(budget) || budget < 0) return toast('Monto inválido', 'warning');
  try {
    await dbInsert('fixed_expenses', {
      description: desc, amount: 0, budgeted_amount: budget,
      category: $('fx-cat').value, person: $('fx-person').value,
      status: $('fx-status').value, due_date: $('fx-due').value || null,
      notes: $('fx-notes').value.trim() || null,
      month: APP.currentMonth, year: APP.currentYear
    });
    closeModal(); toast('Gasto fijo agregado ✓'); renderGastosFijos();
  } catch {}
}

async function updateFixed(id) {
  const desc        = $('fx-desc').value.trim();
  const budget      = parseFloat($('fx-budget').value);
  const newCategory = $('fx-cat').value;
  if (!desc)   return toast('Descripción requerida', 'warning');
  if (isNaN(budget) || budget < 0) return toast('Monto inválido', 'warning');
  const originalDesc = APP.cache.fixedExpenses.find(r => r.id === id)?.description || desc;
  try {
    // Solo actualiza budgeted_amount; amount (gasto real) lo manejan los movimientos
    await dbUpdate('fixed_expenses', id, {
      description: desc, budgeted_amount: budget, category: newCategory,
      person: $('fx-person').value, status: $('fx-status').value,
      due_date: $('fx-due').value || null, notes: $('fx-notes').value.trim() || null
    });
    // Propagar categoría a todos los meses con la misma descripción
    await APP.supabase
      .from('fixed_expenses')
      .update({ category: newCategory })
      .eq('household_id', APP.householdId)
      .eq('description', originalDesc)
      .neq('id', id);
    closeModal(); toast('Gasto actualizado ✓'); renderGastosFijos();
  } catch {}
}

async function editFixed(id) {
  const row = APP.cache.fixedExpenses.find(r => r.id === id);
  if (row) openFixedForm(row);
}

async function toggleFixedStatus(id, currentStatus) {
  const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
  try {
    await dbUpdate('fixed_expenses', id, { status: newStatus });
    toast(newStatus === 'paid' ? 'Marcado como pagado ✓' : 'Marcado como pendiente', 'info');
    renderGastosFijos();
  } catch {}
}

async function deleteFixed(id, desc) {
  confirmAction(`¿Eliminar "${desc}"?`, async () => {
    await dbDelete('fixed_expenses', id);
    toast('Gasto eliminado', 'info'); renderGastosFijos();
  });
}

async function precargarGastosFijos() {
  confirmAction(`¿Precargar los ${DEFAULT_FIXED.length} gastos fijos predeterminados en este mes? Solo se agregarán los que no existan.`, async () => {
    const existing = APP.cache.fixedExpenses.map(r => r.description.toLowerCase());
    const toInsert = DEFAULT_FIXED.filter(d => !existing.includes(d.toLowerCase()));
    if (toInsert.length === 0) return toast('Ya están todos cargados', 'info');
    let count = 0;
    for (const desc of toInsert) {
      try {
        await dbInsert('fixed_expenses', {
          description: desc, amount: 0, status: 'pending',
          month: APP.currentMonth, year: APP.currentYear
        });
        count++;
      } catch {}
    }
    toast(`${count} gastos precargados ✓`); renderGastosFijos();
  });
}

/* ============================================================
   19. DUPLICAR MES ANTERIOR
   ============================================================ */
async function duplicarMesAnterior(table) {
  let prevMonth = APP.currentMonth - 1;
  let prevYear  = APP.currentYear;
  if (prevMonth < 1) { prevMonth = 12; prevYear--; }

  confirmAction(`¿Copiar registros de ${monthName(prevMonth)} ${prevYear} a este mes? Solo se copian los que no existan.`, async () => {
    const prev = await dbSelect(table, { month: prevMonth, year: prevYear });
    if (prev.length === 0) return toast('No hay datos en el mes anterior', 'warning');
    const current = await dbSelect(table, { month: APP.currentMonth, year: APP.currentYear });
    const existingDescs = current.map(r => r.description?.toLowerCase());
    let count = 0;
    for (const row of prev) {
      if (existingDescs.includes(row.description?.toLowerCase())) continue;
      const { id, created_at, updated_at, ...rest } = row;
      // Para fijos y variables: amount=0 al nuevo mes; movimientos empiezan de cero
      const resetAmount = (table === 'fixed_expenses' || table === 'variable_expenses')
        ? { amount: 0 }
        : {};
      try {
        await dbInsert(table, { ...rest, ...resetAmount, month: APP.currentMonth, year: APP.currentYear, status: 'pending' });
        count++;
      } catch {}
    }
    toast(`${count} registros duplicados ✓`); loadCurrentSection();
  });
}

function monthName(m) {
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return meses[m-1];
}

/* ============================================================
   20. GASTOS VARIABLES
   ============================================================ */
const VAR_CATS = ['Supermercado','Comida','Mascotas','Salidas','Servicios','Ropa','Farmacia','Transporte','Tecnología','Hogar','Otros'];

async function renderGastosVariables() {
  const sec = $('section-gastos-variables');
  const rows = await dbSelect('variable_expenses', { month: APP.currentMonth, year: APP.currentYear });
  APP.cache.varExpenses = rows;

  // Real desde movimientos; presupuesto = budgeted_amount > 0 ó amount (legacy)
  const realMap       = await computeRealAmounts(rows);
  const totalBudgetedV = rows.reduce((s,r) => s + (+r.budgeted_amount > 0 ? +r.budgeted_amount : +r.amount || 0), 0);
  const totalRealV     = rows.reduce((s,r) => s + (realMap[r.id] ?? 0), 0);
  const globalDiffV    = totalBudgetedV - totalRealV;

  // Agrupación por categoría (usando real)
  const byCat = {};
  rows.forEach(r => { byCat[r.category||'Otros'] = (byCat[r.category||'Otros']||0) + (realMap[r.id]??0); });
  const catsSorted = Object.entries(byCat).sort((a,b) => b[1]-a[1]);

  sec.innerHTML = `
    <div class="section-top">
      <div>
        <h2 class="section-title">Gastos Variables</h2>
        <p class="section-subtitle">
          Presupuesto: <strong class="mono">${fmtARS(totalBudgetedV)}</strong>
          · Real: <strong class="mono" style="color:${globalDiffV<-0.01?'var(--danger)':'inherit'}">${fmtARS(totalRealV)}</strong>
          ${Math.abs(globalDiffV)>0.01
            ?`· <span style="color:${globalDiffV>0?'var(--success)':'var(--danger)'}">${globalDiffV>0?'↓ Resta':'↑ Excede'} ${fmtARS(Math.abs(globalDiffV))}</span>`
            :''}
          · ${rows.length} registro${rows.length!==1?'s':''}
        </p>
      </div>
      <button class="btn btn--primary" onclick="openVarForm()">+ Agregar gasto</button>
    </div>

    ${catsSorted.length > 0 ? `
    <div class="stats-grid" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr));margin-bottom:1.25rem">
      ${catsSorted.slice(0,6).map(([cat,val]) => `
        <div class="stat-card">
          <div class="card-label" style="font-size:.7rem">${cat}</div>
          <div class="card-value--sm mono" style="font-size:.95rem">${fmtARS(val)}</div>
          <div class="card-sub">${totalRealV>0?fmtPct(val/totalRealV*100):''}</div>
        </div>`).join('')}
    </div>` : ''}

    <div class="filter-bar">
      <div class="search-input-wrap">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input id="var-search" class="field-input" placeholder="Buscar..." oninput="filterVarTable()">
      </div>
      <select id="var-cat-filter" class="field-select" style="width:auto" onchange="filterVarTable()">
        <option value="">Todas las categorías</option>
        ${VAR_CATS.map(c=>`<option>${c}</option>`).join('')}
      </select>
      <select id="var-person-filter" class="field-select" style="width:auto" onchange="filterVarTable()">
        <option value="">Todas las personas</option>
        ${['Juli','Mari','Ambos','Otro'].map(p=>`<option>${p}</option>`).join('')}
      </select>
      <select id="var-method-filter" class="field-select" style="width:auto" onchange="filterVarTable()">
        <option value="">Todos los métodos</option>
        ${['efectivo','débito','crédito','transferencia','otro'].map(m=>`<option>${m}</option>`).join('')}
      </select>
    </div>

    <div class="table-wrap">
      <table class="table">
        <thead><tr>
          <th>Descripción</th><th>Categoría</th><th>Persona</th><th>Método</th>
          <th>Fecha</th><th style="text-align:right">Real / Presupuesto</th><th></th>
        </tr></thead>
        <tbody id="var-tbody">
          ${rows.length === 0
            ? `<tr><td colspan="7"><div class="table-empty">Sin gastos variables este mes.</div></td></tr>`
            : rows.map(r => varRow(r, realMap[r.id] ?? 0)).join('')}
        </tbody>
      </table>
    </div>`;
}

function varRow(r, realAmount) {
  const budget = +r.budgeted_amount > 0 ? +r.budgeted_amount : (+r.amount || 0);
  const real   = realAmount ?? 0;

  let amountCell;
  if (!budget && !real) {
    amountCell = `<strong class="mono" style="color:var(--text-3)">Sin presupuesto</strong>`;
  } else {
    const diff = budget - real;
    let diffSpan;
    if (Math.abs(diff) < 0.01) {
      diffSpan = `<span style="color:var(--text-3)">✓ 100%</span>`;
    } else if (diff > 0) {
      diffSpan = `<span style="color:var(--success)">↓ Resta ${fmtARS(diff)}</span>`;
    } else {
      diffSpan = `<span style="color:var(--danger)">↑ Excede ${fmtARS(-diff)}</span>`;
    }
    amountCell = `<strong style="color:${diff<-0.01?'var(--danger)':'inherit'}">${fmtARS(budget)}</strong>
      <br><span style="font-size:.7rem;color:var(--text-3)">Real: ${fmtARS(real)}</span>
      <span style="font-size:.7rem;margin-left:.3rem">${diffSpan}</span>`;
  }

  return `<tr data-cat="${(r.category||'Otros').toLowerCase()}" data-desc="${r.description.toLowerCase()}" data-person="${(r.person||'').toLowerCase()}" data-method="${(r.payment_method||'').toLowerCase()}">
    <td><strong>${r.description}</strong></td>
    <td>${categoryBadge(r.category||'Otros')}</td>
    <td style="font-size:.8rem">${r.person||'—'}</td>
    <td style="font-size:.8rem">${r.payment_method||'—'}</td>
    <td style="font-size:.8rem">${r.expense_date?fmtDate(r.expense_date):'—'}</td>
    <td style="text-align:right" class="mono">${amountCell}</td>
    <td>
      <div class="table-actions">
        <button class="icon-btn" title="Agregar movimiento al gasto real" onclick="openMovementForm('${r.id}','variable','${r.description.replace(/'/g,"\\'")}')">±</button>
        <button class="icon-btn" title="Ver movimientos" onclick="viewMovements('${r.id}','variable','${r.description.replace(/'/g,"\\'")}')">≡</button>
        <button class="icon-btn" title="Editar presupuesto" onclick="editVar('${r.id}')">✏️</button>
        <button class="icon-btn" title="Eliminar" onclick="deleteVar('${r.id}','${r.description.replace(/'/g,"\\'")}')">🗑️</button>
      </div>
    </td>
  </tr>`;
}

function filterVarTable() {
  const search  = ($('var-search')?.value||'').toLowerCase();
  const cat     = ($('var-cat-filter')?.value||'').toLowerCase();
  const person  = ($('var-person-filter')?.value||'').toLowerCase();
  const method  = ($('var-method-filter')?.value||'').toLowerCase();
  $qa('#var-tbody tr[data-desc]').forEach(tr => {
    const ok = (!search||tr.dataset.desc?.includes(search))
            && (!cat   ||tr.dataset.cat?.includes(cat))
            && (!person||tr.dataset.person?.includes(person))
            && (!method||tr.dataset.method?.includes(method));
    tr.style.display = ok ? '' : 'none';
  });
}

function openVarForm(data = null) {
  const isEdit = !!data;
  const budgetValue = isEdit ? (data?.budgeted_amount ?? data?.amount ?? '') : '';
  openModal(`
    <h2 class="modal-title">${isEdit?'Editar gasto variable':'Nuevo gasto variable'}</h2>
    ${isEdit?`<p style="font-size:.78rem;color:var(--text-3);margin-bottom:.5rem">El monto real solo se modifica con movimientos (±). Acá editás el presupuesto estimado.</p>`:''}
    <div class="form-grid">
      <div class="field-group">
        <label class="field-label">Descripción *</label>
        <input id="vr-desc" class="field-input" placeholder="Ej: Supermercado Coto" value="${data?.description||''}">
      </div>
      <div class="field-row">
        <div class="field-group">
          <label class="field-label">Presupuesto estimado (ARS) *</label>
          <input id="vr-budget" type="number" class="field-input" placeholder="0" min="0" step="0.01" value="${budgetValue}">
        </div>
        <div class="field-group">
          <label class="field-label">Categoría</label>
          <select id="vr-cat" class="field-select">
            ${VAR_CATS.map(c=>`<option ${(data?.category||'Otros')===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field-group">
          <label class="field-label">Persona</label>
          <select id="vr-person" class="field-select">
            ${['Juli','Mari','Ambos','Otro'].map(p=>`<option ${(data?.person||'Ambos')===p?'selected':''}>${p}</option>`).join('')}
          </select>
        </div>
        <div class="field-group">
          <label class="field-label">Método de pago</label>
          <select id="vr-method" class="field-select">
            ${['efectivo','débito','crédito','transferencia','otro'].map(m=>`<option ${(data?.payment_method||'efectivo')===m?'selected':''}>${m}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">Fecha</label>
        <input id="vr-date" type="date" class="field-input" value="${data?.expense_date||today()}">
      </div>
      <div class="field-group">
        <label class="field-label">Observaciones</label>
        <textarea id="vr-notes" class="field-textarea" placeholder="Notas...">${data?.notes||''}</textarea>
      </div>
      <div class="form-actions">
        <button class="btn btn--ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn--primary" onclick="${isEdit?`updateVar('${data.id}')`:'saveVar()'}">
          ${isEdit?'Guardar cambios':'Agregar gasto'}
        </button>
      </div>
    </div>`);
}

async function saveVar() {
  const desc   = $('vr-desc').value.trim();
  const budget = parseFloat($('vr-budget').value);
  if (!desc) return toast('Ingresá una descripción', 'warning');
  if (isNaN(budget) || budget < 0) return toast('Monto inválido', 'warning');
  try {
    await dbInsert('variable_expenses', {
      description: desc, amount: 0, budgeted_amount: budget,
      category: $('vr-cat').value, person: $('vr-person').value,
      payment_method: $('vr-method').value, expense_date: $('vr-date').value || null,
      notes: $('vr-notes').value.trim() || null,
      month: APP.currentMonth, year: APP.currentYear
    });
    closeModal(); toast('Gasto variable agregado ✓'); renderGastosVariables();
  } catch {}
}

async function updateVar(id) {
  const desc   = $('vr-desc').value.trim();
  const budget = parseFloat($('vr-budget').value);
  if (!desc) return toast('Descripción requerida', 'warning');
  if (isNaN(budget) || budget < 0) return toast('Monto inválido', 'warning');
  try {
    // Solo actualiza budgeted_amount; amount (gasto real) lo manejan los movimientos
    await dbUpdate('variable_expenses', id, {
      description: desc, budgeted_amount: budget, category: $('vr-cat').value,
      person: $('vr-person').value, payment_method: $('vr-method').value,
      expense_date: $('vr-date').value || null, notes: $('vr-notes').value.trim() || null
    });
    closeModal(); toast('Gasto actualizado ✓'); renderGastosVariables();
  } catch {}
}

async function editVar(id) {
  const row = APP.cache.varExpenses.find(r => r.id === id);
  if (row) openVarForm(row);
}

async function deleteVar(id, desc) {
  confirmAction(`¿Eliminar "${desc}"?`, async () => {
    await dbDelete('variable_expenses', id);
    toast('Gasto eliminado', 'info'); renderGastosVariables();
  });
}

/* ============================================================
   21. TARJETAS DE CRÉDITO
   ============================================================ */
const DEFAULT_CARDS = [
  { name:'Visa crédito Juli',  holder:'Juli',  bank:'Banco', color:'#1a56db' },
  { name:'Mercado Pago Juli',  holder:'Juli',  bank:'MP',    color:'#009ee3' },
  { name:'Visa crédito Mari',  holder:'Mari',  bank:'Banco', color:'#7c3aed' },
  { name:'Mastercard Mari',    holder:'Mari',  bank:'Banco', color:'#dc2626' },
];

function getCardClosingStatus(card, month = APP.currentMonth, year = APP.currentYear) {
  const { closingDate } = calculateCardDates(card, month, year);
  if (!closingDate) return { status: 'open', daysUntil: null };
  const todayStr = today();
  if (closingDate === todayStr) return { status: 'today', daysUntil: 0 };
  if (closingDate < todayStr)  return { status: 'closed', daysUntil: null };
  const diff = Math.ceil((new Date(closingDate + 'T00:00:00') - new Date()) / 86400000);
  return { status: 'open', daysUntil: diff };
}

function getCardDueStatus(card, month = APP.currentMonth, year = APP.currentYear) {
  const { dueDate } = calculateCardDates(card, month, year);
  if (!dueDate) return { status: 'open', daysUntil: null };
  const todayStr = today();
  if (dueDate === todayStr) return { status: 'today', daysUntil: 0 };
  if (dueDate < todayStr)  return { status: 'overdue', daysUntil: null };
  const diff = Math.ceil((new Date(dueDate + 'T00:00:00') - new Date()) / 86400000);
  return { status: 'open', daysUntil: diff };
}

// Carga las transacciones de tarjeta que corresponden a un mes/año,
// propagando cuotas desde meses anteriores.
// El estado (pagado/pendiente) se resuelve por mes desde card_transaction_monthly_status.
async function loadCardTxnsForMonth(month, year) {
  if (!APP.householdId) return [];

  // Traer transacciones y estados mensuales en paralelo
  const [txnRes, statusRes] = await Promise.all([
    APP.supabase
      .from('card_transactions')
      .select('*')
      .eq('household_id', APP.householdId)
      .gte('year', year - 5)
      .order('created_at', { ascending: true }),
    APP.supabase
      .from('card_transaction_monthly_status')
      .select('transaction_id, status')
      .eq('household_id', APP.householdId)
      .eq('month', month)
      .eq('year', year)
  ]);

  if (txnRes.error) { console.error('loadCardTxns:', txnRes.error); return []; }

  // Mapa: transaction_id → status mensual explícito
  const monthlyStatusMap = {};
  (statusRes.data || []).forEach(s => { monthlyStatusMap[s.transaction_id] = s.status; });

  const targetAbs = year * 12 + month;

  return (txnRes.data || []).map(t => {
    const originAbs = t.year * 12 + t.month;
    const diff = targetAbs - originAbs;

    let projected = null;

    if (t.is_recurring) {
      if (diff < 0) return null;
      projected = { ...t, _projected: diff > 0 };
    } else if (t.total_installments <= 1) {
      if (diff !== 0) return null;
      projected = { ...t };
    } else {
      const effectiveCurrent = t.current_installment + diff;
      if (diff < 0 || effectiveCurrent > t.total_installments) return null;
      projected = {
        ...t,
        current_installment:    effectiveCurrent,
        remaining_installments: t.total_installments - effectiveCurrent,
        _projected: diff > 0,
      };
    }

    // Estado mensual: registro explícito > 'finished' global > 'pending' por defecto
    if (monthlyStatusMap[t.id] !== undefined) {
      projected.status = monthlyStatusMap[t.id];
    } else if (t.status === 'finished') {
      projected.status = 'finished';
    } else {
      projected.status = 'pending';
    }

    return projected;
  }).filter(Boolean);
}

async function renderTarjetas() {
  const sec = $('section-tarjetas');
  const cards = await dbSelect('credit_cards');
  APP.cache.cards = cards;
  const txns = await loadCardTxnsForMonth(APP.currentMonth, APP.currentYear);

  // Calcular totales por tarjeta
  const cardTotals = {};
  txns.forEach(t => {
    const amt = txnARS(t);
    cardTotals[t.card_id] = (cardTotals[t.card_id]||0) + amt;
  });
  const totalGeneral = Object.values(cardTotals).reduce((s,v)=>s+v, 0);
  APP.cache.cardTotals = { ...cardTotals };

  if (cards.length === 0) {
    sec.innerHTML = `
      <div class="section-top">
        <h2 class="section-title">Tarjetas</h2>
        <div style="display:flex;gap:.5rem">
          <button class="btn btn--ghost btn--sm" onclick="precargarTarjetas()">⬇ Precargar tarjetas</button>
          <button class="btn btn--primary" onclick="openCardForm()">+ Nueva tarjeta</button>
        </div>
      </div>
      <div class="empty-state"><div class="empty-state-icon">💳</div><h3>Sin tarjetas</h3>
      <p>Agregá tus tarjetas o precargá las predeterminadas</p></div>`;
    return;
  }

  sec.innerHTML = `
    <div class="section-top">
      <div>
        <h2 class="section-title">Tarjetas</h2>
        <p class="section-subtitle">Total del mes: <strong class="mono">${fmtARS(totalGeneral)}</strong></p>
      </div>
      <div style="display:flex;gap:.5rem">
        <button class="btn btn--ghost btn--sm" onclick="openCardForm()">+ Nueva tarjeta</button>
      </div>
    </div>

    <div class="credit-cards-grid" id="cards-grid">
      ${cards.map(c => creditCardVisual(c, cardTotals[c.id]||0, txns.filter(t=>t.card_id===c.id))).join('')}
    </div>

    <div id="card-transactions-panel"></div>`;

  // Restaurar la tarjeta que estaba activa, o mostrar la primera
  const activeId = (APP.lastActiveCardId && cards.find(c => c.id === APP.lastActiveCardId))
    ? APP.lastActiveCardId : cards[0]?.id;
  if (activeId) showCardTransactions(activeId, txns, cards);
}

function creditCardVisual(card, total, txns) {
  const usdTotal = txns.filter(t=>t.currency==='USD').reduce((s,t)=>s+(+t.amount_usd||0), 0);

  const amountHTML = `<div class="card-amount-value">${fmtARS(total)}</div>`
    + (usdTotal > 0 ? `<div style="font-size:.72rem;color:rgba(255,255,255,.75);margin-top:.1rem">${fmtUSD(usdTotal)} USD</div>` : '');

  const { closingDate: effClosing, dueDate: effDue } = calculateCardDates(card, APP.currentMonth, APP.currentYear);
  const cs = getCardClosingStatus(card);
  const statusBadge = !effClosing ? '' :
    cs.status === 'today'  ? `<span class="card-status-badge card-status-badge--today">Cierra hoy</span>` :
    cs.status === 'closed' ? `<span class="card-status-badge card-status-badge--closed">Ya cerró</span>` :
                             `<span class="card-status-badge card-status-badge--open">Abierta</span>`;

  const dateInfo = (effClosing || effDue)
    ? `<div class="card-dates">
         ${effClosing ? `<span>Cierre: ${fmtDate(effClosing)}</span>` : ''}
         ${effDue    ? `<span>Vto: ${fmtDate(effDue)}</span>` : ''}
       </div>`
    : '';

  const bottomLabel = [card.name, card.bank].filter(Boolean).join(' · ');

  return `
    <div class="credit-card-visual" id="card-visual-${card.id}"
         style="background:linear-gradient(135deg,${card.color}dd 0%,${card.color}88 100%)"
         onclick="showCardTransactions('${card.id}',null,null)">
      <div class="card-chip"></div>
      ${statusBadge}
      <div class="card-number">•••• •••• •••• ${card.last_four||'????'}</div>
      <div class="card-name-holder">Titular</div>
      <div class="card-holder-name">${card.holder}</div>
      ${dateInfo}
      <div style="position:absolute;bottom:1.1rem;left:1.1rem;max-width:55%">
        <div style="font-size:.58rem;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${bottomLabel}</div>
      </div>
      <div class="card-amount-area">
        <div class="card-amount-label">Total mes</div>
        ${amountHTML}
      </div>
    </div>`;
}

async function showCardTransactions(cardId, txnsParam = null, cardsParam = null) {
  APP.lastActiveCardId = cardId;
  const cards = cardsParam || APP.cache.cards;
  const card  = cards.find(c => c.id === cardId);
  if (!card) return;
  const cs = getCardClosingStatus(card);

  // Marcar visualmente la tarjeta activa
  document.querySelectorAll('.credit-card-visual').forEach(el => el.classList.remove('active-card'));
  const cardEl = document.getElementById(`card-visual-${cardId}`);
  if (cardEl) cardEl.classList.add('active-card');

  const txns = txnsParam
    ? txnsParam.filter(t => t.card_id === cardId)
    : await loadCardTxnsForMonth(APP.currentMonth, APP.currentYear);
  const filteredTxns = txnsParam ? txns : txns.filter(t => t.card_id === cardId);
  APP.cache.cardTxns[cardId] = filteredTxns;

  const totalARS      = filteredTxns.filter(t=>t.currency==='ARS').reduce((s,t)=>s+(+t.amount_ars||0), 0);
  const totalUSD      = filteredTxns.filter(t=>t.currency==='USD').reduce((s,t)=>s+(+t.amount_usd||0), 0);
  const totalUSDinARS = filteredTxns.filter(t=>t.currency==='USD').reduce((s,t)=>s+txnARS(t), 0);
  const totalCombined = totalARS + totalUSDinARS;
  const paidARS       = filteredTxns.filter(t=>t.currency==='ARS'&&t.status==='paid').reduce((s,t)=>s+(+t.amount_ars||0), 0);
  const paidUSD       = filteredTxns.filter(t=>t.currency==='USD'&&t.status==='paid').reduce((s,t)=>s+(+t.amount_usd||0), 0);
  const paidUSDinARS  = filteredTxns.filter(t=>t.currency==='USD'&&t.status==='paid').reduce((s,t)=>s+txnARS(t), 0);
  const totalPaid     = paidARS + paidUSDinARS;
  const totalPending  = totalCombined - totalPaid;

  // Si los datos son frescos (click del usuario), sincronizar card visual y subtítulo
  if (!txnsParam) {
    if (!APP.cache.cardTotals) APP.cache.cardTotals = {};
    APP.cache.cardTotals[cardId] = totalCombined;
    const amountEl = document.querySelector(`#card-visual-${cardId} .card-amount-value`);
    if (amountEl) amountEl.textContent = fmtARS(totalCombined);
    const newOverall = Object.values(APP.cache.cardTotals).reduce((s,v)=>s+v, 0);
    const subtitleEl = document.querySelector('#section-tarjetas .section-subtitle strong');
    if (subtitleEl) subtitleEl.textContent = fmtARS(newOverall);
  }

  const panel = $('card-transactions-panel');
  panel.innerHTML = `
    <div style="margin-top:1.5rem">
      <div class="section-top">
        <div>
          <h3 style="font-size:1.1rem;font-weight:700">${card.name}</h3>
          <p style="font-size:.8rem;color:var(--text-2)">
            ${totalCombined>0?`Total ARS: <strong class="mono">${fmtARS(totalCombined)}</strong> · Pend: <span style="color:var(--danger)">${fmtARS(totalPending)}</span>`:'Sin consumos este mes'}
            ${totalUSD>0?` <span style="color:var(--text-3);font-size:.75rem">· ${fmtUSD(totalUSD)} USD</span>`:''}
          </p>
        </div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
          <button class="btn btn--ghost btn--sm" onclick="editCard('${card.id}')">⚙ Configurar tarjeta</button>
          <button class="btn btn--ghost btn--sm" onclick="recalcCardDates('${card.id}')">📅 Recalcular fechas</button>
          <button class="btn btn--ghost btn--sm" onclick="deleteCard('${card.id}','${card.name.replace(/'/g,"\\'")}')">🗑 Eliminar tarjeta</button>
          ${totalUSD > 0 ? `<button class="btn btn--outline btn--sm" onclick="openApplyRateModal('${card.id}')">💱 Cotización USD</button>` : ''}
          <button class="btn btn--primary" onclick="openTxnForm('${card.id}')">+ Agregar consumo</button>
        </div>
      </div>

      ${cs.status === 'closed' ? `
      <div class="alert-item alert-item--warning" style="margin-bottom:.75rem;display:flex;align-items:center;gap:.5rem">
        <span>⚠</span>
        <span>Esta tarjeta ya cerró. Podés usarla para el próximo resumen.</span>
      </div>` : ''}

      <div id="txn-bulk-bar" style="display:none;align-items:center;gap:.75rem;padding:.5rem .875rem;background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius-md);margin-bottom:.75rem;flex-wrap:wrap">
        <span id="txn-bulk-count" style="font-size:.85rem;color:var(--text-2);flex:1"></span>
        <button class="btn btn--success btn--sm" onclick="bulkTxnAction('paid')">✓ Marcar pagados</button>
        <button class="btn btn--ghost btn--sm" onclick="bulkTxnAction('pending')">↩ Marcar pendientes</button>
        <button class="btn btn--danger btn--sm" onclick="bulkTxnAction('delete')">🗑 Eliminar</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th style="width:2rem"><input type="checkbox" id="txn-select-all" style="accent-color:var(--accent)" onchange="txnSelectAll(this.checked)" title="Seleccionar todo"></th>
            <th>Descripción</th><th>Moneda</th><th>Cuotas</th>
            <th style="text-align:right">ARS</th><th style="text-align:right">USD</th>
            <th>Estado</th><th>Fecha</th><th></th>
          </tr></thead>
          <tbody id="txn-tbody">
            ${filteredTxns.length === 0
              ? `<tr><td colspan="9"><div class="table-empty">Sin consumos. <button class="btn btn--primary btn--sm" onclick="openTxnForm('${card.id}')">+ Agregar</button></div></td></tr>`
              : filteredTxns.map(t => txnRow(t, card.id)).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function openApplyRateModal(cardId) {
  const txns = APP.cache.cardTxns[cardId] || [];
  const usdTxns = txns.filter(t => t.currency === 'USD' && (+t.amount_usd||0) > 0);
  if (usdTxns.length === 0) return toast('No hay consumos USD en este mes', 'info');
  const suggestedRate = APP.dollarRate?.sell_rate ? APP.dollarRate.sell_rate.toFixed(2) : '';
  const monthLabel = new Date(APP.currentYear, APP.currentMonth - 1).toLocaleString('es-AR', { month: 'long', year: 'numeric' });
  openModal(`
    <h2 class="modal-title">Aplicar cotización USD</h2>
    <p style="font-size:.85rem;color:var(--text-2);margin-bottom:1rem">
      Actualizará <strong>${usdTxns.length}</strong> consumo${usdTxns.length!==1?'s':''} USD de esta tarjeta en ${monthLabel}.
    </p>
    <div class="form-grid">
      <div class="field-group">
        <label class="field-label">Cotización a aplicar (ARS por USD) *</label>
        <input id="apply-rate-val" type="number" class="field-input" placeholder="Ej: 1440" min="0" step="0.01" value="${suggestedRate}" oninput="previewApplyRate('${cardId}')">
        <p style="font-size:.72rem;color:var(--text-3);margin-top:.25rem">Oficial hoy: ${APP.dollarRate?.sell_rate ? fmtARS(APP.dollarRate.sell_rate) : '—'}</p>
      </div>
      <div id="apply-rate-preview" style="font-size:.82rem;color:var(--text-2);padding:.5rem .75rem;background:var(--bg-3);border-radius:var(--radius-md);line-height:1.6">
        Ingresá la cotización para ver el resumen
      </div>
      <div class="form-actions">
        <button class="btn btn--ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn--primary" onclick="applyUSDRate('${cardId}')">Aplicar cotización</button>
      </div>
    </div>`);
  if (suggestedRate) setTimeout(() => previewApplyRate(cardId), 50);
}

function previewApplyRate(cardId) {
  const rate = parseFloat(document.getElementById('apply-rate-val')?.value || 0);
  const preview = document.getElementById('apply-rate-preview');
  if (!preview) return;
  const txns = APP.cache.cardTxns[cardId] || [];
  const usdTxns = txns.filter(t => t.currency === 'USD' && (+t.amount_usd||0) > 0);
  if (!rate || rate <= 0) { preview.textContent = 'Ingresá la cotización para ver el resumen'; return; }
  const totalUSD = usdTxns.reduce((s, t) => s + (+t.amount_usd||0), 0);
  const rows = usdTxns.map(t => `· ${t.description}: ${fmtUSD(+t.amount_usd)} → ${fmtARS((+t.amount_usd) * rate)}`).join('<br>');
  preview.innerHTML = `${rows}<br><strong style="display:block;margin-top:.4rem">Total ARS: ${fmtARS(totalUSD * rate)}</strong>`;
}

async function applyUSDRate(cardId) {
  const rate = parseFloat(document.getElementById('apply-rate-val')?.value || 0);
  if (!rate || rate <= 0) return toast('Ingresá una cotización válida', 'warning');
  const txns = APP.cache.cardTxns[cardId] || [];
  const usdTxns = txns.filter(t => t.currency === 'USD' && (+t.amount_usd||0) > 0);
  if (usdTxns.length === 0) { closeModal(); return; }
  const uniqueIds = [...new Set(usdTxns.map(t => t.id))];
  let updated = 0;
  for (const id of uniqueIds) {
    const t = usdTxns.find(x => x.id === id);
    const converted = (+t.amount_usd) * rate;
    try {
      await dbUpdate('card_transactions', id, { dollar_rate: rate, converted_ars: converted, amount_ars: converted });
      updated++;
    } catch(e) { console.error('applyUSDRate error', id, e); }
  }
  closeModal();
  toast(`Cotización $${rate.toLocaleString('es-AR')} aplicada a ${updated} consumo${updated!==1?'s':''} USD`, 'success');
  renderTarjetas();
}

function txnRow(t, cardId) {
  const amtARS = txnARS(t);
  const arsDisplay = t.currency==='USD' && amtARS===0 && (+t.amount_usd||0)>0
    ? '<span style="font-size:.72rem;color:var(--warning)" title="Sin cotización — editá el consumo para agregar la cotización aplicada">⚠ Sin cotiz.</span>'
    : fmtARS(amtARS);
  const statusBadge = t.status==='paid'
    ? '<span class="badge badge--success">Pagado</span>'
    : t.status==='finished'
    ? '<span class="badge badge--neutral">Finalizado</span>'
    : '<span class="badge badge--warning">Pendiente</span>';
  const cuotas = t.is_recurring
    ? `<span class="badge" style="background:rgba(99,102,241,.15);color:#818cf8">♻ Fijo</span>`
    : t.total_installments > 1
      ? `${t.current_installment}/${t.total_installments} (${t.remaining_installments} restantes)`
      : '1 pago';
  return `<tr>
    <td><input type="checkbox" class="row-check" data-id="${t.id}" style="accent-color:var(--accent)" onchange="updateTxnBulkBar()"></td>
    <td><strong>${t.description}</strong>${t.notes?`<br><span style="font-size:.75rem;color:var(--text-3)">${t.notes}</span>`:''}</td>
    <td><span class="badge ${t.currency==='USD'?'badge--warning':'badge--success'}">${t.currency}</span></td>
    <td style="font-size:.8rem">${cuotas}</td>
    <td style="text-align:right" class="mono">${arsDisplay}</td>
    <td style="text-align:right" class="mono">${t.currency==='USD'?fmtUSD(+t.amount_usd||0):'—'}</td>
    <td>${statusBadge}</td>
    <td style="font-size:.8rem">${t.transaction_date?fmtDate(t.transaction_date):'—'}</td>
    <td>
      <div class="table-actions">
        <button class="icon-btn" title="${t.status==='paid'?'Marcar pendiente':'Marcar pagado'}"
          onclick="toggleTxnStatus('${t.id}','${t.status}','${cardId}')">${t.status==='paid'?'↩':'✓'}</button>
        <button class="icon-btn" title="Editar" onclick="editTxn('${t.id}','${cardId}')">✏️</button>
        <button class="icon-btn" title="Eliminar" onclick="deleteTxn('${t.id}','${t.description.replace(/'/g,"\\'")}','${cardId}')">🗑️</button>
      </div>
    </td>
  </tr>`;
}

function openTxnForm(cardId, data = null) {
  const isEdit = !!data;
  const dollarDefault = APP.dollarRate?.sell_rate
    ? APP.dollarRate.sell_rate.toFixed(2)
    : '';
  const initConverted = data?.currency === 'USD' && (+data?.amount_usd||0) > 0 && (+data?.dollar_rate||0) > 0
    ? fmtARS((+data.amount_usd) * (+data.dollar_rate))
    : (data?.converted_ars ? fmtARS(data.converted_ars) : '—');
  const cardObj = (APP.cache.cards||[]).find(c => c.id === cardId);
  const csCard  = cardObj ? getCardClosingStatus(cardObj) : null;
  const closedWarning = !isEdit && csCard && csCard.status !== 'open'
    ? csCard.status === 'closed'
      ? `<div class="alert-item alert-item--warning" style="margin-bottom:1rem;font-size:.82rem;display:flex;align-items:center;gap:.5rem">
           <span>⚠</span><span>Esta tarjeta ya cerró. Este consumo podría impactar en el próximo resumen.</span>
         </div>`
      : `<div class="alert-item alert-item--warning" style="margin-bottom:1rem;font-size:.82rem;display:flex;align-items:center;gap:.5rem">
           <span>⚠</span><span>Esta tarjeta cierra hoy. Verificá si este consumo entra en este resumen.</span>
         </div>`
    : '';
  openModal(`
    <h2 class="modal-title">${isEdit?'Editar consumo':'Nuevo consumo'}</h2>
    ${closedWarning}
    <div class="form-grid">
      <div class="field-group">
        <label class="field-label">Descripción *</label>
        <input id="tx-desc" class="field-input" placeholder="Ej: Netflix" value="${data?.description||''}">
      </div>
      <div class="field-row">
        <div class="field-group">
          <label class="field-label">Moneda</label>
          <select id="tx-currency" class="field-select" onchange="toggleTxnCurrency()">
            <option value="ARS" ${(data?.currency||'ARS')==='ARS'?'selected':''}>ARS – Pesos</option>
            <option value="USD" ${data?.currency==='USD'?'selected':''}>USD – Dólares</option>
          </select>
        </div>
        <div class="field-group${(data?.currency||'ARS')==='USD'?' hidden':''}" id="tx-ars-wrap">
          <label class="field-label">Monto ARS *</label>
          <input id="tx-ars" type="number" class="field-input" placeholder="0" min="0" step="0.01" value="${data?.amount_ars||''}">
        </div>
      </div>
      <div id="tx-usd-section" class="${(data?.currency||'ARS')!=='USD'?'hidden':''}">
        <div class="field-row">
          <div class="field-group">
            <label class="field-label">Monto USD *</label>
            <input id="tx-usd" type="number" class="field-input" placeholder="0.00" min="0" step="0.01" value="${data?.amount_usd||''}" oninput="calcTxnConversion()">
          </div>
          <div class="field-group">
            <label class="field-label">Cotización ARS/USD</label>
            <input id="tx-rate" type="number" class="field-input" placeholder="0" min="0" step="0.01" value="${data?.dollar_rate||dollarDefault}" oninput="calcTxnConversion()">
            <p style="font-size:.72rem;color:var(--text-3);margin-top:.25rem">Oficial hoy: ${APP.dollarRate?.sell_rate ? fmtARS(APP.dollarRate.sell_rate) : '—'} · Modificá según tu banco</p>
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">Equivalente ARS</label>
          <div id="tx-converted" style="padding:.5rem .75rem;background:var(--bg-3);border-radius:var(--radius-md);font-family:'DM Mono',monospace;font-size:.9rem">
            ${initConverted}
          </div>
        </div>
      </div>
      <div class="field-group">
        <label style="display:flex;align-items:center;gap:.6rem;cursor:pointer;padding:.5rem .75rem;background:var(--bg-3);border-radius:var(--radius-md);border:1px solid var(--border)">
          <input type="checkbox" id="tx-recurring" ${data?.is_recurring?'checked':''} onchange="toggleRecurring()" style="accent-color:#818cf8;width:1rem;height:1rem;cursor:pointer">
          <span style="font-size:.85rem;font-weight:500;color:var(--text-1)">♻ Gasto fijo recurrente (aparece todos los meses)</span>
        </label>
      </div>
      <div id="tx-installments-section" class="${data?.is_recurring?'hidden':''}">
        <div class="field-row-3">
          <div class="field-group">
            <label class="field-label">Total cuotas</label>
            <input id="tx-total-inst" type="number" class="field-input" min="1" value="${data?.total_installments||1}" oninput="calcInstallments()">
          </div>
          <div class="field-group">
            <label class="field-label">Cuota actual</label>
            <input id="tx-curr-inst" type="number" class="field-input" min="1" value="${data?.current_installment||1}" oninput="calcInstallments()">
          </div>
          <div class="field-group">
            <label class="field-label">Restantes</label>
            <input id="tx-rem-inst" type="number" class="field-input" min="0" value="${data?.remaining_installments||0}" readonly>
          </div>
        </div>
      </div>
      <div class="field-row">
        <div class="field-group">
          <label class="field-label">Estado</label>
          <select id="tx-status" class="field-select">
            <option value="pending" ${(data?.status||'pending')==='pending'?'selected':''}>Pendiente</option>
            <option value="paid"    ${data?.status==='paid'?'selected':''}>Pagado</option>
            <option value="finished"${data?.status==='finished'?'selected':''}>Finalizado</option>
          </select>
        </div>
        <div class="field-group">
          <label class="field-label">Fecha</label>
          <input id="tx-date" type="date" class="field-input" value="${data?.transaction_date||today()}">
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">Observaciones</label>
        <textarea id="tx-notes" class="field-textarea" placeholder="Notas...">${data?.notes||''}</textarea>
      </div>
      <div class="form-actions">
        <button class="btn btn--ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn--primary" onclick="${isEdit?`updateTxn('${data.id}','${cardId}')`:`saveTxn('${cardId}')`}">
          ${isEdit?'Guardar cambios':'Agregar consumo'}
        </button>
      </div>
    </div>`);
}

function toggleTxnCurrency() {
  const isUSD = $('tx-currency').value === 'USD';
  $('tx-usd-section').classList.toggle('hidden', !isUSD);
  $('tx-ars-wrap').classList.toggle('hidden', isUSD);
  if (isUSD) calcTxnConversion();
}

function toggleRecurring() {
  const isRecurring = $('tx-recurring')?.checked;
  $('tx-installments-section')?.classList.toggle('hidden', isRecurring);
}

function calcTxnConversion() {
  const usd  = parseFloat($('tx-usd')?.value||0);
  const rate = parseFloat($('tx-rate')?.value||0);
  const el   = $('tx-converted');
  if (!el) return;
  if (usd > 0 && rate > 0) {
    el.innerHTML = `<strong>${fmtARS(usd * rate)}</strong>`;
  } else if (usd > 0) {
    el.innerHTML = '<span style="color:var(--warning);font-size:.8rem">⚠ Ingresá la cotización para calcular el equivalente en ARS</span>';
  } else {
    el.textContent = '—';
  }
}

function calcInstallments() {
  const total = parseInt($('tx-total-inst')?.value||1);
  const curr  = parseInt($('tx-curr-inst')?.value||1);
  const rem   = $('tx-rem-inst');
  if (rem) rem.value = Math.max(0, total - curr);
}

async function saveTxn(cardId) {
  const desc     = $('tx-desc').value.trim();
  const currency = $('tx-currency').value;
  const amtARS   = parseFloat($('tx-ars').value||0);
  const amtUSD   = parseFloat($('tx-usd')?.value||0);
  const rate     = parseFloat($('tx-rate')?.value||0);
  if (!desc) return toast('Ingresá una descripción', 'warning');
  if (currency === 'ARS' && (!amtARS || amtARS < 0)) return toast('Monto inválido', 'warning');
  if (currency === 'USD' && (!amtUSD || amtUSD < 0)) return toast('Monto USD inválido', 'warning');

  const isRecurring = !!$('tx-recurring')?.checked;
  const totalInst = isRecurring ? 1 : parseInt($('tx-total-inst').value||1);
  const currInst  = isRecurring ? 1 : parseInt($('tx-curr-inst').value||1);
  const converted = currency === 'USD' ? amtUSD * rate : 0;
  if (currency === 'USD' && rate === 0) toast('Sin cotización — el equivalente ARS quedará en $0,00. Editá el consumo cuando tengas la cotización.', 'warning', 5000);

  const txnStatus = $('tx-status').value;
  try {
    const newTxn = await dbInsert('card_transactions', {
      card_id: cardId, description: desc, currency,
      amount_ars: currency === 'ARS' ? amtARS : converted,
      amount_usd: currency === 'USD' ? amtUSD : 0,
      dollar_rate: currency === 'USD' ? rate : null,
      converted_ars: currency === 'USD' ? converted : 0,
      total_installments: totalInst, current_installment: currInst,
      remaining_installments: 0,
      is_recurring: isRecurring,
      status: txnStatus,
      transaction_date: $('tx-date').value || null,
      notes: $('tx-notes').value.trim() || null,
      month: APP.currentMonth, year: APP.currentYear
    });
    // Registrar estado mensual explícito para el mes actual
    if (txnStatus !== 'pending') {
      await upsertMonthlyStatus(newTxn.id, APP.currentMonth, APP.currentYear, txnStatus === 'finished' ? 'paid' : txnStatus);
    }
    closeModal(); toast('Consumo agregado ✓'); renderTarjetas();
  } catch {}
}

async function updateTxn(id, cardId) {
  const desc     = $('tx-desc').value.trim();
  const currency = $('tx-currency').value;
  const amtARS   = parseFloat($('tx-ars').value||0);
  const amtUSD   = parseFloat($('tx-usd')?.value||0);
  const rate     = parseFloat($('tx-rate')?.value||0);
  if (!desc) return toast('Descripción requerida', 'warning');
  const isRecurring = !!$('tx-recurring')?.checked;
  const totalInst = isRecurring ? 1 : parseInt($('tx-total-inst').value||1);
  const currInst  = isRecurring ? 1 : parseInt($('tx-curr-inst').value||1);
  const converted = currency === 'USD' ? amtUSD * rate : 0;
  if (currency === 'USD' && rate === 0) toast('Sin cotización — el equivalente ARS quedará en $0,00. Podés editarlo después.', 'warning', 5000);
  const txnStatus = $('tx-status').value;
  try {
    await dbUpdate('card_transactions', id, {
      description: desc, currency,
      amount_ars: currency === 'ARS' ? amtARS : converted,
      amount_usd: currency === 'USD' ? amtUSD : 0,
      dollar_rate: currency === 'USD' ? rate : null,
      converted_ars: currency === 'USD' ? converted : 0,
      total_installments: totalInst, current_installment: currInst,
      remaining_installments: 0,
      is_recurring: isRecurring,
      status: txnStatus,
      transaction_date: $('tx-date').value || null,
      notes: $('tx-notes').value.trim() || null
    });
    // Actualizar estado mensual para el mes actualmente visualizado
    const monthlyStatus = txnStatus === 'finished' ? 'paid' : txnStatus;
    await upsertMonthlyStatus(id, APP.currentMonth, APP.currentYear, monthlyStatus);
    closeModal(); toast('Consumo actualizado ✓'); renderTarjetas();
  } catch {}
}

async function editTxn(id, cardId) {
  const txns = APP.cache.cardTxns[cardId] || [];
  const t = txns.find(r => r.id === id);
  if (t) openTxnForm(cardId, t);
}

async function toggleTxnStatus(id, currentStatus, cardId) {
  const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
  try {
    await upsertMonthlyStatus(id, APP.currentMonth, APP.currentYear, newStatus);
    toast(newStatus === 'paid' ? 'Marcado como pagado ✓' : 'Marcado como pendiente', 'info');
    renderTarjetas();
  } catch {}
}

async function deleteTxn(id, desc, cardId) {
  confirmAction(`¿Eliminar consumo "${desc}"?`, async () => {
    await dbDelete('card_transactions', id);
    toast('Consumo eliminado', 'info'); renderTarjetas();
  });
}

function openCardForm(data = null) {
  const isEdit = !!data;
  const colors = ['#1a56db','#7c3aed','#dc2626','#059669','#d97706','#0891b2','#be123c'];
  openModal(`
    <h2 class="modal-title">${isEdit?'Editar tarjeta':'Nueva tarjeta'}</h2>
    <div class="form-grid">
      <div class="field-row">
        <div class="field-group">
          <label class="field-label">Nombre de tarjeta *</label>
          <input id="cd-name" class="field-input" placeholder="Ej: Visa crédito" value="${data?.name||''}">
        </div>
        <div class="field-group">
          <label class="field-label">Titular *</label>
          <input id="cd-holder" class="field-input" placeholder="Juli o Mari" value="${data?.holder||''}">
        </div>
      </div>
      <div class="field-row">
        <div class="field-group">
          <label class="field-label">Banco</label>
          <input id="cd-bank" class="field-input" placeholder="Galicia, BBVA..." value="${data?.bank||''}">
        </div>
        <div class="field-group">
          <label class="field-label">Últimos 4 dígitos</label>
          <input id="cd-last4" class="field-input" maxlength="4" placeholder="0000" value="${data?.last_four||''}">
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">Color</label>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
          ${colors.map(c=>`<div onclick="selectCardColor('${c}')" style="width:28px;height:28px;border-radius:50%;background:${c};cursor:pointer;border:3px solid ${(data?.color||'#1a56db')===c?'#fff':'transparent'}" data-color="${c}"></div>`).join('')}
        </div>
        <input type="hidden" id="cd-color" value="${data?.color||'#1a56db'}">
      </div>
      <div class="field-group">
        <label style="display:flex;align-items:center;gap:.6rem;cursor:pointer;padding:.5rem .75rem;background:var(--bg-3);border-radius:var(--radius-md);border:1px solid var(--border)">
          <input type="checkbox" id="cd-auto-dates" ${data?.auto_dates_enabled?'checked':''} onchange="toggleCardDateMode()" style="accent-color:#818cf8;width:1rem;height:1rem;cursor:pointer;flex-shrink:0">
          <span style="font-size:.85rem;font-weight:500;color:var(--text-1)">📅 Calcular fechas automáticamente por regla</span>
        </label>
      </div>
      <div id="cd-auto-fields" class="${data?.auto_dates_enabled?'':'hidden'}">
        <div class="field-row">
          <div class="field-group">
            <label class="field-label">Día de cierre del mes</label>
            <input id="cd-closing-day" type="number" class="field-input" min="1" max="31" placeholder="Ej: 21" value="${data?.closing_day||''}" oninput="previewCardDates()">
          </div>
          <div class="field-group">
            <label class="field-label">Día de vencimiento</label>
            <input id="cd-due-day" type="number" class="field-input" min="1" max="31" placeholder="Ej: 1" value="${data?.due_day||''}" oninput="previewCardDates()">
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">Mes del vencimiento</label>
          <select id="cd-due-offset" class="field-select" onchange="previewCardDates()">
            <option value="0" ${(+(data?.due_month_offset??0))===0?'selected':''}>Mismo mes del cierre</option>
            <option value="1" ${(+(data?.due_month_offset??0))===1?'selected':''}>Mes siguiente al cierre</option>
          </select>
        </div>
        <div id="cd-dates-preview" style="font-size:.82rem;color:var(--text-2);padding:.5rem .75rem;background:var(--bg-3);border-radius:var(--radius-md);line-height:1.6">
          Completá los días para ver la vista previa
        </div>
      </div>
      <div id="cd-manual-fields" class="${data?.auto_dates_enabled?'hidden':''}">
        <div class="field-row">
          <div class="field-group">
            <label class="field-label">Fecha de cierre del resumen</label>
            <input id="cd-closing" type="date" class="field-input" value="${data?.closing_date||''}">
          </div>
          <div class="field-group">
            <label class="field-label">Fecha de vencimiento del pago</label>
            <input id="cd-due" type="date" class="field-input" value="${data?.due_date||''}">
          </div>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn--ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn--primary" onclick="${isEdit?`updateCard('${data.id}')`:'saveCard()'}">
          ${isEdit?'Guardar':'Agregar tarjeta'}
        </button>
      </div>
    </div>`);
}

function selectCardColor(color) {
  $('cd-color').value = color;
  document.querySelectorAll('[data-color]').forEach(el => {
    el.style.border = `3px solid ${el.dataset.color === color ? '#fff' : 'transparent'}`;
  });
}

async function saveCard() {
  const name = $('cd-name').value.trim();
  const holder = $('cd-holder').value.trim();
  if (!name || !holder) return toast('Nombre y titular son obligatorios', 'warning');
  const isAuto = !!$('cd-auto-dates')?.checked;
  try {
    await dbInsert('credit_cards', {
      name, holder, bank: $('cd-bank').value.trim()||null,
      last_four: $('cd-last4').value.trim()||null, color: $('cd-color').value,
      auto_dates_enabled: isAuto,
      closing_day:       isAuto ? (parseInt($('cd-closing-day')?.value)||null) : null,
      due_day:           isAuto ? (parseInt($('cd-due-day')?.value)||null) : null,
      due_month_offset:  isAuto ? (parseInt($('cd-due-offset')?.value)??0) : 0,
      closing_date:      isAuto ? null : ($('cd-closing')?.value || null),
      due_date:          isAuto ? null : ($('cd-due')?.value || null)
    });
    closeModal(); toast('Tarjeta creada ✓'); renderTarjetas();
  } catch {}
}

async function updateCard(id) {
  const name = $('cd-name').value.trim();
  const holder = $('cd-holder').value.trim();
  if (!name || !holder) return toast('Nombre y titular son obligatorios', 'warning');
  const isAuto = !!$('cd-auto-dates')?.checked;
  try {
    await dbUpdate('credit_cards', id, {
      name, holder, bank: $('cd-bank').value.trim()||null,
      last_four: $('cd-last4').value.trim()||null, color: $('cd-color').value,
      auto_dates_enabled: isAuto,
      closing_day:       isAuto ? (parseInt($('cd-closing-day')?.value)||null) : null,
      due_day:           isAuto ? (parseInt($('cd-due-day')?.value)||null) : null,
      due_month_offset:  isAuto ? (parseInt($('cd-due-offset')?.value)??0) : 0,
      closing_date:      isAuto ? null : ($('cd-closing')?.value || null),
      due_date:          isAuto ? null : ($('cd-due')?.value || null)
    });
    closeModal(); toast('Tarjeta actualizada ✓'); renderTarjetas();
  } catch {}
}

function toggleCardDateMode() {
  const isAuto = !!document.getElementById('cd-auto-dates')?.checked;
  document.getElementById('cd-auto-fields')?.classList.toggle('hidden', !isAuto);
  document.getElementById('cd-manual-fields')?.classList.toggle('hidden', isAuto);
  if (isAuto) previewCardDates();
}

function previewCardDates() {
  const closingDay = parseInt(document.getElementById('cd-closing-day')?.value);
  const dueDay     = parseInt(document.getElementById('cd-due-day')?.value);
  const offset     = parseInt(document.getElementById('cd-due-offset')?.value ?? 0);
  const preview    = document.getElementById('cd-dates-preview');
  if (!preview) return;
  if (!closingDay || !dueDay || closingDay < 1 || dueDay < 1) {
    preview.textContent = 'Completá los días para ver la vista previa';
    return;
  }
  const fake = { closing_day: closingDay, due_day: dueDay, due_month_offset: offset };
  const dates = calculateCardDates(fake, APP.currentMonth, APP.currentYear);
  const label = new Date(APP.currentYear, APP.currentMonth - 1).toLocaleString('es-AR', { month: 'long', year: 'numeric' });
  preview.innerHTML = `<strong>Vista previa — ${label}:</strong><br>Cierre: ${fmtDate(dates.closingDate) || '—'} &nbsp;·&nbsp; Vto: ${fmtDate(dates.dueDate) || '—'}`;
}

function recalcCardDates(cardId) {
  const card = (APP.cache.cards || []).find(c => c.id === cardId);
  if (!card) return;
  const rule = detectCardRule(card) ||
    (card.closing_day != null && card.due_day != null
      ? { closingDay: card.closing_day, dueDay: card.due_day, dueMonthOffset: +(card.due_month_offset ?? 0) }
      : null);
  if (!rule) return toast('No se encontró una regla para esta tarjeta. Configurá el día de cierre/vencimiento en ⚙ Configurar tarjeta.', 'warning', 5000);

  const { closingDay, dueDay, dueMonthOffset } = rule;
  const fake  = { closing_day: closingDay, due_day: dueDay, due_month_offset: dueMonthOffset };
  const dates = calculateCardDates(fake, APP.currentMonth, APP.currentYear);
  const label = new Date(APP.currentYear, APP.currentMonth - 1).toLocaleString('es-AR', { month: 'long', year: 'numeric' });

  openModal(`
    <h2 class="modal-title">Recalcular fechas — ${card.name}</h2>
    <p style="font-size:.85rem;color:var(--text-2);margin-bottom:1rem">Regla detectada para <strong>${label}</strong>:</p>
    <div style="background:var(--bg-3);border-radius:var(--radius-md);padding:.75rem 1rem;margin-bottom:1.25rem;font-size:.85rem;line-height:1.8">
      Cierre: día <strong>${closingDay}</strong> del mes<br>
      Vencimiento: día <strong>${dueDay}</strong> del ${dueMonthOffset===1?'mes siguiente':'mismo mes'}<br>
      <span style="color:var(--text-3);font-size:.75rem">(sábados y domingos se mueven al lunes siguiente)</span><br><br>
      📅 <strong>Cierre: ${fmtDate(dates.closingDate) || '—'}</strong><br>
      📅 <strong>Vencimiento: ${fmtDate(dates.dueDate) || '—'}</strong>
    </div>
    <p style="font-size:.8rem;color:var(--text-3);margin-bottom:1.25rem">Al aceptar, la tarjeta usará esta regla para todos los meses.</p>
    <div class="form-actions">
      <button class="btn btn--ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn--primary" onclick="applyCardAutoRule('${cardId}',${closingDay},${dueDay},${dueMonthOffset})">Aplicar regla</button>
    </div>`);
}

async function applyCardAutoRule(cardId, closingDay, dueDay, dueMonthOffset) {
  try {
    await dbUpdate('credit_cards', cardId, {
      auto_dates_enabled: true,
      closing_day:        +closingDay,
      due_day:            +dueDay,
      due_month_offset:   +dueMonthOffset,
      closing_date:       null,
      due_date:           null
    });
    closeModal();
    toast('Fechas automáticas configuradas ✓');
    renderTarjetas();
  } catch {}
}

async function editCard(id) {
  const card = APP.cache.cards.find(c => c.id === id);
  if (card) openCardForm(card);
}

async function deleteCard(id, name) {
  confirmAction(`¿Eliminar la tarjeta "${name}"? Se eliminarán también todos sus consumos.`, async () => {
    await dbDelete('credit_cards', id);
    toast('Tarjeta eliminada', 'info'); renderTarjetas();
  });
}

async function precargarTarjetas() {
  confirmAction('¿Precargar las 4 tarjetas predeterminadas?', async () => {
    for (const c of DEFAULT_CARDS) {
      try { await dbInsert('credit_cards', c); } catch {}
    }
    toast('Tarjetas precargadas ✓'); renderTarjetas();
  });
}

/* ============================================================
   23. CUOTAS INDEPENDIENTES
   ============================================================ */
async function renderCuotas() {
  const sec = $('section-cuotas');
  const rows = await dbSelect('independent_installments');
  APP.cache.installments = rows;

  const active   = rows.filter(r => r.status === 'active');
  const finished = rows.filter(r => r.status === 'finished');
  const totalMensual = active.reduce((s,r) => s + (+r.installment_amount||0), 0);

  sec.innerHTML = `
    <div class="section-top">
      <div>
        <h2 class="section-title">Cuotas Independientes</h2>
        <p class="section-subtitle">Total mensual: <strong class="mono">${fmtARS(totalMensual)}</strong> · ${active.length} activas</p>
      </div>
      <button class="btn btn--primary" onclick="openInstallmentForm()">+ Agregar cuota</button>
    </div>

    ${active.length === 0 && finished.length === 0 ? `
      <div class="empty-state"><div class="empty-state-icon">📅</div>
      <h3>Sin cuotas registradas</h3>
      <p>Agregá cuotas de compras en cuotas que no sean de tarjeta</p></div>` : ''}

    ${active.length > 0 ? `
    <h3 style="font-size:.85rem;font-weight:600;color:var(--text-2);margin-bottom:.75rem;text-transform:uppercase;letter-spacing:.05em">Activas</h3>
    <div style="display:flex;flex-direction:column;gap:.75rem;margin-bottom:1.25rem">
      ${active.map(r => installmentCard(r)).join('')}
    </div>` : ''}

    ${finished.length > 0 ? `
    <h3 style="font-size:.85rem;font-weight:600;color:var(--text-2);margin-bottom:.75rem;text-transform:uppercase;letter-spacing:.05em">Finalizadas</h3>
    <div style="display:flex;flex-direction:column;gap:.75rem">
      ${finished.map(r => installmentCard(r)).join('')}
    </div>` : ''}`;
}

function installmentCard(r) {
  const pct = r.total_installments > 0 ? (r.paid_installments / r.total_installments * 100) : 0;
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.5rem">
        <div>
          <div style="font-weight:600">${r.description}</div>
          <div style="font-size:.8rem;color:var(--text-2)">${r.person||'Ambos'} · ${r.start_date?fmtDate(r.start_date):''}</div>
        </div>
        <div style="text-align:right">
          <div class="mono" style="font-size:1.1rem;font-weight:700">${fmtARS(r.installment_amount)} <span style="font-size:.75rem;color:var(--text-2)">/mes</span></div>
          <div style="font-size:.75rem;color:var(--text-2)">Total: ${fmtARS(r.total_amount)}</div>
        </div>
      </div>
      <div style="margin:.75rem 0 .4rem">
        <div class="progress-bar">
          <div class="progress-fill ${pct===100?'progress-fill--success':''}" style="width:${pct}%"></div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:.75rem;color:var(--text-2)">${r.paid_installments}/${r.total_installments} cuotas pagadas · ${r.remaining_installments} restantes</div>
        <div style="display:flex;gap:.375rem">
          <span class="badge ${r.status==='active'?'badge--success':r.status==='paused'?'badge--warning':'badge--neutral'}">${r.status}</span>
          ${r.status==='active'?`<button class="btn btn--ghost btn--sm" onclick="payInstallment('${r.id}')">+ Pagar cuota</button>`:''}
          <button class="icon-btn" onclick="editInstallment('${r.id}')">✏️</button>
          <button class="icon-btn" onclick="deleteInstallment('${r.id}','${r.description.replace(/'/g,"\\'")}')">🗑️</button>
        </div>
      </div>
      ${r.notes?`<div style="font-size:.75rem;color:var(--text-3);margin-top:.4rem">${r.notes}</div>`:''}
    </div>`;
}

function openInstallmentForm(data = null) {
  const isEdit = !!data;
  openModal(`
    <h2 class="modal-title">${isEdit?'Editar cuota':'Nueva cuota independiente'}</h2>
    <div class="form-grid">
      <div class="field-group">
        <label class="field-label">Descripción *</label>
        <input id="inst-desc" class="field-input" placeholder="Ej: Heladera en cuotas" value="${data?.description||''}">
      </div>
      <div class="field-row">
        <div class="field-group">
          <label class="field-label">Monto total *</label>
          <input id="inst-total" type="number" class="field-input" min="0" step="0.01" value="${data?.total_amount||''}" placeholder="0">
        </div>
        <div class="field-group">
          <label class="field-label">Valor de cuota *</label>
          <input id="inst-cuota" type="number" class="field-input" min="0" step="0.01" value="${data?.installment_amount||''}" placeholder="0">
        </div>
      </div>
      <div class="field-row">
        <div class="field-group">
          <label class="field-label">Total cuotas</label>
          <input id="inst-total-i" type="number" class="field-input" min="1" value="${data?.total_installments||12}">
        </div>
        <div class="field-group">
          <label class="field-label">Cuotas pagadas</label>
          <input id="inst-paid" type="number" class="field-input" min="0" value="${data?.paid_installments||0}">
        </div>
      </div>
      <div class="field-row">
        <div class="field-group">
          <label class="field-label">Persona</label>
          <select id="inst-person" class="field-select">
            ${['Juli','Mari','Ambos','Otro'].map(p=>`<option ${(data?.person||'Ambos')===p?'selected':''}>${p}</option>`).join('')}
          </select>
        </div>
        <div class="field-group">
          <label class="field-label">Estado</label>
          <select id="inst-status" class="field-select">
            <option value="active" ${(data?.status||'active')==='active'?'selected':''}>Activa</option>
            <option value="paused" ${data?.status==='paused'?'selected':''}>Pausada</option>
            <option value="finished" ${data?.status==='finished'?'selected':''}>Finalizada</option>
          </select>
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">Fecha de inicio</label>
        <input id="inst-start" type="date" class="field-input" value="${data?.start_date||today()}">
      </div>
      <div class="field-group">
        <label class="field-label">Notas</label>
        <textarea id="inst-notes" class="field-textarea" placeholder="Observaciones...">${data?.notes||''}</textarea>
      </div>
      <div class="form-actions">
        <button class="btn btn--ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn--primary" onclick="${isEdit?`updateInstallment('${data.id}')`:'saveInstallment()'}">
          ${isEdit?'Guardar':'Agregar cuota'}
        </button>
      </div>
    </div>`);
}

async function saveInstallment() {
  const desc  = $('inst-desc').value.trim();
  const total = parseFloat($('inst-total').value);
  const cuota = parseFloat($('inst-cuota').value);
  if (!desc) return toast('Descripción requerida', 'warning');
  if (isNaN(total)||total<0||isNaN(cuota)||cuota<0) return toast('Montos inválidos', 'warning');
  const totalInst = parseInt($('inst-total-i').value||12);
  const paidInst  = parseInt($('inst-paid').value||0);
  try {
    await dbInsert('independent_installments', {
      description: desc, total_amount: total, installment_amount: cuota,
      total_installments: totalInst, paid_installments: paidInst,
      remaining_installments: Math.max(0, totalInst - paidInst),
      person: $('inst-person').value, status: $('inst-status').value,
      start_date: $('inst-start').value || null,
      notes: $('inst-notes').value.trim() || null
    });
    closeModal(); toast('Cuota agregada ✓'); renderCuotas();
  } catch {}
}

async function updateInstallment(id) {
  const desc  = $('inst-desc').value.trim();
  const total = parseFloat($('inst-total').value);
  const cuota = parseFloat($('inst-cuota').value);
  if (!desc) return toast('Descripción requerida', 'warning');
  const totalInst = parseInt($('inst-total-i').value||12);
  const paidInst  = parseInt($('inst-paid').value||0);
  try {
    await dbUpdate('independent_installments', id, {
      description: desc, total_amount: total, installment_amount: cuota,
      total_installments: totalInst, paid_installments: paidInst,
      remaining_installments: Math.max(0, totalInst - paidInst),
      person: $('inst-person').value, status: $('inst-status').value,
      start_date: $('inst-start').value || null,
      notes: $('inst-notes').value.trim() || null
    });
    closeModal(); toast('Cuota actualizada ✓'); renderCuotas();
  } catch {}
}

async function payInstallment(id) {
  const inst = APP.cache.installments.find(r => r.id === id);
  if (!inst) return;
  const paid = (inst.paid_installments || 0) + 1;
  const remaining = Math.max(0, inst.total_installments - paid);
  const status = remaining === 0 ? 'finished' : 'active';
  try {
    await dbUpdate('independent_installments', id, {
      paid_installments: paid, remaining_installments: remaining, status
    });
    toast(status === 'finished' ? '¡Cuota finalizada! 🎉' : 'Cuota registrada ✓');
    renderCuotas();
  } catch {}
}

async function editInstallment(id) {
  const row = APP.cache.installments.find(r => r.id === id);
  if (row) openInstallmentForm(row);
}

async function deleteInstallment(id, desc) {
  confirmAction(`¿Eliminar cuota "${desc}"?`, async () => {
    await dbDelete('independent_installments', id);
    toast('Cuota eliminada', 'info'); renderCuotas();
  });
}

/* ============================================================
   24. AHORRO Y PROYECCIÓN
   ============================================================ */
async function renderAhorro() {
  const sec = $('section-ahorro');

  const [incomes, fixed, variable, cards, allTxns, installments, goalData] = await Promise.all([
    dbSelect('incomes',    { month: APP.currentMonth, year: APP.currentYear }),
    dbSelect('fixed_expenses', { month: APP.currentMonth, year: APP.currentYear }),
    dbSelect('variable_expenses', { month: APP.currentMonth, year: APP.currentYear }),
    dbSelect('credit_cards'),
    loadCardTxnsForMonth(APP.currentMonth, APP.currentYear),
    dbSelect('independent_installments', { status: 'active' }),
    dbSelect('saving_goals', { month: APP.currentMonth, year: APP.currentYear })
  ]);

  const goal = goalData[0] || null;
  APP.cache.savingGoal = goal;

  const totalIncome   = incomes.reduce((s,r) => s + (+r.amount||0), 0);
  const totalFixed    = fixed.reduce((s,r) => s + (+r.amount||0), 0);
  const totalVariable = variable.reduce((s,r) => s + (+r.amount||0), 0);
  const totalCards    = allTxns.reduce((s,t) => s + txnARS(t), 0);
  const totalInstall  = installments.reduce((s,r) => s + (+r.installment_amount||0), 0);
  const saldo         = totalIncome - totalFixed - totalVariable - totalCards - totalInstall;
  const pctAhorro     = totalIncome > 0 ? (saldo / totalIncome * 100) : 0;

  const metaMensual    = goal?.monthly_goal || 0;
  const pctMeta        = metaMensual > 0 ? Math.min(100, saldo / metaMensual * 100) : 0;
  const difMeta        = saldo - metaMensual;
  const dollarRate     = APP.dollarRate?.sell_rate || 0;

  // Escenarios
  const esc10   = totalIncome - totalFixed - (totalVariable * 0.9) - totalCards - totalInstall;
  const esc20   = totalIncome - totalFixed - (totalVariable * 0.8) - totalCards - totalInstall;
  const esc30   = totalIncome - totalFixed - (totalVariable * 0.7) - totalCards - totalInstall;
  const escSolo = totalIncome - totalFixed - totalInstall;

  sec.innerHTML = `
    <div class="section-top">
      <div>
        <h2 class="section-title">Ahorro y Proyección</h2>
        <p class="section-subtitle">${monthName(APP.currentMonth)} ${APP.currentYear}</p>
      </div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        ${metaMensual > 0 ? `<button class="btn btn--danger btn--sm" onclick="deleteGoal()">🗑 Borrar meta</button>` : ''}
        <button class="btn btn--outline" onclick="openGoalForm()">⚙ Configurar meta</button>
      </div>
    </div>

    <!-- SALDO DISPONIBLE -->
    <div class="dashboard-big-card" style="margin-bottom:1.25rem">
      <div class="dashboard-big-label">Saldo disponible (ahorro posible)</div>
      <div class="dashboard-big-amount ${saldo>=0?'positive':'negative'}">${fmtARS(saldo)}</div>
      <div class="dashboard-big-sub">${fmtPct(pctAhorro)} de los ingresos · Ingresos: ${fmtARS(totalIncome)}</div>
      ${dollarRate > 0 ? `<div class="dashboard-big-sub">≈ ${saldo > 0 ? (saldo/dollarRate).toFixed(1) : '0'} USD al dólar de ${fmtARS(dollarRate)}</div>` : ''}
    </div>

    <!-- META DE AHORRO -->
    ${metaMensual > 0 ? `
    <div class="card" style="margin-bottom:1.25rem">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div class="card-label">Meta de ahorro mensual</div>
          <div class="mono" style="font-size:1.4rem;font-weight:700">${fmtARS(metaMensual)}</div>
          ${goal?.goal_description?`<div style="font-size:.8rem;color:var(--text-2);margin-top:.25rem">🎯 ${goal.goal_description}</div>`:''}
        </div>
        <div style="text-align:right">
          <div class="mono" style="font-size:1.1rem;font-weight:700;color:${difMeta>=0?'var(--success)':'var(--danger)'}">${difMeta>=0?'+':''}${fmtARS(difMeta)}</div>
          <div style="font-size:.75rem;color:var(--text-2)">${difMeta>=0?'sobre la meta':'por debajo de la meta'}</div>
        </div>
      </div>
      <div style="margin-top:.875rem">
        <div class="progress-bar" style="height:10px">
          <div class="progress-fill ${pctMeta>=100?'progress-fill--success':pctMeta>60?'progress-fill--warning':'progress-fill--danger'}" style="width:${Math.min(100,pctMeta)}%"></div>
        </div>
        <div style="font-size:.75rem;color:var(--text-2);margin-top:.375rem">${pctMeta.toFixed(0)}% de la meta alcanzada</div>
      </div>
    </div>` : `
    <div class="card" style="margin-bottom:1.25rem;border-style:dashed">
      <div style="text-align:center;color:var(--text-3);padding:.5rem">
        <div style="font-size:1.5rem;margin-bottom:.375rem">🎯</div>
        <p style="font-size:.875rem">No tenés una meta de ahorro configurada para este mes.</p>
        <button class="btn btn--outline btn--sm" style="margin-top:.625rem" onclick="openGoalForm()">Configurar meta</button>
      </div>
    </div>`}

    <!-- RECOMENDACIÓN -->
    <div class="card" style="margin-bottom:1.25rem;${saldo<0?'border-color:var(--danger)':saldo<metaMensual&&metaMensual>0?'border-color:var(--warning)':'border-color:var(--success)'}">
      <div class="card-label">💡 Recomendación</div>
      <p style="font-size:.9rem;margin-top:.375rem;line-height:1.6">
        ${saldo < 0
          ? `⚠️ Tus gastos superan tus ingresos en <strong>${fmtARS(Math.abs(saldo))}</strong>. Revisá tus gastos variables y tarjetas para reducir el déficit.`
          : saldo < metaMensual && metaMensual > 0
          ? `📉 Estás por debajo de tu meta de ahorro. Reduciendo gastos variables un 20% podrías ahorrar <strong>${fmtARS(esc20)}</strong>.`
          : pctAhorro > 30
          ? `🌟 Excelente! Estás ahorrando el ${pctAhorro.toFixed(0)}% de tus ingresos. Considerá invertir el excedente.`
          : `✅ Vas bien. Tu saldo positivo de <strong>${fmtARS(saldo)}</strong> te permite ahorrar este mes.`}
      </p>
    </div>

    <!-- ESCENARIOS -->
    <h3 style="font-size:.85rem;font-weight:600;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.75rem">Escenarios de ahorro</h3>
    <div class="scenario-grid" style="margin-bottom:1.5rem">
      <div class="scenario-card">
        <div class="scenario-name">Si reducís variables un 10%</div>
        <div class="scenario-value">${fmtARS(esc10)}</div>
        <div style="font-size:.7rem;color:var(--text-3)">Ahorrás ${fmtARS(esc10-saldo)} extra</div>
      </div>
      <div class="scenario-card">
        <div class="scenario-name">Si reducís variables un 20%</div>
        <div class="scenario-value">${fmtARS(esc20)}</div>
        <div style="font-size:.7rem;color:var(--text-3)">Ahorrás ${fmtARS(esc20-saldo)} extra</div>
      </div>
      <div class="scenario-card">
        <div class="scenario-name">Si reducís variables un 30%</div>
        <div class="scenario-value">${fmtARS(esc30)}</div>
        <div style="font-size:.7rem;color:var(--text-3)">Ahorrás ${fmtARS(esc30-saldo)} extra</div>
      </div>
      <div class="scenario-card">
        <div class="scenario-name">Solo gastos fijos obligatorios</div>
        <div class="scenario-value">${fmtARS(escSolo)}</div>
        <div style="font-size:.7rem;color:var(--text-3)">Sin variables ni tarjetas</div>
      </div>
      ${dollarRate > 0 ? `
      <div class="scenario-card">
        <div class="scenario-name">USD con ahorro actual</div>
        <div class="scenario-value" style="font-size:1.1rem">${saldo > 0 ? (saldo/dollarRate).toFixed(2) : '0'} USD</div>
        <div style="font-size:.7rem;color:var(--text-3)">Al dólar de ${fmtARS(dollarRate)}</div>
      </div>` : ''}
    </div>

    <!-- RESUMEN NUMÉRICO -->
    <div class="chart-container">
      <div class="chart-title">Resumen del mes</div>
      <table class="table" style="background:transparent">
        <tbody>
          <tr><td>Ingresos totales</td><td class="mono" style="text-align:right;color:var(--success)">${fmtARS(totalIncome)}</td></tr>
          <tr><td>Gastos fijos</td><td class="mono" style="text-align:right;color:var(--danger)">- ${fmtARS(totalFixed)}</td></tr>
          <tr><td>Gastos variables</td><td class="mono" style="text-align:right;color:var(--danger)">- ${fmtARS(totalVariable)}</td></tr>
          <tr><td>Tarjetas</td><td class="mono" style="text-align:right;color:var(--danger)">- ${fmtARS(totalCards)}</td></tr>
          <tr><td>Cuotas independientes</td><td class="mono" style="text-align:right;color:var(--danger)">- ${fmtARS(totalInstall)}</td></tr>
          <tr style="font-weight:700;font-size:1.05rem"><td>Saldo disponible</td>
            <td class="mono" style="text-align:right;color:${saldo>=0?'var(--success)':'var(--danger)'}">= ${fmtARS(saldo)}</td></tr>
        </tbody>
      </table>
    </div>`;
}

function openGoalForm() {
  const g = APP.cache.savingGoal;
  openModal(`
    <h2 class="modal-title">Meta de ahorro</h2>
    <div class="form-grid">
      <div class="field-row">
        <div class="field-group">
          <label class="field-label">Meta mensual (ARS)</label>
          <input id="goal-amount" type="number" class="field-input" min="0" placeholder="0" value="${g?.monthly_goal||''}">
        </div>
        <div class="field-group">
          <label class="field-label">% ideal de ahorro</label>
          <input id="goal-pct" type="number" class="field-input" min="0" max="100" placeholder="20" value="${g?.ideal_percentage||20}">
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">Descripción del objetivo</label>
        <input id="goal-desc" class="field-input" placeholder="Ej: Vacaciones, fondo de emergencia..." value="${g?.goal_description||''}">
      </div>
      <div class="field-group">
        <label class="field-label">Tipo de objetivo</label>
        <select id="goal-type" class="field-select">
          ${['general','vacaciones','inversión','emergencia','compra importante','viaje','educación'].map(t=>`<option ${(g?.goal_type||'general')===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-actions">
        <button class="btn btn--ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn--primary" onclick="saveGoal()">Guardar meta</button>
      </div>
    </div>`);
}

async function saveGoal() {
  const amount = parseFloat($('goal-amount').value||0);
  const pct    = parseFloat($('goal-pct').value||20);
  const payload = {
    monthly_goal: amount, ideal_percentage: pct,
    goal_description: $('goal-desc').value.trim() || null,
    goal_type: $('goal-type').value,
    month: APP.currentMonth, year: APP.currentYear
  };
  try {
    if (APP.cache.savingGoal?.id) {
      await dbUpdate('saving_goals', APP.cache.savingGoal.id, payload);
    } else {
      await dbInsert('saving_goals', payload);
    }
    closeModal(); toast('Meta guardada ✓'); renderAhorro();
  } catch {}
}

async function deleteGoal() {
  confirmAction('¿Seguro que querés borrar la meta de ahorro mensual?', async () => {
    try {
      if (APP.cache.savingGoal?.id) {
        await dbDelete('saving_goals', APP.cache.savingGoal.id);
      }
      APP.cache.savingGoal = null;
      toast('Meta de ahorro borrada');
      renderAhorro();
    } catch {}
  });
}

/* ============================================================
   25. DÓLAR ARGENTINA
   ============================================================ */
async function renderDolar() {
  const sec = $('section-dolar');
  sec.innerHTML = `
    <div class="section-top">
      <h2 class="section-title">Dólar Argentina</h2>
      <button class="btn btn--outline" id="dolar-refresh-btn" onclick="fetchDollarRate(true)">🔄 Actualizar cotización</button>
    </div>
    <div id="dolar-content"><div style="display:flex;align-items:center;gap:.5rem;color:var(--text-3);padding:2rem"><span class="spinner"></span> Consultando cotización...</div></div>`;

  await fetchDollarRate(false);
}

async function fetchDollarRate(force = false) {
  // Usar caché de localStorage si es reciente (< 30 min) y no es forzado
  const cached = localStorage.getItem('finapp-dollar');
  if (!force && cached) {
    const { data, ts } = JSON.parse(cached);
    if (Date.now() - ts < 30 * 60 * 1000) {
      APP.dollarRate = data;
      renderDolarContent(data);
      return;
    }
  }

  let rateData = null;

  // Intento 1: API DolarAPI (CORS abierto, datos del BCRA)
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares', { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const arr = await res.json();
      const oficial = arr.find(d => d.casa === 'oficial') || arr[0];
      const blue    = arr.find(d => d.casa === 'blue');
      rateData = {
        buy_rate:   oficial?.compra || 0,
        sell_rate:  oficial?.venta  || 0,
        blue_buy:   blue?.compra || null,
        blue_sell:  blue?.venta  || null,
        source:     'DolarAPI (BCRA)',
        rate_date:  oficial?.fechaActualizacion || new Date().toISOString()
      };
    }
  } catch(e) { console.warn('DolarAPI falló:', e.message); }

  // Intento 2: API Argentina Datos
  if (!rateData) {
    try {
      const res = await fetch('https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial', { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const d = await res.json();
        const last = Array.isArray(d) ? d[d.length-1] : d;
        rateData = {
          buy_rate:  last?.compra || 0,
          sell_rate: last?.venta  || 0,
          source:    'ArgentinaDatos',
          rate_date: last?.fecha || new Date().toISOString()
        };
      }
    } catch(e) { console.warn('ArgentinaDatos falló:', e.message); }
  }

  if (!rateData) {
    // Mostrar última cotización guardada en Supabase o LocalStorage
    const lsData = localStorage.getItem('finapp-dollar');
    if (lsData) {
      const { data } = JSON.parse(lsData);
      APP.dollarRate = data;
      renderDolarContent(data, true);
      return;
    }
    renderDolarError();
    return;
  }

  APP.dollarRate = rateData;
  localStorage.setItem('finapp-dollar', JSON.stringify({ data: rateData, ts: Date.now() }));

  // Guardar en Supabase (no bloqueante)
  if (APP.householdId) {
    dbInsert('dollar_rates', rateData).catch(() => {});
  }

  renderDolarContent(rateData);
}

function renderDolarContent(data, fromCache = false) {
  const dolarContent = $('dolar-content');
  if (!dolarContent) return;

  const impuestoPct      = getImpuestoPct();
  const sellRate         = data.sell_rate || 0;
  const dolarConImpuesto = sellRate * (1 + impuestoPct / 100);

  dolarContent.innerHTML = `
    ${fromCache ? `<div class="alert-item alert-item--warning" style="margin-bottom:.875rem">⚠️ Mostrando última cotización guardada (sin conexión a la API)</div>` : ''}

    <div class="dollar-main-card">
      <div class="dollar-flag">🇦🇷 🇺🇸</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;align-items:start">
        <div>
          <div style="font-size:.75rem;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.25rem">Compra</div>
          <div class="dollar-rate-big" style="font-size:1.6rem">${fmtARS(data.buy_rate)}</div>
        </div>
        <div>
          <div style="font-size:.75rem;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.25rem">Venta oficial</div>
          <div class="dollar-rate-big" style="font-size:1.6rem">${fmtARS(sellRate)}</div>
        </div>
        <div>
          <div style="font-size:.75rem;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.25rem">Con impuesto</div>
          <div class="dollar-rate-big" style="font-size:1.6rem;color:#fbbf24">${fmtARS(dolarConImpuesto)}</div>
          <div style="display:flex;align-items:center;gap:.3rem;margin-top:.375rem">
            <input type="number" id="impuesto-pct" value="${impuestoPct}" min="0" max="500" step="1"
              style="width:52px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.25);border-radius:4px;color:#fff;font-size:.78rem;padding:.2rem .35rem;text-align:center"
              oninput="updateImpuesto()">
            <span style="font-size:.72rem;color:rgba(255,255,255,.5)">% impuesto</span>
          </div>
        </div>
      </div>
      <div class="dollar-updated">📅 ${new Date(data.rate_date||Date.now()).toLocaleString('es-AR')} · Fuente: ${data.source}</div>
    </div>

    <div class="dollar-grid" style="margin-bottom:1.25rem">
      ${data.blue_sell ? `
      <div class="chart-container">
        <div class="chart-title">Dólar Blue</div>
        <div style="display:flex;gap:1rem;margin-top:.5rem">
          <div><div style="font-size:.7rem;color:var(--text-2)">Compra</div><div class="mono" style="font-size:1.2rem;font-weight:700">${fmtARS(data.blue_buy)}</div></div>
          <div><div style="font-size:.7rem;color:var(--text-2)">Venta</div><div class="mono" style="font-size:1.2rem;font-weight:700;color:var(--warning)">${fmtARS(data.blue_sell)}</div></div>
        </div>
      </div>` : '<div></div>'}
      <div class="chart-container">
        <div class="chart-title">Brecha Oficial vs Blue</div>
        ${data.blue_sell && sellRate > 0 ? `
          <div class="mono" style="font-size:1.4rem;font-weight:700;color:var(--warning)">${((data.blue_sell/sellRate-1)*100).toFixed(1)}%</div>
          <div style="font-size:.75rem;color:var(--text-2)">de diferencia entre tipos de cambio</div>` : '<div style="color:var(--text-3);font-size:.85rem">Sin datos del blue disponibles</div>'}
      </div>
    </div>

    <!-- CALCULADORA -->
    <div class="chart-container" style="margin-bottom:1.25rem">
      <div class="chart-title">Calculadora de cambio</div>
      <div style="margin-top:.875rem;margin-bottom:.625rem">
        <label class="field-label">Tipo de cambio</label>
        <select id="calc-rate-type" class="field-select" style="margin-top:.3rem" onchange="calcDolar('ars')">
          <option value="oficial">Oficial venta (${fmtARS(sellRate)})</option>
          <option value="impuesto">Con impuesto ${impuestoPct}% (${fmtARS(dolarConImpuesto)})</option>
        </select>
      </div>
      <div class="field-row">
        <div class="field-group">
          <label class="field-label">Pesos (ARS)</label>
          <input id="calc-ars" type="number" class="field-input" placeholder="0" oninput="calcDolar('ars')" value="">
        </div>
        <div class="field-group">
          <label class="field-label">Dólares (USD)</label>
          <input id="calc-usd" type="number" class="field-input" placeholder="0" oninput="calcDolar('usd')" value="">
        </div>
      </div>
      <p id="calc-result" style="font-size:.8rem;color:var(--text-2);margin-top:.5rem">Ingresá un monto para convertir</p>
    </div>

    <!-- SIMULACIÓN DE COMPRA -->
    <h3 style="font-size:.85rem;font-weight:600;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.75rem">Simulación de compra</h3>
    <div class="scenario-grid">
      ${buildDollarScenarios(data, dolarConImpuesto, impuestoPct)}
    </div>`;
}

function buildDollarScenarios(data, dolarConImpuesto, impuestoPct) {
  const sellRate = data.sell_rate || 0;
  if (sellRate === 0) return '<p style="color:var(--text-3)">Sin cotización disponible</p>';

  const incomes = APP.cache.incomes?.reduce((s,r)=>s+(+r.amount||0),0) || 0;
  const scenarios = [
    { label:'Con el total de ingresos', value: incomes },
  ];

  return scenarios.map(s => `
    <div class="scenario-card">
      <div class="scenario-name">${s.label}</div>
      <div class="scenario-value">${s.value > 0 ? (s.value/sellRate).toFixed(2) : '—'} USD</div>
      <div style="font-size:.7rem;color:var(--text-3)">Con dólar oficial (${fmtARS(sellRate)})</div>
      ${dolarConImpuesto > 0 && s.value > 0 ? `
      <div class="scenario-value" style="font-size:1rem;margin-top:.5rem;color:var(--warning)">${(s.value/dolarConImpuesto).toFixed(2)} USD</div>
      <div style="font-size:.7rem;color:var(--text-3)">Con dólar + ${impuestoPct}% (${fmtARS(dolarConImpuesto)})</div>` : ''}
    </div>`).join('');
}

function getImpuestoPct() {
  return parseFloat(localStorage.getItem('dolar_impuesto_pct') || '30');
}

function updateImpuesto() {
  const pct = parseFloat($('impuesto-pct')?.value || '30');
  if (!isNaN(pct)) {
    localStorage.setItem('dolar_impuesto_pct', pct);
    if (APP.dollarRate) renderDolarContent(APP.dollarRate);
  }
}

function calcDolar(from) {
  const rateType = $('calc-rate-type')?.value || 'oficial';
  const sellRate = APP.dollarRate?.sell_rate || 0;
  const pct      = getImpuestoPct();
  const rate     = rateType === 'impuesto' ? sellRate * (1 + pct / 100) : sellRate;
  const label    = rateType === 'impuesto' ? `dólar + ${pct}%` : 'tipo oficial';
  if (!rate) return;
  if (from === 'ars') {
    const ars = parseFloat($('calc-ars').value||0);
    $('calc-usd').value = ars > 0 ? (ars/rate).toFixed(2) : '';
    $('calc-result').textContent = ars > 0 ? `${fmtARS(ars)} = ${(ars/rate).toFixed(2)} USD (al ${label} ${fmtARS(rate)})` : 'Ingresá un monto';
  } else {
    const usd = parseFloat($('calc-usd').value||0);
    $('calc-ars').value = usd > 0 ? (usd*rate).toFixed(2) : '';
    $('calc-result').textContent = usd > 0 ? `${usd} USD = ${fmtARS(usd*rate)} (al ${label} ${fmtARS(rate)})` : 'Ingresá un monto';
  }
}

function renderDolarError() {
  const el = $('dolar-content');
  if (el) el.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">⚠️</div>
      <h3>No se pudo obtener la cotización</h3>
      <p>Verificá tu conexión a internet e intentá actualizar.</p>
      <button class="btn btn--primary" style="margin-top:1rem" onclick="fetchDollarRate(true)">Reintentar</button>
    </div>`;
}

/* ============================================================
   26. RESUMEN ANUAL
   ============================================================ */
async function renderAnual() {
  const sec = $('section-anual');
  const year = APP.currentYear;
  sec.innerHTML = `<div style="display:flex;align-items:center;gap:.5rem;color:var(--text-3);padding:2rem"><span class="spinner"></span> Cargando resumen anual...</div>`;

  const monthlyData = [];
  for (let m = 1; m <= 12; m++) {
    const [inc, fix, vari, txns, inst] = await Promise.all([
      dbSelect('incomes',    { month: m, year }),
      dbSelect('fixed_expenses', { month: m, year }),
      dbSelect('variable_expenses', { month: m, year }),
      loadCardTxnsForMonth(m, year),
      dbSelect('independent_installments', { status: 'active' })
    ]);
    const totalInc        = inc.reduce((s,r)=>s+(+r.amount||0),0);
    const totalFix        = fix.reduce((s,r)=>s+(+r.amount||0),0);
    const totalFixBudget  = fix.reduce((s,r)=>s+(+r.budgeted_amount||+r.amount||0),0);
    const totalVar        = vari.reduce((s,r)=>s+(+r.amount||0),0);
    const totalVarBudget  = vari.reduce((s,r)=>s+(+r.budgeted_amount||+r.amount||0),0);
    const totalCrd  = txns.reduce((s,t)=>s+txnARS(t),0);
    const totalIns  = inst.reduce((s,r)=>s+(+r.installment_amount||0),0);
    const totalGasto = totalFix + totalVar + totalCrd + totalIns;
    const saldo     = totalInc - totalGasto;
    const hasData   = totalInc + totalFix + totalVar + totalCrd > 0;
    monthlyData.push({ m, totalInc, totalFix, totalFixBudget, totalVar, totalVarBudget, totalCrd, totalIns, totalGasto, saldo, hasData });
  }

  // ── Totales anuales ──
  const annualInc        = monthlyData.reduce((s,d)=>s+d.totalInc, 0);
  const annualFix        = monthlyData.reduce((s,d)=>s+d.totalFix, 0);
  const annualFixBudget  = monthlyData.reduce((s,d)=>s+d.totalFixBudget, 0);
  const annualVar        = monthlyData.reduce((s,d)=>s+d.totalVar, 0);
  const annualVarBudget  = monthlyData.reduce((s,d)=>s+d.totalVarBudget, 0);
  const annualCrd        = monthlyData.reduce((s,d)=>s+d.totalCrd, 0);
  const annualIns        = monthlyData.reduce((s,d)=>s+d.totalIns, 0);
  const annualGasto      = annualFix + annualVar + annualCrd + annualIns;
  const annualSaldo      = monthlyData.reduce((s,d)=>s+d.saldo,    0);

  // ── Meses cargados ──
  const loaded        = monthlyData.filter(d=>d.hasData);
  const loadedCount   = loaded.length;
  const mesesPos      = loaded.filter(d=>d.saldo >= 0).length;
  const mesesNeg      = loaded.filter(d=>d.saldo <  0).length;

  // ── Ahorro real = suma de saldos positivos ──
  const ahorroReal  = loaded.filter(d=>d.saldo > 0).reduce((s,d)=>s+d.saldo, 0);
  const pctAhorro   = annualInc > 0 ? ahorroReal / annualInc * 100 : 0;

  // ── Promedios (solo meses cargados) ──
  const avgInc    = loadedCount > 0 ? annualInc   / loadedCount : 0;
  const avgGasto  = loadedCount > 0 ? annualGasto / loadedCount : 0;
  const avgSaldo  = loadedCount > 0 ? annualSaldo / loadedCount : 0;
  const avgAhorro = mesesPos   > 0 ? ahorroReal  / mesesPos   : 0;

  // ── Rankings ──
  const top3Inc   = [...loaded].sort((a,b)=>b.totalInc   - a.totalInc).slice(0,3);
  const top3Gasto = [...loaded].sort((a,b)=>b.totalGasto - a.totalGasto).slice(0,3);
  const top3Ahorro= [...loaded].filter(d=>d.saldo>0).sort((a,b)=>b.saldo-a.saldo).slice(0,3);
  const top3Peor  = [...loaded].sort((a,b)=>a.saldo-b.saldo).slice(0,3);

  // ── Composición de gastos ──
  const pctFix = annualGasto > 0 ? annualFix / annualGasto * 100 : 0;
  const pctVar = annualGasto > 0 ? annualVar / annualGasto * 100 : 0;
  const pctCrd = annualGasto > 0 ? annualCrd / annualGasto * 100 : 0;
  const pctIns = annualGasto > 0 ? annualIns / annualGasto * 100 : 0;

  // ── Meta anual ──
  const metaMensual  = APP.cache.savingGoal?.monthly_goal || 0;
  const metaAnual    = metaMensual * 12;
  const pctMetaAnual = metaAnual > 0 ? Math.min(100, ahorroReal / metaAnual * 100) : 0;

  // ── Mensaje de estado ──
  let mensaje;
  if (loadedCount < 2)                             mensaje = '📊 Cargá más meses para obtener un análisis completo.';
  else if (annualCrd > annualFix && loadedCount >= 3) mensaje = '💳 El gasto en tarjetas está afectando el ahorro. Revisá los consumos.';
  else if (pctAhorro >= 20)                        mensaje = '🌟 Vienen ahorrando bien. Excelente ritmo anual.';
  else if (mesesNeg > mesesPos)                    mensaje = '⚠️ El año está ajustado. Más meses en rojo que en verde.';
  else                                             mensaje = '✅ Vienen bien, aunque hay margen para mejorar el ahorro.';

  // ── Helpers ──
  const meses     = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const maxIncome = Math.max(...monthlyData.map(d=>d.totalInc), 1);
  const maxGastoV = Math.max(...monthlyData.map(d=>d.totalGasto), 1);
  const maxBar    = Math.max(maxIncome, maxGastoV, 1);

  const rankRow = (d, i, val, color) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:.375rem 0${i>0?';border-top:1px solid var(--border)':''}">
      <span style="font-size:.85rem"><strong style="color:var(--text-2)">#${i+1}</strong> ${monthName(d.m)}</span>
      <span class="mono" style="font-size:.82rem;color:${color}">${fmtARS(val)}</span>
    </div>`;

  const loadedOrdered = monthlyData.filter(d=>d.hasData);

  sec.innerHTML = `
    <div class="section-top" style="margin-bottom:1.25rem">
      <div>
        <h2 class="section-title">Resumen Anual ${year}</h2>
        <p class="section-subtitle">${loadedCount} ${loadedCount===1?'mes cargado':'meses cargados'} · ${mesesPos} positivos · ${mesesNeg} negativos</p>
      </div>
    </div>

    <!-- ① TOTALES ANUALES -->
    <div class="stats-grid" style="margin-bottom:1.25rem">
      <div class="stat-card stat-card--green">
        <div class="card-label">Ingresos anuales</div>
        <div class="card-value--sm mono">${fmtARS(annualInc)}</div>
      </div>
      <div class="stat-card stat-card--red">
        <div class="card-label">Gastos totales</div>
        <div class="card-value--sm mono">${fmtARS(annualGasto)}</div>
      </div>
      <div class="stat-card">
        <div class="card-label">Saldo acumulado</div>
        <div class="card-value--sm mono" style="color:${annualSaldo>=0?'var(--success)':'var(--danger)'}">${fmtARS(annualSaldo)}</div>
      </div>
      <div class="stat-card stat-card--green">
        <div class="card-label">Ahorro real del año</div>
        <div class="card-value--sm mono" style="color:var(--success)">${fmtARS(ahorroReal)}</div>
        <div class="card-sub">${fmtPct(pctAhorro)} sobre ingresos</div>
      </div>
      <div class="stat-card">
        <div class="card-label">Meses cargados</div>
        <div class="card-value--sm">${loadedCount} <span style="font-size:.75rem;color:var(--text-3)">/ 12</span></div>
        <div class="card-sub">${mesesPos} positivos · ${mesesNeg} negativos</div>
      </div>
    </div>

    <!-- ② PROMEDIOS MENSUALES -->
    <h3 class="anual-section-title">Promedio mensual</h3>
    <div class="stats-grid" style="margin-bottom:1.25rem">
      <div class="stat-card">
        <div class="card-label">Ingreso promedio</div>
        <div class="card-value--sm mono" style="color:var(--success)">${fmtARS(avgInc)}</div>
        <div class="card-sub">por mes cargado</div>
      </div>
      <div class="stat-card">
        <div class="card-label">Gasto promedio</div>
        <div class="card-value--sm mono" style="color:var(--danger)">${fmtARS(avgGasto)}</div>
        <div class="card-sub">por mes cargado</div>
      </div>
      <div class="stat-card">
        <div class="card-label">Saldo promedio</div>
        <div class="card-value--sm mono" style="color:${avgSaldo>=0?'var(--success)':'var(--danger)'}">${fmtARS(avgSaldo)}</div>
        <div class="card-sub">por mes cargado</div>
      </div>
      <div class="stat-card">
        <div class="card-label">Ahorro promedio</div>
        <div class="card-value--sm mono" style="color:var(--success)">${fmtARS(avgAhorro)}</div>
        <div class="card-sub">solo meses positivos</div>
      </div>
    </div>

    <!-- ③ AHORRO DEL AÑO -->
    <h3 class="anual-section-title">Ahorro del año</h3>
    <div class="card" style="margin-bottom:1.25rem;${ahorroReal>0?'border-color:var(--success)':''}">
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:1.25rem;margin-bottom:${metaAnual>0||loadedCount>0?'.875rem':'0'}">
        <div>
          <div class="card-label">Ahorro acumulado real</div>
          <div class="mono" style="font-size:1.35rem;font-weight:700;color:var(--success)">${fmtARS(ahorroReal)}</div>
        </div>
        <div>
          <div class="card-label">Ahorro prom/mes</div>
          <div class="mono" style="font-size:1.1rem;font-weight:700;color:var(--success)">${fmtARS(avgAhorro)}</div>
        </div>
        <div>
          <div class="card-label">Meses positivos</div>
          <div style="font-size:1.5rem;font-weight:700;color:var(--success)">${mesesPos}</div>
        </div>
        <div>
          <div class="card-label">Meses negativos</div>
          <div style="font-size:1.5rem;font-weight:700;color:${mesesNeg>0?'var(--danger)':'var(--text-3)'}">${mesesNeg}</div>
        </div>
      </div>
      ${metaAnual > 0 ? `
      <div style="margin-bottom:.75rem">
        <div style="display:flex;justify-content:space-between;font-size:.78rem;color:var(--text-2);margin-bottom:.375rem">
          <span>Meta anual estimada (${fmtARS(metaMensual)}/mes × 12)</span>
          <span>${fmtPct(pctMetaAnual)} · ${fmtARS(ahorroReal)} de ${fmtARS(metaAnual)}</span>
        </div>
        <div class="progress-bar" style="height:10px">
          <div class="progress-fill ${pctMetaAnual>=100?'progress-fill--success':pctMetaAnual>60?'progress-fill--warning':'progress-fill--danger'}" style="width:${Math.min(100,pctMetaAnual)}%"></div>
        </div>
      </div>` : ''}
      <div style="padding:.625rem .875rem;background:var(--bg-3);border-radius:var(--radius-md);font-size:.875rem;color:var(--text-1)">
        ${mensaje}
      </div>
    </div>

    <!-- ④ COMPOSICIÓN DE GASTOS -->
    <h3 class="anual-section-title">Composición anual de gastos</h3>
    <div class="card" style="margin-bottom:1.25rem">
      ${annualGasto > 0 ? `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem">
        ${[
          { label:'Gastos fijos', val:annualFix, pct:pctFix, color:'var(--danger)' },
          { label:'Variables',    val:annualVar, pct:pctVar, color:'var(--warning)' },
          { label:'Tarjetas',     val:annualCrd, pct:pctCrd, color:'var(--accent)' },
          { label:'Cuotas',       val:annualIns, pct:pctIns, color:'rgba(168,85,247,1)' },
        ].map(g=>`
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:.3rem">
              <span style="font-size:.8rem;color:var(--text-2)">${g.label}</span>
              <span style="font-size:.8rem;font-weight:700;color:${g.color}">${fmtPct(g.pct)}</span>
            </div>
            <div class="progress-bar" style="height:8px;margin-bottom:.3rem">
              <div style="width:${g.pct.toFixed(1)}%;height:100%;background:${g.color};border-radius:9999px;transition:width .6s ease"></div>
            </div>
            <div class="mono" style="font-size:.78rem;color:var(--text-3)">${fmtARS(g.val)}</div>
          </div>`).join('')}
      </div>` : '<p style="color:var(--text-3);font-size:.875rem">Sin datos de gastos cargados.</p>'}
    </div>

    <!-- ⑤ PRESUPUESTO vs REAL -->
    <h3 class="anual-section-title">Presupuesto vs Gasto real</h3>
    <div class="stats-grid" style="margin-bottom:1.25rem">
      <div class="stat-card">
        <div class="card-label">Pres. Fijos año</div>
        <div class="card-value--sm mono">${fmtARS(annualFixBudget)}</div>
        <div class="card-sub" style="color:${annualFix>annualFixBudget?'var(--danger)':annualFix<annualFixBudget?'var(--success)':'var(--text-3)'}">
          Real: ${fmtARS(annualFix)} ${annualFix!==annualFixBudget?(annualFix>annualFixBudget?'↑':'↓'):'✓'}
        </div>
      </div>
      <div class="stat-card">
        <div class="card-label">Pres. Variables año</div>
        <div class="card-value--sm mono">${fmtARS(annualVarBudget)}</div>
        <div class="card-sub" style="color:${annualVar>annualVarBudget?'var(--danger)':annualVar<annualVarBudget?'var(--success)':'var(--text-3)'}">
          Real: ${fmtARS(annualVar)} ${annualVar!==annualVarBudget?(annualVar>annualVarBudget?'↑':'↓'):'✓'}
        </div>
      </div>
      <div class="stat-card" style="${(annualFix-annualFixBudget)>0?'border-top:2px solid var(--danger)':'border-top:2px solid var(--success)'}">
        <div class="card-label">Dif. Fijos</div>
        <div class="card-value--sm mono" style="color:${(annualFix-annualFixBudget)>0?'var(--danger)':(annualFix-annualFixBudget)<0?'var(--success)':'var(--text-3)'}">
          ${annualFix===annualFixBudget?'—':(annualFix>annualFixBudget?'+':'')+fmtARS(annualFix-annualFixBudget)}
        </div>
        <div class="card-sub">${(annualFix-annualFixBudget)>0?'Excedido':(annualFix-annualFixBudget)<0?'Bajo presupuesto':'En presupuesto'}</div>
      </div>
      <div class="stat-card" style="${(annualVar-annualVarBudget)>0?'border-top:2px solid var(--danger)':'border-top:2px solid var(--success)'}">
        <div class="card-label">Dif. Variables</div>
        <div class="card-value--sm mono" style="color:${(annualVar-annualVarBudget)>0?'var(--danger)':(annualVar-annualVarBudget)<0?'var(--success)':'var(--text-3)'}">
          ${annualVar===annualVarBudget?'—':(annualVar>annualVarBudget?'+':'')+fmtARS(annualVar-annualVarBudget)}
        </div>
        <div class="card-sub">${(annualVar-annualVarBudget)>0?'Excedido':(annualVar-annualVarBudget)<0?'Bajo presupuesto':'En presupuesto'}</div>
      </div>
    </div>

    <!-- ⑥ COMPARATIVA MES A MES -->
    <h3 class="anual-section-title">Comparativa mes a mes</h3>
    ${loadedOrdered.length < 2 ? `
    <div class="card" style="margin-bottom:1.25rem;text-align:center;color:var(--text-3);padding:1.5rem;border-style:dashed">
      <div style="font-size:1.5rem;margin-bottom:.375rem">📊</div>
      <p style="font-size:.875rem">Cargá más meses para ver comparativas reales.</p>
    </div>` : `
    <div class="table-wrap" style="margin-bottom:1.25rem">
      <table class="table">
        <thead><tr>
          <th>Mes</th>
          <th style="text-align:right">Ingresos</th>
          <th style="text-align:right">vs ant.</th>
          <th style="text-align:right">Gastos</th>
          <th style="text-align:right">vs ant.</th>
          <th style="text-align:right">Saldo</th>
          <th style="text-align:right">vs ant.</th>
        </tr></thead>
        <tbody>
          ${loadedOrdered.map((d,i) => {
            const prev   = loadedOrdered[i-1];
            const dInc   = prev != null ? d.totalInc   - prev.totalInc   : null;
            const dGas   = prev != null ? d.totalGasto - prev.totalGasto : null;
            const dSal   = prev != null ? d.saldo      - prev.saldo      : null;
            function diffCell(v, invertColor) {
              if (v === null) return '<td style="text-align:right;color:var(--text-3)">—</td>';
              if (v === 0)    return '<td style="text-align:right;color:var(--text-3)" class="mono">=</td>';
              const good  = invertColor ? v < 0 : v > 0;
              const color = good ? 'var(--success)' : 'var(--danger)';
              const icon  = v > 0 ? '↑' : '↓';
              return `<td style="text-align:right;color:${color};font-size:.8rem" class="mono">${icon} ${fmtARS(Math.abs(v))}</td>`;
            }
            return `<tr>
              <td><strong>${monthName(d.m)}</strong></td>
              <td class="mono" style="text-align:right;color:var(--success)">${fmtARS(d.totalInc)}</td>
              ${diffCell(dInc, false)}
              <td class="mono" style="text-align:right;color:var(--danger)">${fmtARS(d.totalGasto)}</td>
              ${diffCell(dGas, true)}
              <td class="mono" style="text-align:right;font-weight:600;color:${d.saldo>=0?'var(--success)':'var(--danger)'}">${fmtARS(d.saldo)}</td>
              ${diffCell(dSal, false)}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`}

    <!-- ⑥ RANKINGS -->
    <h3 class="anual-section-title">Ranking de meses</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.25rem">
      <div class="chart-container">
        <div class="chart-title" style="color:var(--success)">🏆 Mayor ingreso</div>
        ${top3Inc.length===0 ? '<p style="font-size:.8rem;color:var(--text-3);margin-top:.5rem">Sin datos</p>'
          : top3Inc.map((d,i)=>rankRow(d,i,d.totalInc,'var(--success)')).join('')}
      </div>
      <div class="chart-container">
        <div class="chart-title" style="color:var(--danger)">📈 Mayor gasto</div>
        ${top3Gasto.length===0 ? '<p style="font-size:.8rem;color:var(--text-3);margin-top:.5rem">Sin datos</p>'
          : top3Gasto.map((d,i)=>rankRow(d,i,d.totalGasto,'var(--danger)')).join('')}
      </div>
      <div class="chart-container">
        <div class="chart-title" style="color:var(--success)">💚 Mejor ahorro</div>
        ${top3Ahorro.length===0 ? '<p style="font-size:.8rem;color:var(--text-3);margin-top:.5rem">Sin meses con saldo positivo</p>'
          : top3Ahorro.map((d,i)=>rankRow(d,i,d.saldo,'var(--success)')).join('')}
      </div>
      <div class="chart-container">
        <div class="chart-title" style="color:var(--danger)">⚠️ Peor saldo</div>
        ${top3Peor.length===0 ? '<p style="font-size:.8rem;color:var(--text-3);margin-top:.5rem">Sin datos</p>'
          : top3Peor.map((d,i)=>rankRow(d,i,d.saldo,d.saldo<0?'var(--danger)':'var(--text-2)')).join('')}
      </div>
    </div>

    <!-- ⑦ GRÁFICO DE BARRAS -->
    <h3 class="anual-section-title">Ingresos vs Gastos por mes</h3>
    <div class="chart-container" style="margin-bottom:1.5rem">
      <div class="annual-bar-wrap" style="margin-top:.75rem">
        ${monthlyData.map(d => {
          const wInc = ((d.totalInc   / maxBar)*100).toFixed(1);
          const wGas = ((d.totalGasto / maxBar)*100).toFixed(1);
          return `
            <div class="annual-bar-row" title="${monthName(d.m)}: Ing ${fmtARS(d.totalInc)} / Gasto ${fmtARS(d.totalGasto)}">
              <div class="annual-bar-label">${meses[d.m-1]}</div>
              <div style="flex:1;display:flex;flex-direction:column;gap:2px">
                <div class="annual-bar-track"><div class="annual-bar-fill" style="width:${wInc}%;background:var(--success)"></div></div>
                <div class="annual-bar-track"><div class="annual-bar-fill" style="width:${wGas}%;background:var(--danger)"></div></div>
              </div>
              <div class="annual-bar-val">${d.hasData ? fmtARS(d.saldo) : '—'}</div>
            </div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:1rem;margin-top:.75rem">
        <div style="display:flex;align-items:center;gap:.375rem;font-size:.75rem;color:var(--text-2)"><div style="width:12px;height:6px;background:var(--success);border-radius:3px"></div>Ingresos</div>
        <div style="display:flex;align-items:center;gap:.375rem;font-size:.75rem;color:var(--text-2)"><div style="width:12px;height:6px;background:var(--danger);border-radius:3px"></div>Gastos</div>
      </div>
    </div>

    <!-- ⑧ TABLA DETALLE MES A MES -->
    <h3 class="anual-section-title">Detalle por mes</h3>
    <div class="table-wrap">
      <table class="table">
        <thead><tr>
          <th>Mes</th>
          <th style="text-align:right">Ingresos</th>
          <th style="text-align:right">Fijos</th>
          <th style="text-align:right">Variables</th>
          <th style="text-align:right">Tarjetas</th>
          <th style="text-align:right">Saldo</th>
        </tr></thead>
        <tbody>
          ${monthlyData.map(d => `
            <tr>
              <td><strong>${monthName(d.m)}</strong></td>
              <td class="mono" style="text-align:right;color:var(--success)">${d.totalInc>0?fmtARS(d.totalInc):'—'}</td>
              <td class="mono" style="text-align:right">${d.totalFix>0?fmtARS(d.totalFix):'—'}</td>
              <td class="mono" style="text-align:right">${d.totalVar>0?fmtARS(d.totalVar):'—'}</td>
              <td class="mono" style="text-align:right">${d.totalCrd>0?fmtARS(d.totalCrd):'—'}</td>
              <td class="mono" style="text-align:right;color:${d.saldo>=0?'var(--success)':'var(--danger)'};font-weight:600">
                ${d.hasData ? fmtARS(d.saldo) : '—'}</td>
            </tr>`).join('')}
          <tr style="font-weight:700;border-top:2px solid var(--border-md)">
            <td>TOTAL ANUAL</td>
            <td class="mono" style="text-align:right;color:var(--success)">${fmtARS(annualInc)}</td>
            <td class="mono" style="text-align:right">${fmtARS(annualFix)}</td>
            <td class="mono" style="text-align:right">${fmtARS(annualVar)}</td>
            <td class="mono" style="text-align:right">${fmtARS(annualCrd)}</td>
            <td class="mono" style="text-align:right;color:${annualSaldo>=0?'var(--success)':'var(--danger)'}">${fmtARS(annualSaldo)}</td>
          </tr>
        </tbody>
      </table>
    </div>`;
}

/* ============================================================
   27. EXPORTAR / BACKUP
   ============================================================ */
function renderExportar() {
  const sec = $('section-exportar');
  sec.innerHTML = `
    <div class="section-top">
      <h2 class="section-title">Exportar y Backup</h2>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
      <!-- EXPORTAR JSON -->
      <div class="card">
        <h3 style="font-size:.95rem;font-weight:600;margin-bottom:.5rem">📦 Exportar JSON</h3>
        <p style="font-size:.8rem;color:var(--text-2);margin-bottom:1rem">Respaldo completo de datos para importar luego</p>
        <div style="display:flex;flex-direction:column;gap:.5rem">
          <button class="btn btn--outline" onclick="exportJSON('month')">Exportar mes actual (JSON)</button>
          <button class="btn btn--outline" onclick="exportJSON('year')">Exportar año completo (JSON)</button>
        </div>
      </div>

      <!-- EXPORTAR CSV -->
      <div class="card">
        <h3 style="font-size:.95rem;font-weight:600;margin-bottom:.5rem">📊 Exportar CSV</h3>
        <p style="font-size:.8rem;color:var(--text-2);margin-bottom:1rem">Compatible con Excel, Google Sheets</p>
        <div style="display:flex;flex-direction:column;gap:.5rem">
          <button class="btn btn--outline" onclick="exportCSV('incomes')">Ingresos (CSV)</button>
          <button class="btn btn--outline" onclick="exportCSV('fixed')">Gastos fijos (CSV)</button>
          <button class="btn btn--outline" onclick="exportCSV('variable')">Gastos variables (CSV)</button>
          <button class="btn btn--outline" onclick="exportCSV('cards')">Consumos de tarjetas (CSV)</button>
        </div>
      </div>

      <!-- PDF PROFESIONAL -->
      <div class="card" style="border-color:var(--accent)">
        <h3 style="font-size:.95rem;font-weight:600;margin-bottom:.5rem">📄 Resumen mensual PDF</h3>
        <p style="font-size:.8rem;color:var(--text-2);margin-bottom:1rem">Reporte profesional con ingresos, gastos, tarjetas y totales del mes seleccionado</p>
        <button class="btn btn--primary" onclick="generateMonthlyPDF()">Descargar PDF del mes</button>
      </div>

      <!-- IMPORTAR JSON -->
      <div class="card">
        <h3 style="font-size:.95rem;font-weight:600;margin-bottom:.5rem">📥 Importar respaldo JSON</h3>
        <p style="font-size:.8rem;color:var(--text-2);margin-bottom:1rem">Restaurar desde un backup exportado anteriormente</p>
        <input type="file" id="restore-file" accept=".json" style="display:none" onchange="importJSON(event)">
        <button class="btn btn--ghost" onclick="$('restore-file').click()">Seleccionar archivo JSON</button>
        <p style="font-size:.75rem;color:var(--danger);margin-top:.5rem">⚠️ Los datos existentes del mes no se borrarán, solo se agregarán los nuevos</p>
      </div>
    </div>`;
}

async function generateMonthlyPDF() {
  const month = APP.currentMonth;
  const year  = APP.currentYear;
  const userName = APP.profile?.display_name || APP.session?.user?.email?.split('@')[0] || 'Usuario';
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const mesLabel = `${meses[month-1]} ${year}`;
  const generado = new Date().toLocaleString('es-AR');

  toast('Generando PDF…', 'info', 2000);

  // ── Cargar datos ──
  const [incomes, fixed, variable, cards, allTxnsRaw, installments] = await Promise.all([
    dbSelect('incomes',               { month, year }),
    dbSelect('fixed_expenses',        { month, year }),
    dbSelect('variable_expenses',     { month, year }),
    dbSelect('credit_cards'),
    loadCardTxnsForMonth(month, year),
    dbSelect('independent_installments', { status: 'active' })
  ]);

  // ── Cálculos ──
  const p = n => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0);
  const pu = n => new Intl.NumberFormat('es-AR',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0);
  const fd = d => d ? new Date(d+'T00:00:00').toLocaleDateString('es-AR') : '—';

  const totalInc  = incomes.reduce((s,r)=>s+(+r.amount||0),0);
  const totalFix  = fixed.reduce((s,r)=>s+(+r.amount||0),0);
  const totalVar  = variable.reduce((s,r)=>s+(+r.amount||0),0);
  const totalCrd  = allTxnsRaw.reduce((s,t)=>s+txnARS(t),0);
  const totalIns  = installments.reduce((s,r)=>s+(+r.installment_amount||0),0);
  const totalGasto= totalFix + totalVar + totalCrd + totalIns;
  const saldo     = totalInc - totalGasto;

  // Txns por tarjeta
  const txnsByCard = {};
  allTxnsRaw.forEach(t => {
    if (!txnsByCard[t.card_id]) txnsByCard[t.card_id] = [];
    txnsByCard[t.card_id].push(t);
  });

  // ── Helpers HTML ──
  const th = (t, right=false) => `<th${right?' style="text-align:right"':''}>${t}</th>`;
  const td = (t, right=false, bold=false, color='') =>
    `<td${right?' style="text-align:right'+(color?`;color:${color}`:'')+(bold?';font-weight:700':'')+'\"':color||bold?` style="${color?`color:${color};`:''}${bold?'font-weight:700':''}"`:''}>
      ${t??'—'}
    </td>`;
  const noData = label => `<tr><td colspan="10" style="text-align:center;color:#94a3b8;padding:1rem">Sin ${label} cargados este mes.</td></tr>`;

  // ── Sección Ingresos ──
  const incRows = incomes.length ? incomes.map(r=>`<tr>
    ${td(r.description)} ${td(r.person||'—')} ${td(fd(r.income_date))} ${td(p(r.amount),true,false,'#16a34a')}
    ${td(r.notes||'')}
  </tr>`).join('') : noData('ingresos');

  // ── Sección Gastos Fijos ──
  const totalFixBudgetedPDF = fixed.reduce((s,r)=>s+(+r.budgeted_amount||+r.amount||0),0);
  const fixRows = fixed.length ? fixed.map(r=>{
    const budg = +r.budgeted_amount||+r.amount||0;
    const real = +r.amount||0;
    const diff = real - budg;
    return `<tr>
      ${td(r.description)} ${td(r.category||'General')} ${td(r.person||'—')} ${td(fd(r.due_date))}
      <td style="text-align:center"><span class="badge-pdf ${r.status==='paid'?'badge-ok':'badge-pend'}">${r.status==='paid'?'Pagado':'Pendiente'}</span></td>
      ${td(p(budg),true,false,'#475569')}
      ${td(p(real),true,true,diff>0?'#dc2626':diff<0?'#16a34a':'#dc2626')}
      ${td(diff===0?'—':(diff>0?'+':'')+p(diff),true,false,diff>0?'#dc2626':diff<0?'#16a34a':'#94a3b8')}
      ${td(r.notes||'')}
    </tr>`;
  }).join('') : noData('gastos fijos');

  // ── Sección Gastos Variables ──
  const totalVarBudgetedPDF = variable.reduce((s,r)=>s+(+r.budgeted_amount||+r.amount||0),0);
  const varRows = variable.length ? variable.map(r=>{
    const budg = +r.budgeted_amount||+r.amount||0;
    const real = +r.amount||0;
    const diff = real - budg;
    return `<tr>
      ${td(r.description)} ${td(r.category||'Otros')} ${td(r.person||'—')} ${td(r.payment_method||'—')}
      ${td(fd(r.expense_date))}
      ${td(p(budg),true,false,'#475569')}
      ${td(p(real),true,true,diff>0?'#dc2626':diff<0?'#16a34a':'#dc2626')}
      ${td(diff===0?'—':(diff>0?'+':'')+p(diff),true,false,diff>0?'#dc2626':diff<0?'#16a34a':'#94a3b8')}
      ${td(r.notes||'')}
    </tr>`;
  }).join('') : noData('gastos variables');

  // ── Sección Tarjetas ──
  const cardSections = cards.map(card => {
    const txns = txnsByCard[card.id] || [];
    const cardTotal    = txns.reduce((s,t)=>s+txnARS(t),0);
    const cardPaid     = txns.filter(t=>t.status==='paid').reduce((s,t)=>s+txnARS(t),0);
    const cardPending  = cardTotal - cardPaid;

    const txnRows = txns.length ? txns.map(t=>{
      const amtARS = txnARS(t);
      const cuotas = t.is_recurring ? 'Fijo' : t.total_installments>1 ? `${t.current_installment}/${t.total_installments}` : '1 pago';
      return `<tr>
        ${td(fd(t.transaction_date))} ${td(t.description)}
        <td style="text-align:center">${t.currency}</td>
        ${td(t.currency==='USD'?pu(t.amount_usd):p(t.amount_ars),true)}
        ${td(t.currency==='USD'&&t.dollar_rate?p(t.dollar_rate):'—',true)}
        ${td(t.currency==='USD'?p(t.converted_ars):'—',true)}
        <td style="text-align:center">${cuotas}</td>
        <td style="text-align:center"><span class="badge-pdf ${t.status==='paid'?'badge-ok':'badge-pend'}">${t.status==='paid'?'Pagado':'Pendiente'}</span></td>
        ${td(t.notes||'')}
      </tr>`;
    }).join('') : `<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:.75rem">Sin consumos este mes.</td></tr>`;

    return `
      <div class="card-block">
        <div class="card-header-pdf">
          <div>
            <strong style="font-size:1.05rem">${card.name}</strong>
            ${card.holder?' <span class="card-meta">Titular: '+card.holder+'</span>':''}
            ${card.bank?' <span class="card-meta">| Banco: '+card.bank+'</span>':''}
          </div>
          <div style="text-align:right">
            ${(()=>{ const d=calculateCardDates(card,APP.currentMonth,APP.currentYear); return (d.closingDate?`<div class="card-meta">Cierre: ${fd(d.closingDate)}</div>`:'')+( d.dueDate?`<div class="card-meta">Vencimiento: ${fd(d.dueDate)}</div>`:''); })()}
          </div>
        </div>
        <div class="card-totals-row">
          <span>Total: <strong>${p(cardTotal)}</strong></span>
          <span style="color:#16a34a">Pagado: <strong>${p(cardPaid)}</strong></span>
          <span style="color:#dc2626">Pendiente: <strong>${p(cardPending)}</strong></span>
        </div>
        <table class="pdf-table">
          <thead><tr>
            ${th('Fecha')} ${th('Descripción')} ${th('Mon',true)} ${th('Monto',true)}
            ${th('Cotiz.',true)} ${th('ARS equiv.',true)} ${th('Cuotas',true)} ${th('Estado')} ${th('Notas')}
          </tr></thead>
          <tbody>${txnRows}</tbody>
        </table>
        <div class="section-total">Total tarjeta ${card.name}: <strong>${p(cardTotal)}</strong></div>
      </div>`;
  }).join('');

  // ── HTML del PDF ──
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Proyecta+ Finanzas — ${mesLabel}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 18mm 15mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #1e293b; background: #fff; line-height: 1.4; }

  /* ── Encabezado ── */
  .pdf-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1d4ed8; padding-bottom: 10px; margin-bottom: 18px; }
  .pdf-header-left .brand { font-size: 17pt; font-weight: 800; color: #1d4ed8; letter-spacing: -.02em; }
  .pdf-header-left .subtitle { font-size: 9pt; color: #64748b; margin-top: 2px; }
  .pdf-header-right { text-align: right; font-size: 8.5pt; color: #64748b; }
  .pdf-header-right .period { font-size: 13pt; font-weight: 700; color: #1e293b; }

  /* ── Resumen ejecutivo ── */
  .summary-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-bottom: 20px; }
  .summary-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; }
  .summary-card .label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .05em; color: #64748b; margin-bottom: 3px; }
  .summary-card .value { font-size: 11pt; font-weight: 700; font-family: 'Courier New', monospace; }
  .summary-card.green  { border-top: 3px solid #16a34a; }
  .summary-card.red    { border-top: 3px solid #dc2626; }
  .summary-card.blue   { border-top: 3px solid #1d4ed8; }
  .summary-card.accent { border-top: 3px solid #7c3aed; }
  .status-pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 9pt; font-weight: 700; }
  .status-pos { background: #dcfce7; color: #15803d; }
  .status-neg { background: #fee2e2; color: #b91c1c; }

  /* ── Secciones ── */
  .pdf-section { margin-bottom: 22px; page-break-inside: avoid; }
  .pdf-section-title { font-size: 10.5pt; font-weight: 700; color: #1d4ed8; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1.5px solid #bfdbfe; padding-bottom: 4px; margin-bottom: 8px; }

  /* ── Tablas ── */
  .pdf-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  .pdf-table thead th { background: #f1f5f9; color: #475569; font-weight: 600; padding: 5px 7px; border-bottom: 1.5px solid #cbd5e1; white-space: nowrap; }
  .pdf-table tbody td { padding: 4px 7px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  .pdf-table tbody tr:last-child td { border-bottom: none; }
  .pdf-table tbody tr:hover { background: #f8fafc; }
  .section-total { text-align: right; font-size: 9pt; padding: 5px 7px; border-top: 1.5px solid #cbd5e1; margin-top: 2px; color: #1e293b; }

  /* ── Tarjetas ── */
  .card-block { border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 14px; overflow: hidden; page-break-inside: avoid; }
  .card-header-pdf { display: flex; justify-content: space-between; align-items: flex-start; background: #f8fafc; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
  .card-meta { font-size: 7.5pt; color: #64748b; }
  .card-totals-row { display: flex; gap: 20px; padding: 6px 12px; background: #fff; border-bottom: 1px solid #f1f5f9; font-size: 8.5pt; }

  /* ── Badges ── */
  .badge-pdf { display: inline-block; padding: 1px 7px; border-radius: 999px; font-size: 7.5pt; font-weight: 600; }
  .badge-ok   { background: #dcfce7; color: #15803d; }
  .badge-pend { background: #fef9c3; color: #854d0e; }

  /* ── Total general ── */
  .grand-total { background: #1d4ed8; color: #fff; border-radius: 6px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; font-size: 11pt; font-weight: 700; margin-bottom: 20px; }

  /* ── Pie ── */
  .pdf-footer { border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 24px; font-size: 7.5pt; color: #94a3b8; display: flex; justify-content: space-between; }

  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .no-print { display: none; }
    .pdf-section { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<!-- ENCABEZADO -->
<div class="pdf-header">
  <div class="pdf-header-left">
    <div class="brand">Proyecta+ Finanzas</div>
    <div class="subtitle">Resumen financiero mensual</div>
  </div>
  <div class="pdf-header-right">
    <div class="period">${mesLabel}</div>
    <div>Generado: ${generado}</div>
    <div>Usuario: ${userName}</div>
  </div>
</div>

<!-- BOTÓN IMPRIMIR (solo en pantalla) -->
<div class="no-print" style="margin-bottom:16px;text-align:right">
  <button onclick="window.print()" style="background:#1d4ed8;color:#fff;border:none;border-radius:6px;padding:8px 18px;font-size:10pt;cursor:pointer;font-weight:600">⎙ Imprimir / Guardar PDF</button>
</div>

<!-- RESUMEN EJECUTIVO -->
<div class="summary-grid">
  <div class="summary-card green"><div class="label">Total ingresos</div><div class="value" style="color:#16a34a">${p(totalInc)}</div></div>
  <div class="summary-card red"><div class="label">Gastos fijos (real)</div><div class="value" style="color:#dc2626">${p(totalFix)}</div><div style="font-size:7pt;color:#64748b;margin-top:2px">Pres: ${p(totalFixBudgetedPDF)}</div></div>
  <div class="summary-card red"><div class="label">Gastos variables (real)</div><div class="value" style="color:#dc2626">${p(totalVar)}</div><div style="font-size:7pt;color:#64748b;margin-top:2px">Pres: ${p(totalVarBudgetedPDF)}</div></div>
  <div class="summary-card blue"><div class="label">Tarjetas</div><div class="value" style="color:#1d4ed8">${p(totalCrd)}</div></div>
  <div class="summary-card red"><div class="label">Total gastos</div><div class="value" style="color:#dc2626">${p(totalGasto)}</div></div>
  <div class="summary-card ${saldo>=0?'green':'red'}">
    <div class="label">Saldo disponible</div>
    <div class="value" style="color:${saldo>=0?'#16a34a':'#dc2626'}">${p(saldo)}</div>
  </div>
  <div class="summary-card accent"><div class="label">Cuotas independientes</div><div class="value" style="color:#7c3aed">${p(totalIns)}</div></div>
  <div class="summary-card ${saldo>=0?'green':'red'}">
    <div class="label">Estado del mes</div>
    <div style="margin-top:4px"><span class="status-pill ${saldo>=0?'status-pos':'status-neg'}">${saldo>=0?'✓ Positivo':'✗ Negativo'}</span></div>
  </div>
</div>

<!-- INGRESOS -->
<div class="pdf-section">
  <div class="pdf-section-title">1. Ingresos</div>
  <table class="pdf-table">
    <thead><tr>${th('Descripción')}${th('Persona')}${th('Fecha')}${th('Monto',true)}${th('Notas')}</tr></thead>
    <tbody>
      ${incRows}
      ${incomes.length ? `<tr><td colspan="3" style="text-align:right;font-weight:700;padding:5px 7px">Total ingresos</td>${td(p(totalInc),true,true,'#16a34a')}<td></td></tr>` : ''}
    </tbody>
  </table>
</div>

<!-- GASTOS FIJOS -->
<div class="pdf-section">
  <div class="pdf-section-title">2. Gastos Fijos</div>
  <table class="pdf-table">
    <thead><tr>${th('Descripción')}${th('Categoría')}${th('Persona')}${th('Vencimiento')}${th('Estado')}${th('Presupuesto',true)}${th('Real',true)}${th('Diferencia',true)}${th('Notas')}</tr></thead>
    <tbody>
      ${fixRows}
      ${fixed.length ? `<tr>
        <td colspan="5" style="text-align:right;font-weight:700;padding:5px 7px">Total gastos fijos</td>
        ${td(p(totalFixBudgetedPDF),true,true,'#475569')}
        ${td(p(totalFix),true,true,'#dc2626')}
        ${td((totalFix-totalFixBudgetedPDF)===0?'—':(totalFix>totalFixBudgetedPDF?'+':'')+p(totalFix-totalFixBudgetedPDF),true,true,totalFix>totalFixBudgetedPDF?'#dc2626':'#16a34a')}
        <td></td>
      </tr>` : ''}
    </tbody>
  </table>
</div>

<!-- GASTOS VARIABLES -->
<div class="pdf-section">
  <div class="pdf-section-title">3. Gastos Variables</div>
  <table class="pdf-table">
    <thead><tr>${th('Descripción')}${th('Categoría')}${th('Persona')}${th('Método')}${th('Fecha')}${th('Presupuesto',true)}${th('Real',true)}${th('Diferencia',true)}${th('Notas')}</tr></thead>
    <tbody>
      ${varRows}
      ${variable.length ? `<tr>
        <td colspan="5" style="text-align:right;font-weight:700;padding:5px 7px">Total variables</td>
        ${td(p(totalVarBudgetedPDF),true,true,'#475569')}
        ${td(p(totalVar),true,true,'#dc2626')}
        ${td((totalVar-totalVarBudgetedPDF)===0?'—':(totalVar>totalVarBudgetedPDF?'+':'')+p(totalVar-totalVarBudgetedPDF),true,true,totalVar>totalVarBudgetedPDF?'#dc2626':'#16a34a')}
        <td></td>
      </tr>` : ''}
    </tbody>
  </table>
</div>

<!-- TARJETAS -->
<div class="pdf-section">
  <div class="pdf-section-title">4. Tarjetas de Crédito</div>
  ${cards.length ? cardSections : '<p style="color:#94a3b8;font-size:9pt">Sin tarjetas configuradas.</p>'}
  ${cards.length ? `<div class="grand-total"><span>Total general tarjetas</span><span>${p(totalCrd)}</span></div>` : ''}
</div>

<!-- PIE -->
<div class="pdf-footer">
  <span>Documento generado automáticamente por Proyecta+ Finanzas</span>
  <span>Los importes corresponden a los datos cargados por el usuario.</span>
</div>

</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { toast('Bloqueador de popups activo. Permitilo para generar el PDF.', 'error', 5000); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 600);
}

async function exportJSON(scope) {
  const isYear = scope === 'year';
  let data = {};

  if (isYear) {
    data.year = APP.currentYear;
    data.months = {};
    for (let m = 1; m <= 12; m++) {
      data.months[m] = await collectMonthData(m, APP.currentYear);
    }
  } else {
    data.month     = APP.currentMonth;
    data.year      = APP.currentYear;
    data.monthData = await collectMonthData(APP.currentMonth, APP.currentYear);
  }

  data.exportedAt = new Date().toISOString();
  data.exportedBy = APP.profile?.display_name;

  downloadFile(
    JSON.stringify(data, null, 2),
    `finapp-${isYear?APP.currentYear:`${APP.currentMonth}-${APP.currentYear}`}.json`,
    'application/json'
  );
  toast('Archivo JSON exportado ✓');
}

async function collectMonthData(month, year) {
  const [inc, fix, vari, txns, inst, goal] = await Promise.all([
    dbSelect('incomes',    { month, year }),
    dbSelect('fixed_expenses', { month, year }),
    dbSelect('variable_expenses', { month, year }),
    dbSelect('card_transactions', { month, year }),
    dbSelect('independent_installments'),
    dbSelect('saving_goals', { month, year })
  ]);
  return { incomes: inc, fixed_expenses: fix, variable_expenses: vari, card_transactions: txns, independent_installments: inst, saving_goals: goal };
}

async function exportCSV(type) {
  let rows = [];
  let filename = '';

  if (type === 'incomes') {
    rows = await dbSelect('incomes', { month: APP.currentMonth, year: APP.currentYear });
    filename = `ingresos-${APP.currentMonth}-${APP.currentYear}.csv`;
  } else if (type === 'fixed') {
    rows = await dbSelect('fixed_expenses', { month: APP.currentMonth, year: APP.currentYear });
    filename = `gastos-fijos-${APP.currentMonth}-${APP.currentYear}.csv`;
  } else if (type === 'variable') {
    rows = await dbSelect('variable_expenses', { month: APP.currentMonth, year: APP.currentYear });
    filename = `gastos-variables-${APP.currentMonth}-${APP.currentYear}.csv`;
  } else if (type === 'cards') {
    rows = await dbSelect('card_transactions', { month: APP.currentMonth, year: APP.currentYear });
    filename = `tarjetas-${APP.currentMonth}-${APP.currentYear}.csv`;
  }

  if (!rows.length) return toast('Sin datos para exportar', 'warning');

  // Crear CSV
  const headers = Object.keys(rows[0]).filter(k => !['id','household_id','created_by'].includes(k));
  const csv = [
    headers.join(';'),
    ...rows.map(r => headers.map(h => {
      const v = r[h]||'';
      return typeof v === 'string' && v.includes(';') ? `"${v}"` : v;
    }).join(';'))
  ].join('\r\n');

  downloadFile(csv, filename, 'text/csv;charset=utf-8');
  toast('CSV exportado ✓');
}

async function importJSON(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    confirmAction('¿Importar datos desde este archivo? Los datos existentes no se borrarán.', async () => {
      let count = 0;
      const insertFrom = async (arr, table, month, year) => {
        for (const row of (arr||[])) {
          const { id, created_at, updated_at, household_id, ...rest } = row;
          try {
            await dbInsert(table, { ...rest, month: month||rest.month, year: year||rest.year });
            count++;
          } catch {}
        }
      };
      if (data.monthData) {
        const { month, year, monthData } = data;
        await insertFrom(monthData.incomes, 'incomes', month, year);
        await insertFrom(monthData.fixed_expenses, 'fixed_expenses', month, year);
        await insertFrom(monthData.variable_expenses, 'variable_expenses', month, year);
        await insertFrom(monthData.card_transactions, 'card_transactions', month, year);
      }
      toast(`${count} registros importados ✓`);
      loadCurrentSection();
    });
  } catch(e) {
    toast('Error al leer el archivo: ' + e.message, 'error');
  }
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ============================================================
   28. CONFIGURACIÓN
   ============================================================ */
function renderConfiguracion() {
  const sec = $('section-configuracion');
  const profile = APP.profile;
  sec.innerHTML = `
    <div class="section-top">
      <h2 class="section-title">Configuración</h2>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
      <!-- Perfil -->
      <div class="card">
        <h3 style="font-size:.95rem;font-weight:600;margin-bottom:1rem">👤 Perfil</h3>
        <div class="form-grid">
          <div class="field-group">
            <label class="field-label">Nombre mostrado</label>
            <input id="cfg-name" class="field-input" value="${profile?.display_name||''}" placeholder="Tu nombre">
          </div>
          <div class="field-group">
            <label class="field-label">Email (solo lectura)</label>
            <input class="field-input" value="${APP.session?.user?.email||''}" readonly style="opacity:.6">
          </div>
          <div class="field-group">
            <label class="field-label">Color de avatar</label>
            <input type="color" id="cfg-color" class="field-input" value="${profile?.avatar_color||'#4f79f7'}" style="height:42px;padding:.25rem">
          </div>
          <div class="form-actions">
            <button class="btn btn--primary" onclick="saveProfile()">Guardar perfil</button>
          </div>
        </div>
      </div>

      <!-- Información del hogar -->
      <div class="card">
        <h3 style="font-size:.95rem;font-weight:600;margin-bottom:1rem">🏠 Hogar</h3>
        <div style="display:flex;flex-direction:column;gap:.625rem">
          <div>
            <div class="field-label">ID del Hogar</div>
            <div class="mono" style="font-size:.75rem;color:var(--text-2);word-break:break-all;margin-top:.25rem">${APP.householdId||'Sin hogar asignado'}</div>
          </div>
          ${APP.householdId ? `
          <div class="alert-item alert-item--success" style="font-size:.8rem">✅ Conectado al hogar compartido con tu pareja</div>` : `
          <div class="alert-item alert-item--warning" style="font-size:.8rem">⚠️ Sin hogar asignado. Ver README para instrucciones de configuración.</div>`}
        </div>
      </div>

      <!-- Tema -->
      <div class="card">
        <h3 style="font-size:.95rem;font-weight:600;margin-bottom:1rem">🎨 Apariencia</h3>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:.875rem">Tema oscuro</span>
          <label class="toggle-wrap">
            <input type="checkbox" class="toggle-input" id="cfg-theme" ${APP.theme==='dark'?'checked':''} onchange="toggleTheme()">
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <!-- Datos y Reseteo -->
      <div class="card" style="border-color:var(--danger-dim)">
        <h3 style="font-size:.95rem;font-weight:600;margin-bottom:1rem;color:var(--danger)">⚠️ Zona peligrosa</h3>
        <div style="display:flex;flex-direction:column;gap:.625rem">
          <button class="btn btn--ghost" onclick="resetMonth()">🗑 Borrar todos los datos de este mes</button>
          <p style="font-size:.75rem;color:var(--text-3)">Esta acción no se puede deshacer. Eliminará ingresos, gastos y consumos del mes actual.</p>
        </div>
      </div>

      <!-- Instrucciones -->
      <div class="card" style="grid-column:1/-1">
        <h3 style="font-size:.95rem;font-weight:600;margin-bottom:.75rem">📖 Instrucciones para configurar el hogar</h3>
        <p style="font-size:.8rem;color:var(--text-2);line-height:1.7">
          1. En Supabase, ir a <strong>SQL Editor</strong> y ejecutar:<br>
          <code style="background:var(--bg-3);padding:.25rem .5rem;border-radius:4px;font-size:.75rem">INSERT INTO households (name) VALUES ('Hogar de Juli y Mari') RETURNING id;</code><br><br>
          2. Copiar el UUID obtenido y ejecutar:<br>
          <code style="background:var(--bg-3);padding:.25rem .5rem;border-radius:4px;font-size:.75rem">UPDATE profiles SET household_id = 'UUID-AQUI', display_name = 'Juli' WHERE id = (SELECT id FROM auth.users WHERE email = 'juli@email.com');</code><br>
          <code style="background:var(--bg-3);padding:.25rem .5rem;border-radius:4px;font-size:.75rem">UPDATE profiles SET household_id = 'UUID-AQUI', display_name = 'Mari' WHERE id = (SELECT id FROM auth.users WHERE email = 'mari@email.com');</code><br><br>
          3. Recargar la app. Ambos usuarios verán los mismos datos.
        </p>
      </div>
    </div>`;
}

async function saveProfile() {
  const name  = $('cfg-name')?.value.trim();
  const color = $('cfg-color')?.value;
  if (!name) return toast('Ingresá un nombre', 'warning');
  try {
    await dbUpdate('profiles', APP.profile.id, { display_name: name, avatar_color: color });
    APP.profile.display_name  = name;
    APP.profile.avatar_color  = color;
    updateUserUI();
    toast('Perfil actualizado ✓');
  } catch {}
}

async function resetMonth() {
  confirmAction(`¿Borrar TODOS los datos de ${monthName(APP.currentMonth)} ${APP.currentYear}? Esta acción no se puede deshacer.`, async () => {
    const tables = ['incomes','fixed_expenses','variable_expenses','card_transactions'];
    let ok = true;
    for (const t of tables) {
      const rows = await dbSelect(t, { month: APP.currentMonth, year: APP.currentYear });
      for (const r of rows) {
        try { await dbDelete(t, r.id); } catch { ok = false; }
      }
    }
    toast(ok ? `Mes borrado ✓` : 'Algunos datos no pudieron borrarse', ok?'success':'warning');
    loadCurrentSection();
  });
}
