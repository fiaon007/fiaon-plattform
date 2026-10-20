// ═══════════════════════════════════════════════════════════════════════════
// DER FALL = DIE KONTAKTINFO (E-218 · E-248 · Neubau 20.10.2026)
//
// Justin: „Ein Mitarbeiter soll auch darüber Vertrieb machen können."
// Dafür braucht er hier dasselbe wie am Telefon: wer das ist, wo er steht,
// was offen ist — und die Handlungen, ohne die Seite zu wechseln.
//
// 20.10.2026 wie bei WhatsApp „Kontaktinfo": über das (i) oder einen Klick auf
// Namen/Bild im Chat-Kopf; großes rundes Bild, Name, Nummer, darunter die
// drei Handlungen (Anrufen · Akte · Zahlungsseite), dann die Fakten, Mara,
// Ergebnis buchen, Notiz. Breit genug: eigene Spalte rechts. Sonst liegt sie
// über dem Verlauf. Das × schließt sie.
// „Akte" führt seit dem Neubau auf die EINE Adresse /akte/<Kennung> (E-315) —
// vorher /agent/pipeline?person=…, das im Chefbüro ohne Office-Sitzung ins
// Leere lief.
// ═══════════════════════════════════════════════════════════════════════════
import { Avatar } from "./Avatar";
import { datumKurz, nummerLesbar, stufeKlasse, stufeText, terminText, uhr, vorname, ZAHLTEXT, type ChatDaten } from "./wr-format";
import { ZAkte, ZFunke, ZLink, ZSchliessen, ZTelefon } from "./Symbole";

