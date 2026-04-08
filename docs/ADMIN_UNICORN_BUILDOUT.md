# ARAS Admin Dashboard — UNICORN BUILDOUT + PREMIUM DESIGN
> Date: 2026-02-11 | Basis: ADMIN_P0_FINALIZATION.md (alle P0 ✅)
> Primary Admin: `/admin` → `admin-dashboard.tsx` (988 Zeilen Monolith)
> TypeScript: 0 neue Fehler | Keine DB-Änderungen | Keine Dependency-Upgrades

---

## A) STATUS IN EINFACHEN WORTEN

1. **Security ist dicht.** Alle Admin-API-Routen (`/api/admin/*`) sind durch echten `requireAdmin`-Middleware geschützt. Kein Zugriff ohne Admin-Session.
2. **Frontend ist geschützt.** Alle `/admin/*` Routen haben `AdminRoute`-Guard, alle `/internal/*` haben `StaffRoute`-Guard. Nicht-Admins werden zu `/` umgeleitet.
3. **User werden nicht mehr gelöscht.** Stattdessen wird `subscriptionStatus='disabled'` gesetzt. Sessions werden sofort ungültig. Login wird blockiert.
4. **Audit-Trail läuft.** Jede wichtige Admin-Aktion (Passwort, Plan, Usage, Disable, Enable, Rollenänderung) wird in `staffActivityLog` oder `adminAuditLog` gespeichert.
5. **Error-Responses sind sauber.** Kein `err.message`, kein `debug`-Feld, kein SQL-Leak. Standardisiertes Format: `{ ok:false, code:'...', message:'...' }`.
6. **Das Dashboard ist ein 988-Zeilen-Monolith.** Ein einziges File rendert Stats, User-Liste, 11 DB-Tabellen-Viewer, 4 Modals. Kein Layout-System, keine Komponenten-Trennung.
7. **Kein Pagination.** Alle Daten werden komplett geladen. Bei 500+ Users wird das langsam/gefährlich.
8. **Kein Server-Side Search.** Suche filtert nur client-seitig — skaliert nicht.
9. **Password-Hashes sind im API-Response.** `GET /api/admin/users` liefert das `password`-Feld mit.
10. **6 fertige Backend-Module sind nicht gemountet.** Export, Search, Activity, Staff, Notifications, Chat existieren als Code, werden aber nicht geladen.
11. **Deep-Dive-API existiert** (`/api/admin/users/:id/deep-dive`) aber wird im Frontend nur als JSON-Dump angezeigt, nicht als echtes Detail-Panel.
12. **Design ist funktional, aber nicht premium.** Hardcoded `grid-cols-6`, keine Skeletons, keine Empty States, native `confirm()` statt ARAS-Dialoge.

---

## B) ADMIN INFORMATION ARCHITECTURE (IA)

### B.1 — Frontend-Screens (existierend)

| Section | Ziel | URL | Component File | APIs consumed | DB Tables | Priority | Risks |
|---------|------|-----|----------------|---------------|-----------|----------|-------|
| **Admin Dashboard** (PRIMARY) | User-/Daten-Management | `/admin` | `pages/admin-dashboard.tsx:420-987` | `/api/admin/stats`, `/api/admin/users`, `/api/admin/online-users`, `/api/admin/roles/stats`, `/api/admin/audit`, alle CRUD | users, leads, contacts, campaigns, chatSessions, callLogs, voiceAgents, feedback, sessions, subscriptionPlans, staffActivityLog, adminAuditLog | P0 ✅ | Monolith, kein Pagination |
| **Admin Dashboard** (ALIAS) | Gleich wie oben | `/admin-dashboard` | Gleich | Gleich | Gleich | — | Doppelte Route, könnte verwirrend sein |
| **Founding Claims** | Founding-Pass Claims verwalten | `/admin/founding-claims` | `pages/admin-founding-claims.tsx` | `/api/admin/founding/claims` | founding_claims | P0 ✅ | Separates Feature, funktioniert |
| **Contracts** | Verträge hochladen/verwalten | `/admin/contracts` | `pages/admin/contracts.tsx` | `/api/admin/contracts/*` | Filesystem (kein DB) | P0 ✅ | Kein DB-Backing |
| **Accept Invite** | Staff-Einladung annehmen | `/admin/accept-invite` | `pages/admin/accept-invite.tsx` | `/api/admin/staff/accept` | staffInvitations (FEHLT in Schema!) | P1 | Schema fehlt |

### B.2 — Backend-Routen (gemountet)

