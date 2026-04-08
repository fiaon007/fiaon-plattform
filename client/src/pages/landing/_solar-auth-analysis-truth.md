# Solar LP — Auth Analysis Flow: Source of Truth

## State Machine (from auth-page.tsx)

```
FORM → [register success] → ANALYSIS (briefing phase) → [polling complete] → COMPLETE → [user clicks "ENTER SPACE"] → /space
```

### States
| State | `onboardingPhase` | `briefingData.status` | Description |
|-------|------------------|-----------------------|-------------|
| FORM | `'signup'` | `null` | Registration form visible |
| ANALYSIS | `'briefing'` | `'polling'` | Polling `/api/user/profile-context` every 2.5–3s |
| COMPLETE | `'complete'` | `'ready'` or `'timeout'` | Data shown, "ENTER SPACE" button visible |

### Trigger: Register Success → Analysis
After `registerMutation.mutateAsync()` succeeds:
1. `skipAuthRedirectRef.current = true` (block useEffect redirect)
2. Initialize `briefingData` with empty arrays/strings, `status: 'polling'`
3. `setOnboardingPhase('briefing')` — immediately, synchronously

### Polling: `GET /api/user/profile-context`
- **Requires auth** (session cookie from register)
- **Interval**: first poll after 2000ms, then every 2500–3000ms
- **Max polls**: 90 (~3 min)
- **AbortController** for cleanup

#### Response shape:
```ts
{
  id: string;
  name: string;
  company: string | null;
  website: string | null;
  industry: string | null;
  aiProfile: {
    companyDescription?: string;
    callAngles?: string[];
    objectionHandling?: { objection: string; response: string }[];
    targetAudienceSegments?: string[];
    targetAudience?: string;
    competitors?: string[];
    uniqueSellingPoints?: string[];
    decisionMakers?: string[];
    enrichmentMeta?: { status: string; qualityScore?: number };
    qualityScore?: number;
  } | null;
  profileEnriched: boolean;
  enrichmentStatus: string | null;
  enrichmentMeta: { status: string; qualityScore?: number } | null;
}
```

#### Terminal conditions (stop polling):
- `profileEnriched === true` → status='ready', phase='complete'
- `enrichmentStatus ∈ ['complete', 'live_research', 'ok', 'limited']` → ready/complete
- `enrichmentStatus ∈ ['failed', 'timeout', 'error']` → ready/complete (show retry button)
- `pollCount >= MAX_POLLS` → timeout/complete

### Timeline Steps (UI, 4 steps, advance every 3000ms)
1. "Website & Domain scannen" / "Öffentliche Daten werden gelesen"
2. "Zielgruppe identifizieren" / "Marktsegmente werden analysiert"
3. "Call-Strategie generieren" / "Gesprächseinstiege werden erstellt"
4. "Einwandbehandlung aufbauen" / "Antworten werden optimiert"

### Briefing Data Cards (shown as data arrives)
1. **COMPANY INTELLIGENCE** — `briefingData.companySnapshot` (min 10 chars, truncated at 350)
2. **ZIELGRUPPE** — `briefingData.targetAudience[]` joined
3. **CALL ANGLES** — `briefingData.callAngles[]` (max 4)
4. **EINWANDBEHANDLUNG** — `briefingData.objections[]` (max 3, each has `.objection` + `.response`)
5. **WETTBEWERBER** — `briefingData.competitors[]` (max 5)
6. **UNIQUE SELLING POINTS** — `briefingData.uniqueSellingPoints[]` (max 5)
7. **Intelligence Score** — `briefingData.qualityScore` / 10 (shown when complete & > 0)

### Retry Mechanism
- If `enrichmentStatus` is 'failed' or 'timeout':
  - Show retry button
  - `POST /api/user/enrich/retry` (requireAuth)
  - Reset: `briefingData.status='polling'`, `onboardingPhase='briefing'`

### Final Redirect
- User clicks "ENTER SPACE" button
- `queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] })`
- `setLocation('/space')`

## API Endpoints Used
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/register` | No | Create account + auto-login + trigger enrichment |
| GET | `/api/user/profile-context` | Yes | Poll enrichment results |
| POST | `/api/user/enrich/retry` | Yes | Force re-enrichment |

## BriefingData TypeScript Interface
```ts
interface BriefingData {
  status: 'polling' | 'ready' | 'timeout';
  enrichmentStatus: string;
  qualityScore: number;
  companySnapshot: string;
  targetAudience: string[];
  targetAudienceSegments: string[];
  callAngles: string[];
  objections: { objection: string; response: string }[];
  competitors: string[];
  uniqueSellingPoints: string[];
  decisionMakers: string[];
  nextActions: string[];
}
```