export function FallSpalte({
  chat, name, nummer, schublade, onZu, onAnrufen, anrufenMoeglich, sendet, akteLink,
  ergebnisOffen, setErgebnisOffen, onErgebnis, notizEntwurf, setNotizEntwurf, onNotiz,
  maraAn, maraAusGrund, onMara, schrittSchalter, alleSchritte, onAlleSchritte,
}: {
  chat: ChatDaten; name: string; nummer: string; schublade: boolean; onZu: () => void;
  onAnrufen: () => void; anrufenMoeglich: boolean; sendet: boolean;
  akteLink: string | null;
  ergebnisOffen: boolean; setErgebnisOffen: (v: boolean) => void; onErgebnis: (wert: string) => void;
  notizEntwurf: string; setNotizEntwurf: (t: string) => void; onNotiz: () => void;
  maraAn: boolean; maraAusGrund: string | null | undefined; onMara: () => void;
  schrittSchalter: boolean; alleSchritte: boolean; onAlleSchritte: () => void;
}) {
  const l = chat.lage;
  const anzeigeName = l.name || name || "Unbekannt";
  const maraSatz = maraAn ? "Mara antwortet hier" : maraAusGrund === "schalter" ? "Mara ist hier aus" : "Mara pausiert — übernimmt nach 15 Min. ohne Antwort";
  return (
    <aside className={`wr-person${schublade ? " schublade" : ""}`} aria-label="Kontaktinfo">
      <div className="wr-person-leiste">
        <button type="button" className="wr-ikon" onClick={onZu} aria-label="Kontaktinfo schließen" title="Schließen"><ZSchliessen g={18} /></button>
        <b>Kontaktinfo</b>
      </div>
      <div className="wr-person-inhalt">
        <section className="wr-person-kopf">
          <Avatar name={anzeigeName === "Unbekannt" ? null : anzeigeName} schluessel={nummer} groesse="xl" />
          <h2>{anzeigeName}</h2>
          <p className="wr-person-nummer">{nummerLesbar(l.phone || nummer)}</p>
          <div className="wr-marken">
            {l.stufe && <span className={`wr-marke stufe-${stufeKlasse(l.stufe)}`}>{stufeText(l.stufe)}</span>}
            {l.istLead && <span className="wr-marke">Interessent</span>}
            {l.gekuendigt_am && <span className="wr-marke warn">Gekündigt</span>}
            {l.mandat_seit && <span className="wr-marke">Mandat</span>}
            {Number(l.nicht_erreicht) > 0 && <span className="wr-marke warn">{l.nicht_erreicht}× nicht erreicht</span>}
          </div>
          <div className="wr-person-aktionen">
            {anrufenMoeglich && (
              <button type="button" className="wr-aktion" onClick={onAnrufen}><ZTelefon g={20} /><span>Anrufen</span></button>
            )}
            {akteLink && (
              <a className="wr-aktion" href={akteLink} target="_blank" rel="noopener"><ZAkte g={20} /><span>Akte</span></a>
            )}
            {chat.links?.zahlung && (
              <a className="wr-aktion" href={chat.links.zahlung} target="_blank" rel="noopener noreferrer" title="Seine Zahlungsseite (neuer Tab)"><ZLink g={20} /><span>Zahlung</span></a>
            )}
          </div>
        </section>

        <section className="wr-person-block">
          <dl>
            {l.termin && <><dt>Termin</dt><dd className="wr-gut">{terminText(l.termin)}{l.termin_mitarbeiter ? ` · ${vorname(l.termin_mitarbeiter)}` : ""}</dd></>}
            {l.paket && <><dt>Paket</dt><dd>{String(l.paket).split("\n")[0]}</dd></>}
            {l.zahlstatus && <><dt>Zahlung</dt><dd>{ZAHLTEXT[l.zahlstatus] ?? l.zahlstatus}</dd></>}
            {l.rate_nr != null && (
              <><dt>Offene Rate</dt><dd>
                Rate {l.rate_nr} · {(Number(l.betrag_cents || 0) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
                {l.faellig_am ? ` · fällig ${datumKurz(l.faellig_am)}` : ""}
              </dd></>
            )}
            {l.promised_payment_date && <><dt>Zusage</dt><dd>{datumKurz(l.promised_payment_date)}</dd></>}
            {l.follow_up_date && <><dt>Wiedervorlage</dt><dd>{datumKurz(l.follow_up_date)}</dd></>}
            {l.letzter_kontakt && <><dt>Zuletzt gesprochen</dt><dd>{datumKurz(l.letzter_kontakt)} {uhr(l.letzter_kontakt)}</dd></>}
            {l.betreuer && <><dt>Betreuer</dt><dd>{l.betreuer}</dd></>}
            {l.email && <><dt>E-Mail</dt><dd>{l.email}</dd></>}
            {l.ref && <><dt>Antrag</dt><dd>{l.ref}</dd></>}
            {l.anzeige && <><dt>Kam über</dt><dd>{l.anzeige}</dd></>}
          </dl>
        </section>

        <section className="wr-person-block wr-person-mara">
          <button type="button" className={`wr-mara-zeile${maraAn ? " an" : maraAusGrund === "schalter" ? "" : " pause"}`} onClick={onMara} aria-pressed={maraAn}
            title={maraAn ? "Klicken schaltet Mara in diesem Gespräch ab" : "Klicken schaltet Mara in diesem Gespräch an"}>
            <ZFunke g={18} />
            <span>{maraSatz}</span>
            <span className="wr-schalter-bahn" aria-hidden="true"><i /></span>
          </button>
          {schrittSchalter && (
            <label className="wr-schrittschalter">
              <input type="checkbox" checked={alleSchritte} onChange={onAlleSchritte} />
              Maras interne Schritte alle aufgeklappt zeigen
            </label>
          )}
        </section>

        {!l.istLead && (
          <section className="wr-person-block wr-ergebnis">
            <button type="button" className="wr-knopf voll" aria-expanded={ergebnisOffen} onClick={() => setErgebnisOffen(!ergebnisOffen)}>
              {ergebnisOffen ? "Schließen" : "Ergebnis buchen"}
            </button>
            {ergebnisOffen && (
              <div className="wr-ergebnis-liste">
                <p className="wr-still">Das Ergebnis geht denselben Weg wie in der Akte — Wiedervorlage und Pipeline ziehen mit.</p>
                {chat.ergebnisse.map((e) => (
                  <button key={e.wert} type="button" className="wr-klein" disabled={sendet} onClick={() => onErgebnis(e.wert)}>{e.text}</button>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="wr-person-block wr-notiz">
          <label htmlFor="wr-notiz-feld">Notiz zum Gespräch (nur intern)</label>
          <textarea id="wr-notiz-feld" rows={2} value={notizEntwurf} maxLength={500}
            onChange={(e) => setNotizEntwurf(e.target.value)} placeholder="Was man beim nächsten Mal wissen muss." />
          {notizEntwurf !== (chat.notiz ?? "") && <button type="button" className="wr-klein" onClick={onNotiz}>Notiz sichern</button>}
        </section>

        <p className="wr-still wr-hinweis">
          Mahnungen, Forderungen und Ratenrückstände gehen nie über WhatsApp — das verbietet Meta und kostet im
          Ernstfall unsere Nummer. Dafür bleiben Mail, Telefon und Brief.
        </p>
      </div>
    </aside>
  );
}
