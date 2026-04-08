# ARAS Admin Dashboard — P0 HARDEN + QA + PREMIUM READINESS
> Date: 2026-02-11 | TypeScript: 0 new errors | No DB changes | No dependency changes

---

## 1) WO WIR STEHEN (10 Bullets)

1. **Backend AuthZ gefixt:** Die no-op `requireAdmin` Stub-Funktion (`admin.ts:19-23`) wurde gelöscht und durch den echten Import aus `middleware/admin.ts` ersetzt. Zusätzlich: `router.use(requireAdmin)` als Defense-in-Depth auf Router-Level.
2. **Frontend Guards aktiv:** Neue `AdminRoute` und `StaffRoute` Komponenten (`client/src/components/admin-route.tsx`) wrappen alle `/admin/*` und `/internal/*` Routen in `App.tsx:207-243`. Non-admin → Redirect zu `/`.
3. **Delete → Disable:** Der DELETE-Handler (`admin-users.ts:537-600`) setzt jetzt `subscriptionStatus='disabled'` statt `DELETE FROM users`. Keine FK-Constraint-Fehler mehr. Sessions werden sofort invalidiert.
4. **Login-Block für disabled Accounts:** `simple-auth.ts:228-229` prüft `subscriptionStatus === 'disabled'` und gibt klare Fehlermeldung zurück.
5. **Enable-Endpoint existiert:** `POST /api/admin/users/:userId/enable` (`admin-users.ts:607-645`) setzt Status zurück auf `active`.
6. **Audit Trail aktiv:** Alle P0-Admin-Aktionen (password_changed, plan_changed, usage_reset, user_disabled, user_enabled) schreiben in `staffActivityLog`.
7. **Error-Responses sanitized:** Alle 12 catch-Blöcke in `admin.ts` geben jetzt `{ ok:false, code:'INTERNAL_ERROR', message:'...' }` zurück statt `error.message`.
8. **Middleware-Leaks gefixt:** `requireAdmin` und `requireStaffOrAdmin` geben keine `debug`-Felder (username/role) oder `err.message` mehr ans Frontend.
9. **Contracts Router sicher:** Alle 7 Endpoints in `admin/contracts.ts` haben individuell `requireAdmin` — kein Leck durch Mounting-Reihenfolge.
10. **TypeScript clean:** `npx tsc --noEmit` = 0 neue Fehler. Alle Änderungen sind rückwärtskompatibel.

---

## 2) QA MATRIX (24 Tests)

### A) Security / AuthZ

| ID | Persona | Action | Endpoint/Route | Erwartetes Ergebnis | Wie prüfen | Risk if fails |
|----|---------|--------|----------------|---------------------|------------|---------------|
| A1 | anon (no session) | GET stats | `GET /api/admin/stats` | 401 `No session` | curl ohne Cookie | Komplette Admin-API offen |
| A2 | user (role=user) | GET stats | `GET /api/admin/stats` | 403 `FORBIDDEN` | Login als user, dann curl mit Cookie | User sieht alle Plattform-Daten |
| A3 | user | navigate /admin | Browser `/admin` | Redirect zu `/` | Browser als user-role | User sieht Admin-UI |
| A4 | staff | navigate /admin | Browser `/admin` | Redirect zu `/` | Login als staff, navigate | Staff sieht Admin-only Panel |
| A5 | staff | navigate /internal/dashboard | Browser `/internal/dashboard` | 200, CRM lädt | Login als staff | Staff CRM blockiert |
| A6 | user | navigate /internal/dashboard | Browser `/internal/dashboard` | Redirect zu `/` | Login als user | User sieht internes CRM |
| A7 | admin | GET stats | `GET /api/admin/stats` | 200 + stats JSON | Login als admin, curl | Admin kann nicht arbeiten |
| A8 | admin | navigate /admin | Browser `/admin` | Dashboard lädt | Browser als admin | Admin kann nicht arbeiten |
| A9 | admin | GET /api/admin/users | `GET /api/admin/users` | 200 + user array | curl als admin | User-Management kaputt |
| A10 | user | POST change-plan | `POST /api/admin/users/:id/change-plan` | 403 | curl als user | User ändert eigenen Plan |

