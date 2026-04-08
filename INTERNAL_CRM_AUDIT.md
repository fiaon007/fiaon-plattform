# ARAS Internal CRM/Command Center – IST-STAND AUDIT

**Generated:** 2026-02-02  
**Status:** Completed

---

## 1. UI ROUTES INVENTORY

| Route | Page Component | Status |
|-------|---------------|--------|
| `/internal` | Redirect → `/internal/dashboard` | ✅ |
| `/internal/dashboard` | `client/src/pages/internal/dashboard.tsx` | ✅ Real |
| `/internal/contacts` | `client/src/pages/internal/contacts.tsx` | ✅ Real + CRUD |
| `/internal/companies` | `client/src/pages/internal/companies.tsx` | ✅ Real + CRUD |
| `/internal/deals` | `client/src/pages/internal/deals.tsx` | ✅ Real + Pipeline |
| `/internal/tasks` | `client/src/pages/internal/tasks.tsx` | ✅ Real + CRUD |
| `/internal/calls` | `client/src/pages/internal/calls.tsx` | ✅ Real |
| `/internal/settings` | Not implemented | ❌ Stub |
| `/admin-dashboard` | `client/src/pages/admin-dashboard.tsx` | ✅ Real |

---

## 2. DATABASE TABLES (Internal CRM)

| Table | Schema Location | Status |
|-------|----------------|--------|
| `internal_companies` | `shared/schema.ts:541-552` | ✅ Defined |
| `internal_contacts` | `shared/schema.ts:555-573` | ✅ Defined |
| `internal_deals` | `shared/schema.ts:576-595` | ✅ Defined |
| `internal_tasks` | `shared/schema.ts:598-615` | ✅ Defined |
| `internal_call_logs` | `shared/schema.ts:618-641` | ✅ Defined |
| `internal_notes` | `shared/schema.ts:644-655` | ✅ Defined |
| `user_tasks` | `shared/schema.ts:678-709` | ✅ Defined |

**⚠️ Note:** Tables must be created via migration: `psql "$DATABASE_URL" -f db/migrations/add_internal_crm_system.sql`

---

## 3. API ENDPOINTS

### Companies
| Method | Endpoint | Auth | Storage Function |
|--------|----------|------|------------------|
| GET | `/api/internal/companies` | requireInternal | getAllCompanies/searchCompanies |
| GET | `/api/internal/companies/:id` | requireInternal | getCompanyById |
| POST | `/api/internal/companies` | requireInternal | createCompany |
| PATCH | `/api/internal/companies/:id` | requireInternal | updateCompany |
| DELETE | `/api/internal/companies/:id` | requireInternal | deleteCompany |

### Contacts
| Method | Endpoint | Auth | Storage Function |
|--------|----------|------|------------------|
| GET | `/api/internal/contacts` | requireInternal | getAllContacts/searchContacts |
| GET | `/api/internal/contacts/:id` | requireInternal | getContactById |
| POST | `/api/internal/contacts` | requireInternal | createContact |
| PATCH | `/api/internal/contacts/:id` | requireInternal | updateContact |
| DELETE | `/api/internal/contacts/:id` | requireInternal | deleteContact |

### Deals
| Method | Endpoint | Auth | Storage Function |
|--------|----------|------|------------------|
| GET | `/api/internal/deals` | requireInternal | getAllDeals |
| GET | `/api/internal/deals/stats` | requireInternal | getDealStats |
| GET | `/api/internal/deals/:id` | requireInternal | getDealById |
| POST | `/api/internal/deals` | requireInternal | createDeal |
| PATCH | `/api/internal/deals/:id` | requireInternal | updateDeal |
| DELETE | `/api/internal/deals/:id` | requireInternal | deleteDeal |

### Tasks
| Method | Endpoint | Auth | Storage Function |
|--------|----------|------|------------------|
| GET | `/api/internal/tasks` | requireInternal | getAllTasks |
| GET | `/api/internal/tasks/:id` | requireInternal | getTaskById |
| POST | `/api/internal/tasks` | requireInternal | createTask |
| PATCH | `/api/internal/tasks/:id` | requireInternal | updateTask |
| DELETE | `/api/internal/tasks/:id` | requireInternal | deleteTask |

### Call Logs
| Method | Endpoint | Auth | Storage Function |
|--------|----------|------|------------------|
| GET | `/api/internal/calls` | requireInternal | getAllCallLogs |
| GET | `/api/internal/calls/:id` | requireInternal | getCallLogById |
| POST | `/api/internal/calls` | requireInternal | createCallLog |

### Notes
| Method | Endpoint | Auth | Storage Function |
|--------|----------|------|------------------|
| GET | `/api/internal/notes` | requireInternal | getNotesByContact/getNotesByDeal |
| POST | `/api/internal/notes` | requireInternal | createNote |
| DELETE | `/api/internal/notes/:id` | requireInternal | deleteNote |

