// ═══════════════════════════════════════════════════════════════════════════
// DER KARTEN-AUFRUF — der Navy-Glas-Abschluss der Themenseiten (30.08.2026)
//
// Jede der SEO-/SEA-Themenseiten endet mit DIESEM Block: das Kartenbild, ein
// Satz Nutzen, der Antrag-Knopf — und der Compliance-Fußsatz, der auf jeder
// Seite stehen MUSS. Er wohnt hier, damit ihn keine Seite vergessen kann
// (AGENTS.md: eine Definition, ein Ort).
//
// Compliance: Die Karte ist ZIEL, nie Zusage — deshalb steht neben jedem
// Karten-Nutzen „die Entscheidung trifft die Bank“.
// ═══════════════════════════════════════════════════════════════════════════
// 02.09.2026: zweisprachig — Knöpfe und Compliance-Fußsatz in der Sprache der Adresse.
import { Auf } from "@/components/site/DunkleBuehne";
import { useSprache, inSprache } from "@/i18n/sprache";
import "@/styles/seo-seiten.css";

const KARTENBILD = "https://fiaon.com/mail/fiaon-karte-banner.jpg";

export default function KartenAufruf({ titel, satz }: { titel: string; satz: string }) {
  const sprache = useSprache();
  const en = sprache === "en";
  return (
    <section className="sx-aufruf">
      <div className="dk-rahmen">
        <Auf>
          <div className="sx-aufruf-glas">
            <span className="sx-aufruf-schein" aria-hidden="true" />
            <div className="sx-aufruf-text">
              <h2>{titel}</h2>
              <p>{satz}</p>
              <div className="sx-aufruf-knoepfe">
                <a className="dk-knopf" href="/antrag">
                  {en ? "Start the application" : "Jetzt Antrag starten"}
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </a>
                <a className="dk-knopf still" href={inSprache("/kontakt", sprache)}>{en ? "Have it checked for free" : "Kostenlos prüfen lassen"}</a>
              </div>
            </div>
            <div className="sx-aufruf-bild">
              <img src={KARTENBILD} alt={en ? "The FIAON card on a dark background with a blue ring of light" : "Die FIAON-Karte auf dunklem Grund mit blauem Leuchtring"} loading="lazy" decoding="async" width="520" height="320" />
            </div>
          </div>
          <p className="sx-fuss">
            {en
              ? "FIAON is not legal advice and does not promise the deletion of justified entries. The bank always decides on account, card and limit."
              : "FIAON ist keine Rechtsberatung und verspricht keine Löschung berechtigter Einträge. Über Konto, Karte und Rahmen entscheidet immer die Bank."}
          </p>
        </Auf>
      </div>
    </section>
  );
}
