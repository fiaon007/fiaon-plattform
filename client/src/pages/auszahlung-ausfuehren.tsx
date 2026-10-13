// ═══════════════════════════════════════════════════════════════════════════
// /auszahlung-ausfuehren/<Token> — DIE BUCHHALTUNG BESTÄTIGT DIE ÜBERWEISUNG (13.10.2026)
//
// Justin: Florentine gibt jede Auszahlung mit TAN frei, danach bekommt die Buchhaltung
// (buchhaltung@schwarzott-global.com) den Auftrag mit allen Details; erst wenn SIE die
// Ausführung bestätigt, wird ausgebucht und Florentine bekommt den Durchführungsbeleg.
//
// Diese Seite ist der Link aus der Mail an die Buchhaltung: alle Zahlungsdaten zum
// Kopieren, darunter EIN Schritt „Überweisung ausgeführt“. Kein Login — das Token im Pfad
// ist der Ausweis (nur die Buchhaltung hat es; Florentine nie, Vier-Augen). Die Seite
// liest nur per GET; bestätigt wird ausschließlich per POST von derselben Herkunft, so
// lösen Link-Vorschauen der Mailprogramme nichts aus. Gesiezt. Immer hell.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { FiaonWortmarke } from "@/components/marke/FiaonWortmarke";
import "@/styles/auszahlung-ausfuehren.css";

interface Ansicht {
  nummer: string; empfaenger: string; iban: string; bic: string | null; betragCents: number; verwendungszweck: string;
  art: string | null; auszahlung: string | null; erfasst: string; freigegeben: string;
  stand: "offen" | "bestaetigt" | "ungueltig"; bestaetigtAm: string | null; wertAm: string | null;
}

type Lage =
  | { art: "laedt" }
  | { art: "da"; a: Ansicht }
  | { art: "fertig"; a: Ansicht; hinweis: string | null }
  | { art: "weg" }
  | { art: "fehler"; text: string };

