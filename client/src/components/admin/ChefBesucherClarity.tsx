// ═══════════════════════════════════════════════════════════════════════════
// BESUCHER › ÄRGERNISSE — Microsoft Clarity (27.08.2026, seit E-378 der zweite Teil der Seite)
//
// Seit dem 15.10.2026 (E-378) misst fiaon.com Besucher selbst (ChefBesucher.tsx).
// Clarity bleibt für das, was nur Clarity sieht: Wut-Klicks, tote Klicks,
// Skriptfehler, „sofort zurück" — je Seite, mit dem Knopf „Als Aufgabe".
// Clarity gibt über die Schnittstelle nur die letzten drei Tage heraus, zählt nur
// Besucher mit Einwilligung und erlaubt zehn Abrufe am Tag; die Seite sagt
// deshalb IMMER, wie alt die Zahlen sind.
//
// E-378: Die Zeiten kommen jetzt richtig an (Clarity liefert Sekunden, nicht
// Millisekunden — vorher stand hier „0 s aktiv"). Die Ranglisten „Meistbesuchte
// Seiten" und „Woher" sind weg: Das zeigt die eigene Messung oben genauer und für
// alle Besucher, nicht nur für die mit Einwilligung.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { MousePointerClick, RefreshCw, Loader2, AlertTriangle, ExternalLink, ClipboardPlus, ClipboardCheck } from "lucide-react";
import { API, zahl, seit } from "./chef-teile";

/** Millisekunden in „2 min 14 s". */
export const dauerText = (ms: number): string => {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m} min ${rest} s` : `${m} min`;
};
const prozent = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString("de-DE")} %`;

