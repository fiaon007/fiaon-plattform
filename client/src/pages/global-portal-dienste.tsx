// ═══════════════════════════════════════════════════════════════════════════
// „IHR BÜRO ERWEITERN“ — Zusatzdienste per Klick im Global-Portal (Scheibe 1 „Ihr US-Büro“, 22.10.2026)
//
// Justin: ruhig, hochwertig, typografisch — keine Symbolwand, keine Marken, kein Drängen. Jede Kachel ist
// anklickbar und öffnet das Fenster mit dem, was enthalten ist, und dem Preis, leise gesetzt
// („149 € einmalig“); die eine Handlung heißt „Hinzufügen“. Alle Texte und Preise kommen aus
// shared/fiaon-global-zusatz.ts (eine Quelle, Wortwand geprüft); der Server sagt, was gebucht ist und was
// der Auftrag schon enthält. Gestaltung nur über die Tokens des Portals (.gp, global-portal.css) und
// .gpd-Klassen (global-portal-dienste.css) — ein späterer Entwurf tauscht nur das CSS.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2, X } from "lucide-react";
import {
  GLOBAL_ZUSATZ_GRUPPEN, ZUSATZ_WOERTER, buchbareZusatzdienste, globalZusatz, zusatzAngabePruefen, zusatzPreisText, zusatzZeitraumText,
  type GlobalZusatz, type ZusatzStatus,
} from "@shared/fiaon-global-zusatz";
import "@/styles/global-portal-dienste.css";

type T = Record<string, any>;
const STUFEN: ZusatzStatus[] = ["gebucht", "bezahlt", "aktiv"];

