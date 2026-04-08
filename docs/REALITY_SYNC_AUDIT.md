# ARAS Internal CRM — Reality Sync Audit v2

**Generated:** 2026-02-02  
**Method:** Source code analysis with file references

---

## 1. ROUTING TRUTH

### Source: `client/src/App.tsx`

| Route | Component | Lines | Auth Guard |
|-------|-----------|-------|------------|
| `/internal` | Redirect → dashboard | 219-222 | `user` required |
| `/internal/dashboard` | `InternalDashboard` | 213 | `user` required |
| `/internal/contacts` | `InternalContacts` | 214 | `user` required |
| `/internal/companies` | `InternalCompanies` | 215 | `user` required |
| `/internal/deals` | `InternalDeals` | 216 | `user` required |
| `/internal/tasks` | `InternalTasks` | 217 | `user` required |
| `/internal/calls` | `InternalCalls` | 218 | `user` required |
| `/internal/settings` | ❌ NOT DEFINED | - | - |

**⚠️ Finding:** Routes are inside `{user ? ...}` conditional, requiring auth. API endpoints have additional RBAC via `requireInternal`.

---

## 2. LAYER MAP (z-index)

### Source: `client/src/App.tsx`

| Layer | Element | z-index | File:Line |
|-------|---------|---------|-----------|
| Background | VideoBackground | `-1` (style) | App.tsx:100 |
| Overlay | Dark overlays | `none` | App.tsx:119-126 |
| Content wrapper | `div.relative.z-10` | `z-10` | App.tsx:248 |
| Early Access Banner | `div.fixed.z-[9999]` | `z-[9999]` | App.tsx:250 |

### Source: `client/src/components/internal/internal-layout.tsx`

| Layer | Element | z-index | File:Line |
|-------|---------|---------|-----------|
| Main container | `div.relative.z-20` | `z-20` | internal-layout.tsx:45 |
| Sidebar | `aside.z-50` | `z-50` | internal-layout.tsx:47 |
| Header | `header.z-40` | `z-40` | internal-layout.tsx:117 |
| Glow effects | `div.fixed.pointer-events-none` | `none` | internal-layout.tsx:157 |

**✅ Finding:** Layer hierarchy is correct. Content should render above video.

---

## 3. PAGE TRANSITION ANALYSIS

### Source: `client/src/components/page-transition.tsx`

```typescript
// Lines 18-27
useEffect(() => {
  if (location !== displayLocation) {
    setIsTransitioning(true);
    const timer = setTimeout(() => {
      setDisplayLocation(location);  // ← DELAYED UPDATE
      setIsTransitioning(false);
    }, 150); // ← 150ms DELAY
    return () => clearTimeout(timer);
  }
}, [location, displayLocation]);
```

**⚠️ ROOT CAUSE IDENTIFIED:**
- Route changes are **delayed by 150ms** before `displayLocation` updates
- During this delay, `children` still render with OLD `displayLocation` key
- If old content unmounts before new content mounts → **blank screen (video only)**
- The `motion.div` uses `displayLocation` as key, not `location`

---

## 4. API ENDPOINTS TRUTH

### Source: `server/routes/internal/index.ts`

| Method | Endpoint | Auth | Storage Function | Lines |
|--------|----------|------|------------------|-------|
| GET | `/api/internal/companies` | requireInternal | getAllCompanies/searchCompanies | 33-43 |
| GET | `/api/internal/companies/:id` | requireInternal | getCompanyById | 45-53 |
| POST | `/api/internal/companies` | requireInternal | createCompany | 55-77 |
| PATCH | `/api/internal/companies/:id` | requireInternal | updateCompany | 79-87 |
| DELETE | `/api/internal/companies/:id` | requireInternal | deleteCompany | 89-97 |
| GET | `/api/internal/contacts` | requireInternal | getAllContacts/searchContacts | ~100+ |
| GET | `/api/internal/deals` | requireInternal | getAllDeals | ~150+ |
| GET | `/api/internal/tasks` | requireInternal | getAllTasks | ~200+ |
| GET | `/api/internal/calls` | requireInternal | getAllCallLogs | ~250+ |
| GET | `/api/internal/dashboard/stats` | requireInternal | getDashboardStats | ~400+ |
| POST | `/api/internal/ai/*` | requireInternal | AI handlers | via ai.ts |

**✅ Finding:** All endpoints use `requireInternal` middleware (admin/staff only).

---

## 5. RBAC TRUTH

### Source: `server/middleware/role-guard.ts`