### B) Disable/Enable Flow

| ID | Persona | Action | Endpoint/Route | Erwartetes Ergebnis | Wie prüfen | Risk if fails |
|----|---------|--------|----------------|---------------------|------------|---------------|
| B1 | admin | Disable user | `DELETE /api/admin/users/:userId` | `{ success:true, action:"DISABLED" }` | curl als admin | Disable funktioniert nicht |
| B2 | disabled user | Login | `POST /api/login` | 401 `Account disabled` | Login mit disabled user credentials | Disabled user kann weiter arbeiten |
| B3 | admin | Disable self | `DELETE /api/admin/users/:ownId` | 400 `Cannot disable yourself` | curl mit eigenem userId | Admin sperrt sich selbst aus |
| B4 | admin | Disable other admin | `DELETE /api/admin/users/:adminId` | 400 `Cannot disable an admin` | curl mit anderem Admin userId | Admin-Account deaktiviert |
| B5 | admin | Enable user | `POST /api/admin/users/:userId/enable` | `{ success:true, action:"ENABLED" }` | curl als admin | User bleibt gesperrt |
| B6 | re-enabled user | Login | `POST /api/login` | 200 + user data | Login nach Enable | User kann nicht zurück |
| B7 | admin | Disable user (UI) | Admin Dashboard Trash-Icon | Confirm Dialog → success toast | Browser klicken | UI-Flow kaputt |
| B8 | admin | Session check | Nach Disable: alter Cookie | 401 oder neue Request scheitert | User-Browser bleibt offen | Disabled user bleibt eingeloggt |

### C) Audit Logs

| ID | Persona | Action | Endpoint/Route | Erwartetes Ergebnis | Wie prüfen | Risk if fails |
|----|---------|--------|----------------|---------------------|------------|---------------|
| C1 | admin | Change password | `POST /api/admin/users/:id/change-password` | staffActivityLog: action=password_changed | SQL: `SELECT * FROM staff_activity_log ORDER BY created_at DESC LIMIT 1` | Kein Audit Trail |
| C2 | admin | Change plan | `POST /api/admin/users/:id/change-plan` | staffActivityLog: action=plan_changed | SQL query | Planänderungen nicht nachvollziehbar |
| C3 | admin | Reset usage | `POST /api/admin/users/:id/reset-usage` | staffActivityLog: action=usage_reset | SQL query | Usage-Resets unsichtbar |
| C4 | admin | Disable user | `DELETE /api/admin/users/:userId` | staffActivityLog: action=user_disabled | SQL query | Deaktivierung nicht geloggt |

### D) UX States

| ID | Persona | Action | Endpoint/Route | Erwartetes Ergebnis | Wie prüfen | Risk if fails |
|----|---------|--------|----------------|---------------------|------------|---------------|
| D1 | admin | Dashboard load | `/admin` | Stats + User-Liste laden | Browser | Leere/kaputte Seite |
| D2 | admin | Error response | Trigger 500 (z.B. DB down) | Toast mit generischer Nachricht, KEIN raw SQL | Network tab | DB-Fehler an Client geleakt |
| D3 | admin | Disable confirm | Trash-Icon klicken | "Disable this user? Login will be blocked..." | Browser | Verwirrende "Delete" Warnung |
| D4 | admin | Disabled user badge | User mit status=disabled | Grüner Re-enable Button statt roter Trash | Browser | Admin erkennt disabled User nicht |

---

## 3) SECURITY SWEEP FINDINGS

### Gefixed in dieser Session

