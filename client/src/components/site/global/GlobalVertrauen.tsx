// ═══════════════════════════════════════════════════════════════════════════
// DAS VERTRAUENS-BAND — vier Tatsachen an Haarlinien, jede mit ihrem Beleg (E-510, 13.11.2026)
//
// Justin (12.11.): „keine Magie, sondern knallharte Fakten“. Das Band zeigt nur, was der Leser selbst nachprüfen kann
// (Sprachleitfaden 6.1 bis 6.3): den Eintrag im britischen Register, die Presse-Zeile, den Vertrag vor der Unterschrift,
// die Zahlung per Rechnung. Keine Logos, keine Sterne, keine Zähler, keine Kundenstimmen.
//
// Die vier Zeilen und ihre Verweise kommen aus shared/fiaon-global-saetze.ts (vertrauensBand) — hier wird kein Wortlaut
// getippt; die Wortwand liest dieselbe Quelle. Für die Österreich-Seite gibt es dort eine eigene Fassung (land="AT").
//
// SO WIRD ES BENUTZT
//   <GlobalVertrauen sprache="de" />                       unter der Bühne, über dem Schlussband
//   <GlobalVertrauen sprache="en" land="AT" />             Österreich-Seite (land aus satzLand(pfad))
//   <GlobalVertrauen sprache="de" leitsatz />              mit dem Leitsatz als ruhiger Überschrift darüber
//   <GlobalVertrauen sprache="de" eng />                   ohne eigenen Abstand oben und unten (in einem Abschnitt)
// Die Presse-Zeile steht je Seite GENAU EINMAL — also das Band je Seite nur einmal einsetzen.
//
// Bewegung: einmal beim Hineinscrollen — die obere Linie zeichnet sich von links, die vier Tatsachen gleiten gestaffelt
// nach (data-an, bewegung.ts). Ohne JS, im Druck und bei „weniger Bewegung“ steht alles sofort.
// Stil: styles/global-vertrauen.css (Präfix gvt-), Maße aus styles/global-tokens.css.
// ═══════════════════════════════════════════════════════════════════════════
import { useRef } from "react";
import { vertrauensBand, weitererSatz, type SatzLand, type SatzSprache } from "@shared/fiaon-global-saetze";
import { useEinmalSichtbar } from "@/components/site/global/bewegung";
import "@/styles/global-tokens.css";
import "@/styles/global-vertrauen.css";

const WORT = {
  de: { name: "Nachprüfbare Angaben zu FIAON", fenster: "öffnet in einem neuen Fenster" },
  en: { name: "Verifiable facts about FIAON", fenster: "opens in a new window" },
} as const;

function Pfeil({ extern }: { extern: boolean }) {
  return (
    <svg className="gvt-pfeil" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {extern ? <path d="M7 17 17 7M9 7h8v8" /> : <path d="M5 12h14M13 6l6 6-6 6" />}
    </svg>
  );
}

export default function GlobalVertrauen({ sprache, land = "DE", leitsatz = false, eng = false, className = "" }: {
  sprache: SatzSprache;
  /** „AT“ auf der Österreich-Seite (satzLand(pfad) aus shared/fiaon-global-saetze). */
  land?: SatzLand;
  /** Den Leitsatz „Prüfen Sie uns an Fakten, nicht an Versprechen.“ als ruhige Überschrift (h2) über das Band setzen. */
  leitsatz?: boolean;
  /** Ohne eigenen Abstand oben und unten — wenn das Band in einem Abschnitt steht, der schon atmet. */
  eng?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useEinmalSichtbar(ref, 0, "0px 0px -8% 0px");
  const w = WORT[sprache];
  const zeilen = vertrauensBand(sprache, land);
  const titel = leitsatz ? weitererSatz("LEITSATZ", sprache) : null;

  return (
    <section ref={ref} className={`gvt${eng ? " eng" : ""}${className ? ` ${className}` : ""}`} aria-label={titel ? undefined : w.name} aria-labelledby={titel ? "gvt-titel" : undefined}>
      <div className="gvt-innen">
        {titel && <h2 className="gvt-titel" id="gvt-titel">{titel}</h2>}
        <ul className="gvt-liste">
          {zeilen.map((z, i) => {
            const fremd = z.extern ? { target: "_blank", rel: "noopener" } : {};
            const neuesFenster = z.extern ? <span className="gvt-sr"> ({w.fenster})</span> : null;
            return (
              <li key={z.art} data-art={z.art} style={{ ["--i" as string]: String(i) }}>
                {z.verweisText === null ? (
                  // Die ganze Zeile ist der Verweis (Presse-Zeile: genau dieser Wortlaut, als Link, ohne Logo).
                  <a className="gvt-tatsache gvt-verweis" href={z.adresse} {...fremd}>{z.text}<Pfeil extern={z.extern} />{neuesFenster}</a>
                ) : (
                  <>
                    <span className="gvt-tatsache">{z.text}</span>
                    <a className="gvt-verweis klein" href={z.adresse} {...fremd}>{z.verweisText}<Pfeil extern={z.extern} />{neuesFenster}</a>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
