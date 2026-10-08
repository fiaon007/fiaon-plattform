// ═══════════════════════════════════════════════════════════════════════════
// „WAS SIE BEKOMMEN“ (E-301) — sechs Leistungskarten aus seite.leistungen
//
// Runde 2 (Justin 08.10.2026, Punkt 5): keine Fotos mehr auf den Karten — jede
// trägt oben ihre eigene Linien-Illustration (LeistungsIllustration, 1,5 px, Gold-
// Akzent), dann Titel, Satz, Punkte. Hover: die Karte hebt sich leicht, die
// Goldlinie oben läuft über die volle Breite, die Illustration bewegt sich ruhig.
// Gestaffeltes Einblenden; bei „weniger Bewegung“ steht alles still.
// Runde 3 (Punkt 3): je Karte ein Satz und höchstens drei Punkte — der Rest (mehr)
// klappt unter „Mehr erfahren“ auf.
// ═══════════════════════════════════════════════════════════════════════════
import type { FirmaLeistung } from "@shared/fiaon-global-angebot-firma-typen";
import { Auf, Mehr, Zeichen } from "./gemeinsam";

const WORTE = { mehr: "Mehr erfahren", weniger: "Weniger" };
import LeistungsIllustration from "./LeistungsIllustration";

export default function LeistungsKarten({ karten }: { karten: FirmaLeistung[] }) {
  return (
    <ul className="gaf-leistungen" data-fiaon="firma-leistungen">
      {karten.map((k, i) => (
        <Auf als="li" key={k.schluessel} verz={(i % 3) * 90} className="gaf-leistung">
          <div className="gaf-leistung-il"><LeistungsIllustration art={k.schluessel} /></div>
          <h3 className="gaf-leistung-titel">{k.titel}</h3>
          <p className="gaf-leistung-satz">{k.text}</p>
          <ul className="gaf-punkte">
            {k.punkte.slice(0, 3).map((p) => <li key={p}><Zeichen art="haken" groesse={14} /><span>{p}</span></li>)}
          </ul>
          {[...k.punkte.slice(3), ...(k.mehr ?? [])].length > 0 && (
            <Mehr id={`gaf-leistung-${k.schluessel}-mehr`} knopf={WORTE.mehr} knopfZu={WORTE.weniger} className="gaf-mehr-klein">
              <ul className="gaf-punkte gaf-punkte-mehr">
                {[...k.punkte.slice(3), ...(k.mehr ?? [])].map((p) => <li key={p}><Zeichen art="haken" groesse={14} /><span>{p}</span></li>)}
              </ul>
            </Mehr>
          )}
        </Auf>
      ))}
    </ul>
  );
}