export default function GlobalDienste({ a, s, mitToken, vorschau, laden }: {
  a: T; s: "de" | "en"; mitToken: (pfad: string) => string; vorschau: boolean; laden: () => Promise<void> | void;
}) {
  const W = ZUSATZ_WOERTER[s];
  const loc = s === "en" ? "en-GB" : "de-DE";
  const [offen, setOffen] = useState<GlobalZusatz | null>(null);
  const [angabe, setAngabe] = useState("");
  const [stand, setStand] = useState<"bereit" | "laeuft" | "fertig">("bereit");
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fertigText, setFertigText] = useState("");
  const knopfRef = useRef<HTMLButtonElement>(null);

  const gebucht: T[] = a.dienste?.gebucht ?? [];
  const enthalten: string[] = a.dienste?.enthalten ?? [];
  const nachKey = new Map(gebucht.map((g) => [String(g.key), g]));
  const tag = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(loc, { day: "numeric", month: "long", year: "numeric" }) : "");

  useEffect(() => {
    if (!offen) return;
    const zu = (e: KeyboardEvent) => { if (e.key === "Escape") schliessen(); };
    window.addEventListener("keydown", zu);
    const t = setTimeout(() => knopfRef.current?.focus(), 60);
    return () => { window.removeEventListener("keydown", zu); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offen]);

  const oeffnen = (z: GlobalZusatz) => { setOffen(z); setAngabe(""); setStand("bereit"); setMeldung(null); setFertigText(""); };
  const schliessen = () => { setOffen(null); setStand("bereit"); setMeldung(null); };

  const hinzufuegen = async () => {
    if (!offen || vorschau) return;
    const p = zusatzAngabePruefen(offen, angabe, s);
    if (!p.ok) { setMeldung(p.error); return; }
    setStand("laeuft"); setMeldung(null);
    try {
      const r = await fetch(mitToken("/zusatz"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: offen.key, angabe: p.wert, sprache: s }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { setMeldung(j.error || W.technisch); setStand("bereit"); return; }
      setFertigText(j.schon ? W.schonText : W.fertigText);
      setStand("fertig");
      await laden();
    } catch { setMeldung(W.technisch); setStand("bereit"); }
  };

  const katalog = buchbareZusatzdienste();
  const gebuchtSichtbar = gebucht.filter((g) => globalZusatz(g.key));

  return (
    <div className="gpd">
      {a.dienste?.fehler && <p className="gp-meldung schlecht" role="alert">{W.technisch}</p>}

      {gebuchtSichtbar.length > 0 && (
        <section className="gp-abschnitt gpd-abschnitt gpd-gebucht" aria-label={W.gebuchtTitel}>
          <h2 className="gpd-h2">{W.gebuchtTitel}</h2>
          <ul className="gpd-liste">
            {gebuchtSichtbar.map((g) => {
              const z = globalZusatz(g.key)!;
              const stufe = STUFEN.indexOf(g.status);
              return (
                <li key={g.id} className={`gpd-zeile st-${g.status}`} data-fiaon="dienst-gebucht">
                  <div className="gpd-zeile-text">
                    <b>{z[s].titel}</b>
                    <small>{[g.angabe, g.status === "aktiv" && g.aktivAm ? W.aktivSeit(tag(g.aktivAm)) : W.gebuchtAm(tag(g.am)), zusatzPreisText(z, s)].filter(Boolean).join(" · ")}</small>
                  </div>
                  <div className="gpd-stand" aria-label={W.status[g.status as ZusatzStatus]}>
                    <span className="gpd-punkte" aria-hidden="true">{STUFEN.map((x, i) => <i key={x} className={i <= stufe ? "an" : ""} />)}</span>
                    <span className="gpd-stand-text">{W.status[g.status as ZusatzStatus]}</span>
                  </div>
                  <div className="gpd-wege">
                    {g.zahlungsseite && <a className="gp-knopf klein" href={g.zahlungsseite}>{W.zurZahlung}</a>}
                    {g.rechnungUrl && <a className="gpd-link" href={g.rechnungUrl} target="_blank" rel="noopener">{W.rechnung}{g.rechnungsnummer ? ` ${g.rechnungsnummer}` : ""}</a>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {GLOBAL_ZUSATZ_GRUPPEN.map((gr) => {
        const liste = katalog.filter((z) => z.gruppe === gr.gruppe);
        if (!liste.length) return null;
        return (
          <section key={gr.gruppe} className="gp-abschnitt gpd-abschnitt gpd-gruppe" aria-label={gr[s]}>
            <h2 className="gpd-gruppe-titel">{gr[s]}</h2>
            <div className="gpd-kacheln">
              {liste.map((z, i) => {
                const g = nachKey.get(z.key);
                const drin = enthalten.includes(z.key);
                return (
                  <button key={z.key} type="button" className={`gpd-kachel${g ? " gebucht" : ""}${drin ? " enthalten" : ""}`} style={{ ["--i" as any]: i }}
                    onClick={() => oeffnen(z)} data-fiaon={`dienst-${z.key}`}>
                    <b className="gpd-kachel-titel">{z[s].titel}</b>
                    <span className="gpd-kachel-kurz">{z[s].kurz}</span>
                    <span className="gpd-kachel-fuss">
                      <span className="gpd-preis">{drin ? W.enthaltenMarke : g ? W.statusKurz[g.status as ZusatzStatus] : zusatzPreisText(z, s)}</span>
                      <span className="gpd-mehr">{W.mehr} <ArrowRight size={14} strokeWidth={1.6} /></span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {offen && (
        <div className="gp-schleier" role="dialog" aria-modal="true" aria-labelledby="gpd-titel" onClick={(e) => { if (e.target === e.currentTarget) schliessen(); }}>
          <div className="gp-dialog gpd-dialog">
            <button type="button" className="gp-dialog-zu" onClick={schliessen} aria-label={W.schliessen}><X size={18} /></button>
            {stand === "fertig" ? (
              <div className="gp-fertig" role="status">
                <svg className="gp-haken-gross" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" /><path d="M15 27 l7 7 l15 -16" /></svg>
                <h3>{W.fertigTitel}</h3>
                <p>{fertigText}</p>
                <button type="button" className="gp-knopf" onClick={schliessen}>{W.schliessen}</button>
              </div>
            ) : (() => {
              const g = nachKey.get(offen.key);
              const drin = enthalten.includes(offen.key);
              return (
                <>
                  <span className="gpd-dialog-gruppe">{GLOBAL_ZUSATZ_GRUPPEN.find((x) => x.gruppe === offen.gruppe)?.[s]}</span>
                  <h3 id="gpd-titel">{offen[s].titel}</h3>
                  <p className="gpd-dialog-kurz">{offen[s].kurz}</p>
                  <div className="gpd-dialog-block">
                    <span className="gpd-auge">{W.enthalten}</span>
                    <ul className="gpd-enthalten">{offen[s].enthalten.map((x) => <li key={x}>{x}</li>)}</ul>
                  </div>
                  <div className="gpd-dialog-block">
                    <span className="gpd-auge">{W.danach}</span>
                    <p>{offen[s].einrichtung}</p>
                  </div>
                  {drin ? (
                    <p className="gpd-hinweis">{W.enthaltenText}</p>
                  ) : g ? (
                    <p className="gpd-hinweis">{W.status[g.status as ZusatzStatus]}{g.angabe ? ` · ${g.angabe}` : ""}</p>
                  ) : (
                    <>
                      {offen.angabe && (
                        <label className="gp-feldname">{offen.angabe[s].label}
                          <input className="gp-eingabe" value={angabe} inputMode="url" autoCapitalize="none" spellCheck={false} placeholder={offen.angabe[s].platzhalter}
                            onChange={(e) => setAngabe(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void hinzufuegen(); }} />
                          <small className="gpd-klein">{offen.angabe[s].hinweis}</small>
                        </label>
                      )}
                      <div className="gpd-preiszeile">
                        <span className="gpd-preis gross">{zusatzPreisText(offen, s)}</span>
                        <small>{W.rechnungHinweis}{offen.abrechnung !== "einmalig" ? ` ${W.ersterZeitraum(zusatzZeitraumText(offen.abrechnung, s))}` : ""}</small>
                      </div>
                      {meldung && <p className="gp-meldung schlecht" role="alert">{meldung}</p>}
                      {vorschau && <p className="gp-meldung" role="note">{W.vorschau}</p>}
                      <button ref={knopfRef} type="button" className="gp-knopf gross" disabled={vorschau || stand === "laeuft"} onClick={() => void hinzufuegen()} data-fiaon="dienst-hinzufuegen">
                        {stand === "laeuft" ? <><Loader2 size={16} className="gp-dreht" /> {W.laeuft}</> : W.hinzufuegen}
                      </button>
                    </>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
