// ═══════════════════════════════════════════════════════════════════════════
// JAHRESBETREUUNG AB DEM ZWEITEN JAHR — DER BLOCK FÜR JEDE SEITE (19.09.2026, E-196)
//
// Justin: „Für 699 € im Jahr kümmern wir uns fortlaufend um alles … Füge und
// pflege das bitte auf jeder Seite neu ein." Ein Baustein, zwei Größen: „voll"
// auf den Startseiten (für Unternehmen und für Privatpersonen), „kompakt" auf
// allen Unterseiten und Landingpages. Texte und Preis kommen ausschließlich aus
// GLOBAL_JAHRESBETREUUNG (shared/fiaon-global.ts) — dieselben Sätze stehen im
// Auftrag, im Vertrag und auf der Rechnung.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_JAHRESBETREUUNG, globalJahresbetreuungPreisText } from "@shared/fiaon-global";

function Haken() {
  return (
    <svg className="fg-haken" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7.25" stroke="currentColor" strokeOpacity=".28" strokeWidth="1" />
      <path d="M4.8 8.2l2.1 2.1 4.3-4.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function GlobalJahresbetreuung({ sprache, groesse = "kompakt", startPfad, onGespraech, knopf, gespraech, so }: {
  sprache: "de" | "en";
  groesse?: "voll" | "kompakt";
  /** Wohin „beim Auftrag dazubuchen" führt (Auftrag mit oder ohne Paket). */
  startPfad: string;
  /** Nur auf den Startseiten: springt zum Gesprächskalender. */
  onGespraech?: () => void;
  knopf: string;
  gespraech?: string;
  so: string;
}) {
  const j = GLOBAL_JAHRESBETREUUNG[sprache];
  const preis = globalJahresbetreuungPreisText(sprache);
  const [zahl, einheit] = sprache === "en" ? [preis, "a year"] : [preis, "im Jahr"];

  if (groesse === "kompakt") {
    return (
      <aside className="fg-jb kompakt" aria-label={j.titel}>
        <div className="fg-jb-kopf">
          <span className="fg-auge">{j.marke}</span>
          <b className="fg-jb-titel">{j.titel}: <span className="fg-glanz">{zahl}</span> {einheit}</b>
          <p>{j.kurz}</p>
        </div>
        <ul>{j.leistungen.map((x) => <li key={x}><Haken />{x}</li>)}</ul>
        <p className="fg-jb-klein">{j.bedingungen}</p>
        <a className="fg-textknopf" href={startPfad}>{knopf}</a>
      </aside>
    );
  }

  return (
    <section id="jahresbetreuung" className="fg-sek eng" style={{ scrollMarginTop: 72 }}>
      <div className="fg-rahmen">
        <div className="fg-jb voll">
          <div className="fg-jb-kopf">
            <span className="fg-auge">{j.marke}</span>
            <h2 className="fg-h2">{sprache === "en" ? `${j.titel}: we take care of everything, year after year.` : `${j.titel}: Wir kümmern uns fortlaufend um alles.`}</h2>
            <p className="fg-lead">{j.lead}</p>
            <div className="fg-jb-preis">
              <b className="fg-glanz">{zahl}</b>
              <span>{einheit} · {sprache === "en" ? "all fees included" : "alle Gebühren inklusive"}</span>
            </div>
          </div>
          <div className="fg-jb-rumpf">
            <ul>{j.leistungen.map((x) => <li key={x}><Haken />{x}</li>)}</ul>
            <div className="fg-jb-so">
              <b>{so}</b>
              <p>{j.bedingungen}</p>
              <p>{j.nichtHeute}</p>
            </div>
            <div className="fg-knoepfe">
              <a className="fg-knopf" href={startPfad}>{knopf}</a>
              {onGespraech && gespraech && <button type="button" className="fg-knopf hell" onClick={onGespraech}>{gespraech}</button>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
