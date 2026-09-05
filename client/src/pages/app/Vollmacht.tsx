// ═══════════════════════════════════════════════════════════════════════════
// /app/mehr/vollmachten — Ihre Vollmacht (Bauvorlage 3.14, Scheibe 5, 05.09.2026)
//
// Drei Zustände, je genau eine Handlung:
//   aktiv      → „Ihre Vollmacht gilt bis {gueltigBis} für: {umfang}“, stiller
//                Textlink „Widerrufen“ mit Rückfrage (zwei Knöpfe)
//   keine      → Satz + Knopf „Vollmacht jetzt unterschreiben“ (signierter Link)
//   widerrufen → Satz mit Datum, darunter derselbe Knopf für eine neue
//
// Die Vollmacht ist eine „Vollmacht zur Übermittlung“: FIAON übermittelt die
// vom Kunden unterschriebenen Erklärungen und nimmt Antworten entgegen — kein
// Vertretungsrecht, jederzeit widerruflich. Daten: GET /kunde/:ref/app/vollmacht,
// POST /kunde/:ref/app/vollmacht/widerruf (Modul B). Demo: feste Werte, kein Aufruf.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { api } from "./Bausteine";
import "@/styles/app-antraege.css";

/** Klartext je Vorgangsart — EINE Tabelle für Vollmacht-Umfang, Unterschriftseite und Vorgang. */
export const ART_KLARTEXT: Record<string, string> = {
  p_konto: "Antrag an Ihre Bank: höherer Schutzbetrag auf dem P-Konto",
  p_konto_umwandlung: "Verlangen an Ihre Bank: Umwandlung in ein P-Konto",
  rundfunk: "Antrag auf Befreiung vom Rundfunkbeitrag",
  wohngeld: "Anschreiben an Ihre Wohngeldstelle",
  kfz: "Kündigung Ihrer Kfz-Versicherung",
  handy: "Kündigung Ihres Handyvertrags",
  selbstauskunft: "Selbstauskunft bei der Auskunftei (Art. 15 DSGVO)",
  brief: "Ihr Brief",
  nachfass: "Erinnerung an die Stelle",
};
export const artKlartext = (art: string | null | undefined): string => (art ? ART_KLARTEXT[art] ?? art : "");

interface VollmachtStand {
  aktiv: boolean;
  gueltigBis: string | null;
  umfang: string[];
  unterschriebenAm: string | null;
  widerrufenAm: string | null;
  /** Vom Server gerechnet: unterschrieben · widerrufen · abgelaufen (zwölf Monate vorbei) · null (nie erteilt). */
  status: "offen" | "unterschrieben" | "widerrufen" | "abgelaufen" | null;
  unterschriftUrl: string | null;
}

const DEMO_VOLLMACHT: VollmachtStand = { aktiv: true, gueltigBis: "27.08.2027", umfang: ["p_konto", "rundfunk"], unterschriebenAm: "28.08.2026", widerrufenAm: null, status: "unterschrieben", unterschriftUrl: null };

/** Umfang lesbar: „A, B und C“. Unbekannte Schlüssel bleiben stehen, nichts wird erfunden. */
function umfangSatz(umfang: string[]): string {
  const teile = (umfang ?? []).map((u) => artKlartext(u)).filter(Boolean);
  if (teile.length === 0) return "alle Anträge, die Sie unterschreiben";
  if (teile.length === 1) return teile[0];
  return `${teile.slice(0, -1).join(", ")} und ${teile[teile.length - 1]}`;
}