### Dashboard & AI
| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/api/internal/dashboard/stats` | requireInternal |
| POST | `/api/internal/ai/weekly-summary` | requireInternal |
| POST | `/api/internal/ai/contact-summary` | requireInternal |
| POST | `/api/internal/ai/deal-next-steps` | requireInternal |

---

## 4. REALITY-CHECK MATRIX

| Route/Page | React Query | API Calls | Renders Data | Loading/Error States | CRUD Wired | Overall |
|------------|-------------|-----------|--------------|---------------------|------------|---------|
| `/internal/dashboard` | ✅ | ✅ | ✅ | ✅/⚠️ | Read only | ⚠️ Partial |
| `/internal/contacts` | ✅ | ✅ | ✅ | ✅/✅ | ✅ Create | ✅ Real |
| `/internal/companies` | ✅ | ✅ | ✅ | ✅/✅ | ✅ Create | ✅ Real |
| `/internal/deals` | ✅ | ✅ | ✅ | ✅/✅ | ✅ Create + Move | ✅ Real |
| `/internal/tasks` | ✅ | ✅ | ✅ | ✅/✅ | ✅ Create + Toggle | ✅ Real |
| `/internal/calls` | ✅ | ✅ | ✅ | ✅/✅ | Read only | ✅ Real |
| `/admin-dashboard` | ✅ | ✅ | ✅ | ✅/⚠️ | ✅ Full CRUD | ✅ Real |

---

## 5. DEBUG INSTRUMENTATION

### Activation
```javascript
localStorage.setItem('aras_debug', '1');
```

### What Gets Logged
- `[ARAS-DEBUG timestamp] 📦 MOUNT` — Component mount
- `[ARAS-DEBUG timestamp] 🔄 LOADING` — Data fetch started
- `[ARAS-DEBUG timestamp] ✅ SUCCESS` — Data fetch completed with row count
- `[ARAS-DEBUG timestamp] ❌ ERROR` — Fetch error with details
- `[ARAS-DEBUG timestamp] 📤 UNMOUNT` — Component unmount

### Hook Location
`client/src/hooks/useArasDebug.ts`

---

## 6. BUG TRIAGE

### Bug 1: "DB-Daten werden nicht gezeigt"

**Hypothese 1 (HOCH):** User hat keine `admin` oder `staff` Rolle → 403 Forbidden
- Beleg: `server/middleware/role-guard.ts:67-76`

**Hypothese 2 (MITTEL):** Tabellen existieren nicht (Migration nicht ausgeführt)
- Beleg: `ARAS_COMMAND_CENTER.md:12-16`

**Hypothese 3 (NIEDRIG):** Response ist kein Array → Rendering bricht
- Beleg: `client/src/pages/internal/contacts.tsx:70-77`

### Bug 2: "Navigation lädt Seite erst nach Refresh"

**Hypothese 1 (MITTEL):** PageTransition delay (150ms) verursacht perceived lag
- Beleg: `client/src/components/page-transition.tsx:18-27`

**Hypothese 2 (HOCH - FIXED):** InternalLayout hatte keinen z-index → Content unter Video
- Fix: Added `relative z-20` to InternalLayout container

**Hypothese 3 (MITTEL - FIXED):** Wouter Link + motion.a propagation issue
- Fix: Replaced with motion.button + setLocation

---

## 7. FIXES APPLIED

### Fix 1: InternalLayout z-index
```diff
- <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
+ <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 relative z-20">
```

### Fix 2: Navigation Button Handler
```diff
- <Link key={item.path} href={item.path}>
-   <motion.a ...>
+ <motion.button
+   key={item.path}
+   onClick={() => setLocation(item.path)}
```

---

## 8. FILES CREATED/MODIFIED

### New Files
- `client/src/hooks/useArasDebug.ts` — Debug instrumentation hook
- `client/src/pages/internal/companies.tsx` — Companies page with CRUD
- `client/src/pages/internal/deals.tsx` — Deals pipeline with Kanban
- `client/src/pages/internal/tasks.tsx` — Tasks with status management
- `client/src/pages/internal/calls.tsx` — Call logs viewer
- `INTERNAL_CRM_AUDIT.md` — This audit document

### Modified Files
- `client/src/pages/internal/dashboard.tsx` — Added debug hooks
- `client/src/pages/internal/contacts.tsx` — Added CRUD, debug hooks, better states
- `client/src/components/internal/internal-layout.tsx` — z-index fix, navigation fix
- `client/src/App.tsx` — Added routes for new internal pages

---

## 9. MANUAL QA CHECKLIST

### With Debug Flag OFF
- [ ] Login as admin/staff
- [ ] Navigate to `/internal/dashboard`
- [ ] Console should be clean (no ARAS-DEBUG logs)
- [ ] All KPIs load correctly
- [ ] Navigate between pages 5x without refresh
- [ ] Verify content changes immediately

### With Debug Flag ON
```javascript
localStorage.setItem('aras_debug', '1');
```
- [ ] Reload page
- [ ] Console shows MOUNT logs
- [ ] Console shows LOADING → SUCCESS logs
- [ ] Navigate to another page
- [ ] Console shows UNMOUNT → MOUNT → LOADING → SUCCESS
- [ ] Verify row counts in logs match UI

### CRUD Testing
- [ ] Create new contact → appears in list
- [ ] Create new company → appears in list
- [ ] Create new deal → appears in pipeline
- [ ] Move deal to next stage → updates correctly
- [ ] Create new task → appears in list
- [ ] Toggle task status → updates correctly

---

## 10. KNOWN LIMITATIONS

1. **Settings page** (`/internal/settings`) — Not implemented (stub in nav)
2. **Edit/Delete UI** — Only Create is wired; Edit/Delete require modal implementation
3. **Pre-existing TypeScript errors** — 231 errors in codebase unrelated to CRM
4. **Call Logs** — Read-only (no create UI, populated by external integrations)

---

*End of Audit*
