# ADMIN UI SPEC v0 — Repo-Based Design Rules
> Source: `index.css:17-52`, `tailwind.config.ts`, `aras-primitives.tsx`, `CommandCenterLayout.tsx`

## Colors (from `:root` vars in `index.css:39-51`)
| Token | Value | Usage |
|-------|-------|-------|
| `--aras-gold-light` | `#e9d7c4` | Gradient start, subtle accents |
| `--aras-gold-dark` | `#a34e00` | Gradient end |
| `--aras-orange` | `#FE9100` | Primary accent, CTA |
| `--aras-bg` | `#0f0f0f` | Page background |
| `--aras-text` | `rgba(245,245,247,0.94)` | Primary text |
| `--aras-muted` | `rgba(245,245,247,0.72)` | Secondary text |
| `--aras-soft` | `rgba(245,245,247,0.56)` | Tertiary/disabled |
| `--aras-stroke` | `rgba(233,215,196,0.14)` | Default borders |
| `--aras-stroke-accent` | `rgba(254,145,0,0.24)` | Accent borders |
| `--aras-glass` | `rgba(15,15,15,0.85)` | Glass card bg |
| `--aras-glass-border` | `rgba(255,255,255,0.08)` | Glass card border |

CommandCenterLayout uses slightly different tokens (`DESIGN` object, line 22-49):
- `bg.primary: #050507`, `bg.card: rgba(255,255,255,0.03)`
- `accent.primary: #FF6A00`, `accent.secondary: #FFB200`

**Decision:** Use `:root` CSS vars (canonical). CommandCenter DESIGN object is local override.

## Typography (from `index.css:1`)
- **Import:** `Orbitron:wght@400;700;900` + `Inter:wght@400;500;600;700`
- **Body:** `font-inter` (Inter) — applied via `body { @apply font-inter }` (line 82)
- **Headlines:** `font-orbitron` (Orbitron) — used in `AGradientTitle` only
- **Sizes (from aras-primitives):** sm=`text-lg`, md=`text-xl`, lg=`text-2xl`, xl=`text-3xl`

## Spacing
- 8px base grid (standard Tailwind)
- Card padding: `p-6` (24px) — from `AGlassCard`
- Page padding: `p-6` desktop, `p-4` mobile

## Radii (from repo)
- `--radius: 0.5rem` (8px) — Tailwind base
- `AGlassCard: rounded-[22px]`
- Buttons: `rounded-full` (pill)
- Status badges: `rounded-full`
- Tables: `rounded-xl` (12px) — from admin-dashboard pattern
- Cards for admin: `rounded-xl` to `rounded-2xl` (12-16px)

## Shadows
- Glass: `shadow-lg shadow-black/20` (elevated variant)
- Buttons: `0 0 20px rgba(254,145,0,0.25)` (primary hover)
- No cheap glows on containers

## Motion
- Button transitions: `duration-200` (200ms)
- Accordion: `0.2s ease-out`
- CommandCenter sidebar: `duration: 0.2, ease: "easeInOut"`
- Sheet (slide-over): `duration-300` open, `duration-300` close
- **Reduced motion:** CommandCenter checks `prefers-reduced-motion` → `duration: 0`

## Existing Components to Reuse
| Component | File | What it does |
|-----------|------|-------------|
| `AGlassCard` | `ui/aras-primitives.tsx:20-50` | Glass container (default/elevated/subtle) |
| `AGradientTitle` | `ui/aras-primitives.tsx:57-89` | Orbitron gradient headline |
| `AButton` | `ui/aras-primitives.tsx:95-193` | Primary/secondary/ghost buttons |
| `AStatusBadge` | `ui/aras-primitives.tsx:200-237` | Status dots (pending/approved/error/info/warning) |
| `AStatePanel` | `ui/aras-primitives.tsx:243-end` | Loading skeleton / Empty / Error states |
| `Skeleton` | `ui/skeleton.tsx` | Basic pulse skeleton |
| `Sheet` | `ui/sheet.tsx` | Radix slide-over (right/left/top/bottom) |
| `Dialog` | `ui/dialog.tsx` | Radix modal dialog |
| `Table` | `ui/table.tsx` | Shadcn table primitives |
| `Badge` | `ui/badge.tsx` | Basic badge (default/secondary/destructive/outline) |
| `Toast` | `ui/toast.tsx` | Radix toast system |
| `AdminRoute` | `components/admin-route.tsx` | Frontend admin guard |
| `UserDeepDivePanel` | `admin/UserDeepDivePanel.tsx` | Existing deep-dive (816 lines, uses framer-motion) |

## Layout Pattern
- Admin: standalone full-page, no sidebar from app.tsx (admin-dashboard renders its own)
- Internal CRM: `CommandCenterLayout` wraps children with sidebar + topbar
- **Admin should NOT use CommandCenterLayout** — it has its own shell

## API Endpoints (Admin)
- `GET /api/admin/users` — list (no passwords)
- `GET /api/admin/stats` — KPI counts
- `GET /api/admin/online-users` — online user IDs
- `DELETE /api/admin/users/:userId` — disable (soft)
- `POST /api/admin/users/:userId/enable` — re-enable
- `GET /api/admin/users/:userId/deep-dive` — full user data
- `GET /api/admin/audit?limit=50&page=1&action=` — audit log
- `GET /api/admin/roles/stats` — role distribution