| # | Severity | Finding | Location | Fix |
|---|----------|---------|----------|-----|
| F1 | **CRITICAL** | `requireAdmin` no-op stub | `admin.ts:19-23` (alt) | Gelöscht, echter Import + `router.use(requireAdmin)` |
| F2 | **CRITICAL** | Keine Frontend-Guards | `App.tsx:206-210` (alt) | `AdminRoute` + `StaffRoute` Wrapper |
| F3 | **CRITICAL** | Hard DELETE → FK crash | `admin-users.ts:553-554` (alt) | Soft-disable via `subscriptionStatus='disabled'` |
| F4 | **HIGH** | `debug: { username, role }` in 403 | `middleware/admin.ts:47` (alt) | Entfernt, standardisierte Response |
| F5 | **HIGH** | `debug: { username, role }` in Staff 403 | `middleware/admin.ts:93` (alt) | Entfernt in dieser Finalization |
| F6 | **HIGH** | `err.message` in 500 responses | `middleware/admin.ts:63,104` (alt) | Generische Messages statt raw errors |
| F7 | **HIGH** | Alle 12 catch-Blöcke leakten `error.message` | `admin.ts` (alle Handler) | Sanitized zu `{ ok:false, code, message }` |
| F8 | **MEDIUM** | Kein Audit Trail für plan/pw/usage | `admin.ts` change-plan/pw/reset | `logAdminAction()` Helper + Logging |

### Verbleibende Risiken (nicht P0-blocking)

| # | Severity | Finding | Location | Empfehlung |
|---|----------|---------|----------|------------|
| R1 | **MEDIUM** | Password hashing inkonsistent: `admin.ts:351` nutzt bcrypt, `admin-users.ts:229` nutzt scrypt | Beide Dateien | P1: Standardisieren auf scrypt (Systemstandard) |
| R2 | **MEDIUM** | Generic CRUD POST/PATCH ohne Input-Validation | `admin.ts:127-163` | P1: Zod-Schemas pro Tabelle |
| R3 | **MEDIUM** | Users-Liste returned password hashes | `admin.ts:94-107` (createCRUDRoutes) | P1: Column-Selection, `password` excluden |
| R4 | **MEDIUM** | Unbounded SELECTs (keine Pagination) | `admin.ts:94-107` alle CRUD GETs | P1: LIMIT/OFFSET + ?page&limit params |
| R5 | **LOW** | Stats-Endpoint fetcht ALLE users in Memory | `admin.ts:259` | P1: SQL COUNT/GROUP BY statt JS |
| R6 | **LOW** | 6 Route-Files unmounted (dead code) | admin-staff, admin-search, admin-export, admin-notifications, admin-activity, n8n-admin | P1: Mounten oder entfernen |

---

## 4) REMAINING P0 TODOs

Alle CRITICAL P0 sind erledigt. **Keine verbleibenden P0-Blocker.**

| # | Priority | Item | Risk | Status |
|---|----------|------|------|--------|
| — | P0 | No-op requireAdmin | CRITICAL | ✅ DONE |
| — | P0 | Frontend admin guard | CRITICAL | ✅ DONE |
| — | P0 | Delete → Disable | CRITICAL | ✅ DONE |
| — | P0 | Login block disabled | HIGH | ✅ DONE |
| — | P0 | Audit trail P0 actions | HIGH | ✅ DONE |
| — | P0 | Response sanitization | HIGH | ✅ DONE |
| — | P0 | requireStaffOrAdmin debug leak | HIGH | ✅ DONE |
| 1 | P0.5 | Standardize password hashing (bcrypt→scrypt in admin.ts:351) | MEDIUM | OPEN — 1 line fix, low risk |
| 2 | P0.5 | Strip `password` field from users list response | MEDIUM | OPEN — map response |

---

## 5) P1/P2 ROADMAP

### P1 — Funktionalität (Admin SaaS Standard)

