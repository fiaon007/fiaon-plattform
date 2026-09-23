// ═══════════════════════════════════════════════════════════════════════════
// FIAON BANKING — Aufträge und Freigaben (E-228)
//
// Jeder Zahlungsauftrag als eigene Karte mit dem einen nächsten Schritt.
// Freigeben geht nur mit TAN; eintragen, dass überwiesen wurde, nur mit der
// Referenz der Bank.
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { ruf, type Auftrag, type AuftragStatus, type Ich } from "./api";
import { betragText, geld, heute, ibanHuebsch, tag, zeit } from "./format";
import { Chip, Feld, Knopf, KnopfLink, Kopierfeld, Leer, Meldung, Zeichen, type ChipArt } from "./ui";
import { TanDialog } from "./tan";

const STATUS: Record<AuftragStatus, { text: string; art: ChipArt }> = {
  entwurf: { text: "Entwurf", art: "still" },
  eingereicht: { text: "Wartet auf Freigabe", art: "warn" },
  freigegeben: { text: "Freigegeben", art: "info" },
  abgelehnt: { text: "Abgelehnt", art: "fehler" },
  ausgefuehrt: { text: "Ausgeführt", art: "gut" },
  zurueckgezogen: { text: "Zurückgezogen", art: "still" },
};

const kurz = (email: string | null) => (email ? email.split("@")[0].replace(/^js$/, "Justin").replace(/^florentine$/, "Florentine") : "—");