const euro = (c: number) => (c / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
/** Für Bankmasken: ohne Tausenderpunkt, mit Komma — „1234,56“. */
const euroRoh = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const tag = (s: string | null) => (s ? new Date(`${s.slice(0, 10)}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
const zeit = (s: string | null) => (s ? new Date(s).toLocaleString("de-DE", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin",
}) + " Uhr" : "—");
const heute = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

function Zeichen({ art }: { art: "haken" | "halt" | "kopie" | "bank" }) {
  // Selbst gezeichnet, 1,5 px, currentColor (AGENTS.md: keine Icon-Bibliotheken auf neuen Flächen).
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {art === "haken" && <path d="M5 12.5l4.5 4.5L19 7.5" />}
      {art === "halt" && (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5.5" /><path d="M12 16.2v.3" /></>)}
      {art === "kopie" && (<><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" /></>)}
      {art === "bank" && (<><path d="M4 9.5 12 5l8 4.5" /><path d="M5.5 10v7M10 10v7M14 10v7M18.5 10v7" /><path d="M4 19h16" /></>)}
    </svg>
  );
}

function Kopierfeld({ titel, zeigen, wert, mono = false }: { titel: string; zeigen: string; wert: string; mono?: boolean }) {
  const [stand, setStand] = useState<"" | "ja" | "nein">("");
  const kopieren = async () => {
    try { await navigator.clipboard.writeText(wert); setStand("ja"); } catch { setStand("nein"); }
    window.setTimeout(() => setStand(""), 1800);
  };
  return (
    <div className="aa-feld">
      <b>{titel}</b>
      <span className={mono ? "aa-mono" : undefined}>{zeigen}</span>
      <button type="button" className="aa-kopie" onClick={() => void kopieren()} aria-label={`${titel} kopieren`}>
        <Zeichen art={stand === "ja" ? "haken" : "kopie"} />
        <span>{stand === "ja" ? "Kopiert" : stand === "nein" ? "Bitte markieren" : "Kopieren"}</span>
      </button>
    </div>
  );
}

export default function AuszahlungAusfuehrenPage() {
  // AGENTS.md: alle Haken oben, vor dem ersten return.
  const { token = "" } = useParams<{ token: string }>();
  const [lage, setLage] = useState<Lage>({ art: "laedt" });
  const [wertAm, setWertAm] = useState(heute);
  const [notiz, setNotiz] = useState("");
  const [zugesagt, setZugesagt] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Auszahlung ausführen · FIAON";
    let weg = false;
    (async () => {
      try {
        const r = await fetch(`/api/fiaon/buchhaltung/extern/${encodeURIComponent(token)}`, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" });
        const j = await r.json().catch(() => null);
        if (weg) return;
        if (r.status === 404 || !j?.ok) { setLage(r.status === 404 ? { art: "weg" } : { art: "fehler", text: j?.error || "Der Auftrag konnte nicht geladen werden." }); return; }
        setLage({ art: "da", a: j.auftrag as Ansicht });
      } catch {
        if (!weg) setLage({ art: "fehler", text: "Keine Verbindung. Bitte die Seite neu laden." });
      }
    })();
    return () => { weg = true; };
  }, [token]);

  const bestaetigen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zugesagt || laeuft) return;
    setLaeuft(true); setFehler(null);
    try {
      const r = await fetch(`/api/fiaon/buchhaltung/extern/${encodeURIComponent(token)}/bestaetigen`, {
        method: "POST", cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wertAm, notiz: notiz.trim() || null }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setFehler(j?.error || "Die Bestätigung ging nicht durch. Bitte erneut versuchen."); return; }
      setLage({ art: "fertig", a: j.auftrag as Ansicht, hinweis: j.hinweis ?? null });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setFehler("Keine Verbindung — es wurde nichts bestätigt. Bitte erneut versuchen.");
    } finally {
      setLaeuft(false);
    }
  };

  const kopf = (
    <div className="aa-kopf">
      <span className="aa-marke"><FiaonWortmarke /></span>
      <span>Ausführungsauftrag · vertraulich</span>
    </div>
  );

  const zustand = (ton: "gut" | "halt", titel: string, saetze: string[]) => (
    <div className="aa-inhalt aa-zustand">
      <div className={`aa-symbol ${ton}`}><Zeichen art={ton === "gut" ? "haken" : "halt"} /></div>
      <h1>{titel}</h1>
      {saetze.map((s) => <p key={s} className="aa-unter">{s}</p>)}
    </div>
  );

  let inhalt: JSX.Element;
  if (lage.art === "laedt") {
    inhalt = <div className="aa-inhalt"><p className="aa-auge">Auftrag wird geladen</p><div className="aa-laedt" /></div>;
  } else if (lage.art === "weg") {
    inhalt = zustand("halt", "Dieser Link ist ungültig", ["Der Link ist unvollständig oder gehört zu keinem Auszahlungsauftrag. Bitte nichts überweisen und bei FIAON nachfragen."]);
  } else if (lage.art === "fehler") {
    inhalt = zustand("halt", "Der Auftrag lässt sich gerade nicht laden", [lage.text]);
  } else if (lage.art === "fertig" || (lage.art === "da" && lage.a.stand === "bestaetigt")) {
    const a = lage.a;
    inhalt = (
      <>
        {zustand("gut", "Ausführung bestätigt", [
          `${a.nummer} · ${euro(a.betragCents)} an ${a.empfaenger} — SEPA-Überweisung ausgeführt am ${tag(a.wertAm)}.`,
          lage.art === "fertig"
            ? "Die Auszahlung ist ausgebucht. Die Geschäftsführung erhält jetzt den Durchführungsbeleg. Für Sie ist nichts weiter zu tun."
            : `Bestätigt am ${zeit(a.bestaetigtAm)}. Für Sie ist nichts weiter zu tun.`,
        ])}
        {lage.art === "fertig" && lage.hinweis ? <p className="aa-inhalt aa-leise aa-nach">{lage.hinweis}</p> : null}
      </>
    );
  } else if (lage.a.stand === "ungueltig") {
    inhalt = zustand("halt", "Nicht mehr zur Ausführung freigegeben", [
      `${lage.a.nummer} wurde zurückgezogen oder abgelehnt. Bitte diese Auszahlung nicht überweisen.`,
      "Falls Sie sie bereits ausgeführt haben, melden Sie sich bitte umgehend bei FIAON.",
    ]);
  } else {
    const a = lage.a;
    inhalt = (
      <div className="aa-inhalt">
        <p className="aa-auge">SEPA-Überweisung zur Ausführung</p>
        <h1>Auszahlung <span className="aa-nw">{a.nummer}</span> ausführen</h1>
        <p className="aa-unter">Von der Geschäftsführung mit TAN freigegeben. Bitte überweisen Sie den Betrag per SEPA-Überweisung und bestätigen Sie die Ausführung danach hier.</p>

        <div className="aa-betrag">
          <span>Betrag</span>
          <b>{euro(a.betragCents)}</b>
        </div>

        <div className="aa-daten" aria-label="Zahlungsdaten">
          <Kopierfeld titel="Empfänger" zeigen={a.empfaenger} wert={a.empfaenger} />
          <Kopierfeld titel="IBAN" zeigen={a.iban} wert={a.iban.replace(/\s+/g, "")} mono />
          {a.bic ? <Kopierfeld titel="BIC" zeigen={a.bic} wert={a.bic} mono /> : null}
          <Kopierfeld titel="Betrag" zeigen={euro(a.betragCents)} wert={euroRoh(a.betragCents)} mono />
          <Kopierfeld titel="Verwendungszweck" zeigen={a.verwendungszweck} wert={a.verwendungszweck} />
          <p className="aa-hinweis"><Zeichen art="bank" /> Zahlungsart: SEPA-Überweisung, keine Echtzeitüberweisung. Verwendungszweck bitte vollständig übernehmen — die Referenz ordnet die Zahlung zu.</p>
        </div>

        <dl className="aa-meta">
          <div><dt>Zahlungsauftrag</dt><dd>{a.nummer}</dd></div>
          <div><dt>Auszahlung</dt><dd>{a.auszahlung || "—"}{a.art ? ` · ${a.art}` : ""}</dd></div>
          <div><dt>Erfasst</dt><dd>{a.erfasst}</dd></div>
          <div><dt>Freigegeben</dt><dd>{a.freigegeben}</dd></div>
        </dl>

        <form className="aa-bestaetigen" onSubmit={(e) => void bestaetigen(e)}>
          <h2>Nach der Überweisung</h2>
          <p className="aa-leise">Erst Ihre Bestätigung bucht die Auszahlung aus und erzeugt den Durchführungsbeleg. Bitte nur bestätigen, wenn die Überweisung tatsächlich beauftragt ist.</p>
          <div className="aa-reihe">
            <label className="aa-eingabe">
              <span>Ausgeführt am</span>
              <input type="date" value={wertAm} max={heute()} required onChange={(e) => setWertAm(e.target.value)} />
            </label>
            <label className="aa-eingabe aa-breit">
              <span>Bankreferenz oder Notiz <em>(optional)</em></span>
              <input type="text" value={notiz} maxLength={200} placeholder="z. B. Referenz aus dem Onlinebanking" onChange={(e) => setNotiz(e.target.value)} />
            </label>
          </div>
          <label className="aa-zusage">
            <input type="checkbox" checked={zugesagt} onChange={(e) => setZugesagt(e.target.checked)} />
            <span>Ich bestätige, dass die SEPA-Überweisung über <strong>{euro(a.betragCents)}</strong> an <strong>{a.empfaenger}</strong> ({a.iban}) am angegebenen Tag ausgeführt wurde.</span>
          </label>
          {fehler ? <p className="aa-fehler" role="alert">{fehler}</p> : null}
          <button type="submit" className="aa-knopf" disabled={!zugesagt || laeuft}>
            {laeuft ? "Wird bestätigt …" : "Überweisung ausgeführt — bestätigen"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <main className="aa-seite">
      <div className="aa-blatt">
        {kopf}
        {inhalt}
      </div>
      <div className="aa-fuss">
        <span>FIAON LTD · Company No. 17318250</span>
        <span>Diese Seite ist nur für die ausführende Buchhaltung bestimmt.</span>
      </div>
    </main>
  );
}