| Priority | Item | Why | UI Components | Backend needs | DB needs | Validation |
|----------|------|-----|---------------|---------------|----------|------------|
| P1 | Pagination für alle Listen | Unbounded SELECTs → OOM bei Scale | `AdminDataTable` mit page/limit controls | `?page=1&limit=50` params, `COUNT(*)` | None | 1000+ users paginiert in <200ms |
| P1 | Column-Selection (kein password) | Password-Hashes im API-Response | — (Backend only) | `.select({ id, username, email, ... })` statt `select()` | None | GET /api/admin/users → kein password-Feld |
| P1 | Input Validation (Zod) | Raw req.body → Drizzle insert | — | Zod-Schemas pro Tabelle für POST/PATCH | None | POST mit invalid data → 400 |
| P1 | Stats via SQL Aggregation | 8 full table scans alle 30s | — | `COUNT(*)`, `GROUP BY`, `SUM()` | None | /stats in <100ms statt 2s |
| P1 | User Detail Panel | Kein Deep-Dive in Admin UI | `UserDetailSlideOver` mit Tabs | Existiert: `/users/:id/deep-dive` | None | Panel öffnet, zeigt alle Daten |
| P1 | Search + Filter (server-side) | Client-side filter skaliert nicht | `SearchBar` + `FilterDropdowns` | `?search=...&role=...&plan=...` | None | Suche funktioniert bei 10k users |
| P1 | Export CSV | Feature existiert aber unmounted | `ExportButton` | Mount `admin-export.ts` | None | CSV Download funktioniert |
| P1 | Mount admin-staff.ts | Staff-Management nicht erreichbar | — | Fix `staffInvitations` import, mount route | Prüfe ob Tabelle existiert | Staff invite flow funktioniert |
| P1 | System Health Dashboard | Keine Error/Webhook-Sichtbarkeit | `SystemHealthCard` | Neuer `/api/admin/health` endpoint | None (P1-only) | Admin sieht System-Status |
| P1 | Impersonation (Konzept) | Admin kann User-Probleme nicht debuggen | `ImpersonateBanner` | Shadow session + audit | `impersonation_log` table | NUR KONZEPT in P1 |

### P2 — Design Upgrade (Premium ARAS)

| Priority | Item | Why | UI Components | Backend needs | DB needs | Validation |
|----------|------|-----|---------------|---------------|----------|------------|
| P2 | Admin Shell Layout | Kein shared Layout, 953-line Monolith | `AdminLayout`, `AdminSidebar`, `AdminTopBar` | None | None | Sidebar + Content + Breadcrumbs |
| P2 | AdminDataTable (universal) | Jede Tabelle eigener Render-Code | `AdminDataTable` mit sort/filter/select | Pagination API (P1) | None | Sortierbare, filterbare Tabelle |
| P2 | Loading Skeletons | Plain "Loading..." Text | `TableSkeleton`, `StatsSkeleton` | None | None | Skeleton statt Text |
| P2 | Empty States | Leere Liste = nichts | `EmptyState` mit Illustration + CTA | None | None | Hilfreiche Nachricht bei 0 Einträgen |
| P2 | Error Boundaries | Silent fails | `AdminErrorBoundary` | None | None | Fehlermeldung + Retry Button |
| P2 | Branded Confirm Dialog | Native `confirm()` | `ConfirmDialog` Component | None | None | ARAS-styled Confirm Modal |
| P2 | Toast Standardisierung | Inkonsistente Toast-Nutzung | Standardisierte Toast-Variants | None | None | Einheitliche Erfolg/Fehler Toasts |
| P2 | Subtle Motion | Keine Transitions | Page/modal/table animations | None | None | 200ms transitions + reduced-motion |
| P2 | Dark Glass Morphism | Flat/inkonsistentes Styling | ARAS CI: `#FE9100`, glass cards, Orbitron | None | None | Premium ARAS Design |
| P2 | Responsive Admin | Hardcoded grid-cols-6 | Responsive breakpoints | None | None | Tablet/Mobile funktioniert |

---

## 6) COPY-PASTE IMPLEMENTATION CHECKLIST (Next 48h)

### P0.5 — Immediate Quick Wins (2-4h)

**Task 1: Standardize password hashing**
- **Files:** `server/routes/admin.ts:351`
- **Change:** Replace `bcrypt.hash(newPassword, 10)` with scrypt (import `hashPassword` from `routes.ts` or inline scrypt logic from `simple-auth.ts:31-34`)
- **Acceptance:** Both password change endpoints use scrypt
- **Validation:** Change pw via admin → login succeeds. `npx tsc --noEmit`

**Task 2: Strip password from users list**
- **Files:** `server/routes/admin.ts:94-107` (inside createCRUDRoutes GET ALL)
- **Change:** After `res.json(records)`, add: `if (tableName === 'users') { records = records.map(({password, ...rest}: any) => rest); }` before the json response
- **Acceptance:** GET `/api/admin/users` response has no `password` field
- **Validation:** curl + check response