```typescript
// Line 67 - checks both camelCase and snake_case
const userRole = user.userRole || user.user_role;

// Line 79 - allowed roles check
if (!allowedRoles.includes(userRole)) { ... }

// Line 105 - requireInternal definition
export const requireInternal = requireRole(['admin', 'staff']);
```

**Allowed roles for internal:** `admin`, `staff`

**⚠️ Potential Issue:** If user object from session doesn't include `userRole` or `user_role`, access is denied with "no role found" (line 72-75).

---

## 6. DATABASE TABLES TRUTH

### Source: `shared/schema.ts` (lines 541-669)

| Table | Schema Defined | Migration File |
|-------|---------------|----------------|
| `internal_companies` | ✅ Line 541 | ✅ exists |
| `internal_contacts` | ✅ Line 555 | ✅ exists |
| `internal_deals` | ✅ Line 576 | ✅ exists |
| `internal_tasks` | ✅ Line 598 | ✅ exists |
| `internal_call_logs` | ✅ Line 618 | ✅ exists |
| `internal_notes` | ✅ Line 644 | ✅ exists |

**Migration file:** `db/migrations/add_internal_crm_system.sql` ✅ EXISTS

**⚠️ Note:** Tables must be created manually via migration. If not run, API returns 500 "relation does not exist".

---

## 7. REALITY MATRIX v2

| Page | Route | Query Key | Fetcher | Error Handling | Loading State | Empty State | CRUD Wired |
|------|-------|-----------|---------|----------------|---------------|-------------|------------|
| Dashboard | `/internal/dashboard` | `/api/internal/dashboard/stats` | ✅ | ⚠️ throws | ⚠️ basic | ❌ none | Read only |
| Contacts | `/internal/contacts` | `/api/internal/contacts` | ✅ | ✅ shows error | ✅ skeleton | ✅ CTA | ✅ Create |
| Companies | `/internal/companies` | `/api/internal/companies` | ✅ | ✅ shows error | ✅ skeleton | ✅ CTA | ✅ Create |
| Deals | `/internal/deals` | `/api/internal/deals` | ✅ | ✅ shows error | ✅ skeleton | ✅ CTA | ✅ Create+Move |
| Tasks | `/internal/tasks` | `/api/internal/tasks` | ✅ | ✅ shows error | ✅ skeleton | ✅ CTA | ✅ Create+Toggle |
| Calls | `/internal/calls` | `/api/internal/calls` | ✅ | ✅ shows error | ✅ skeleton | ✅ empty msg | Read only |
| Settings | `/internal/settings` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ STUB |

---

## 8. BUG ROOT CAUSES

### Bug #1: "Video-only until refresh"

**Root Cause:** `PageTransition` component delays route change by 150ms. During transition, if component unmounts before new one mounts, blank screen appears.

**Evidence:**
- `page-transition.tsx:24` - 150ms setTimeout delay
- `page-transition.tsx:32` - uses `displayLocation` (delayed) as motion key
- Content unmounts during exit animation → video visible

**Fix Strategy:** 
1. Remove delay OR
2. Always render shell/skeleton during transition OR
3. Use immediate location as key, only animate opacity

### Bug #2: "DB data not showing"

**Potential Causes (in order of likelihood):**
1. **Migration not run** → 500 error "relation does not exist"
2. **User has no role** → 403 "no role found"
3. **User has wrong role** → 403 "Insufficient permissions"
4. **Network/fetch error** → silent fail if not handled

**Evidence:**
- `role-guard.ts:69-76` - returns 403 if no role
- Tables require manual migration

---

## 9. PROVIDER BRANDING ISSUES

| File | Line | Current Text | Should Be |
|------|------|--------------|-----------|
| daily-briefing.tsx | 123 | "Realtime (Gemini)" | "ARAS AI Realtime" |
| daily-briefing.tsx | 465 | "Gemini nicht konfiguriert" | "ARAS AI nicht konfiguriert" |
| daily-briefing.tsx | 755 | "Realtime (Gemini)" | "ARAS AI Realtime" |

---

## 10. VALIDATION COMMANDS

```bash
# Build check
npm run build

# Secret check
git grep -n "sk_" . | grep -v example | grep -v ".md"
git grep -n "AIza" . | grep -v example | grep -v ".md"

# Dev server
npm run dev

# Manual QA
# 1. Open /internal/dashboard
# 2. Navigate 5x between pages
# 3. Check console for errors
# 4. Verify no "video only" state
```

---

*End of Reality Sync Audit*
