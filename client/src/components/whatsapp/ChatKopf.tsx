// ═══════════════════════════════════════════════════════════════════════════
// DER CHAT-KOPF (E-248) — die EINE Glasstelle des Raums
//
// VORHER brach er auf zwei bis drei Zeilen um (Handy 102 px): Nummer ohne
// Leerzeichen, Betreuer, Fenster, Mara-Grund. Der Termin aus dem Kalender —
// im Pflichtfall DIE Information („heute 20 Uhr ruft Florentine an") —
// stand nur rechts in der Fall-Spalte.
//
// NACHHER: Name, darunter „Stufe B · Florentine"; der Termin als Chip
// („Termin heute 20:00 · Florentine", am Handy in der Unterzeile); rechts
// Mara-Schalter, Anrufen und — wenn die Fall-Spalte nicht daneben passt —
// der Fall. Das Fenster steht über dem Eingabefeld, dort wird es gebraucht.
//
// E-IT-H (08.10.2026, Punkt 15): Das (i) gibt es jetzt in JEDER Breite. Ist
// Platz für die Fall-Spalte, blendet es sie ein und aus (der Browser merkt
// sich die Wahl); sonst öffnet es die Schublade über dem Verlauf.
// ═══════════════════════════════════════════════════════════════════════════
import { stufeText, terminText, vorname } from "./wr-format";

export function ChatKopf({
  name, stufe, betreuer, termin, terminMitarbeiter, maraAn, maraAusGrund, onMara, onZurueck, zurueck,
  onAnrufen, anrufenMoeglich, fallKnopf, fallOffen, onFall, alleSchritte, onAlleSchritte, schrittKnopf,
}: {
  name: string; stufe: string | null; betreuer: string | null;
  termin: string | null; terminMitarbeiter: string | null;
  maraAn: boolean; maraAusGrund: string | null | undefined; onMara: () => void;
  zurueck: boolean; onZurueck: () => void;
  onAnrufen: () => void; anrufenMoeglich: boolean;
  fallKnopf: boolean; fallOffen: boolean; onFall: () => void;
  schrittKnopf: boolean; alleSchritte: boolean; onAlleSchritte: () => void;
}) {
  const terminSatz = termin ? `Termin ${terminText(termin)}${terminMitarbeiter ? ` · ${vorname(terminMitarbeiter)}` : ""}` : null;
  // Ruft der Betreuer selbst an, steht sein Name nur einmal da („Termin heute 20:00 · Florentine · Stufe B").
  const betreuerZeigen = betreuer && (!termin || !terminMitarbeiter || vorname(betreuer) !== vorname(terminMitarbeiter));
  const unter = [stufeText(stufe), betreuerZeigen ? vorname(betreuer) : null].filter(Boolean).join(" · ");
  const maraTitel = maraAn
    ? "Mara antwortet in diesem Gespräch. Klicken schaltet sie hier ab."
    : maraAusGrund === "schalter"
      ? "Mara ist hier abgeschaltet, bis jemand sie wieder einschaltet."
      : "Mara pausiert, weil jemand aus dem Team schreibt. Bleibt der Kunde 15 Minuten ohne Antwort (nachts sofort), übernimmt sie wieder.";
  return (
    <div className="wr-chat-kopf">
      {zurueck && (
        <button type="button" className="wr-zurueck" onClick={onZurueck} aria-label="Zurück zur Liste">
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      )}
      <span className="wr-avatar" aria-hidden="true">{(name || "?").slice(0, 1).toUpperCase()}</span>
      <div className="wr-chat-wer">
        <b title={name}>{name}</b>
        <small>
          {terminSatz && <span className="wr-termin-kurz">{terminSatz}{unter ? " · " : ""}</span>}
          {unter}
        </small>
      </div>
      {terminSatz && <span className="wr-termin-chip" title="Aus dem Kalender">{terminSatz}</span>}
      <div className="wr-chat-knoepfe">
        <button type="button" className={`wr-schalter${maraAn ? " an" : ""}`} onClick={onMara} aria-pressed={maraAn} title={maraTitel}>
          <span aria-hidden="true" />Mara{!maraAn && <em>{maraAusGrund === "schalter" ? " aus" : " pausiert"}</em>}
        </button>
        {schrittKnopf && (
          <button type="button" className={`wr-ikon${alleSchritte ? " an" : ""}`} onClick={onAlleSchritte} aria-pressed={alleSchritte}
            title={alleSchritte ? "Maras interne Schritte bündeln" : "Maras interne Schritte alle zeigen"} aria-label="Maras interne Schritte alle zeigen">
            <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 5h12M3 9h12M3 13h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        )}
        {anrufenMoeglich && (
          <button type="button" className="wr-ikon" onClick={onAnrufen} aria-label="Anrufen" title="Anrufen">
            <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.2 3.5h3l1.6 4.2-2 1.4a11 11 0 0 0 5.1 5.1l1.4-2 4.2 1.6v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3.2 5.7a2 2 0 0 1 2-2.2z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
          </button>
        )}
        {fallKnopf && (
          <button type="button" className={`wr-ikon wr-fall-knopf${fallOffen ? " an" : ""}`} onClick={onFall} aria-pressed={fallOffen}
            aria-label="Den Fall ein- oder ausblenden" title="Den Fall ein- oder ausblenden: Stufe, Zahlung, Termin, Notiz, Ergebnis buchen">
            <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M12 11v5.5M12 7.6v.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        )}
      </div>
    </div>
  );
}
