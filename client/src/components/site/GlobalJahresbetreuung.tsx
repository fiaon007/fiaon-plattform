// ═══════════════════════════════════════════════════════════════════════════
// JAHRESBETREUUNG AB DEM ZWEITEN JAHR — DER BLOCK FÜR JEDE SEITE (19.09.2026, E-196)
//
// Justin: „Für 699 € im Jahr kümmern wir uns fortlaufend um alles … Füge und
// pflege das bitte auf jeder Seite neu ein." Ein Baustein, zwei Größen: „voll"
// auf den Startseiten (für Unternehmen und für Privatpersonen), „kompakt" auf
// allen Unterseiten und Landingpages. Texte und Preis kommen ausschließlich aus
// GLOBAL_JAHRESBETREUUNG (shared/fiaon-global.ts) — dieselben Sätze stehen im
// Auftrag, im Vertrag und auf der Rechnung.
//
// 06.10.2026 (E-293): dritte Größe „band“ für /business — eine Zeile statt eines
// Abschnitts von 133 Wörtern: Jahresring, „Jahresbetreuung: 699 € im Jahr“, ein
// Satz, die Zeitleiste „Jahr 1 / Ab Jahr 2“, die Bedingung kurz, ein Knopf. Die
// vollen Sätze (lead, sechs Leistungen, Bedingungen) stehen unter „So
// funktioniert es“ im DOM. Das Band trägt `id="jahresbetreuung"` selbst — der
// Menüpunkt /business#jahresbetreuung zeigt weiter hierher.
// ═══════════════════════════════════════════════════════════════════════════
import { useRef } from "react";
import { GLOBAL_JAHRESBETREUUNG, globalJahresbetreuungPreisText } from "@shared/fiaon-global";
import { useEinmalSichtbar } from "@/components/site/global/bewegung";

function Haken() {
  return (
    <svg className="fg-haken" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7.25" stroke="currentColor" strokeOpacity=".28" strokeWidth="1" />
      <path d="M4.8 8.2l2.1 2.1 4.3-4.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Der Jahresring (Scheibe A ruhig: Kreis, zwölf Monatsstriche, Monat 1 navy; der Zeiger dreht ab Scheibe B einmal). */
function Jahresring() {
  return (
    <svg className="fg-jb-ring" viewBox="0 0 220 220" aria-hidden="true">
      <circle cx="110" cy="110" r="96" className="kreis" />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1="110" y1="14" x2="110" y2="22" className={i === 0 ? "monat eins" : "monat"} transform={`rotate(${i * 30} 110 110)`} />
      ))}
      <line x1="110" y1="110" x2="110" y2="26" className="zeiger" />
      <circle cx="110" cy="110" r="4" className="nabe" />
    </svg>
  );
}

function Band({ sprache, startPfad, knopf, so }: { sprache: "de" | "en"; startPfad: string; knopf: string; so: string }) {
  const ref = useRef<HTMLElement>(null);
  useEinmalSichtbar(ref);
  const j = GLOBAL_JAHRESBETREUUNG[sprache];
  return (
    <section ref={ref} id="jahresbetreuung" className="fg-sek eng fg-jb-band-sek" style={{ scrollMarginTop: 72 }}>
      <div className="fg-rahmen">
        <div className="fg-jb band">
          <div className="fg-jb-ring-rahmen">
            <Jahresring />
            <ul className="fg-jb-kurz">{j.kurzLeistungen.map((x, i) => <li key={x} style={{ "--i": i } as React.CSSProperties}>{x}</li>)}</ul>
          </div>
          <div className="fg-jb-mitte">
            <span className="fg-auge">{j.marke}</span>
            <h2 className="fg-jb-titel">{j.titel}: <span className="fg-glanz">{j.preisZeile}</span></h2>
            <p className="fg-jb-satz">{j.bandSatz}</p>
            <div className="fg-jb-zeit" aria-hidden="false">
              <span className="eins">{j.zeitleiste[0]}</span>
              <span className="zwei">{j.zeitleiste[1]}</span>
            </div>
            <p className="fg-jb-klein">{j.bandBedingung}</p>
          </div>
          <div className="fg-jb-tun">
            <a className="fg-knopf" href={startPfad}>{knopf}</a>
            <details className="fg-jb-so">
              <summary>{so}</summary>
              <p>{j.lead}</p>
              <ul>{j.leistungen.map((x) => <li key={x}>{x}</li>)}</ul>
              <p>{j.bedingungen}</p>
            </details>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function GlobalJahresbetreuung({ sprache, groesse = "kompakt", startPfad, onGespraech, knopf, gespraech, so }: {
  sprache: "de" | "en";
  groesse?: "voll" | "kompakt" | "band";
  /** Wohin „beim Auftrag dazubuchen" führt (Auftrag mit oder ohne Paket). */
  startPfad: string;
  /** Nur auf den Startseiten: springt zum Gesprächskalender. */
  onGespraech?: () => void;
  knopf: string;
  gespraech?: string;
  so: string;
}) {
  if (groesse === "band") return <Band sprache={sprache} startPfad={startPfad} knopf={knopf} so={so} />;
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
