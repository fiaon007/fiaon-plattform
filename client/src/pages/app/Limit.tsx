// ═══════════════════════════════════════════════════════════════════════════
// /app/mehr/limit — LIMIT-ERHÖHUNG ANFRAGEN (05.10.2026, E-283)
//
// Justin: „Limit-Gespräch muss der Kunde buchen in der App, also sowas wie
// ‚Limit-Erhöhung anfragen', das geht aber nur alle 3 Monate."
//
// Der Bildschirm rechnet NICHTS selbst. GET /kunde/:ref/limit-gespraech sagt,
// ob gebucht werden darf (Regel: shared/fiaon-limit-gespraech.ts) und welche
// Zeiten frei sind (dieselbe Rechnung wie die Terminseite). POST …/buchen
// prüft den Anspruch noch einmal. Alle Sätze stehen in LIMIT_TEXTE — dort
// prüft sie der Prüfstand gegen die Wortwand.
//
// Zwei Schritte, nicht einer: Zeit wählen, dann „Limit-Gespräch buchen". Ein
// Tipp auf eine Uhrzeit bucht nicht sofort — auf dem Telefon trifft der Daumen
// leicht die Nachbarzeit.
//
// Als-Kunde-Ansicht: liest, bucht nicht (der Server antwortet 403 NUR_ANSICHT,
// der Bildschirm sagt es). Demo: GET mit ?stufe=, POST antwortet „nur zur Ansicht".
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { LIMIT_TEXTE, limitGrundSatz, type LimitAnspruch } from "@shared/fiaon-limit-gespraech";
import { ZeitWahl, type ZeitSlot } from "@/components/termin/ZeitWahl";
import { api, startgespraechBuchen } from "./Bausteine";
import { ereignisMelden } from "./Bericht";

const DEMO_REF = "FIAON-DEMO";
/** Nach so vielen Millisekunden gilt das Laden als gescheitert — ein Ladezustand ohne Ende ist ein weißes Fenster. */
const ZEITGRENZE_MS = 15_000;

interface LimitDaten {
  anspruch: LimitAnspruch;
  ansprechpartnerDat: string | null;
  slots: ZeitSlot[];
  slotMinuten: number;
  vertretung: { anrufer: string; betreuer: string | null; bis: string } | null;
}