export function Vollmachten({ kundeRef, basis, demo }: { kundeRef: string; basis: string; demo: boolean }) {
  const [v, setV] = useState<VollmachtStand | null>(demo ? DEMO_VOLLMACHT : null);
  const [grund, setGrund] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [rueckfrage, setRueckfrage] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ ton: "gut" | "fehler"; text: string } | null>(null);

  const laden = () => {
    if (demo) return;
    api(`/kunde/${encodeURIComponent(kundeRef)}/app/vollmacht`).then((r) => {
      if (r.json?.ok === false && r.json?.grund) { setGrund(r.json.text || "Dieser Bereich wird gerade für Sie eingerichtet."); return; }
      if (!r.ok || !r.json?.ok) { setFehler("Ihre Vollmacht konnte gerade nicht geladen werden."); return; }
      setV({
        aktiv: !!r.json.aktiv,
        gueltigBis: r.json.gueltigBis ?? null,
        umfang: Array.isArray(r.json.umfang) ? r.json.umfang.map(String) : [],
        unterschriebenAm: r.json.unterschriebenAm ?? null,
        widerrufenAm: r.json.widerrufenAm ?? null,
        status: ["offen", "unterschrieben", "widerrufen", "abgelaufen"].indexOf(r.json.status) !== -1 ? r.json.status : null,
        unterschriftUrl: r.json.unterschriftUrl ?? null,
      });
      setFehler(null);
    }).catch(() => setFehler("Ihre Vollmacht konnte gerade nicht geladen werden."));
  };
  useEffect(laden, [kundeRef, demo]);

  const widerrufen = async () => {
    if (demo) {
      setV({ ...DEMO_VOLLMACHT, aktiv: false, status: "widerrufen", widerrufenAm: new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }) });
      setRueckfrage(false); setMeldung({ ton: "gut", text: "In der Demo-Ansicht wird nichts geändert." }); return;
    }
    setLaeuft(true); setMeldung(null);
    const r = await api(`/kunde/${encodeURIComponent(kundeRef)}/app/vollmacht/widerruf`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setLaeuft(false);
    if (r.ok && r.json?.ok !== false) {
      setRueckfrage(false);
      setMeldung({ ton: "gut", text: r.json?.text || "Ihre Vollmacht ist widerrufen. Anträge, die noch auf Ihre Unterschrift warten, bleiben in Ihrer Akte – für den Versand braucht es dann eine neue Vollmacht." });
      laden();
    } else {
      setMeldung({ ton: "fehler", text: r.json?.error || "Der Widerruf konnte gerade nicht gespeichert werden. Bitte versuchen Sie es noch einmal – Ihre Vollmacht ist unverändert." });
    }
  };

  return (
    <>
      <h1 className="ap-gruss ap-auf">Vollmachten<small>Womit Sie FIAON erlauben, Ihre unterschriebenen Erklärungen zu übermitteln.</small></h1>

      {grund && <div className="ap-karte ap-leer ap-auf v1"><b>Noch einen Moment.</b>{grund}</div>}
      {fehler && !v && (
        <div className="ap-karte ap-leer ap-auf v1">
          <b>{fehler}</b>
          <button type="button" className="ap-knopf still" style={{ marginTop: 12 }} onClick={laden}>Noch einmal</button>
        </div>
      )}
      {!v && !grund && !fehler && <div className="ap-skelett" style={{ height: 160, borderRadius: 14 }} />}

      {v && v.aktiv && (
        <div className="ap-karte ap-auf v1">
          <div className="ap-karte-kopf"><h3>Ihre Vollmacht zur Übermittlung</h3><span className="ap-status gut">gilt</span></div>
          <p>Ihre Vollmacht gilt{v.gueltigBis ? ` bis ${v.gueltigBis}` : ""} für: {umfangSatz(v.umfang)}.</p>
          <dl className="ap-liste">
            {v.unterschriebenAm && <><dt>Unterschrieben</dt><dd>{v.unterschriebenAm}</dd></>}
            {v.gueltigBis && <><dt>Gültig bis</dt><dd>{v.gueltigBis}</dd></>}
            <dt>Umfang</dt><dd>FIAON übermittelt die Erklärungen, die Sie selbst unterschrieben haben, und nimmt Eingangsbestätigungen und Antworten entgegen. Eigene Erklärungen gibt FIAON nicht für Sie ab.</dd>
          </dl>
          {!rueckfrage && <button type="button" className="ap-textknopf still" style={{ marginTop: 8 }} onClick={() => { setRueckfrage(true); setMeldung(null); }}>Widerrufen</button>}
          {rueckfrage && (
            <div className="ap-rueckfrage" role="group" aria-label="Widerruf bestätigen">
              <p>Möchten Sie die Vollmacht widerrufen? Laufende Anträge, die noch auf Ihre Unterschrift warten, bleiben in Ihrer Akte – für den Versand braucht es dann eine neue Vollmacht.</p>
              <div className="ap-knopf-reihe" style={{ marginTop: 0 }}>
                <button type="button" className="ap-knopf still" onClick={widerrufen} disabled={laeuft}>{laeuft ? "Wird gespeichert …" : "Ja, widerrufen"}</button>
                <button type="button" className="ap-knopf" onClick={() => setRueckfrage(false)} disabled={laeuft}>Behalten</button>
              </div>
            </div>
          )}
          {meldung && <div className={`ap-meldung ${meldung.ton}`} role="status">{meldung.text}</div>}
        </div>
      )}

      {v && !v.aktiv && (
        <div className="ap-karte ap-auf v1">
          {v.widerrufenAm ? (
            <>
              <div className="ap-karte-kopf"><h3>Vollmacht widerrufen</h3><span className="ap-status">widerrufen</span></div>
              <p>Sie haben Ihre Vollmacht am {v.widerrufenAm} widerrufen. Seitdem übermittelt FIAON keine Erklärungen mehr für Sie.</p>
            </>
          ) : v.status === "abgelaufen" ? (
            <>
              <div className="ap-karte-kopf"><h3>Vollmacht abgelaufen</h3><span className="ap-status">abgelaufen</span></div>
              <p>Ihre Vollmacht ist{v.gueltigBis ? ` am ${v.gueltigBis}` : ""} abgelaufen. Für den nächsten Antrag braucht es eine neue.</p>
            </>
          ) : (
            <>
              <div className="ap-karte-kopf"><h3>Noch keine Vollmacht</h3></div>
              <p>Sie haben noch keine Vollmacht erteilt. Sie wird nötig, sobald wir einen Antrag für Sie übermitteln.</p>
            </>
          )}
          {v.unterschriftUrl && <a className="ap-knopf" style={{ marginTop: 14 }} href={v.unterschriftUrl}>Vollmacht jetzt unterschreiben</a>}
          {!v.unterschriftUrl && !demo && <p className="ap-fuss">Der Unterschriftlink entsteht mit Ihrem ersten Antrag unter Vorgänge › Ansprüche.</p>}
          {demo && <p className="ap-fuss">Demo-Ansicht – feste Vorführdaten.</p>}
          {meldung && <div className={`ap-meldung ${meldung.ton}`} role="status">{meldung.text}</div>}
        </div>
      )}

      <div className="ap-karte ap-auf v2">
        <h3>Was die Vollmacht bedeutet</h3>
        <p>Sie erklären selbst – FIAON bereitet vor und übermittelt. Jeden Antrag unterschreiben Sie mit dem Finger, ein Mitarbeiter versendet ihn und bestätigt den Versand unter Vorgänge. Eine Vollmacht gilt zwölf Monate ab Ihrer Unterschrift und lässt sich hier jederzeit widerrufen.</p>
        <Link href={`${basis}/vorgaenge`} className="ap-link" style={{ display: "inline-block", marginTop: 10, fontSize: 15 }}>Zu meinen Vorgängen →</Link>
      </div>
    </>
  );
}