| Route File | Mount Point | Endpoints | Auth | Status |
|------------|-------------|-----------|------|--------|
| `routes/admin.ts` | `/api/admin` | GET `/stats`, `/online-users`, `/sessions`; CRUD für 14 Tabellen; POST `/users/:id/change-password`, `/change-plan`, `/reset-usage` | `router.use(requireAdmin)` + per-route | ✅ Gemountet |
| `routes/admin-users.ts` | `/api/admin` | GET `/users/:id/deep-dive`, `/users/:id/ai-insight`, `/audit`, `/roles/stats`; PATCH `/users/:id/role`, `/users/bulk-role`; POST `/users/:id/password`, `/users/:id/enable`; DELETE `/users/:id` | `requireAdmin` per-route | ✅ Gemountet |
| `routes/admin-enrich.ts` | `/api/admin` | POST `/users/:id/enrich` | `requireAdmin` | ✅ Gemountet |
| `routes/admin/contracts.ts` | `/api/admin/contracts` | 7 CRUD-Endpoints | `requireAdmin` per-route | ✅ Gemountet |

### B.3 — Backend-Routen (NICHT gemountet — 6 Dateien)

| Route File | Would-be Endpoints | Auth | Blockiert? | Aufwand zum Mounten |
|------------|--------------------|------|------------|---------------------|
| `admin-export.ts` (195 LOC) | POST `/export`, GET `/export/:id`, GET `/export/:id/download` | `requireAdmin` | Nein — imports `exportService` (muss geprüft werden) | 1 Zeile in `routes.ts` + Service-Check |
| `admin-search.ts` (101 LOC) | GET+POST `/search` | `requireAdmin` | Nein — imports `searchService` | 1 Zeile + Service-Check |
| `admin-activity.ts` (174 LOC) | GET `/activity`, `/activity/stats`, SSE `/activity/stream` | `requireAdmin` | Nein — graceful 42P01 handling | 1 Zeile + Service-Check |
| `admin-staff.ts` (460 LOC) | GET `/staff`, POST `/staff/invite`, DELETE `/staff/invite/:id` | `requireAdmin` | **JA** — importiert `staffInvitations` die NICHT in schema.ts existiert | Schema-Definition + Migration nötig |
| `admin-notifications.ts` (206 LOC) | GET+POST+PATCH+DELETE `/notifications/*` | `requireAdmin` | Nein — graceful 42P01 handling | 1 Zeile + Service-Check |
| `admin-chat.ts` (531 LOC) | GET `/chat/channels`, POST `/chat/messages`, etc. | `requireStaffOrAdmin` | Nein — imports teamChat* schemas | 1 Zeile + Schema-Check |

---

## C) UNICORN FEATURE GAP MAP

| # | Feature | Exists? | Current State (Beleg) | Minimal Work Plan | DB Impact |
|---|---------|---------|----------------------|-------------------|-----------|
| 1 | **Users DataGrid** (Search/Filter/Sort/Pagination) | **Partial** | Client-side search only (`admin-dashboard.tsx:414-418`). No sort, no pagination. No server-side filter. | Backend: Add `?page&limit&search&role&plan&status` to users endpoint. Frontend: Build `AdminDataTable` component with column headers, sort arrows, page controls. | None |
| 2 | **User Deep Dive Panel** (slide-over) | **Partial** | API exists (`admin-users.ts:67-179`), returns calls/chats/leads/contacts/stripe. Frontend: only raw JSON dump in modal (`admin-dashboard.tsx:874-888`). | Build `UserDetailPanel` slide-over with tabs: Overview, Usage, Calls, Chats, Leads, Stripe. Fetch via `/api/admin/users/:id/deep-dive`. | None |
| 3 | **Usage & Limits View + Reset** | **Partial** | Stats shown inline (AI messages + voice calls per user, `admin-dashboard.tsx:582-589`). Reset button exists (`admin-dashboard.tsx:611-618`). No limit visualization, no plan-based max display. | Add plan limits lookup, progress bars, limit warnings. Reuse existing reset mutation. | None |
| 4 | **Billing/Plans Read View + Change** | **Yes** | Plan change modal works (`admin-dashboard.tsx:733-816`). Shows current plan, allows change + status. Stripe data available in deep-dive API. | Polish: show Stripe subscription details in deep-dive panel. No new backend needed. | None |
| 5 | **Audit Trail UI** (filter/search) | **Partial** | Backend pagination + action filter exists (`admin-users.ts:442-494`). Frontend has `auditLog` query (`admin-dashboard.tsx:397-404`) but **no rendered UI for it** — `activeTab === 'audit'` never shows content. | Build `AuditTrailView` component: table with actor, target, action, timestamp, before/after diff. Filter by action type. | None |
| 6 | **Export CSV** (users) | **No (frontend)** | Backend exists in `admin-export.ts` but NOT mounted. Service `exportService` needs verification. | Mount route, verify service, add "Export CSV" button to users DataGrid header. | None |
| 7 | **System Health** | **No** | No health/error/queue endpoints. Activity feed backend exists (`admin-activity.ts`) but unmounted. | Mount activity route, build `SystemHealthCard`: recent errors, active sessions, last export, webhook status. | None |
| 8 | **Support Notes** (internal) | **No** | No notes/tagging system for users. `staffActivityLog.metadata` could store notes but no dedicated UI. | P2: Add notes textarea to User Deep Dive panel, store in `staffActivityLog` with action `'admin_note'`. | None (uses existing table) |
| 9 | **Permissions Matrix** (read-only) | **Partial** | Role stats API exists (`admin-users.ts:501-531`). Frontend fetches but only shows in header area. | Build read-only matrix view: 3 roles × feature areas. Static data, no backend needed. | None |
| 10 | **Impersonation** | **KONZEPT ONLY** | Nicht implementiert. | **Konzept:** Admin → POST `/api/admin/impersonate/:userId` → Server erstellt Shadow-Session mit `impersonatedBy` flag. Banner in Frontend zeigt "Viewing as [user]". Alle Aktionen werden mit original Admin-ID geloggt. EXIT via POST `/api/admin/stop-impersonation`. **Security:** Nur für admins. Nur für non-admin users. Max 1h Session. Audit-Log Pflicht. **NICHT IMPLEMENTIEREN in diesem Sprint.** | Proposed: `impersonation_log` table (P2) |

