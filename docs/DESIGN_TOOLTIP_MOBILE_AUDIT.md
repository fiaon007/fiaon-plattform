# Design-Qualität, Tooltips & Mobile — Audit + Umsetzung (Prompt 1/3)

Stand: 16.07.2026 · Bereich: `/admin/*` · Keine Geschäftslogik geändert.

---

## Phase 0 — Befund

### 1. Tooltip-Bug (bestätigt: natives `title`-Attribut)

Die Info-„i" waren als **natives `title`-Attribut** umgesetzt. Das erklärt jedes
Symptom:

- **Desktop:** Der Browser rendert `title` verzögert (~1 s) und als hässlichen,
  nicht gestalteten OS-Kasten — außerhalb des CI.
- **Mobile:** `title` hat **kein** Touch-Verhalten. Beim Antippen passiert nichts;
  sichtbar bleibt nur der `cursor-help` (Fragezeichen-Cursor).

**Betroffene Stellen (vorher):**

| Ort | Muster | Anzahl |
| --- | --- | --- |
| `components/admin/PageHelp.tsx` → `Tip` | `title` + `cursor-help` | 1 Komponente |
| `pages/admin-leistung.tsx` | `<Tip>` (Kennzahlen + Tabellenköpfe) | 12 |
| `pages/admin-hub.tsx` | `<Tip>` (Tages-Kennzahlen) | 4 |
| `pages/admin-finanzen.tsx` | eigenes inline-„i" (`cursor-help` + `title`) | Kpi + 8 Funnel-Stufen |

Da `Tip` zentral ist, behebt ein Fix der Komponente **alle** `<Tip>`-Stellen auf
einmal. Die Kopie in `admin-finanzen` wurde auf dieselbe Komponente umgestellt.

### 2. KI-Ausgabe (Markdown-Rohtext)

Die KI-Analyse wurde mit `whitespace-pre-wrap` **roh** ausgegeben — `## Was lief gut`
und `**Text**` standen als Zeichen auf der Seite (`admin-leistung.tsx:152`,
`admin-diagnose.tsx:335`). Zusätzlich lief der Text über die **volle Breite** =
unlesbar.

### 3. Mobile-Audit (380 px)

| Seite | Was brach | Regel |
| --- | --- | --- |
| `/admin/leistung` | **Team-Tabelle (11 Spalten)** scrollt horizontal, „Direktzahler" abgeschnitten | Kern-Problem |
| `/admin/leistung` | KI-Analyse über volle Breite, Rohtext | Lesbarkeit |
| `/admin/leistung`, `/admin/hub`, `/admin/finanzen` | Info-Tooltips per Tap tot | Tooltip-Bug |
| `/admin/finanzen` | Kennzahl-/Funnel-Tooltips tot | Tooltip-Bug |

Touch-Ziel-„i": vorher 14 px (weit unter 44 px).

---

## Umsetzung

### Tooltips — eine gemeinsame Komponente

`Tip` (`client/src/components/admin/PageHelp.tsx`):

- **Klick/Tap** statt Hover → funktioniert auf dem Handy.
- Rendert per **Portal an `<body>`** mit `position: fixed` und **eigener
  Viewport-Positionierung** (klemmt sich in den sichtbaren Bereich, kippt bei
  wenig Platz nach oben) → wird **nie** von `overflow-hidden`-Tabellen/Karten
  abgeschnitten.
- Dezente Karte im CI (weiß, slate-Rand, feiner Schatten), sanfte Einblendung
  (160 ms), **schließt bei Klick daneben oder ESC**.
- Trigger mit vergrößertem Hit-Bereich (`p-1.5 -m-1.5`), `aria-label` +
  `aria-expanded`.
- **API unverändert** (`<Tip text="…" />`) → alle 17 Aufrufe funktionieren ohne
  weitere Änderung; native `title`-Doppelungen an den Kacheln entfernt.

### KI-Buttons & -Ausgaben

`AiKit.tsx` (`client/src/components/admin/AiKit.tsx`):

- **`AiButton`** — subtiler dunkler Verlauf + feine Innenkante + weicher Schatten
  (kein Neon/Glow), Hover hebt 1 px, ruhiger Ladezustand (sanft pulsierendes
  Icon statt hartem Spinner), `min-h-44px`.
- **`Markdown`** — leichter Renderer für die KI-Ausgabe: Überschriften (`#`–`####`),
  Aufzählungen (`-`/`*`/`•`), nummerierte Listen, **fett**, *kursiv*, `code`.
  Monochrom-slate, **Lesebreite `max-w-[68ch]`**.
- Verdrahtet in `/admin/leistung` (Analyse) und `/admin/diagnose` (Auswertung).

### Layout & Tabellen

- KI-Textblöcke auf angenehme Lesebreite begrenzt.
- **`/admin/leistung`**: Team-Tabelle bleibt auf Desktop (`hidden lg:block`); unter
  `lg` **stapeln Karten** (Agent oben, Kennzahlen als Paare, wichtige zuerst:
  Abschlüsse/Umsatz groß). Zeile/Karte tappbar (≥ 44 px) zeigt Ergebnis-Details.
- Keine horizontale Scrollwüste mehr bei 380 px.

### CI-Qualität

`client/src/index.css`:

- Feine Schatten-Hierarchie (Karte < Drawer < Dialog beibehalten), konsistente
  Radien/Abstände, ruhige Übergänge (150–200 ms).
- **`prefers-reduced-motion`**: `.fiaon-tip-card`, `.fiaon-ai-pulse` und der
  Button-Lift werden abgeschaltet.
- Bestehendes CI (monochrom slate, keine Emojis) bleibt — nur hochwertiger.

---

## Vorher / Nachher — Screenshots

> Screenshots gehören in `docs/img/`. Aufnahme (Admin-Login nötig):

1. Dev-Server: `npm run dev` → `http://localhost:5000/admin/leistung`.
2. Desktop: Fenster ~1280 px.
3. Mobile: DevTools Device-Toolbar → **380 px** Breite.

| Ansicht | Vorher | Nachher |
| --- | --- | --- |
| Tooltip (Desktop) | `img/tooltip-desktop-before.png` | `img/tooltip-desktop-after.png` |
| Tooltip (380 px, Tap) | `img/tooltip-mobile-before.png` | `img/tooltip-mobile-after.png` |
| KI-Analyse | `img/ki-before.png` | `img/ki-after.png` |
| Leistungs-Tabelle (380 px) | `img/table-mobile-before.png` | `img/table-mobile-after.png` |

---

## Abnahme-Tests

- **Tooltip öffnet per Tap auf dem Handy** — `Tip` ist ein `<button>` mit
  `onClick`; kein Hover-Zwang.
- **KI-Analyse ist gerendert und lesbar** — `Markdown` + `max-w-[68ch]`.
- **Keine Seite scrollt horizontal bei 380 px** — Team-Tabelle als Karten;
  restliche Tabellen ≤ 4 Spalten passen.