**Task 3: Strip password from single user GET**
- **Files:** `server/routes/admin.ts:110-124` (createCRUDRoutes GET ONE)
- **Change:** Same pattern for single user response
- **Acceptance:** GET `/api/admin/users/:id` has no `password`
- **Validation:** curl

### P1 — Core Admin Features (1-2 weeks)

**Task 4: Pagination for users list**
- **Files:** `server/routes/admin.ts:94-107`, `client/src/pages/admin-dashboard.tsx:210-224`
- **Change:** Backend: parse `?page=1&limit=50`, use `LIMIT/OFFSET` + `COUNT(*)`. Frontend: add page controls
- **Acceptance:** `?page=1&limit=50` returns 50 users + `{ total, page, limit, data }`
- **Validation:** 1000+ users → pages work, response <200ms

**Task 5: SQL-based stats**
- **Files:** `server/routes/admin.ts:229-336`
- **Change:** Replace 8× `SELECT *` with `SELECT COUNT(*)` queries + `GROUP BY` for distributions
- **Acceptance:** Stats endpoint doesn't fetch all rows into memory
- **Validation:** Response time <100ms at 10k users

**Task 6: Input validation (Zod schemas)**
- **Files:** `server/routes/admin.ts:127-163`
- **Change:** Add Zod schemas per table for POST/PATCH. Reject invalid input with 400
- **Acceptance:** POST with unknown columns → 400
- **Validation:** curl with bad data → 400 error

**Task 7: Mount admin-export.ts**
- **Files:** `server/routes.ts` (add import + mount)
- **Change:** `const adminExportRoutes = await import('./routes/admin-export'); app.use('/api/admin', adminExportRoutes.default);`
- **Acceptance:** POST `/api/admin/export` works
- **Validation:** curl → 201

**Task 8: Mount admin-staff.ts (if staffInvitations table exists)**
- **Files:** `server/routes.ts`, possibly `shared/schema.ts`
- **Change:** Check DB for `staff_invitations` table. If exists, add schema definition + mount route
- **Acceptance:** GET `/api/admin/staff` → staff list
- **Validation:** curl as admin → 200

**Task 9: User detail slide-over panel**
- **Files:** `client/src/pages/admin-dashboard.tsx` or new `client/src/components/admin/user-detail-panel.tsx`
- **Change:** On user row click → open slide-over panel, fetch `/api/admin/users/:id/deep-dive`
- **Acceptance:** Click user → panel with tabs (Overview, Usage, Activity)
- **Validation:** Browser click test

**Task 10: Server-side search**
- **Files:** Backend: new endpoint or extend GET `/api/admin/users?search=...`. Frontend: debounced search input
- **Change:** Backend: `WHERE username ILIKE '%search%' OR email ILIKE '%search%'`. Frontend: debounce 300ms
- **Acceptance:** Search filters server-side
- **Validation:** Type "test" → only matching users shown

**Task 11: Resolve duplicate user endpoints**
- **Files:** `server/routes/admin.ts:185`
- **Change:** Remove `createCRUDRoutes('users', users, router)` — admin-users.ts handles all user-specific operations with proper auth + audit
- **Acceptance:** Only admin-users.ts DELETE handler exists for users
- **Validation:** DELETE user → hits admin-users.ts (has audit log), not generic CRUD

### P2 — Design Upgrade (2-4 weeks)

**Task 12: Extract AdminLayout shell**
- **Files:** New `client/src/components/admin/admin-layout.tsx`
- **Change:** Extract header/sidebar/content from `admin-dashboard.tsx` into shared layout
- **Acceptance:** AdminDashboard uses `<AdminLayout>` wrapper
- **Validation:** Visual check — same appearance, cleaner code

**Task 13: AdminDataTable component**
- **Files:** New `client/src/components/admin/admin-data-table.tsx`
- **Change:** Reusable table with sorting, pagination, column toggle, row selection
- **Acceptance:** All tables use `<AdminDataTable>` instead of inline rendering
- **Validation:** Sort/filter/paginate works on each table

**Task 14: Loading skeletons**
- **Files:** `client/src/pages/admin-dashboard.tsx` (replace "Loading..." text)
- **Change:** Add `TableSkeleton` and `StatsSkeleton` components with pulse animation
- **Acceptance:** Loading shows skeleton, not text
- **Validation:** Throttle network → skeleton visible

