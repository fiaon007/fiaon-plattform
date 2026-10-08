// ═══════════════════════════════════════════════════════════════════════════
// „IHR PRÜFBERICHT“ — DIE DUNKLE NAVY-BÜHNE (E-301), die einzige dunkle Fläche
//
// Daten: compliance (Kundenfassung von compliance-daten.json: ohne Bereich 8,
// ohne gesamt.zusatz, ohne interne Sätze — gefiltert im Server). Aufbau wie im
// Generator des Prüfberichts: Ampelturm (Navy-Gehäuse, die aktive Lampe leuchtet
// mit Glanz), Gesamturteil, Kernzahlen, kleines Siegel der Sonderfreigabe,
// Legende (Zeichen + Wort, nie Farbe allein), dann je Bereich eine Kachel mit
// Nummer, Ampel-Pille, Kurzurteil und „belegt“-Balken (Anteil der bestätigten,
// korrigierten und neu belegten Befunde). Jede Kachel öffnet ihren Bereich
// unter ihrer Reihe (grid-auto-flow: dense): Urteil, Befund-Tabelle im eigenen
// Scrollkasten, „nicht geprüft“, Chancen und Risiken. Darunter Auflagen,
// Stärken und Schwächen, Methodik und der Knopf zum PDF.
// Die Beschriftungen der Teile (WORTE unten) sind Bedienbeschriftungen — die
// Kundenfassung trägt dafür keine Felder; alle Inhalte kommen aus den Daten.
// ═══════════════════════════════════════════════════════════════════════════
import { Fragment, useState } from "react";
import type { Ampel, ComplianceBereich, ComplianceKundenfassung, FirmaSonderfreigabe } from "@shared/fiaon-global-angebot-firma-typen";
import { SiegelGrafik } from "./SonderfreigabeSiegel";
import { Auf, Fett, Zeichen } from "./gemeinsam";

const WORTE = {
  gesamt: "Gesamturteil", legende: "Legende", bereiche: "Die Bereiche", belegt: "belegt", befunde: "Befunde",
  aussage: "Aussage", quelle: "Quelle", stand: "Stand", pruefung: "Prüfung", nichtGeprueft: "Nicht geprüft",
  chancen: "Chancen", risiken: "Risiken", auflagen: "Auflagen", staerken: "Stärken", schwaechen: "Schwächen",
  methodik: "Methodik", oeffnen: "Bereich öffnen", schliessen: "Bereich schließen", pruefdatum: "Prüfdatum", datenstand: "Datenstand",
};
const BELEGT = new Set(["bestätigt", "korrigiert", "neu", "neu belegt"]);
const PRUEF_WORT: Record<string, string> = { neu: "neu belegt" };

export function AmpelPille({ ampel, klein = false }: { ampel: Ampel; klein?: boolean }) {
  const art = ampel === "GRÜN" ? "haken" : ampel === "ROT" ? "kreuz" : "warnung";
  return (
    <span className={`gaf-pille gaf-pille-${ampel === "GRÜN" ? "gruen" : ampel === "ROT" ? "rot" : "gelb"}${klein ? " klein" : ""}`}>
      <Zeichen art={art} groesse={klein ? 12 : 14} /><span>{ampel}</span>
    </span>
  );
}

/** Der Ampelturm: Navy-Gehäuse mit Metallkante, drei Lampen; die aktive leuchtet mit Hof und Glanzlicht. */
function Ampelturm({ ampel }: { ampel: Ampel }) {
  const lampen: { a: Ampel; y: number; farbe: string; hell: string }[] = [
    { a: "ROT", y: 46, farbe: "#e05a4f", hell: "#ffb1a6" },
    { a: "GELB", y: 106, farbe: "#f0bf3c", hell: "#fff0b8" },
    { a: "GRÜN", y: 166, farbe: "#3fbf83", hell: "#b9f5d6" },
  ];
  return (
    <svg className="gaf-turm" viewBox="0 0 100 214" width="92" height="197" role="img" aria-label={`${WORTE.gesamt}: ${ampel}`}>
      <defs>
        <linearGradient id="gaf-turm-g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#0a1830" /><stop offset=".5" stopColor="#1a345c" /><stop offset="1" stopColor="#0a1830" /></linearGradient>
        <linearGradient id="gaf-turm-k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c8d3e4" stopOpacity=".7" /><stop offset="1" stopColor="#c8d3e4" stopOpacity=".1" /></linearGradient>
        {lampen.map((l) => (
          <radialGradient key={l.a} id={`gaf-l-${l.a}`} cx="42%" cy="38%" r="62%"><stop offset="0" stopColor={l.hell} /><stop offset=".55" stopColor={l.farbe} /><stop offset="1" stopColor={l.farbe} stopOpacity=".75" /></radialGradient>
        ))}
        <filter id="gaf-turm-hof" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="7" /></filter>
      </defs>
      <rect x="10" y="6" width="80" height="200" rx="26" fill="url(#gaf-turm-g)" stroke="url(#gaf-turm-k)" strokeWidth="1.2" />
      {lampen.map((l) => {
        const an = l.a === ampel;
        return (
          <g key={l.a} className={an ? "gaf-lampe an" : "gaf-lampe"}>
            <circle cx="50" cy={l.y} r="22" fill="#06101f" />
            {an && <circle cx="50" cy={l.y} r="24" fill={l.farbe} opacity=".75" filter="url(#gaf-turm-hof)" className="gaf-lampe-hof" />}
            <circle cx="50" cy={l.y} r="18" fill={an ? `url(#gaf-l-${l.a})` : l.farbe} opacity={an ? 1 : 0.16} />
            {an && <ellipse cx="44" cy={l.y - 7} rx="8" ry="4.5" fill="#fff" opacity=".55" />}
          </g>
        );
      })}
    </svg>
  );
}

