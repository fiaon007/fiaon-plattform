// ═══════════════════════════════════════════════════════════════════════════
// FIAON BANKING — Aufträge und Freigaben (E-228)
//
// Jeder Zahlungsauftrag als eigene Karte mit dem einen nächsten Schritt.
// Freigeben geht nur mit TAN; eintragen, dass überwiesen wurde, nur mit der
// Referenz der Bank.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from "react";
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

function AuftragKarte({ a, ich, onNeu, fokus = false }: { a: Auftrag; ich: Ich; onNeu: () => void; fokus?: boolean }) {
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
  // 13.10.2026: Ausführung über die Buchhaltung — die Geschäftsführung gibt mit TAN frei, die Buchhaltung führt aus.
  const extern = !!a.ausfuehrungExtern;
  const st = extern && a.status === "eingereicht" ? { text: "Wartet auf Freigabe der Geschäftsführung", art: "warn" as ChipArt }
    : extern && a.status === "freigegeben" ? { text: "Bei der Buchhaltung", art: "info" as ChipArt }
    : STATUS[a.status];
  const karte = useRef<HTMLElement>(null);

  const tu = async (pfad: string, body: unknown = {}) => {
    setLaeuft(true); setFehler(null);
    try {
      const j = await ruf<{ hinweis?: string | null }>(`/buchhaltung/auftrag/${a.id}/${pfad}`, { body });
      if (j?.hinweis) setHinweis(j.hinweis);
      onNeu();
    } catch (e: any) { setFehler(e.message); } finally { setLaeuft(false); }
  };

  const darfFreigeben = (inhaber && ((a.status === "eingereicht") || (eigen && a.status === "entwurf")))
    || (ich.rolle === "buchhaltung" && extern && a.status === "eingereicht" && !eigen);
  const darfAblehnen = a.status === "eingereicht" && !eigen && (inhaber || (ich.rolle === "buchhaltung" && extern));
  // Aus der Freigabe-Mail: Karte ansteuern und — wenn diese Person freigeben darf — den TAN-Dialog öffnen.
  useEffect(() => {
    if (!fokus) return;
    karte.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (darfFreigeben) setTan(true);
  }, [fokus]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <article ref={karte} className={`bk-auftrag bk-auftrag-${a.status}${fokus ? " bk-fokus" : ""}`}>
      <header className="bk-auftrag-kopf">
        <div>
          <span className="bk-mono bk-auftrag-nr">{a.nummer}</span>
          <Chip art={st.art}>{st.text}</Chip>
          {a.payoutId ? <Chip art="tief" zeichen="team">Mitarbeiter-Auszahlung</Chip> : null}
          {extern ? <Chip art="still">Über die Buchhaltung</Chip> : null}
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
        {a.freigabeMailAm ? <li className="fertig"><span>Zur Freigabe gesendet</span>{zeit(a.freigabeMailAm)}</li> : null}
        {a.entschiedenAm ? <li className={a.status === "abgelehnt" ? "fehler" : "fertig"}><span>{a.status === "abgelehnt" ? "Abgelehnt" : "Freigegeben"}</span>{kurz(a.entschiedenVon)} · {zeit(a.entschiedenAm)}</li> : null}
        {extern && a.externGesendetAm ? <li className="fertig"><span>An die Buchhaltung</span>{zeit(a.externGesendetAm)}</li> : null}
        {extern && a.externBestaetigtAm ? <li className="fertig"><span>Ausführung bestätigt</span>{zeit(a.externBestaetigtAm)}{a.externWertAm ? ` · ausgeführt am ${tag(a.externWertAm)}` : ""}</li> : null}
        {a.ausgefuehrtAm ? <li className="fertig"><span>{extern ? "Ausgebucht" : "Überwiesen"}</span>{zeit(a.ausgefuehrtAm)}{a.bankReferenz ? <> · <span className="bk-mono">{a.bankReferenz}</span></> : null}</li> : null}
      </ol>
      {a.entscheidungNotiz ? <p className="bk-auftrag-notiz">Grund: {a.entscheidungNotiz}</p> : null}

      {extern && a.status === "eingereicht" ? (
        <Meldung art={a.freigabeMailAm ? "info" : "warn"}>
          {a.freigabeMailAm
            ? <>Die Freigabe-Mail mit TAN ist am {zeit(a.freigabeMailAm)} an die Geschäftsführung gegangen.</>
            : <>Die Freigabe-Mail ist noch nicht raus.</>}
          {inhaber ? <> <button type="button" className="bk-link-knopf" disabled={laeuft} onClick={() => void tu("freigabe-mail")}>{a.freigabeMailAm ? "Erneut senden (neue TAN)" : "Jetzt senden"}</button></> : null}
        </Meldung>
      ) : null}
      {extern && a.status === "freigegeben" ? (
        <Meldung art={a.externGesendetAm ? "info" : "warn"}>
          {a.externGesendetAm
            ? <>Freigegeben — der Auftrag liegt seit {zeit(a.externGesendetAm)} bei der Buchhaltung ({a.ausfuehrungExtern}). Sobald sie die SEPA-Überweisung bestätigt, wird ausgebucht und der Durchführungsbeleg geht an die Geschäftsführung.</>
            : <>Freigegeben, aber noch nicht an die Buchhaltung übermittelt.</>}
          {" "}<button type="button" className="bk-link-knopf" disabled={laeuft} onClick={() => void tu("an-buchhaltung")}>{a.externGesendetAm ? "Erneut an die Buchhaltung" : "Jetzt an die Buchhaltung"}</button>
        </Meldung>
      ) : null}
      {a.status === "freigegeben" && inhaber && !extern ? (
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
      {a.status === "freigegeben" && !inhaber && !extern ? <Meldung art="info">Freigegeben — die Überweisung macht der Inhaber im Geschäftskonto.</Meldung> : null}

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
        {a.status === "ausgefuehrt" ? <KnopfLink href={`/api/fiaon/buchhaltung/auftrag/${a.id}/bestaetigung.pdf`} zeichen="pdf" klein>{extern ? "Durchführungsbeleg" : "Zahlungsbestätigung"}</KnopfLink> : null}
        {a.status === "ausgefuehrt" && extern ? <Knopf art="still" klein disabled={laeuft} onClick={() => void tu("beleg-senden")}>Beleg erneut senden</Knopf> : null}
        <span className="bk-flex" />
        {["entwurf", "eingereicht"].includes(a.status) && (eigen || inhaber) ? (
          <Knopf art="still" klein disabled={laeuft} onClick={() => void tu("zurueckziehen")}>Zurückziehen</Knopf>
        ) : null}
        {a.status === "entwurf" && eigen && !inhaber ? (
          <Knopf art="primaer" klein zeichen="senden" disabled={laeuft} onClick={() => void tu("einreichen")}>Zur Freigabe einreichen</Knopf>
        ) : null}
        {darfAblehnen && !ablehnen ? (
          <Knopf klein disabled={laeuft} onClick={() => setAblehnen(true)}>Ablehnen</Knopf>
        ) : null}
        {darfFreigeben ? (
          <Knopf art="primaer" klein zeichen="schloss" disabled={laeuft} onClick={() => setTan(true)}>{extern && inhaber ? "Selbst mit TAN freigeben" : "Mit TAN freigeben"}</Knopf>
        ) : null}
      </footer>

      {darfFreigeben ? (
        <TanDialog offen={tan} titel={`Freigabe ${a.nummer}`}
          anfordern={() => ruf(`/buchhaltung/auftrag/${a.id}/tan`, { body: {} })}
          bestaetigen={async (t) => { await ruf(`/buchhaltung/auftrag/${a.id}/freigeben`, { body: { tan: t } }); }}
          onZu={() => setTan(false)} onFertig={() => { setTan(false); onNeu(); }} knopf="Freigeben"
          vorhanden={!inhaber && extern && a.freigabeMailAm ? {
            beschreibung: `Freigabe ${a.nummer}: ${geld(a.betragCents)} an ${a.empfaenger}`,
            hinweis: `Die TAN steht in der Mail „Bitte freigeben: ${a.nummer}“. Sie gilt nur für diese Auszahlung.`,
          } : null} />
      ) : null}
    </article>
  );
}

export default function Auftraege({ auftraege, ich, onNeu, onNeueUeberweisung, fokusId = null }: {
  auftraege: Auftrag[]; ich: Ich; onNeu: () => void; onNeueUeberweisung: () => void;
  /** 13.10.2026: Aus der Freigabe-Mail (…?reiter=auftraege&auftrag=ID) — diese Karte ansteuern. */
  fokusId?: number | null;
}) {
  const fokusOffen = fokusId == null || auftraege.some((a) => a.id === fokusId && ["entwurf", "eingereicht", "freigegeben"].includes(a.status));
  const [sicht, setSicht] = useState<"offen" | "erledigt" | "alle">(fokusOffen ? "offen" : "alle");
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
        <p className="bk-fussnote bk-oben"><Zeichen n="schild" g={14} /> Jede Zahlung hat zwei Namen: Du bereitest vor, der Inhaber gibt mit TAN frei und überweist. Auszahlungen „über die Buchhaltung“ gibst du mit der TAN aus der Mail frei — die Buchhaltung führt aus.</p>
      ) : null}
      {liste.length === 0 ? (
        <Leer titel={sicht === "offen" ? "Nichts offen" : "Noch keine Aufträge"} text={sicht === "offen" ? "Alle Aufträge sind erledigt." : "Der erste entsteht über „Neue Überweisung“."} />
      ) : (
        <div className="bk-auftragsliste">{liste.map((a) => <AuftragKarte key={a.id} a={a} ich={ich} onNeu={onNeu} fokus={a.id === fokusId} />)}</div>
      )}
    </div>
  );
}
