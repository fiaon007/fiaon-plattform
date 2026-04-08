# SPACE CURRENT STATE AUDIT
> **Erstellt:** 2026-02-05  
> **Scope:** `/app/space` Route, Chat-Funktionalität, Gating, DB  
> **Status:** Source of Truth für SPACE Seite

---

## 1. User Journey nach Registrierung

### 1.1 Route Flow
```
/app/space oder /space → Space Komponente (client/src/pages/space.tsx)
```

### 1.2 Ablauf für neue User
1. **Auth Check** → `useAuth()` prüft Session
2. **Loading Screen** → Spinner während `authLoading` oder `subscriptionLoading`
3. **Cinematic Intro** (nur bei Erstbesuch + gültigem AI Profile):
   - Phase 1: Boot (0-0.6s) → "ARAS AI" + "INITIALIZING"
   - Phase 2: Scan (0.6-1.3s) → Progress Bar + "Generating AI Profile..."
   - Phase 3: Results (1.3s+) → Welcome + Company Stats + Description
   - Gespeichert in `localStorage`: `aras_intro_seen_${userId}`
4. **Welcome Banner** (15s auto-hide) → zeigt AI Profile Research Results
5. **Chat Interface** → `ChatInterface` Komponente

### 1.3 Ablauf für wiederkehrende User
1. **Auth Check** → Session validiert
2. **Loading Screen** → kurz
3. **Kein Cinematic Intro** (localStorage Flag gesetzt)
4. **Welcome Banner** (optional, 15s)
5. **Chat Interface** mit letzten Messages

---

## 2. UI-Komponenten & States

### 2.1 Datei-Struktur
```
client/src/pages/
├── space.tsx                    # Haupt-Page (AKTIV für /app/space)
└── space-new.tsx                # Alternative Version (NICHT im Routing)

client/src/components/chat/
├── chat-interface.tsx           # Chat UI (2279 Zeilen)
└── message-bubble.tsx           # Message Rendering

client/src/components/layout/
├── sidebar.tsx                  # Navigation
└── topbar.tsx                   # Header mit Plan Badge
```

### 2.2 space.tsx Komponenten-Hierarchie
```
Space
├── Sidebar (activeSection="space")
├── TopBar (subscriptionData, user)
├── AnimatePresence
│   ├── Cinematic Intro Overlay (showCinematicIntro)
│   │   ├── Phase: boot
│   │   ├── Phase: scan
│   │   └── Phase: results
│   └── Welcome Banner (showWelcome)
│       ├── Company Info Grid
│       ├── Services List
│       ├── Target Audience
│       └── Keywords
└── ErrorBoundary
    └── ChatInterface
```

### 2.3 ChatInterface Komponenten
```
ChatInterface
├── Chat History Sidebar (showHistory)
├── Messages Container
│   ├── Empty State (hasMessages=false)
│   │   ├── ARAS AI Title (Orbitron Font)
│   │   ├── Animated Text Carousel
│   │   ├── Quick Action Buttons (SUGGESTED_PROMPTS)
│   │   │   ├── "Outbound Kampagne starten" → /app/campaigns
│   │   │   ├── "Einzelanruf starten" → /app/power
│   │   │   └── "ARAS AI prompt schreiben" → Prompt Creation Flow
│   │   └── Input Field
│   └── Messages (hasMessages=true)
│       └── MessageBubble (pro Message)
├── Streaming Message
├── Thinking Indicator
└── Call Wizard Modal (showCallModal)
```

### 2.4 States

| State | Typ | Beschreibung |
|-------|-----|--------------|
| `showCinematicIntro` | boolean | Cinematic Intro Overlay |
| `introPhase` | 'boot' \| 'scan' \| 'results' | Intro Phase |
| `showWelcome` | boolean | Welcome Banner (auto-hide 15s) |
| `showTopBar` | boolean | TopBar visibility (auto-hide 4s) |
| `showHistory` | boolean | Chat History Sidebar |
| `isThinking` | boolean | AI denkt nach |
| `isStreaming` | boolean | Streaming Response |
| `streamingMessage` | string | Aktueller Stream Content |
| `currentSessionId` | number \| null | Aktive Chat Session |
| `uploadedFiles` | UploadedFile[] | Hochgeladene Dateien |
| `isPromptLoading` | boolean | Prompt Creation läuft |

