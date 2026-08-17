// ═══════════════════════════════════════════════════════════════════════════
// DIE MARKE FÜR „E-MAIL-EVENTS"
//
// ── DER BEFUND (20.08.2026) ────────────────────────────────────────────────
// In der Verwaltungs-Navigation trugen „Mail-Zentrale" und „E-Mail-Events"
// dasselbe Zeichen (`Send` aus lucide-react). Zwei Einträge direkt untereinander,
// gleiches Bild — wer schnell klickt, landet im falschen Bereich.
//
// Die beiden tun völlig verschiedene Dinge:
//   Mail-Zentrale   schreibt und verschickt Freitext an Kunden und Gruppen.
//   E-Mail-Events   PRÜFT die automatischen Zweige und zeigt die Ampel.
//
// ── DAS MOTIV ──────────────────────────────────────────────────────────────
// Ein Briefumschlag mit einem Haken: Post, die geprüft ist. Nicht ein zweiter
// Pfeil (das wäre wieder „senden") und keine Ampel als Ampel — drei Punkte in
// einem 20×20-Feld werden bei 16 px zu Brei.
//
// ── DIE FORM ───────────────────────────────────────────────────────────────
// Dieselben Regeln wie die fünf Kundenzeichen (client/src/lib/fiaon-zeichen.tsx):
// 20×20 Bezugsraster, 1,5 px Strich, runde Enden, `currentColor`, geometrisch.
// Die Schnittstelle ist die von lucide-react (`size`, `className`, `strokeWidth`),
// damit sie in der Navigation ohne Sonderbehandlung einsetzbar ist.
// ═══════════════════════════════════════════════════════════════════════════

export function ZeichenMailPruefung({
  size = 20, className = "", strokeWidth = 1.5,
}: { size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 20 20" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false" className={className}
    >
      {/* Der Umschlag — links offen gelassen, damit der Haken Platz hat, ohne
          Linien zu überschneiden. Überschneidungen werden bei 16 px zu Flecken. */}
      <path d="M2.5 5.5h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z" />
      {/* Die Falte: zwei Striche statt eines Dreiecks — ein gefülltes Dreieck
          wäre die einzige Fläche im ganzen Zeichensatz. */}
      <path d="m1.9 6.2 6.1 4.3 3.2-2.3" />
      {/* Der Haken, rechts außerhalb des Umschlags: „geprüft". Er sitzt
          bewusst über der Ecke, damit er auch klein als eigenes Element
          erkennbar bleibt. */}
      <path d="m12.4 11.8 2 2 3.1-3.6" />
    </svg>
  );
}