function AuftragKarte({ a, ich, onNeu }: { a: Auftrag; ich: Ich; onNeu: () => void }) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [ablehnen, setAblehnen] = useState(false);
  const [grund, setGrund] = useState("");
  const [ref, setRef] = useState("");
  const [wertAm, setWertAm] = useState(heute());
  const [tan, setTan] = useState(false);
  const inhaber = ich.rolle === "inhaber";
  const eigen = a.erstelltVon === ich.email;
  const st = STATUS[a.status];

  const tu = async (pfad: string, body: unknown = {}) => {
    setLaeuft(true); setFehler(null);
    try {
      const j = await ruf<{ hinweis?: string | null }>(`/buchhaltung/auftrag/${a.id}/${pfad}`, { body });
      if (j?.hinweis) setHinweis(j.hinweis);
      onNeu();
    } catch (e: any) { setFehler(e.message); } finally { setLaeuft(false); }
  };

  const darfFreigeben = inhaber && ((a.status === "eingereicht") || (eigen && a.status === "entwurf"));

  return (
    <article className={`bk-auftrag bk-auftrag-${a.status}`}>
      <header className="bk-auftrag-kopf">
        <div>
          <span className="bk-mono bk-auftrag-nr">{a.nummer}</span>
          <Chip art={st.art}>{st.text}</Chip>
          {a.payoutId ? <Chip art="tief" zeichen="team">Mitarbeiter-Auszahlung</Chip> : null}
          {a.freigabeArt === "einzel" ? <Chip art="still">Einzelzeichnung</Chip> : a.freigabeArt === "vier_augen" ? <Chip art="still">Vier Augen</Chip> : null}
        </div>
        <span className="bk-auftrag-betrag">{geld(a.betragCents)}</span>
      </header>

      <div className="bk-auftrag-rumpf">
        <div className="bk-auftrag-an">
          <span className="bk-klein-l">An</span>
          <strong>{a.empfaenger}</strong>
          <span className="bk-mono">{ibanHuebsch(a.iban)}{a.bic ? ` · ${a.bic}` : ""}</span>
        </div>
        <div className="bk-auftrag-zweck">
          <span className="bk-klein-l">Verwendungszweck</span>
          <span>{a.zweck}</span>
          <span className="bk-leise">{[a.kategorie, a.faelligAm ? `ausführen am ${tag(a.faelligAm)}` : null].filter(Boolean).join(" · ")}</span>
        </div>
      </div>

      <ol className="bk-verlauf">
        <li className="fertig"><span>Erfasst</span>{kurz(a.erstelltVon)} · {zeit(a.erstelltAm)}</li>
        {a.eingereichtAm ? <li className="fertig"><span>Eingereicht</span>{zeit(a.eingereichtAm)}</li> : null}
        {a.entschiedenAm ? <li className={a.status === "abgelehnt" ? "fehler" : "fertig"}><span>{a.status === "abgelehnt" ? "Abgelehnt" : "Freigegeben"}</span>{kurz(a.entschiedenVon)} · {zeit(a.entschiedenAm)}</li> : null}
        {a.ausgefuehrtAm ? <li className="fertig"><span>Überwiesen</span>{zeit(a.ausgefuehrtAm)}{a.bankReferenz ? <> · <span className="bk-mono">{a.bankReferenz}</span></> : null}</li> : null}
      </ol>
      {a.entscheidungNotiz ? <p className="bk-auftrag-notiz">Grund: {a.entscheidungNotiz}</p> : null}

      {a.status === "freigegeben" && inhaber ? (
        <div className="bk-auftrag-aktion">
          <div className="bk-abschreib">
            <Kopierfeld l="Empfänger" w={a.empfaenger} mono={false} />
            <Kopierfeld l="IBAN" w={ibanHuebsch(a.iban)} />
            {a.bic ? <Kopierfeld l="BIC" w={a.bic} /> : null}
            <Kopierfeld l="Betrag" w={betragText(a.betragCents)} />
            <Kopierfeld l="Verwendungszweck" w={a.zweck} mono={false} />
          </div>
          <div className="bk-ausfuehren">
            <Feld id={`ref-${a.id}`} l="Referenz der Bank" hinweis="Aus dem Geschäftskonto, nachdem die Überweisung raus ist.">
              <input id={`ref-${a.id}`} value={ref} onChange={(e) => setRef(e.target.value)} spellCheck={false} />
            </Feld>
            <Feld id={`wert-${a.id}`} l="Wertstellung">
              <input id={`wert-${a.id}`} type="date" value={wertAm} onChange={(e) => setWertAm(e.target.value)} />
            </Feld>
            <Knopf art="primaer" zeichen="haken" disabled={!ref.trim() || laeuft} onClick={() => void tu("ausfuehren", { bankReferenz: ref, wertAm })}>
              Überweisung eintragen
            </Knopf>
          </div>
          {a.payoutId ? <p className="bk-leise bk-klein-text">Mit dem Eintragen wird die Auszahlung abgeschlossen: Abrechnung, Status und Nachricht an den Mitarbeiter — derselbe Weg wie „Als überwiesen markieren“.</p> : null}
        </div>
      ) : null}
      {a.status === "freigegeben" && !inhaber ? <Meldung art="info">Freigegeben — die Überweisung macht der Inhaber im Geschäftskonto.</Meldung> : null}

      {ablehnen ? (
        <div className="bk-auftrag-aktion">
          <Feld id={`grund-${a.id}`} l="Grund der Ablehnung">
            <input id={`grund-${a.id}`} value={grund} onChange={(e) => setGrund(e.target.value)} autoFocus />
          </Feld>
          <div className="bk-knopfreihe">
            <Knopf art="warnung" disabled={!grund.trim() || laeuft} onClick={() => void tu("ablehnen", { notiz: grund })}>Ablehnen</Knopf>
            <Knopf art="still" onClick={() => setAblehnen(false)}>Abbrechen</Knopf>
          </div>
        </div>
      ) : null}

      {fehler ? <Meldung art="fehler">{fehler}</Meldung> : null}
      {hinweis ? <Meldung art="warn">{hinweis}</Meldung> : null}

      <footer className="bk-auftrag-fuss">
        {a.hatBeleg ? <KnopfLink href={`/api/fiaon/buchhaltung/auftrag/${a.id}/beleg`} zeichen="dokument" klein art="still">Beleg</KnopfLink> : null}
        {a.status === "ausgefuehrt" ? <KnopfLink href={`/api/fiaon/buchhaltung/auftrag/${a.id}/bestaetigung.pdf`} zeichen="pdf" klein>Zahlungsbestätigung</KnopfLink> : null}
        <span className="bk-flex" />
        {["entwurf", "eingereicht"].includes(a.status) && (eigen || inhaber) ? (
          <Knopf art="still" klein disabled={laeuft} onClick={() => void tu("zurueckziehen")}>Zurückziehen</Knopf>
        ) : null}
        {a.status === "entwurf" && eigen && !inhaber ? (
          <Knopf art="primaer" klein zeichen="senden" disabled={laeuft} onClick={() => void tu("einreichen")}>Zur Freigabe einreichen</Knopf>
        ) : null}
        {a.status === "eingereicht" && inhaber && !eigen && !ablehnen ? (
          <Knopf klein disabled={laeuft} onClick={() => setAblehnen(true)}>Ablehnen</Knopf>
        ) : null}
        {darfFreigeben ? (
          <Knopf art="primaer" klein zeichen="schloss" disabled={laeuft} onClick={() => setTan(true)}>Mit TAN freigeben</Knopf>
        ) : null}
      </footer>

      {darfFreigeben ? (
        <TanDialog offen={tan} titel={`Freigabe ${a.nummer}`}
          anfordern={() => ruf(`/buchhaltung/auftrag/${a.id}/tan`, { body: {} })}
          bestaetigen={async (t) => { await ruf(`/buchhaltung/auftrag/${a.id}/freigeben`, { body: { tan: t } }); }}
          onZu={() => setTan(false)} onFertig={() => { setTan(false); onNeu(); }} knopf="Freigeben" />
      ) : null}
    </article>
  );
}