### 2.5 Loading/Empty/Error States

**Loading:**
```tsx
<div className="flex h-screen bg-black items-center justify-center">
  <motion.div className="w-16 h-16 border-4 border-[#FE9100]..." animate={{ rotate: 360 }} />
  <p>ARAS AI lädt...</p>
</div>
```

**Empty (kein Chat):**
- Große "ARAS AI" Headline mit Wave Gradient
- Animierter Text: "erledigt für dich: Outbound Calls / Terminvereinbarungen / ..."
- 3 Quick Action Buttons
- Chat Input Feld

**Error:**
- `ErrorBoundary` wrapping `ChatInterface`
- Fallback: "Chat konnte nicht geladen werden"

---

## 3. DB Tabellen & Relationen

### 3.1 Relevante Tabellen

```sql
-- Chat Sessions
chat_sessions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id),
  title VARCHAR DEFAULT 'New Chat',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Chat Messages
chat_messages (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES chat_sessions(id),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  is_ai BOOLEAN DEFAULT false,
  timestamp TIMESTAMP
)

-- Users (relevante Felder für SPACE)
users (
  id VARCHAR PRIMARY KEY,
  username VARCHAR UNIQUE NOT NULL,
  first_name VARCHAR,
  last_name VARCHAR,
  company VARCHAR,
  industry VARCHAR,
  ai_profile JSONB,                    -- Business Intelligence + Psychologisches Profil
  profile_enriched BOOLEAN DEFAULT false,
  subscription_plan VARCHAR DEFAULT 'starter',
  subscription_status VARCHAR DEFAULT 'trial_pending',
  ai_messages_used INTEGER DEFAULT 0,
  voice_calls_used INTEGER DEFAULT 0,
  trial_messages_used INTEGER DEFAULT 0,
  has_payment_method BOOLEAN DEFAULT false
)

-- User Data Sources (Knowledge Base)
user_data_sources (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT CHECK (type IN ('text', 'url', 'file')),
  title TEXT,
  status TEXT DEFAULT 'active',
  content_text TEXT,
  url TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Subscription Plans
subscription_plans (
  id VARCHAR PRIMARY KEY,              -- free, pro, ultra, ultimate
  name VARCHAR NOT NULL,
  price INTEGER NOT NULL,              -- in cents
  ai_messages_limit INTEGER,           -- null = unlimited
  voice_calls_limit INTEGER,
  leads_limit INTEGER,
  campaigns_limit INTEGER,
  features TEXT[],
  stripe_price_id VARCHAR
)
```

### 3.2 Relationen

```
User (1) ─────────── (N) ChatSession
                          │
                          └─── (N) ChatMessage

User (1) ─────────── (N) UserDataSource

User (1) ─────────── (1) SubscriptionPlan (via subscription_plan field)
```

### 3.3 AI Profile Struktur (JSONB)

```typescript
aiProfile: {
  // Business Intelligence
  companyDescription?: string;
  products?: string[];
  services?: string[];
  targetAudience?: string;
  competitors?: string[];
  effectiveKeywords?: string[];
  opportunities?: string[];
  challenges?: string[];
  
  // Psychologisches Profil (aus Chat-Analyse)
  personalityType?: string;
  communicationTone?: string;
  decisionMakingStyle?: string;
  interests?: string[];
  painPoints?: string[];
  chatInsightsSummary?: string;
  lastChatAnalysis?: string;
  
  // Enrichment Metadata
  enrichmentStatus?: 'live_research' | 'fallback';
  enrichmentErrorCode?: string;
}
```

---

## 4. API Endpoints & Dataflow

### 4.1 Chat Endpoints (server/chat.ts)

| Endpoint | Method | Auth | Zweck |
|----------|--------|------|-------|
| `/api/chat/messages` | POST | ✅ | Nachricht senden (Streaming SSE) |
| `/api/chat/messages` | GET | ✅ | Messages einer Session abrufen |
| `/api/chat/sessions` | GET | ✅ | Alle Sessions des Users |
| `/api/chat/sessions/new` | POST | ✅ | Neue Session erstellen |
| `/api/chat/sessions/:id/activate` | POST | ✅ | Session aktivieren |
| `/api/chat/sessions/update-title` | POST | ✅ | Session Titel updaten |
| `/api/chat/analyze-user` | POST | ✅ | Deep Chat Analysis (Gemini) |

