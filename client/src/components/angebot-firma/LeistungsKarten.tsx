// ═══════════════════════════════════════════════════════════════════════════
// „WAS SIE BEKOMMEN“ (E-301) — sechs Leistungskarten aus seite.leistungen
//
// Jede Karte: eigenes Zeichen je Schlüssel (1,5 px, keine Bibliothek), Titel,
// Satz, Punkte. Karten mit Szenenbild tragen es oben (KI-Hinweis am Bild).
// Hover: die Karte hebt sich um 4 px, die Goldlinie oben läuft über die volle
// Breite, das Zeichen bekommt einen goldenen Hof. Gestaffeltes Einblenden.
// ═══════════════════════════════════════════════════════════════════════════
import type { FirmaLeistung } from "@shared/fiaon-global-angebot-firma-typen";
import { Auf, Bild, Zeichen } from "./gemeinsam";

export default function LeistungsKarten({ karten }: { karten: FirmaLeistung[] }) {
  return (
    <ul className="gaf-leistungen" data-fiaon="firma-leistungen">
      {karten.map((k, i) => (
        <Auf als="li" key={k.schluessel} verz={(i % 3) * 90} className={`gaf-leistung${k.bild ? " mit-bild" : ""}`}>
          {k.bild && <Bild bild={k.bild} className="gaf-leistung-bild" groessen="(max-width: 760px) 92vw, 380px" />}
          <div className="gaf-leistung-kopf">
            <span className="gaf-leistung-zeichen"><Zeichen art={k.schluessel} groesse={22} /></span>
            <h3>{k.titel}</h3>
          </div>
          <p className="gaf-leistung-satz">{k.text}</p>
          <ul className="gaf-punkte">
            {k.punkte.map((p) => <li key={p}><Zeichen art="haken" groesse={14} /><span>{p}</span></li>)}
          </ul>
        </Auf>
      ))}
    </ul>
  );
}