export default function Auftraege({ auftraege, ich, onNeu, onNeueUeberweisung }: {
  auftraege: Auftrag[]; ich: Ich; onNeu: () => void; onNeueUeberweisung: () => void;
}) {
  const [sicht, setSicht] = useState<"offen" | "erledigt" | "alle">("offen");
  const liste = useMemo(() => auftraege.filter((a) =>
    sicht === "alle" ? true
      : sicht === "offen" ? ["entwurf", "eingereicht", "freigegeben"].includes(a.status)
      : ["ausgefuehrt", "abgelehnt", "zurueckgezogen"].includes(a.status)), [auftraege, sicht]);
  const offen = auftraege.filter((a) => ["entwurf", "eingereicht", "freigegeben"].includes(a.status)).length;

  return (
    <div className="bk-seite">
      <div className="bk-filter">
        <div className="bk-segment" role="tablist" aria-label="Aufträge">
          {([["offen", `Offen (${offen})`], ["erledigt", "Erledigt"], ["alle", "Alle"]] as const).map(([w, t]) => (
            <button key={w} type="button" role="tab" aria-selected={sicht === w} className={sicht === w ? "aktiv" : ""} onClick={() => setSicht(w)}>{t}</button>
          ))}
        </div>
        <span className="bk-flex" />
        <Knopf art="primaer" zeichen="plus" onClick={onNeueUeberweisung}>Neue Überweisung</Knopf>
      </div>
      {ich.rolle === "buchhaltung" ? (
        <p className="bk-fussnote bk-oben"><Zeichen n="schild" g={14} /> Jede Zahlung hat zwei Namen: Du bereitest vor, der Inhaber gibt mit TAN frei und überweist.</p>
      ) : null}
      {liste.length === 0 ? (
        <Leer titel={sicht === "offen" ? "Nichts offen" : "Noch keine Aufträge"} text={sicht === "offen" ? "Alle Aufträge sind erledigt." : "Der erste entsteht über „Neue Überweisung“."} />
      ) : (
        <div className="bk-auftragsliste">{liste.map((a) => <AuftragKarte key={a.id} a={a} ich={ich} onNeu={onNeu} />)}</div>
      )}
    </div>
  );
}
