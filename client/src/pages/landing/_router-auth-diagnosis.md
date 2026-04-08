# Router & Auth Diagnosis — ARAS Plattform

**Date:** 2026-02-16
**Scope:** Read-only analysis of `/login`, `/signup`, `/auth` routes and auth flow.

---

## 1. Route Definitions (client/src/App.tsx)

| Path | Component | Location in Switch | Public? |
|------|-----------|-------------------|---------|
| `/login` | `Login` (pages/login.tsx) | Line 171, before auth gate | ✅ Yes |
| `/signup` | `Signup` (pages/signup.tsx) | Line 172, before auth gate | ✅ Yes |
| `/auth` | `AuthPage` (pages/auth-page.tsx) | Line 173, before auth gate | ✅ Yes |
| `/forgot-password` | `ForgotPassword` | Line 174, before auth gate | ✅ Yes |
| `/welcome` | `Welcome` | Line 175, before auth gate | ✅ Yes |

All three auth entry points are in the public `<Switch>` section **before** the `{!user ? ... : ...}` conditional block. Route ordering is correct — they will match before the catch-all `NotFound`.

## 2. Auth Guard Logic (App.tsx lines 150–269)

```
Router() {
  const { user, isLoading } = useAuth();
  if (isLoading) → spinner
  return <Switch>
    // Public routes (lines 166–193) ← /login, /signup, /auth are HERE
    {!user ? (
      // Unauthenticated fallbacks: "/" → AuthPage, "/app" → AuthPage, etc.
    ) : (
      // Authenticated routes: "/" → AppPage, "/app" → AppPage, etc.
    )}
    <Route component={NotFound} />  // catch-all
  </Switch>
}
```

**No redirect loop.** Public routes are matched first regardless of auth state.

## 3. Root Cause: Why `/login` Is Broken

**File:** `client/src/pages/login.tsx`, lines 76–88

```ts
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);
  // Simulate login process for wireframe
  setTimeout(() => {
    toast({ title: "Login Successful", ... });
    setLocation("/app");
  }, 1500);
};
```

**Problems:**
1. **`handleSubmit` is a mock/wireframe** — it never calls `/api/login`. It uses `setTimeout` to fake success.
2. **Field mismatch**: The form collects `email` but the backend passport-local strategy expects `username`.
3. After the fake "success", it redirects to `/app` which (for unauthenticated users) shows `AuthPage` — creating a visual loop.

## 4. Root Cause: Why `/signup` Is Broken

**File:** `client/src/pages/signup.tsx`, lines 75–116

```ts
const response = await fetch('/api/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    username, password, email, firstName, lastName
    // ❌ MISSING: phone (REQUIRED by server — min 8 chars)
  })
});
```

**Problems:**
1. **Missing required `phone` field** — server validates `phone?.trim().length < 8` and returns 400: `"Telefonnummer ist erforderlich (mindestens 8 Zeichen)"`.
2. Missing optional but valuable fields: `company`, `industry`, `role`, `language`, `primaryGoal`.
3. Error handling parses response as text, not JSON — loses structured error messages.

## 5. Working Auth Flow: `/auth` (auth-page.tsx)

The **working** registration lives in `auth-page.tsx` (6303 lines, multi-step wizard):
- Step 1: firstName, lastName, email, username, password
- Step 2: company, role, phone, website, industry (phone validated ≥8 chars)
- Step 3: (skipped) → Step 4: research animation + actual `registerMutation.mutateAsync()`
- On success: sets query data, shows briefing, eventually redirects to `/space`

Login in auth-page uses `loginMutation.mutateAsync({ username, password })` → redirects to `/space`.

## 6. Backend API Summary

### POST /api/register (server/simple-auth.ts:247)
| Field | Required | Validation |
|-------|----------|------------|
| `username` | ✅ | Unique check |
| `password` | ✅ | Hashed with scrypt |
| `phone` | ✅ | `.trim().length >= 8` |
| `email` | ❌ (but checked) | Unique if provided |
| `firstName` | ❌ | — |
| `lastName` | ❌ | — |
| `company` | ❌ | Triggers enrichment if + industry |
| `industry` | ❌ | Triggers enrichment if + company |
| `role` | ❌ | Stored as `jobRole` |
| `website` | ❌ | Null if `noWebsite=true` |
| `language` | ❌ | Default `"de"` |
| `primaryGoal` | ❌ | — |
| `noWebsite` | ❌ | Boolean flag |

**Success:** 201 + sanitized user JSON + session cookie set via `req.login()`
**Errors:** 400 `{ message: "..." }` for validation/duplicate, 500 for server errors.

### POST /api/login (server/simple-auth.ts:434)
| Field | Required | Notes |
|-------|----------|-------|
| `username` | ✅ | passport-local default field |
| `password` | ✅ | Compared via scrypt or bcrypt |

**Success:** 200 + sanitized user JSON + session cookie
**Errors:** 401 `{ ok: false, code: "INVALID_CREDENTIALS"|"ACCOUNT_DISABLED", message: "..." }`

### GET /api/auth/user (server/simple-auth.ts:463)
Returns sanitized user if authenticated, 401 otherwise.

## 7. Conclusion

- **Routes are correctly defined** — no 404, no redirect loop, no Switch ordering issue.
- **`/login` is a non-functional wireframe** — never calls the API.
- **`/signup` sends incomplete data** — missing required `phone` field → always 400.
- **`/auth` is the only working auth UI** — full multi-step flow with all required fields.
- **Fix plan** (STEP 5, separate): minimal patches to login.tsx and signup.tsx without touching auth-page.tsx.