export default function ChefBesucherClarity() {
  const [d, setD] = useState<any>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [holt, setHolt] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  // Welche Seite gerade zur Aufgabe wird, und was daraus geworden ist.
  const [aufgabeLaeuft, setAufgabeLaeuft] = useState<string | null>(null);
  const [aufgaben, setAufgaben] = useState<Record<string, { id: number; schonDa: boolean }>>({});

  const laden = () => {
    setLaedt(true); setFehler(null);
    fetch(`${API}/chef/clarity`, { credentials: "include" })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (j?.ok) setD(j); else setFehler(j?.error || "Clarity ließ sich nicht laden.");
      })
      .catch(() => setFehler("Keine Verbindung zum Server."))
      .finally(() => setLaedt(false));
  };
  useEffect(laden, []);

  const neuHolen = async () => {
    if (holt) return;
    setHolt(true); setMeldung(null);
    try {
      const r = await fetch(`${API}/chef/clarity/neu`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tage: 3 }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setD({ ...j, eingerichtet: true, leer: false }); setMeldung("Frisch von Clarity geholt."); }
      else setMeldung(j?.error || "Der Abruf ist nicht gelungen.");
    } catch {
      setMeldung("Keine Verbindung zum Server.");
    } finally { setHolt(false); }
  };

  // Justin: „36 Wut-Klicks ist eine Zahl, 36 Wut-Klicks auf /antrag ist eine Aufgabe."
  const zurAufgabe = async (s: any) => {
    if (aufgabeLaeuft) return;
    setAufgabeLaeuft(s.pfad);
    try {
      const r = await fetch(`${API}/chef/clarity/aufgabe`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pfad: s.pfad, aerger: s.aerger, sitzungen: s.sitzungen }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setAufgaben((a) => ({ ...a, [s.pfad]: { id: j.id, schonDa: !!j.schonDa } }));
      else setMeldung(j?.error || "Die Aufgabe ließ sich nicht anlegen.");
    } catch {
      setMeldung("Keine Verbindung zum Server.");
    } finally { setAufgabeLaeuft(null); }
  };

  const kopf = (
    <div className="bz-abschnitt-kopf">
      <h2><AlertTriangle size={17} strokeWidth={1.7} aria-hidden="true" /> Ärgernisse <em>Clarity, letzte 3 Tage</em></h2>
    </div>
  );

  if (laedt) return <section className="bz-abschnitt bz-clarity">{kopf}<p className="bz-leise">lädt …</p></section>;
  if (fehler) return <section className="bz-abschnitt bz-clarity">{kopf}<p className="bz-leise">{fehler}</p></section>;
  if (!d) return null;
  if (!d.eingerichtet) return <section className="bz-abschnitt bz-clarity">{kopf}<p className="bz-leise">{d.hinweis}</p></section>;
  if (d.leer) {
    return (
      <section className="bz-abschnitt bz-clarity">
        {kopf}
        <p className="bz-leise">{d.hinweis}</p>
        <button type="button" className="cw-knopf klein" onClick={neuHolen} disabled={holt}>
          {holt ? <><Loader2 size={14} className="cw-dreht" /> holt …</> : <><RefreshCw size={14} strokeWidth={1.7} /> Jetzt von Clarity holen</>}
        </button>
        {meldung && <p className="cw-meldung" role="status">{meldung}</p>}
      </section>
    );
  }

  const k = d.kopf ?? {};
  // Sortiert nach DICHTE, nicht nach absoluter Zahl: 36 Wut-Klicks bei 3.000 Sitzungen
  // sind ein anderer Befund als 36 bei 50.
  const seitenNachAerger = [...(d.seiten ?? [])]
    .filter((s: any) => (s.gewicht ?? 0) > 0)
    .sort((a: any, b: any) => (b.dichte ?? 0) - (a.dichte ?? 0))
    .slice(0, 12);

  return (
    <section className="bz-abschnitt bz-clarity">
      {kopf}
      <div className="cbes-stand">
        <span>
          Stand: <b>{d.stand ? seit(d.stand) : "unbekannt"}</b>
          {d.budget && <> · Abrufe heute {d.budget.verbrauchtHeute}/{d.budget.tagesbudget}
            {d.budget.nochMoeglich > 0 ? <> · noch {d.budget.nochMoeglich}</> : <> · <b>heute keine weiteren</b></>}</>}
          {" "}· nur Besucher mit Einwilligung
        </span>
        <button type="button" className="cw-knopf klein" onClick={neuHolen} disabled={holt || (d.budget?.nochMoeglich ?? 0) === 0}>
          {holt ? <Loader2 size={14} className="cw-dreht" /> : <RefreshCw size={14} strokeWidth={1.7} />}
          {holt ? "holt …" : "Neu holen"}
        </button>
      </div>
      {d.ladefehler && <p className="cw-meldung" role="status">{d.ladefehler}</p>}
      {meldung && <p className="cw-meldung" role="status">{meldung}</p>}

      <div className="bz-clarity-zahlen">
        <span><b>{zahl(k.sitzungen ?? 0)}</b> Sitzungen{k.bots > 0 && <> · {zahl(k.bots)} Bots</>}</span>
        <span><b>{dauerText(k.zeitAktivMs ?? 0)}</b> Ø aktiv · von {dauerText(k.zeitGesamtMs ?? 0)}</span>
        <span><b>{prozent(k.scrolltiefe ?? 0)}</b> Ø Scrolltiefe</span>
      </div>

      {(d.aergernisse ?? []).length > 0 && (
        <div className="cbes-aerger">
          {d.aergernisse.map((a: any) => (
            <div key={a.key} className="cbes-aergerkarte">
              <b>{zahl(a.vorfaelle)}</b>
              <strong>{a.titel}</strong>
              <em>{a.satz}</em>
              <small>{prozent(a.anteil)} der Sitzungen · {zahl(a.seiten)} Seitenaufrufe</small>
            </div>
          ))}
        </div>
      )}

      {seitenNachAerger.length > 0 && (
        <>
          <h3 className="bz-unterkopf"><MousePointerClick size={15} strokeWidth={1.7} aria-hidden="true" /> Diese Seiten machen Ärger</h3>
          <div className="cbes-seiten">
            {seitenNachAerger.map((s: any) => {
              const gemacht = aufgaben[s.pfad];
              return (
                <div key={s.pfad} className="cbes-seite">
                  <span className="cbes-pfad">
                    <b>{s.pfad}</b>
                    <em>
                      {zahl(s.sitzungen)} Sitzungen
                      {s.scrolltiefe != null && <> · {prozent(s.scrolltiefe)} Scrolltiefe</>}
                      {s.dichte > 0 && <> · <b title="Gewichtete Vorfälle je 1.000 Sitzungen (Wut ×3, Fehler ×2)">{Math.round(s.dichte)} je 1.000</b></>}
                    </em>
                  </span>
                  <span className="cbes-marken">
                    {s.aerger?.wut > 0 && <i data-ton="rot" title="Mehrfach schnell auf dieselbe Stelle geklickt">{s.aerger.wut} Wut</i>}
                    {s.aerger?.fehler > 0 && <i data-ton="rot" title="Skriptfehler im Browser">{s.aerger.fehler} Fehler</i>}
                    {s.aerger?.tot > 0 && <i data-ton="gelb" title="Geklickt, nichts passiert">{s.aerger.tot} tot</i>}
                    {s.aerger?.zurueck > 0 && <i data-ton="gelb" title="Binnen Sekunden wieder zurück">{s.aerger.zurueck} zurück</i>}
                    {s.aerger?.scrollSuche > 0 && <i data-ton="gelb" title="Gesucht und nicht gefunden">{s.aerger.scrollSuche} gesucht</i>}
                  </span>
                  <span className="cbes-wege">
                    {gemacht ? (
                      <a className="cw-knopf klein" href="/chef/s/todo" title={gemacht.schonDa ? "Aufgabe gibt es schon" : "Aufgabe angelegt"}>
                        <ClipboardCheck size={13} strokeWidth={1.8} />
                        {gemacht.schonDa ? "steht schon" : "angelegt"}
                      </a>
                    ) : (
                      <button type="button" className="cw-knopf klein" onClick={() => zurAufgabe(s)} disabled={!!aufgabeLaeuft}>
                        {aufgabeLaeuft === s.pfad ? <Loader2 size={13} className="cw-dreht" /> : <ClipboardPlus size={13} strokeWidth={1.8} />}
                        Als Aufgabe
                      </button>
                    )}
                    <a className="cw-knopf klein" href={s.adresse} target="_blank" rel="noopener noreferrer" title="Die Seite ansehen">
                      <ExternalLink size={13} strokeWidth={1.7} /> ansehen
                    </a>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
