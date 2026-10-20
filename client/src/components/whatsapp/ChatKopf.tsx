// ═══════════════════════════════════════════════════════════════════════════
// DER CHAT-KOPF (E-248 · Neubau 20.10.2026) — die EINE Glasstelle des Raums
//
// Wie bei WhatsApp: rundes Bild, Name, darunter Nummer · Stufe · Betreuer.
// Ein Klick auf Bild oder Name öffnet die Kontaktinfo (den Fall). Rechts
// höchstens vier ruhige Zeichen: Mara-Schalter (klein, mit Bahn), Anrufen,
// Akte, (i). Der Termin aus dem Kalender — im Pflichtfall DIE Information
// („Termin morgen 10:00 · Lea") — steht als Chip daneben, im schmalen Chat
// in der Unterzeile. Das Fenster steht über dem Eingabefeld, dort wird es
// gebraucht.
//
// Mara-Schalter (E-230): an · pausiert (ein Mensch schreibt, läuft nach 15
// Minuten ohne Antwort ab, nachts sofort) · aus (bewusst, bleibt).
// ═══════════════════════════════════════════════════════════════════════════
import { Avatar } from "./Avatar";
import { Stufe } from "./Gespraechsliste";
import { nummerLesbar, terminText, vorname } from "./wr-format";
import { ZAkte, ZFunke, ZInfo, ZKalender, ZTelefon, ZZurueck } from "./Symbole";

export function ChatKopf({
  name, nummer, stufe, betreuer, termin, terminMitarbeiter, maraAn, maraAusGrund, onMara, onZurueck, zurueck,
  onAnrufen, anrufenMoeglich, akteLink, fallKnopf, fallOffen, onFall,
}: {
  name: string; nummer: string; stufe: string | null; betreuer: string | null;
  termin: string | null; terminMitarbeiter: string | null;
  maraAn: boolean; maraAusGrund: string | null | undefined; onMara: () => void;
  zurueck: boolean; onZurueck: () => void;
  onAnrufen: () => void; anrufenMoeglich: boolean;
  /** /akte/<Kennung> — nur, wenn es einen Menschen im System gibt. */
  akteLink: string | null;
  fallKnopf: boolean; fallOffen: boolean; onFall: () => void;
}) {
  const terminSatz = termin ? `Termin ${terminText(termin)}${terminMitarbeiter ? ` · ${vorname(terminMitarbeiter)}` : ""}` : null;
  // Ruft der Betreuer selbst an, steht sein Name nur einmal da.
  const betreuerZeigen = betreuer && (!termin || !terminMitarbeiter || vorname(betreuer) !== vorname(terminMitarbeiter));
  const nr = nummerLesbar(nummer);
  const unter = [name !== `+${nummer}` && name !== nr ? nr : null, betreuerZeigen ? vorname(betreuer) : null].filter(Boolean).join(" · ");
  const pausiert = !maraAn && maraAusGrund !== "schalter";
  const maraTitel = maraAn
    ? "Mara antwortet in diesem Gespräch. Klicken schaltet sie hier ab."
    : maraAusGrund === "schalter"
      ? "Mara ist hier abgeschaltet, bis jemand sie wieder einschaltet. Klicken schaltet sie an."
      : "Mara pausiert, weil jemand aus dem Team schreibt. Bleibt der Kunde 15 Minuten ohne Antwort (nachts sofort), übernimmt sie wieder. Klicken schaltet sie sofort an.";
  const person = (
    <>
      <Avatar name={name.startsWith("+") ? null : name} schluessel={nummer} groesse="m" />
      <span className="wr-chat-wer">
        <span className="wr-chat-name"><b title={name}>{name}</b><Stufe stufe={stufe} /></span>
        <small>
          {terminSatz && <span className="wr-termin-kurz"><ZKalender g={13} />{terminSatz}{unter ? " · " : ""}</span>}
          {unter || (terminSatz ? "" : "WhatsApp")}
        </small>
      </span>
    </>
  );
  return (
    <div className="wr-chat-kopf">
      {zurueck && (
        <button type="button" className="wr-zurueck" onClick={onZurueck} aria-label="Zurück zur Liste" title="Zurück zur Liste">
          <ZZurueck g={22} />
        </button>
      )}
      {fallKnopf
        ? <button type="button" className="wr-chat-person" onClick={onFall} title="Kontaktinfo öffnen">{person}</button>
        : <div className="wr-chat-person">{person}</div>}
      {terminSatz && <span className="wr-termin-chip" title="Aus dem Kalender"><ZKalender g={14} />{terminSatz}</span>}
      <div className="wr-chat-knoepfe">
        <button type="button" className={`wr-schalter${maraAn ? " an" : ""}${pausiert ? " pause" : ""}`} onClick={onMara} aria-pressed={maraAn} title={maraTitel}>
          <ZFunke g={15} />
          <span className="wr-schalter-wort">Mara{!maraAn && <em>{maraAusGrund === "schalter" ? " aus" : " pausiert"}</em>}</span>
          <span className="wr-schalter-bahn" aria-hidden="true"><i /></span>
        </button>
        {anrufenMoeglich && (
          <button type="button" className="wr-ikon" onClick={onAnrufen} aria-label="Anrufen" title="Anrufen"><ZTelefon /></button>
        )}
        {akteLink && (
          <a className="wr-ikon wr-akte-knopf" href={akteLink} target="_blank" rel="noopener" aria-label="Akte öffnen" title="Akte öffnen (neuer Tab)"><ZAkte /></a>
        )}
        {fallKnopf && (
          <button type="button" className={`wr-ikon wr-fall-knopf${fallOffen ? " an" : ""}`} onClick={onFall} aria-pressed={fallOffen}
            aria-label="Kontaktinfo ein- oder ausblenden" title="Kontaktinfo: Stufe, Zahlung, Termin, Notiz, Ergebnis buchen">
            <ZInfo />
          </button>
        )}
      </div>
    </div>
  );
}