export function Limit({ kundeRef, demo, demoStufe, basis, onStand }: {
  kundeRef: string;
  demo: boolean;
  /** Nur in der Demo: die Stufe, die die Antwort zeigen soll. */
  demoStufe?: number;
  basis: string;
  /** Der Schale den neuen Stand melden (Mehr-Zeile, Karte auf Heute). */
  onStand?: (a: LimitAnspruch) => void;
}) {
  const [daten, setDaten] = useState<LimitDaten | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [versuch, setVersuch] = useState(0);
  const [gewaehlt, setGewaehlt] = useState<ZeitSlot | null>(null);
  const [bucht, setBucht] = useState(false);
  const [meldung, setMeldung] = useState<{ ton: "gut" | "fehler"; text: string } | null>(null);
  // E-283: Eben gebucht — bis der neue Stand („gebucht") da ist, bleibt die Zeitwahl gesperrt.
  // Sonst ersetzte ein zweiter Tipp die Erfolgsmeldung durch „schon gebucht".
  const [ebenGebucht, setEbenGebucht] = useState(false);

  useEffect(() => {
    let aktiv = true;
    const abbruch = new AbortController();
    const uhr = window.setTimeout(() => abbruch.abort(), ZEITGRENZE_MS);
    setFehler(null);
    const pfad = demo ? `/kunde/${DEMO_REF}/limit-gespraech?stufe=${demoStufe ?? 1}` : `/kunde/${encodeURIComponent(kundeRef)}/limit-gespraech`;
    api(pfad, { signal: abbruch.signal })
      .then((r) => {
        if (!aktiv) return;
        if (!r.ok || !r.json?.ok || !r.json.anspruch) {
          setFehler(r.json?.error || "Ihr Limit-Gespräch lässt sich gerade nicht laden. Bitte versuchen Sie es in einem Moment noch einmal.");
          return;
        }
        const d: LimitDaten = {
          anspruch: r.json.anspruch,
          ansprechpartnerDat: r.json.ansprechpartnerDat ?? null,
          slots: Array.isArray(r.json.slots) ? r.json.slots : [],
          slotMinuten: Number(r.json.slotMinuten) || 20,
          vertretung: r.json.vertretung ?? null,
        };
        setDaten(d);
        setGewaehlt(null);
        setEbenGebucht(false);
        onStand?.(d.anspruch);
      })
      .catch(() => { if (aktiv) setFehler("Ihr Limit-Gespräch lässt sich gerade nicht laden. Bitte versuchen Sie es in einem Moment noch einmal."); })
      .finally(() => window.clearTimeout(uhr));
    return () => { aktiv = false; abbruch.abort(); window.clearTimeout(uhr); };
  }, [kundeRef, demo, demoStufe, versuch]); // eslint-disable-line react-hooks/exhaustive-deps

  const buchen = async () => {
    if (!gewaehlt || bucht || ebenGebucht) return;
    ereignisMelden(kundeRef, demo, "limit", "knopf");
    setBucht(true); setMeldung(null);
    const ref = demo ? DEMO_REF : encodeURIComponent(kundeRef);
    const r = await api(`/kunde/${ref}/limit-gespraech/buchen`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beginn: gewaehlt.beginn, agentId: gewaehlt.agentId }),
    }).catch(() => null);
    setBucht(false);
    if (r?.ok && r.json?.ok) {
      ereignisMelden(kundeRef, demo, "limit", "fertig");
      setMeldung({ ton: "gut", text: String(r.json.meldung || LIMIT_TEXTE.gebuchtErfolg(r.json.termin, !!r.json.bestaetigt)) });
      setGewaehlt(null);
      setEbenGebucht(true);
      setVersuch((v) => v + 1);
      return;
    }
    // Jeder Ausgang ist sichtbar und bleibt stehen (AGENTS.md, Neubau-Checkliste 4).
    const text = r?.json?.code === "NUR_ANSICHT" ? LIMIT_TEXTE.nurAnsicht
      : r?.json?.error || "Ihr Limit-Gespräch ließ sich gerade nicht buchen. Bitte versuchen Sie es noch einmal.";
    setMeldung({ ton: "fehler", text });
    // Neuer Stand vom Server (Sperrfrist, schon gebucht) oder die Zeit ist weg: frisch laden.
    if (r?.json?.anspruch || r?.json?.grund === "nicht_angeboten" || r?.json?.grund === "belegt") setVersuch((v) => v + 1);
  };

  const startBuchen = async () => {
    if (demo) { setMeldung({ ton: "fehler", text: "In der Demo-Ansicht lässt sich kein Termin buchen." }); return; }
    const f = await startgespraechBuchen(kundeRef);
    if (f) setMeldung({ ton: "fehler", text: f });
  };

  const a = daten?.anspruch ?? null;
  const satz = a ? limitGrundSatz(a) : null;
  // E-283: „Alle drei Monate besprechen Sie …" und der Bank-Satz nur, wo das Gespräch dem Grunde nach
  // zusteht — nicht bei FIAON Start, Global, beendetem Vertrag oder unbezahltem Paket; auch nicht beim Laden.
  const mitAnspruch = !!a && !["kein_paket", "global", "beendet", "nicht_bezahlt"].includes(a.grund);

  return (
    <>
      <h1 className="ap-gruss ap-auf">{LIMIT_TEXTE.titel}{mitAnspruch && <small>{LIMIT_TEXTE.unterzeile(daten?.ansprechpartnerDat)}</small>}</h1>

      {!daten && !fehler && <div className="ap-skelett" style={{ height: 160, borderRadius: 14 }} />}
      {fehler && (
        <div className="ap-karte ap-leer" role="alert">
          <b>{fehler}</b>
          <button type="button" className="ap-knopf still" style={{ marginTop: 12 }} onClick={() => setVersuch((v) => v + 1)}>Noch einmal</button>
        </div>
      )}

      {a && (
        <section className="ap-abschnitt ap-auf v1" data-fiaon="limit-stand" data-grund={a.grund}>
          {/* Gebucht: Datum, Uhrzeit, Gesprächspartner — und der Weg zur Absage. */}
          {a.grund === "gebucht" && a.gebucht && (
            <div className="ap-karte">
              <h3>Ihr Limit-Gespräch</h3>
              <p>{a.gebucht.vorbei ? LIMIT_TEXTE.gebuchtVorbei(a.gebucht) : LIMIT_TEXTE.gebucht(a.gebucht)}</p>
              {a.gebucht.absageLink && !demo && (
                <a className="ap-link" href={a.gebucht.absageLink} style={{ display: "inline-block", marginTop: 10, fontSize: 15 }}>Termin absagen</a>
              )}
            </div>
          )}

          {/* Frei: Zeit wählen, dann buchen. */}
          {a.grund === "frei" && (
            <div className="ap-karte">
              <h3>Zeit wählen</h3>
              <p>{LIMIT_TEXTE.waehlen}</p>
              {daten!.vertretung && (
                <p style={{ fontSize: 15, marginTop: 8 }}>
                  {daten!.vertretung.betreuer ? `${daten!.vertretung.betreuer} ist bis ${daten!.vertretung.bis} nicht im Haus` : `Bis ${daten!.vertretung.bis} ist das Team nicht im Haus`}
                  {` – bis dahin führt ${daten!.vertretung.anrufer} Ihr Gespräch.`}
                </p>
              )}
              <div style={{ marginTop: 14 }}>
                {daten!.slots.length === 0
                  ? <p style={{ margin: 0 }}>{LIMIT_TEXTE.keineZeit}</p>
                  : <ZeitWahl slots={daten!.slots} gewaehlt={gewaehlt?.beginn ?? null} gesperrt={bucht || ebenGebucht} onWahl={(s) => { setGewaehlt(s); setMeldung(null); }} />}
              </div>
              {daten!.slots.length > 0 && (
                <button type="button" className="ap-knopf" style={{ marginTop: 16 }} disabled={!gewaehlt || bucht || ebenGebucht} onClick={() => void buchen()} data-fiaon="limit-buchen">
                  {bucht ? "Wird gebucht …" : LIMIT_TEXTE.knopf}
                </button>
              )}
            </div>
          )}

          {/* Alle anderen Gründe: ein Satz, und wo es einen gibt, der Weg weiter. */}
          {a.grund !== "frei" && a.grund !== "gebucht" && satz && (
            <div className="ap-karte">
              <p style={{ margin: 0 }}>{satz}</p>
              {a.grund === "rueckstand" && <Link href={`${basis}/geld/zahlen`} className="ap-link" style={{ display: "inline-block", marginTop: 10 }}>Rate zahlen →</Link>}
              {a.grund === "nicht_bezahlt" && <Link href={`${basis}/geld/zahlen`} className="ap-link" style={{ display: "inline-block", marginTop: 10 }}>Zur Zahlung →</Link>}
              {a.grund === "start_fehlt" && <button type="button" className="ap-knopf still" style={{ marginTop: 12 }} onClick={() => void startBuchen()}>Startgespräch buchen</button>}
            </div>
          )}

          {a.letztes && a.grund !== "gebucht" && <p className="ap-fuss" style={{ marginTop: 10 }}>{LIMIT_TEXTE.letztes(a.letztes)}</p>}
          {mitAnspruch && <p className="ap-fuss" style={{ marginTop: 10 }}>{LIMIT_TEXTE.bank}</p>}
        </section>
      )}

      {meldung && <div className={`ap-meldung ${meldung.ton}`} role="status">{meldung.text}</div>}
      {demo && <p className="ap-fuss">Demo-Ansicht – feste Vorführdaten, es wird nichts gebucht.</p>}
    </>
  );
}