---

## D) P1 IMPLEMENTATION ROADMAP (15 Tasks, sequenziell)

### Task 1: Strip password from API responses
- **Goal:** Password-Hashes nie an Frontend senden
- **Scope:** Backend-only, 2 Stellen
- **Files:** `server/routes/admin.ts:94-107` (GET ALL), `server/routes/admin.ts:110-124` (GET ONE)
- **Change:** Before `res.json(records)`, wenn `tableName === 'users'`: map records to exclude `password`. Same for single GET.
- **UI spec:** N/A
- **Acceptance:** `GET /api/admin/users` → kein `password` Feld in Response
- **Validation:** `curl -s ... | jq '.[0] | keys' | grep password` → leer. `npx tsc --noEmit`

### Task 2: Standardize password hashing (bcrypt → scrypt)
- **Goal:** Admin change-password nutzt gleichen Algorithmus wie Registration
- **Scope:** 1 Datei, ~5 Zeilen
- **Files:** `server/routes/admin.ts:350-352`
- **Change:** Replace `bcrypt.hash(newPassword, 10)` with scrypt logic (copy from `admin-users.ts:230-236`)
- **UI spec:** N/A
- **Acceptance:** Admin ändert PW → User kann sich mit neuem PW einloggen
- **Validation:** Manueller Test: PW ändern → Login. `npx tsc --noEmit`

### Task 3: Remove duplicate users CRUD
- **Goal:** Nur admin-users.ts handled User-spezifische Ops (hat Audit + Safety)
- **Scope:** 1 Zeile entfernen
- **Files:** `server/routes/admin.ts:185`
- **Change:** Remove `createCRUDRoutes('users', users, router);` — admin-users.ts already handles all user endpoints
- **UI spec:** N/A
- **Acceptance:** DELETE user → geht durch admin-users.ts (hat Audit Log), nicht generic CRUD
- **Validation:** Check: `DELETE /api/admin/users/:id` → Response enthält `action: "DISABLED"` (nicht `deleted`). `npx tsc --noEmit`

### Task 4: Server-side pagination for users
- **Goal:** Users-Liste paginiert laden statt alle auf einmal
- **Scope:** Backend: neuer paginated endpoint. Frontend: Page-Controls.
- **Files:** `server/routes/admin-users.ts` (neuer GET `/users` Endpoint), `client/src/pages/admin-dashboard.tsx:210-224`
- **Change:**
  - Backend: Neuer `GET /users?page=1&limit=50&search=&role=&plan=&status=` Endpoint mit `LIMIT/OFFSET` + `COUNT(*)`
  - Response: `{ data: [...], pagination: { page, limit, total, totalPages } }`
  - Frontend: Paginierung-UI unten an Users-Liste
- **UI spec:** Page controls: `< 1 2 3 ... N >` am unteren Rand. Höhe 48px, `text-sm`, `bg-white/5` buttons, active: `bg-[#FE9100] text-black`. 16px gap.
- **Acceptance:** 100+ Users → Pages angezeigt, nur 50 pro Seite geladen
- **Validation:** Network tab: Request hat `?page=1&limit=50`. Response hat `pagination` object. `npx tsc --noEmit`