### 4.2 User/Subscription Endpoints (server/routes.ts)

| Endpoint | Method | Auth | Zweck |
|----------|--------|------|-------|
| `/api/user/subscription` | GET | ✅ | Plan, Limits, Usage |
| `/api/user/profile-context` | GET | ✅ | AI Profile für Kontext |
| `/api/user/data-sources` | GET | ✅ | Knowledge Base Sources |
| `/api/user/data-sources` | POST | ✅ | Text/URL Source hinzufügen |
| `/api/auth/user` | GET | ✅ | User Daten |

### 4.3 Streaming Response Flow (POST /api/chat/messages)

```
Client                          Server
  │                               │
  │──POST /api/chat/messages──────▶│
  │   {message, sessionId}        │
  │                               │
  │◀──SSE: data: {thinking: true}─│ (Phase 1: Thinking)
  │                               │
  │◀──SSE: data: {sessionId: X}───│ (Session Created/Returned)
  │                               │
  │◀──SSE: data: {content: "..."}─│ (Phase 2: Streaming chunks)
  │◀──SSE: data: {content: "..."}─│
  │◀──SSE: data: {content: "..."}─│
  │                               │
  │◀──SSE: [stream end]───────────│
  │                               │
  │──invalidateQueries────────────│ (Refresh subscription/usage)
```

### 4.4 Gemini Integration (server/chat.ts)

```typescript
// Model: gemini-2.5-flash (November 2025)
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash",
  generationConfig: {
    temperature: 1.0,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
  },
  tools: [{
    googleSearch: {}  // Live Google Search Grounding
  }],
});
```

### 4.5 System Prompt Injection

```
getSystemPrompt(user) 
  + 
getKnowledgeDigest(userId, 'space')  // User Data Sources
  =
enhancedSystemPrompt
```

Der System Prompt enthält:
- ARAS AI Identity
- User Profile (Name, Company, Industry)
- Account Status (Plan, Messages Used)
- Business Intelligence (aus aiProfile)
- Psychologisches Profil
- Platform Knowledge (Preise, Launch, Features)
- Knowledge Base Digest (User Data Sources)

---

## 5. Gating/Plans/Limits

### 5.1 Plan-Konfiguration (subscription_plans Tabelle)

| Plan | Price | AI Messages | Voice Calls | Features |
|------|-------|-------------|-------------|----------|
| free | €0 | 10 | 0 | Basic Chat |
| pro | €49/mo | 500 | 50 | + Knowledge Base |
| ultra | €99/mo | 2000 | 200 | + Campaigns |
| enterprise | Custom | Unlimited | Unlimited | Full Access |

### 5.2 Limit Checking (server/middleware/usage-limits.ts)

```typescript
// Middleware für AI Messages
checkMessageLimit(req, res, next) {
  const limitCheck = await storage.checkUsageLimit(userId, 'ai_message');
  
  if (!limitCheck.allowed) {
    return res.status(403).json({
      error: limitCheck.message,
      requiresUpgrade: limitCheck.requiresUpgrade,
      requiresPayment: limitCheck.requiresPayment,
      plan: user.subscriptionPlan
    });
  }
  next();
}
```

### 5.3 Client-Side Limit Handling (chat-interface.tsx)

```typescript
// In sendMessage mutation
if (response.status === 403) {
  const errorData = await response.json();
  
  toast({
    title: "Limit erreicht! ❌",
    description: errorData.message,
    variant: "destructive",
    action: (
      <ToastAction onClick={() => window.location.href = '/billing'}>
        Jetzt upgraden 🚀
      </ToastAction>
    )
  });
}
```

### 5.4 Locked States

**Campaign Mode:**
- Sichtbar in Quick Actions: "Outbound Kampagne starten"
- Führt zu `/app/campaigns`
- Keine explizite Lock-UI in SPACE (redirect-basiert)

**Voice Calls:**
- Button: "Einzelanruf starten" → `/app/power`
- Limit-Check erfolgt in `/app/power`, nicht in SPACE

### 5.5 Trial Flow

