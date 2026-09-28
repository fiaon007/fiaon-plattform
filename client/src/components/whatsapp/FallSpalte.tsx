// ═══════════════════════════════════════════════════════════════════════════
// DER FALL (23.09.2026, E-218; neu gesetzt 28.09.2026, E-248)
//
// Justin: „Ein Mitarbeiter soll auch darüber Vertrieb machen können."
// Dafür braucht er hier dasselbe wie am Telefon: wer das ist, wo er steht,
// was offen ist — und die Handlungen, ohne die Seite zu wechseln.
// Breit genug: eigene Spalte rechts. Sonst: Schublade über dem Verlauf,
// geöffnet über das Zeichen im Chat-Kopf.
// ═══════════════════════════════════════════════════════════════════════════
import { datumKurz, stufeKlasse, stufeText, terminText, uhr, vorname, ZAHLTEXT, type ChatDaten } from "./wr-format";

export function FallSpalte({
  chat, name, schublade, onZu, onAnrufen, anrufenMoeglich, sendet,
  ergebnisOffen, setErgebnisOffen, onErgebnis, notizEntwurf, setNotizEntwurf, onNotiz,
  schrittSchalter, alleSchritte, onAlleSchritte,
}: {
  chat: ChatDaten; name: string; schublade: boolean; onZu: () => void;
  onAnrufen: () => void; anrufenMoeglich: boolean; sendet: boolean;
  ergebnisOffen: boolean; setErgebnisOffen: (v: boolean) => void; onErgebnis: (wert: string) => void;
  notizEntwurf: string; setNotizEntwurf: (t: string) => void; onNotiz: () => void;
  schrittSchalter: boolean; alleSchritte: boolean; onAlleSchritte: () => void;
}) {
  const l = chat.lage;
  return (
    <aside className={`wr-person${schublade ? " schublade" : ""}`} aria-label="Der Fall">
      <div className="wr-person-kopf">
        <h2>{l.name || name || "Unbekannt"}</h2>
        {schublade && <button type="button" className="wr-klein" onClick={onZu}>Schließen</button>}
      </div>
      <div className="wr-marken">
        {l.stufe && <span className={`wr-marke stufe-${stufeKlasse(l.stufe)}`}>{stufeText(l.stufe)}</span>}
        {l.istLead && <span className="wr-marke">Interessent</span>}
        {l.gekuendigt_am && <span className="wr-marke warn">Gekündigt</span>}
        {l.mandat_seit && <span className="wr-marke">Mandat</span>}
        {Number(l.nicht_erreicht) > 0 && <span className="wr-marke warn">{l.nicht_erreicht}× nicht erreicht</span>}
      </div>

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
        {l.phone && <><dt>Telefon</dt><dd>{l.phone}</dd></>}
        {l.email && <><dt>E-Mail</dt><dd>{l.email}</dd></>}
        {l.ref && <><dt>Antrag</dt><dd>{l.ref}</dd></>}
      </dl>
      {l.anzeige && <p className="wr-still">Kam über: {l.anzeige}</p>}

      <div className="wr-person-knoepfe">
        {!l.istLead && <a className="wr-knopf" href={`/agent/pipeline?person=${l.id}`} target="_blank" rel="noreferrer">Akte öffnen</a>}
        {anrufenMoeglich && <button type="button" className="wr-knopf" onClick={onAnrufen}>Anrufen</button>}
        {chat.links?.zahlung && <a className="wr-knopf" href={chat.links.zahlung} target="_blank" rel="noreferrer">Zahlungsseite</a>}
      </div>

      {!l.istLead && (
        <div className="wr-ergebnis">
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
        </div>
      )}

      <div className="wr-notiz">
        <label htmlFor="wr-notiz-feld">Notiz zum Gespräch</label>
        <textarea id="wr-notiz-feld" rows={2} value={notizEntwurf} maxLength={500}
          onChange={(e) => setNotizEntwurf(e.target.value)} placeholder="Was man beim nächsten Mal wissen muss." />
        {notizEntwurf !== (chat.notiz ?? "") && <button type="button" className="wr-klein" onClick={onNotiz}>Notiz sichern</button>}
      </div>

      {schrittSchalter && (
        <label className="wr-schrittschalter">
          <input type="checkbox" checked={alleSchritte} onChange={onAlleSchritte} />
          Maras interne Schritte alle aufgeklappt zeigen
        </label>
      )}

      <p className="wr-still wr-hinweis">
        Mahnungen, Forderungen und Ratenrückstände gehen nie über WhatsApp — das verbietet Meta und kostet im
        Ernstfall unsere Nummer. Dafür bleiben Mail, Telefon und Brief.
      </p>
    </aside>
  );
}