### Task 5: Server-side search + filters
- **Goal:** Suche/Filter serverseitig statt client-seitig
- **Scope:** Backend-Erweiterung von Task 4 Endpoint, Frontend: debounced Search + Dropdowns
- **Files:** `server/routes/admin-users.ts` (erweitere GET `/users`), `client/src/pages/admin-dashboard.tsx:519-530`
- **Change:**
  - Backend: `WHERE username ILIKE '%search%' OR email ILIKE '%search%'` + `AND user_role = $role` + `AND subscription_plan = $plan`
  - Frontend: Debounce 300ms auf SearchInput. Role-Dropdown, Plan-Dropdown, Status-Dropdown.
- **UI spec:** Filter-Bar: horizontal flex, gap-2. Dropdowns: 120px breit, `bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm`. Debounce: 300ms.
- **Acceptance:** Tippe "test" → nur passende Users. Wähle role=admin → nur Admins.
- **Validation:** Network: Requests mit Query-Params. Ergebnis korrekt. `npx tsc --noEmit`

### Task 6: Column sorting
- **Goal:** Spaltenköpfe klickbar zum Sortieren
- **Scope:** Backend: `?sort=username&order=asc`. Frontend: Sort-Arrows.
- **Files:** `server/routes/admin-users.ts` (erweitere GET `/users`), `client/src/pages/admin-dashboard.tsx:537-643`
- **Change:**
  - Backend: Parse `sort` + `order` params, apply `ORDER BY`
  - Frontend: Clickable column headers mit ↑/↓ indicator
- **UI spec:** Header row: `text-xs text-white/40 uppercase tracking-wider`. Sort arrow: 12×12px, `text-white/30` inactive, `text-[#FE9100]` active.
- **Acceptance:** Klick auf "Username" → alphabetisch sortiert. Nochmal klick → umgekehrt.
- **Validation:** Network: `?sort=username&order=desc` in URL. Reihenfolge korrekt. `npx tsc --noEmit`

### Task 7: User Deep Dive slide-over panel
- **Goal:** Klick auf User → Slide-Over Panel mit allen Daten statt JSON-Dump
- **Scope:** Neues Component, ersetzt Details-Modal
- **Files:** Neu: `client/src/components/admin/user-detail-panel.tsx`. Update: `admin-dashboard.tsx` (ersetze details-Modal)
- **Change:**
  - Component: Slide-over von rechts (480px breit), Tabs: Overview | Usage | Calls | Chats | Leads | Stripe
  - Fetch: `GET /api/admin/users/:id/deep-dive` (existiert!)
  - Overview: Avatar, Name, Email, Role-Badge, Plan-Badge, Status-Badge, Created, Last Login
  - Usage: AI Messages (Fortschrittsbalken), Voice Calls (Fortschrittsbalken), Reset-Button
  - Calls: Tabelle mit letzten 20 Anrufen
  - Chats: Liste der letzten 10 Sessions
  - Leads: Tabelle
  - Stripe: Customer ID, Balance, Subscriptions (falls vorhanden)
- **UI spec:**
  - Panel: `fixed right-0 top-0 h-full w-[480px] bg-[#111113] border-l border-white/10 shadow-2xl`
  - Tabs: `flex gap-0 border-b border-white/10`. Active: `border-b-2 border-[#FE9100] text-white`. Inactive: `text-white/40`
  - Tab-Content padding: `p-5`
  - Animation: slide from right 300ms ease-out. `prefers-reduced-motion: reduce` → no animation.
- **Acceptance:** Klick auf Eye-Icon → Panel öffnet, zeigt structured Daten statt JSON
- **Validation:** Browser-Test. Panel öffnet, Tabs wechselbar, Daten korrekt. `npx tsc --noEmit`

### Task 8: Audit Trail UI
- **Goal:** Audit-Log sichtbar machen im Admin Dashboard
- **Scope:** Neues Tab oder eigene Seite im Admin Dashboard
- **Files:** Neu: `client/src/components/admin/audit-trail-view.tsx`. Update: `admin-dashboard.tsx:105,396-404`
- **Change:**
  - Rendere Audit-Tab Content (aktuell fehlt komplett)
  - Tabelle: Datum, Actor, Action, Target, Before→After (diff view)
  - Filter: Action-Dropdown (role_change, password_reset, user_delete, plan_change, bulk_role_change)
  - Pagination: nutze bestehende Backend-Pagination