```
Registrierung
    │
    ▼
subscription_status = "trial_pending"
subscription_plan = "starter"
trial_messages_used = 0
    │
    ▼
Erste 10 Messages frei
    │
    ▼
Nach 10 Messages: 403 + Upgrade CTA
```

---

## 6. Risiken/Constraints (DO-NOT-TOUCH)

### 6.1 Kritische Abhängigkeiten

| Bereich | Dateien | Risiko |
|---------|---------|--------|
| Auth | `server/simple-auth.ts`, `server/auth.ts` | Session/Cookie Handling |
| Billing | `server/routes.ts` (Stripe), `subscription_plans` | Payment Flow |
| DB Schema | `shared/schema.ts`, `db/migrations/*` | Data Integrity |
| Session Store | PostgreSQL `sessions` Tabelle | Auth Persistence |

### 6.2 Naming Constraints (aus schema.ts)

- `subscription_plan`: `starter`, `professional`, `enterprise` (DB Default: `starter`)
- `subscription_status`: `trial_pending`, `trialing`, `active`, `canceled`, `past_due`
- `user_role`: `user`, `admin`, `staff`

### 6.3 API Contract (NICHT ändern)

```typescript
// /api/user/subscription Response
{
  plan: string,
  status: string,
  aiMessagesUsed: number,
  voiceCallsUsed: number,
  aiMessagesLimit: number | null,
  voiceCallsLimit: number | null,
  renewalDate: string | null,
  trialMessagesUsed: number,
  trialEndDate: string | null,
  hasPaymentMethod: boolean,
  requiresPaymentSetup: boolean,
  isTrialActive: boolean,
  canUpgrade: boolean
}
```

### 6.4 UI/Component Constraints

- **space.tsx** rendert Sidebar + TopBar direkt (nicht über app.tsx Layout)
- **ChatInterface** ist eigenständig, nicht in app.tsx lazy-loaded
- **Framer Motion** wird extensiv genutzt für Animationen
- **Orbitron Font** für Headlines (via CSS import)

### 6.5 Bekannte Probleme / Technische Schulden

1. **Doppelte space.tsx**: `space.tsx` (aktiv) und `space-new.tsx` (ungenutzt) existieren
2. **Chat Router Duplizierung**: `/api/chat/*` in `chat.ts` UND in `routes.ts` registriert
3. **Streaming nicht in chat.ts**: POST `/api/chat/messages` in `chat.ts` ist non-streaming, der streaming Endpoint ist in `routes.ts`
4. **Hardcoded Plan Names**: Plan IDs teilweise hardcoded (`free`, `pro`, etc.)

---

## 7. File Discovery Log

### Frontend Files (SPACE)
```
client/src/pages/space.tsx                    # Haupt-Page (645 LOC)
client/src/pages/space-new.tsx                # Alt. Version (36 LOC, UNUSED)
client/src/components/chat/chat-interface.tsx # Chat UI (2279 LOC)
client/src/components/chat/message-bubble.tsx # Message Rendering
client/src/components/layout/sidebar.tsx      # Navigation
client/src/components/layout/topbar.tsx       # Header
client/src/components/error-boundary.tsx      # Error Handling
client/src/App.tsx                            # Routing (Line 190-191)
```

### Backend Files (SPACE)
```
server/chat.ts                                # Chat Router (521 LOC)
server/routes.ts                              # Main Routes (5167 LOC)
server/middleware/usage-limits.ts             # Limit Middleware (74 LOC)
server/knowledge/context-builder.ts           # Knowledge Digest
server/storage.ts                             # DB Operations
```

### Shared Files
```
shared/schema.ts                              # DB Schema (1040 LOC)
```

---

## 8. Quick Reference

### Routing
```
/app/space → Space (space.tsx)
/space     → Space (space.tsx)
```

### Key Hooks
```typescript
useAuth()           // User, isLoading
useQuery(["/api/user/subscription"])  // Plan, Limits
useQuery(["/api/chat/messages"])      // Chat Messages
useQuery(["/api/chat/sessions"])      // Chat Sessions
```

### Key Actions
```typescript
startNewChatMutation.mutate()    // Neue Session
sendMessage.mutate(message)       // Nachricht senden
loadChatSession(sessionId)        // Session wechseln
startPromptCreation()             // Prompt Creation Flow
```

---

*Diese Dokumentation dient als Source of Truth für SPACE V2 Entwicklung.*
