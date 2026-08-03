/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FIAON — die fünf Zeichen
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Der gesamte Kundenbereich kennt GENAU FÜNF Symbole. Keine Icon-Bibliothek:
 * eine solche Abhängigkeit lädt hunderte Zeichen, von denen jedes eine eigene
 * Handschrift mitbringt, und verführt dazu, jede Zeile zu bebildern.
 *
 * Gemeinsame Regeln — wer ein sechstes Zeichen ergänzen will, muss sie
 * einhalten und begründen, warum Text nicht genügt:
 *   · 20×20 Bezugsraster, `size` skaliert proportional
 *   · Strichstärke 1,5 px, runde Enden und Ecken
 *   · `currentColor`, niemals eine eigene Farbe
 *   · strikt geometrisch: Kreise, gerade Linien, 45-Grad-Winkel
 *
 * Warum überhaupt Symbole, wenn Text klarer ist: An drei Stellen ist der Platz
 * physisch zu knapp für ein Wort (Schließen im Kopf des Slide-overs, Aufklapp-
 * Winkel am Hinweis, Zurück-Pfeil) und an einer ist das Symbol schneller
 * erfassbar als das Wort (Telefon auf dem Primärknopf, neben dem Wort
 * „Anrufen"). Alles andere trägt Text.
 */

type Props = { size?: number; className?: string; strokeWidth?: number };

function Rahmen({ size = 20, className = "", strokeWidth = 1.5, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 20 20" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false" className={className}
    >
      {children}
    </svg>
  );
}

/** 1 — Telefon. Bewusst ein abstrakter Hörer aus zwei Bögen, kein Klotz. */
export function ZeichenTelefon(p: Props) {
  return (
    <Rahmen {...p}>
      <path d="M6.5 3.5h-2a1.5 1.5 0 0 0-1.5 1.6c.3 3.3 1.7 6.4 4 8.7s5.4 3.7 8.7 4a1.5 1.5 0 0 0 1.6-1.5v-2a1.5 1.5 0 0 0-1.3-1.5 8 8 0 0 1-1.8-.4 1.5 1.5 0 0 0-1.6.3l-.8.9a12 12 0 0 1-4.4-4.4l.9-.8a1.5 1.5 0 0 0 .3-1.6 8 8 0 0 1-.4-1.8 1.5 1.5 0 0 0-1.5-1.3z" />
    </Rahmen>
  );
}

/** 2 — Schließen. Zwei Diagonalen, exakt 45 Grad. */
export function ZeichenSchliessen(p: Props) {
  return (
    <Rahmen {...p}>
      <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
    </Rahmen>
  );
}

/**
 * 3 — Winkel. EIN Zeichen für alle Richtungen: `richtung` dreht es. Ein
 * eigenes Zeichen je Richtung wären vier fast identische Pfade.
 */
export function ZeichenWinkel({ richtung = "unten", ...p }: Props & { richtung?: "oben" | "unten" | "links" | "rechts" }) {
  const grad = { oben: 180, unten: 0, links: 90, rechts: -90 }[richtung];
  return (
    <Rahmen {...p} className={`${p.className ?? ""} transition-transform duration-200`}>
      <g style={{ transform: `rotate(${grad}deg)`, transformOrigin: "10px 10px" }}>
        <path d="M5.5 8l4.5 4.5L14.5 8" />
      </g>
    </Rahmen>
  );
}

/** 4 — Pfeil zurück. Linie plus Spitze, damit die Richtung eindeutig ist. */
export function ZeichenZurueck(p: Props) {
  return (
    <Rahmen {...p}>
      <path d="M16 10H4.5M9 4.5L3.5 10l5.5 5.5" />
    </Rahmen>
  );
}

/** 5 — Haken. Bestätigung nach einer Aktion. */
export function ZeichenHaken(p: Props) {
  return (
    <Rahmen {...p}>
      <path d="M4.5 10.5l3.5 3.5 7.5-8" />
    </Rahmen>
  );
}

/**
 * Leerzustand: konzentrische Kreise, CI-Blau bei 8 %. Keine Illustration,
 * sondern eine Form — sie bedeutet nichts Bestimmtes und passt deshalb zu
 * jedem leeren Abschnitt, ohne je falsch zu sein.
 */
export function LeerForm({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-hidden="true" className="mx-auto">
      {[40, 30, 20, 10].map((r, i) => (
        <circle key={r} cx="48" cy="48" r={r}
                stroke="var(--fi-primaer)" strokeOpacity={0.08 + i * 0.02} strokeWidth="1.5" />
      ))}
      <circle cx="48" cy="48" r="3" fill="var(--fi-primaer)" fillOpacity="0.16" />
    </svg>
  );
}