**Task 15: Empty states**
- **Files:** `client/src/pages/admin-dashboard.tsx` (after filter, if 0 results)
- **Change:** Show `<EmptyState icon={...} title="..." description="..." />`
- **Acceptance:** Empty table shows illustration + message
- **Validation:** Filter for nonexistent term → empty state

**Task 16: Branded confirm dialog**
- **Files:** New `client/src/components/admin/confirm-dialog.tsx`, update `admin-dashboard.tsx`
- **Change:** Replace all `confirm()` calls with `<ConfirmDialog>` component
- **Acceptance:** Destructive actions show ARAS-styled dialog
- **Validation:** Click disable → branded modal, not browser dialog

**Task 17: Error boundary**
- **Files:** New `client/src/components/admin/admin-error-boundary.tsx`
- **Change:** Wrap admin pages in error boundary with Retry button
- **Acceptance:** Component crash → error message + Retry, not white screen
- **Validation:** Throw error in component → boundary catches

**Task 18: ARAS premium styling**
- **Files:** `client/src/pages/admin-dashboard.tsx` + extracted components
- **Change:** Apply ARAS CI: dark bg `#0a0a0b`, primary `#FE9100`, glass cards `backdrop-blur`, Orbitron headings
- **Acceptance:** Admin looks premium, consistent with ARAS brand
- **Validation:** Visual review

**Task 19: Responsive layout**
- **Files:** AdminLayout + AdminDataTable
- **Change:** Replace hardcoded `grid-cols-6` with responsive breakpoints
- **Acceptance:** Admin works on tablet (1024px) and mobile (375px)
- **Validation:** Chrome DevTools responsive mode

**Task 20: Subtle motion + reduced-motion**
- **Files:** All new admin components
- **Change:** 200ms transitions on page/modal/hover. `@media (prefers-reduced-motion: reduce)` disables all
- **Acceptance:** Smooth transitions, no motion for a11y users
- **Validation:** Toggle reduced-motion in OS settings → no animations

---

## 7) STOP

**STOP = none.** Keine Blocker-Frage. Alle P0-Entscheidungen sind getroffen und implementiert. P1/P2 können direkt gestartet werden.

---

## VALIDATION LOG

```
$ npx tsc --noEmit --pretty 2>&1 | grep -c "error TS"
0

Changed files (P0 Sprint):
  server/routes/admin.ts           — AuthZ fix + error sanitization + audit logging
  server/middleware/admin.ts        — Response leak fixes (debug fields + err.message)
  server/routes/admin-users.ts     — Disable/Enable statt Hard Delete
  server/simple-auth.ts            — Login block for disabled accounts
  client/src/components/admin-route.tsx — NEW: AdminRoute + StaffRoute guards
  client/src/App.tsx               — Route wrappers applied
  client/src/pages/admin-dashboard.tsx — UI: Disable statt Delete + Enable button
```

### 6 Kern-Prüfungen (manuell)

1. **A2: User → /api/admin/stats = 403**
   - Login als normaler User → DevTools → Network → fetch `/api/admin/stats` → Response: 403 `{ ok:false, code:"FORBIDDEN" }`

2. **A3: User → /admin = Redirect**
   - Login als User → Browser: `/admin` → sofortiger Redirect zu `/`

3. **B1: Admin disables User**
   - Login als Admin → Admin Dashboard → User-Liste → Trash-Icon → Confirm "Disable this user?" → Toast "User deaktiviert"

4. **B2: Disabled User Login**
   - User wurde disabled → Neuer Browser/Incognito → Login mit disabled credentials → Fehlermeldung "Account disabled. Please contact support."

5. **C1: Audit Log nach Password-Change**
   - Admin ändert Passwort → DB: `SELECT * FROM staff_activity_log WHERE action='password_changed' ORDER BY created_at DESC LIMIT 1` → Eintrag vorhanden

6. **D2: Keine raw DB Errors**
   - Trigger beliebigen 500-Fehler → Network Response enthält NUR `{ ok:false, code:"INTERNAL_ERROR", message:"..." }`, KEIN SQL/Stack-Trace