function anteilBelegt(b: ComplianceBereich) {
  const n = b.befunde.length;
  const ja = b.befunde.filter((x) => BELEGT.has(String(x.pruefung).toLowerCase())).length;
  return { n, ja, anteil: n ? ja / n : 0 };
}

function BereichDetail({ b }: { b: ComplianceBereich }) {
  return (
    <div className="gaf-bereich-detail" id={`gaf-bereich-${b.nr}`} role="region" aria-label={`${b.nr} · ${b.titel}`}>
      <div className="gaf-bereich-urteil">
        {b.urteil.map((u, i) => <p key={i}><Fett text={u} /></p>)}
      </div>
      {b.befunde.length > 0 && (
        <>
          <p className="gaf-buehne-auge">{WORTE.befunde} · {b.befunde.length}</p>
          <div className="gaf-tabelle-kasten" tabIndex={0} role="group" aria-label={`${WORTE.befunde} ${b.titel}`}>
            <table className="gaf-tabelle">
              <thead><tr><th>{WORTE.aussage}</th><th>{WORTE.quelle}</th><th>{WORTE.stand}</th><th>{WORTE.pruefung}</th></tr></thead>
              <tbody>
                {b.befunde.map((f) => {
                  const url = String(f.quelle_url || "").split(/\s*;\s*/)[0];
                  const pw = PRUEF_WORT[f.pruefung] ?? f.pruefung;
                  return (
                    <tr key={f.id}>
                      <td><Fett text={f.aussage} /></td>
                      <td>{/^https?:\/\//.test(url) ? <a href={url} target="_blank" rel="noreferrer noopener">{f.quelle_name}</a> : f.quelle_name}</td>
                      <td className="gaf-nowrap">{f.stand}</td>
                      <td><span className={`gaf-pruef${BELEGT.has(String(f.pruefung).toLowerCase()) ? " ja" : ""}`}>{pw}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="gaf-bereich-spalten">
        {b.nicht_geprueft.length > 0 && (
          <div>
            <p className="gaf-buehne-auge">{WORTE.nichtGeprueft}</p>
            <ul className="gaf-buehne-liste">{b.nicht_geprueft.map((x) => <li key={x.punkt}><b>{x.punkt}</b><span>{x.grund}</span></li>)}</ul>
          </div>
        )}
        {b.chancen.length > 0 && (
          <div>
            <p className="gaf-buehne-auge">{WORTE.chancen}</p>
            <ul className="gaf-buehne-liste plus">{b.chancen.map((x) => <li key={x}><Fett text={x} /></li>)}</ul>
          </div>
        )}
        {b.risiken.length > 0 && (
          <div>
            <p className="gaf-buehne-auge">{WORTE.risiken}</p>
            <ul className="gaf-buehne-liste minus">{b.risiken.map((x) => <li key={x}><Fett text={x} /></li>)}</ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ComplianceBuehne({ c, texte, pdf, sonderfreigabe }: {
  c: ComplianceKundenfassung | null;
  texte: { titel: string; sub: string; download: string; hinweis: string };
  pdf: string;
  sonderfreigabe?: FirmaSonderfreigabe | null;
}) {
  const [offen, setOffen] = useState<number | null>(null);
  const [methodik, setMethodik] = useState(false);
  return (
    <section className="gaf-buehne" id="pruefbericht" aria-label={texte.titel} data-fiaon="firma-pruefbericht">
      <div className="gaf-buehne-grund" aria-hidden="true"><span className="a" /><span className="b" /><span className="c" /></div>
      <div className="gaf-rahmen">
        <Auf className="gaf-kopf gaf-kopf-hell">
          <p className="gaf-auge gaf-auge-hell">{c?.meta.anlass || texte.titel}</p>
          <h2 className="gaf-h2">{texte.titel}</h2>
          <p className="gaf-sub">{texte.sub}</p>
        </Auf>

        {c && (
          <>
            <Auf className="gaf-urteil">
              <div className="gaf-urteil-turm">
                <Ampelturm ampel={c.gesamt.ampel} />
                <AmpelPille ampel={c.gesamt.ampel} />
              </div>
              <div className="gaf-urteil-text">
                <p className="gaf-buehne-auge">{WORTE.gesamt} · {c.meta.firma}</p>
                <h3 className="gaf-urteil-titel">{c.gesamt.titel}</h3>
                {c.gesamt.text.map((t, i) => <p key={i} className="gaf-urteil-absatz"><Fett text={t} /></p>)}
                <p className="gaf-urteil-meta">{WORTE.pruefdatum} {c.meta.pruefdatum} · {WORTE.datenstand}: {c.meta.datenstand}</p>
              </div>
              {sonderfreigabe && <div className="gaf-urteil-siegel"><SiegelGrafik sf={sonderfreigabe} groesse={124} /></div>}
            </Auf>

            {c.gesamt.kernzahlen.length > 0 && (
              <Auf className="gaf-kernzahlen-wrap">
                <dl className="gaf-kernzahlen">
                  {c.gesamt.kernzahlen.map((z) => <div key={z.text}><dt>{z.text}</dt><dd>{z.wert}</dd></div>)}
                </dl>
              </Auf>
            )}

            <div className="gaf-legende" role="group" aria-label={WORTE.legende}>
              <span className="gaf-buehne-auge">{WORTE.legende}</span>
              <AmpelPille ampel="GRÜN" klein /><AmpelPille ampel="GELB" klein /><AmpelPille ampel="ROT" klein />
            </div>

            <p className="gaf-buehne-auge gaf-bereiche-titel">{WORTE.bereiche}</p>
            <div className="gaf-kacheln">
              {c.bereiche.map((b) => {
                const auf = offen === b.nr;
                const bel = anteilBelegt(b);
                return (
                  <Fragment key={b.nr}>
                    <button type="button" className={`gaf-kachel${auf ? " auf" : ""}`} aria-expanded={auf} aria-controls={`gaf-bereich-${b.nr}`}
                      onClick={() => setOffen(auf ? null : b.nr)} data-ampel={b.ampel}>
                      <span className="gaf-kachel-kopf">
                        <span className="gaf-kachel-nr">{String(b.nr).padStart(2, "0")}</span>
                        <AmpelPille ampel={b.ampel} klein />
                      </span>
                      <span className="gaf-kachel-titel">{b.titel}</span>
                      <span className="gaf-kachel-kurz"><Fett text={b.kurz} /></span>
                      {bel.n > 0 && (
                        <span className="gaf-belegt">
                          <span className="gaf-belegt-balken"><i style={{ width: `${Math.round(bel.anteil * 100)}%` }} /></span>
                          <span className="gaf-belegt-zahl">{bel.ja} / {bel.n} {WORTE.belegt}</span>
                        </span>
                      )}
                      <span className="gaf-kachel-mehr">{auf ? WORTE.schliessen : WORTE.oeffnen}<span className="gaf-plus" aria-hidden="true" /></span>
                    </button>
                    {auf && <BereichDetail b={b} />}
                  </Fragment>
                );
              })}
            </div>

            <div className="gaf-buehne-unten">
              {c.gesamt.auflagen.length > 0 && (
                <Auf className="gaf-glas-feld">
                  <p className="gaf-buehne-auge">{WORTE.auflagen}</p>
                  <ol className="gaf-auflagen">{c.gesamt.auflagen.map((a, i) => <li key={i}><Fett text={a} /></li>)}</ol>
                </Auf>
              )}
              {(c.chancen.length > 0 || c.schwaechen.length > 0) && (
                <Auf className="gaf-glas-feld gaf-zwei">
                  <div>
                    <p className="gaf-buehne-auge">{WORTE.staerken}</p>
                    <ul className="gaf-buehne-liste plus">{c.chancen.map((x) => <li key={x.titel}><b>{x.titel}</b><span><Fett text={x.text} /></span></li>)}</ul>
                  </div>
                  <div>
                    <p className="gaf-buehne-auge">{WORTE.schwaechen}</p>
                    <ul className="gaf-buehne-liste minus">{c.schwaechen.map((x) => <li key={x.titel}><b>{x.titel}</b><span><Fett text={x.text} /></span></li>)}</ul>
                  </div>
                </Auf>
              )}
              {c.methodik.length > 0 && (
                <div className={`gaf-glas-feld gaf-methodik${methodik ? " auf" : ""}`}>
                  <button type="button" className="gaf-methodik-knopf" aria-expanded={methodik} aria-controls="gaf-methodik" onClick={() => setMethodik((m) => !m)}>
                    <span className="gaf-buehne-auge">{WORTE.methodik}</span><span className="gaf-plus" aria-hidden="true" />
                  </button>
                  <div className="gaf-klapp" id="gaf-methodik"><div>
                    {c.methodik.map((m, i) => <p key={i}><Fett text={m} /></p>)}
                    {c.meta.kopf.length > 0 && <dl className="gaf-meta-kopf">{c.meta.kopf.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
                  </div></div>
                </div>
              )}
            </div>
          </>
        )}

        <div className="gaf-buehne-fuss">
          <a className="gaf-knopf-gold" href={pdf} target="_blank" rel="noreferrer" data-fiaon="firma-pruefbericht-pdf">
            <Zeichen art="pdf" groesse={18} /><span>{texte.download}</span>
          </a>
          <p className="gaf-buehne-hinweis">{texte.hinweis}</p>
          {c?.fuss && <p className="gaf-buehne-hinweis klein">{c.fuss}</p>}
        </div>
      </div>
    </section>
  );
}