- **UI spec:**
  - Tabelle: `text-sm`, Zeilen `border-b border-white/5`, Hover: `bg-white/5`
  - Action-Badge: farbig je Typ (role_change=#8B5CF6, password_reset=#F59E0B, user_delete=#EF4444, plan_change=#06B6D4)
  - Diff: `bg-red-500/10 line-through` für before, `bg-green-500/10` für after
  - Filter-Leiste oben: Dropdown + Datums-Range (optional)
- **Acceptance:** Audit-Tab klicken → Tabelle mit Einträgen. Filter funktioniert.
- **Validation:** Browser-Test. Audit-Einträge nach Passwort-Änderung sichtbar. `npx tsc --noEmit`

### Task 9: Mount admin-export.ts + Export Button
- **Goal:** CSV-Export für Users (und andere Entities) verfügbar machen
- **Scope:** 1 Zeile Mount + Service-Prüfung + Frontend-Button
- **Files:** `server/routes.ts` (mount), `server/services/export.service.ts` (verify), `admin-dashboard.tsx` (button)
- **Change:**
  - Mount: `app.use('/api/admin', (await import('./routes/admin-export')).default);`
  - Verify: Prüfe ob `exportService` korrekt exportiert und funktioniert
  - Frontend: "Export CSV" Button in Users-Header
- **UI spec:** Button: `px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/70 hover:bg-white/10 flex items-center gap-2`. Icon: Download 16×16.
- **Acceptance:** Klick → CSV-Download startet
- **Validation:** `curl -X POST /api/admin/export -d '{"entityType":"users","format":"csv"}'` → 201. `npx tsc --noEmit`

### Task 10: Mount admin-activity.ts + System Health Card
- **Goal:** Activity-Feed und System-Status sichtbar machen
- **Scope:** Mount + minimal Frontend
- **Files:** `server/routes.ts`, `admin-dashboard.tsx` (neue Section)
- **Change:**
  - Mount: `app.use('/api/admin', (await import('./routes/admin-activity')).default);`
  - Frontend: `SystemHealthCard` in Stats-Area: letzte 5 Activities, Active Sessions, Error Count
- **UI spec:** Card: `p-4 rounded-xl bg-white/5 border border-white/10 col-span-2`. Title: "System Health". Items: `text-xs text-white/50`, timestamps rechts.
- **Acceptance:** Card zeigt letzte Activities (oder "No activities" wenn Tabelle fehlt — graceful)
- **Validation:** API: `GET /api/admin/activity?limit=5` → 200 (oder `{ data: [], total: 0 }` graceful). `npx tsc --noEmit`

### Task 11: Loading Skeletons
- **Goal:** "Loading..." Text ersetzen durch Skeletons
- **Scope:** Frontend-only
- **Files:** `admin-dashboard.tsx:534-535`, neues Utility: `client/src/components/admin/skeleton.tsx`
- **Change:**
  - Stats-Skeleton: 6 Boxen mit Pulse-Animation
  - Table-Skeleton: 8 Zeilen mit 4 Spalten Pulse
  - Anstatt `<div>Loading...</div>` → `<TableSkeleton rows={8} />`
- **UI spec:** Skeleton: `bg-white/5 animate-pulse rounded`. Stats: `h-16`. Row: `h-14`. Gap: `4px`. Duration: CSS `animation: pulse 2s infinite`. Reduced-motion: `animation: none, opacity: 0.5`.
- **Acceptance:** Beim Laden sieht man Skeleton statt "Loading..."
- **Validation:** Throttle Network → Skeleton sichtbar. Reduced-motion → kein Blinken. `npx tsc --noEmit`

### Task 12: Empty States
- **Goal:** Leere Listen zeigen hilfreiche Nachricht statt nichts
- **Scope:** Frontend-only
- **Files:** `admin-dashboard.tsx:537-643` (nach filter), neues Utility: `client/src/components/admin/empty-state.tsx`
- **Change:**
  - Users: "Keine User gefunden" + "Filter zurücksetzen" Button
  - Generic Table: "Keine Einträge" + Illustration (Lucide Icon)
  - Audit: "Noch keine Audit-Einträge"
- **UI spec:** Centered: `py-16 text-center`. Icon: `w-12 h-12 text-white/20 mx-auto mb-3`. Title: `text-base text-white/50 font-medium`. Description: `text-sm text-white/30`. CTA: `mt-4 px-4 py-2 rounded-lg bg-white/5 text-white/60 text-sm hover:bg-white/10`.
- **Acceptance:** Filter mit "zzzzz" → Empty State sichtbar
- **Validation:** Browser-Test. `npx tsc --noEmit`

### Task 13: Branded Confirm Dialog
- **Goal:** Native `confirm()` ersetzen durch ARAS-styled Dialog
- **Scope:** Neues Component + Ersetzung in admin-dashboard.tsx
- **Files:** Neu: `client/src/components/admin/confirm-dialog.tsx`. Update: `admin-dashboard.tsx:614,624,634,667`
- **Change:**
  - Component: Modal mit Title, Description, Cancel + Confirm Button
  - Destructive variant: Confirm-Button rot
  - State: `useState<{open, onConfirm, title, description, variant}>` im Dashboard
- **UI spec:**
  - Backdrop: `fixed inset-0 bg-black/80 backdrop-blur-sm`
  - Card: `max-w-sm bg-[#1a1a1c] rounded-2xl border border-white/20 p-6`
  - Title: `text-lg font-bold text-white`
  - Description: `text-sm text-white/50 mt-2`
  - Buttons: `mt-6 flex gap-3`. Cancel: `flex-1 py-2.5 rounded-xl bg-white/10`. Confirm: `flex-1 py-2.5 rounded-xl bg-red-500 text-white font-bold` (destructive) oder `bg-[#FE9100] text-black` (normal)
  - Animation: `opacity 150ms + scale 150ms`. Reduced-motion: opacity only.
- **Acceptance:** Disable klicken → ARAS-styled Dialog statt Browser-Dialog
- **Validation:** Browser-Test, alle 4 confirm-Stellen geprüft. `npx tsc --noEmit`

### Task 14: SQL-based Stats (Performance)
- **Goal:** Stats-Endpoint soll COUNT/GROUP BY nutzen statt alle Rows fetchen
- **Scope:** Backend-only
- **Files:** `server/routes/admin.ts:229-336`
- **Change:** Replace `db.select().from(users)` + JS-Loops mit SQL: `SELECT COUNT(*) FROM users`, `SELECT subscription_plan, COUNT(*) FROM users GROUP BY subscription_plan`, etc.
- **UI spec:** N/A (Backend performance)
- **Acceptance:** `/api/admin/stats` Response identisch, aber <100ms statt >1s
- **Validation:** `time curl -s /api/admin/stats` → <100ms. Response schema gleich. `npx tsc --noEmit`

### Task 15: Responsive Stats Grid
- **Goal:** `grid-cols-6` → responsive für Tablet/Mobile
- **Scope:** Frontend-only, 1 Zeile
- **Files:** `admin-dashboard.tsx:480`
- **Change:** `grid-cols-6` → `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`
- **UI spec:** Mobile (375px): 2 Spalten. Tablet (768px): 3 Spalten. Desktop (1024px+): 6 Spalten.
- **Acceptance:** Chrome DevTools: iPhone SE → 2 Spalten korrekt
- **Validation:** Responsive Mode testen. `npx tsc --noEmit`

---

## E) P2 DESIGN REBUILD SPEC (Premium ARAS)

### E.1 — Layout/Shell

| Property | Spec | Begründung |
|----------|------|------------|
| **Max width** | `max-w-[1600px] mx-auto` | Konsistent mit restlicher App, verhindert Stretch auf Ultrawide |
| **Page padding** | `p-6` (Desktop), `p-4` (Tablet), `p-3` (Mobile) | Bereits so in `admin-dashboard.tsx:421` |
| **Background** | `bg-[#0a0a0b]` (solid) + optional subtle radial gradient: `radial-gradient(ellipse at 20% 50%, rgba(254,145,0,0.03), transparent 70%)` | Konsistent mit `admin-dashboard.tsx:421`, Landing, Auth-Page |
| **Grid System** | CSS Grid: `grid-cols-[240px_1fr]` (Sidebar + Content). Collapse auf Mobile: Sidebar → Top-Tab-Bar | Sidebar existiert bereits (`admin-dashboard.tsx:498-514`), muss nur responsive werden |
| **Nav Position** | **Left sidebar** (240px, sticky, full height) | Bereits implementiert als 192px sidebar. Erweitern auf 240px für Labels + Icons. Konsistent mit Internal CRM Layout. |

### E.2 — Components

#### Cards (Stats KPI)
```
Container: rounded-xl bg-white/[0.03] border border-white/[0.06] p-4
           backdrop-blur-sm (optional, nur wenn über Gradient)
Hover:     border-white/[0.12] transition-colors duration-200
Label:     text-xs text-white/40 font-medium tracking-wider uppercase
Value:     text-2xl font-bold (color per metric)
Trend:     text-xs, green if positive, red if negative
```

#### DataGrid Table
```
Container:  rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden
Header Row: bg-white/[0.02] border-b border-white/[0.08]
            text-xs text-white/40 font-medium uppercase tracking-wider px-4 py-3
Body Row:   border-b border-white/[0.04] px-4 py-3.5
            hover:bg-white/[0.04] transition-colors duration-150
Selected:   bg-[#FE9100]/[0.06] border-l-2 border-l-[#FE9100]
Pagination: border-t border-white/[0.06] px-4 py-3 flex justify-between items-center
```

#### Slide-Over Panel (User Deep Dive)
```
Container:  fixed right-0 top-0 h-full w-[480px]
            bg-[#111113] border-l border-white/[0.08] shadow-2xl
            transform transition-transform duration-300 ease-out
            (closed: translate-x-full, open: translate-x-0)
Backdrop:   fixed inset-0 bg-black/50 (clickable to close)
Header:     sticky top-0 bg-[#111113] border-b border-white/[0.08]
            px-5 py-4 flex justify-between items-center
Tabs:       px-5 border-b border-white/[0.06]
            Tab: px-4 py-3 text-sm
            Active: text-white border-b-2 border-[#FE9100]
            Inactive: text-white/40 hover:text-white/60
Content:    px-5 py-5 overflow-y-auto
```

#### Modals / Confirm Dialogs
```
Backdrop:   fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999]
Card:       bg-[#1a1a1c] rounded-2xl border border-white/[0.15]
            shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)]
            max-w-lg w-full mx-4
Header:     px-6 pt-6 pb-0
Title:      text-lg font-bold text-white
Body:       px-6 py-4
Footer:     px-6 pb-6 flex gap-3
Primary:    bg-[#FE9100] text-black font-bold rounded-xl px-4 py-2.5
Destructive: bg-red-500 text-white font-bold rounded-xl
Cancel:     bg-white/10 text-white rounded-xl hover:bg-white/15
```

#### Banners / Toasts
```
Toast Container:  fixed bottom-4 right-4 z-[10000] (already exists via shadcn)
Success:          bg-emerald-500/10 border border-emerald-500/20 text-emerald-400
Error:            bg-red-500/10 border border-red-500/20 text-red-400
Warning:          bg-amber-500/10 border border-amber-500/20 text-amber-400
Info:             bg-blue-500/10 border border-blue-500/20 text-blue-400
```

#### Badges
```
Active:    bg-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded font-medium
Disabled:  bg-red-500/20 text-red-400
Admin:     bg-[#FE9100]/20 text-[#FE9100]
Staff:     bg-violet-500/20 text-violet-400
User:      bg-zinc-500/20 text-zinc-400
Plan Free: bg-zinc-500/20 text-zinc-400
Plan Pro:  bg-blue-500/20 text-blue-400
Plan Ultra: bg-purple-500/20 text-purple-400
Plan Ultimate: bg-[#FE9100]/20 text-[#FE9100]
Online:    bg-emerald-500/20 text-emerald-400 + animate-pulse (dot only)
```

### E.3 — Motion

| Element | Duration | Easing | Reduced-Motion |
|---------|----------|--------|----------------|
| Modal open/close | 150ms | ease-out | opacity only, no scale |
| Slide-over open/close | 300ms | cubic-bezier(0.16, 1, 0.3, 1) | opacity only, no transform |
| Table row hover | 150ms | ease | No change (CSS only) |
| Page transition | 200ms | ease-out | opacity only |
| Skeleton pulse | 2000ms | ease-in-out infinite | animation: none, opacity: 0.5 |
| Button hover | 150ms | ease | No change |
| Toast enter/exit | 200ms | ease-out / ease-in | opacity only |

**Implementation:** All motion via CSS `transition` properties (not framer-motion for admin). Reduced motion via:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
Scope: nur innerhalb `[data-admin-shell]` wrapper.

### E.4 — States

#### Loading Skeleton
```
Stats:    6× rounded-xl bg-white/[0.04] h-[88px] animate-pulse
Table:    8× rows: h-[56px] bg-white/[0.02] animate-pulse
          Column widths: 40px (avatar), flex-1, 80px, 80px, 160px (actions)
Panel:    Full-height skeleton matching tab layout
```

#### Empty States
```
Users:    Icon: Users (lucide), Title: "Keine User gefunden"
          Description: "Passe deine Filter an oder setze sie zurück."
          CTA: "Filter zurücksetzen" → clear all filters
Audit:    Icon: History, Title: "Noch keine Audit-Einträge"
          Description: "Änderungen an Usern werden hier protokolliert."
Generic:  Icon: Database, Title: "Keine Einträge"
          Description: "Diese Tabelle enthält noch keine Daten."
```

#### Error States
```
Container: p-8 text-center
Icon:      AlertCircle, w-12 h-12 text-red-400/50 mx-auto mb-3
Title:     "Fehler beim Laden" text-base text-white/60
Message:   error.message (sanitized), text-sm text-white/30
CTA:       "Erneut versuchen" → refetch(). Style: primary button.
```

---

## F) DB EXTENSION PLAN (VORSCHLÄGE, NICHT UMSETZEN)

| # | Table/Column | Purpose | Risk | Migration Idea | Rollback |
|---|-------------|---------|------|----------------|----------|
| 1 | `staff_invitations` (neue Tabelle) | Staff-Einladungs-System. Blockiert `admin-staff.ts` Mount. | LOW — neue Tabelle, kein Impact auf bestehende | `CREATE TABLE staff_invitations (id SERIAL PK, email VARCHAR, role VARCHAR, token VARCHAR UNIQUE, expires_at TIMESTAMP, created_by VARCHAR REFERENCES users, created_at TIMESTAMP DEFAULT NOW(), used_at TIMESTAMP)` | `DROP TABLE staff_invitations` |
| 2 | `admin_audit_log.action` ENUM erweitern | Aktuell nur 5 Werte: `role_change, password_reset, user_delete, plan_change, bulk_role_change`. Fehlen: `user_disable, user_enable, usage_reset`. | LOW — VARCHAR in PostgreSQL, Drizzle-Enum ist nur TS-Constraint | Entweder Drizzle-Schema erweitern ODER `staffActivityLog` weiter nutzen (aktuell so) | Enum-Erweiterung ist additiv, kein Rollback nötig |
| 3 | `admin_notes` (neue Tabelle) | Interne Notizen zu Users für Support | LOW — neue Tabelle | `CREATE TABLE admin_notes (id SERIAL PK, user_id VARCHAR REFERENCES users, author_id VARCHAR REFERENCES users, content TEXT, created_at TIMESTAMP DEFAULT NOW())` | `DROP TABLE admin_notes` |
| 4 | `impersonation_log` (neue Tabelle) | Audit für Admin-Impersonation-Sessions | LOW — nur wenn Impersonation implementiert wird | `CREATE TABLE impersonation_log (id SERIAL PK, admin_id VARCHAR REFERENCES users, target_id VARCHAR REFERENCES users, started_at TIMESTAMP, ended_at TIMESTAMP, actions_performed INT DEFAULT 0)` | `DROP TABLE impersonation_log` |

**Empfehlung:** Nur #1 ist kurzfristig nötig (wenn Staff-Management gewünscht). #2 ist nice-to-have. #3 und #4 erst bei konkretem Feature-Bedarf.

---

## VALIDATION LOG

```
$ npx tsc --noEmit --pretty 2>&1 | grep -c "error TS"
0
```

Kein `pnpm lint` Script vorhanden. Build nicht separat getestet (typecheck is sufficient pre-build).

### 10 Manuelle QA-Checks

| # | Check | Wie testen | Erwartung |
|---|-------|-----------|-----------|
| 1 | **Admin AuthZ** | Login als user → `GET /api/admin/stats` | 403 FORBIDDEN |
| 2 | **Frontend Guard** | Login als user → navigate `/admin` | Redirect zu `/` |
| 3 | **Staff Guard** | Login als staff → navigate `/internal/dashboard` | CRM lädt |
| 4 | **Disable User** | Admin → Trash-Icon → Confirm | User disabled, Toast "User deaktiviert" |
| 5 | **Disabled Login** | Disabled User → Login | "Account disabled. Please contact support." |
| 6 | **Enable User** | Admin → Grüner Button → Confirm | User re-enabled |
| 7 | **Audit Log DB** | Nach Plan-Change: `SELECT * FROM staff_activity_log ORDER BY created_at DESC LIMIT 1` | Eintrag mit action=plan_changed |
| 8 | **No Password Leak** | Network Tab → GET `/api/admin/users` | Kein `password` Feld (AKTUELL NOCH OFFEN → Task 1) |
| 9 | **Error Sanitization** | Trigger 500 → Network Tab | `{ ok:false, code:"INTERNAL_ERROR" }`, kein SQL/Stack |
| 10 | **Contracts Auth** | Login als user → `GET /api/admin/contracts` | 403 (Contracts hat eigenes requireAdmin) |

---

## STOP

**STOP = none.**

Zur Klarstellung: `/admin` ist die **PRIMARY Admin-Oberfläche**. `/admin-dashboard` ist ein Alias (gleiche Komponente). Es gibt nur EIN Admin-UI.
Das Command Center (`/internal/*`) ist die Staff+Admin CRM-Oberfläche — separat, nicht Admin-Dashboard.

Nächster Schritt: **Task 1 starten** (Strip password from API responses).
