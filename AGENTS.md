# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

Personal finance SPA for collaborative household expense tracking between two users (Juli & Mari). No build process — all logic runs directly in the browser as static files.

## Development

**No build step required.** Open `index.html` directly in a browser or serve it with any static file server:

```powershell
# Simple local server (Python)
python -m http.server 8080

# Or with Node
npx serve .
```

There are no tests, no linting config, and no package manager in this project. All dependencies are loaded via CDN in `index.html`.

## Architecture

Single-file architecture — the entire app lives in three files:

- **[index.html](index.html)** — shell with CDN imports (Supabase JS v2, SheetJS), sidebar nav, modal containers, and section placeholders
- **[script.js](script.js)** — ~2,700 lines of vanilla JS; all app logic in one file
- **[styles.css](styles.css)** — full fintech dark/light theme using CSS custom properties; responsive (desktop sidebar, mobile bottom nav)
- **[supabase-schema.sql](supabase-schema.sql)** — PostgreSQL schema with Row Level Security policies to deploy in Supabase dashboard

### script.js structure

The file is organized in sequential sections (roughly top to bottom):

1. **Config** (lines ~1–30): Supabase URL + anon key, `APP` global state object with cache
2. **Auth** (~30–100): Supabase Auth flows (login, logout, session check)
3. **Routing** (~100–200): section show/hide, nav active state
4. **Data loaders** (~200–600): one async function per section (loadIncomes, loadFixedExpenses, etc.) that queries Supabase and renders HTML
5. **CRUD handlers** (~600–1800): form submissions, inline edits, deletes for each entity
6. **Credit card module** (~1800–2100): 4 hardcoded cards (Visa, Naranja, American, Macro), card summaries, installment calculations
7. **Import/Export** (~2100–2300): CSV/XLSX ingestion (SheetJS), JSON/CSV/PDF export
8. **Dollar rates** (~2300–2450): fetches from DolarAPI (BCRA data), caches in `dollar_rates` table
9. **Savings goals** (~2450–2600): projections, progress bars
10. **Real-time sync** (~2600–2700): Supabase Realtime channels; re-renders affected section on remote changes
11. **Init** (~2700+): `DOMContentLoaded` bootstrap

### State management

Global `APP` object holds:
- `APP.user` — current Supabase user
- `APP.household` — household ID shared between the two users
- `APP.cache` — in-memory cache keyed by section to avoid redundant fetches
- `APP.currentMonth` / `APP.currentYear` — active period for all money views

### Database (Supabase / PostgreSQL)

11 tables, all protected with Row Level Security scoped to `household_id`:
`households`, `profiles`, `incomes`, `fixed_expenses`, `variable_expenses`, `credit_cards`, `card_summaries`, `card_transactions`, `independent_installments`, `saving_goals`, `dollar_rates`, `imports_log`

RLS policies enforce that users only see data from their own household. Always filter by `household_id` when writing new queries.

### Key conventions

- **No frameworks** — DOM manipulation is direct `innerHTML` / `querySelector`; avoid adding React, Vue, etc.
- **Supabase client** is initialized once at top of `script.js` as `const supabase = supabase.createClient(URL, KEY)`
- **Modal pattern**: all forms live in `<dialog>` elements; open with `.showModal()`, close with `.close()`
- **Theme**: toggled via `document.body.classList.toggle('light-theme')`; preference persisted in `localStorage`
- **Currency**: amounts stored as numbers in the DB; the UI displays Argentine pesos (ARS) with `toLocaleString('es-AR')`
- **Supabase credentials** are hardcoded in `script.js` lines 11–12 (anon/public key — safe for client-side use with RLS)
