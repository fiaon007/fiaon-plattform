// ═══════════════════════════════════════════════════════════════════════════
// /girokonto-trotz-negativer-bonitaet · /en/current-account-despite-poor-credit
// — der Pfeiler zur Konto-Suche (30.08.2026, zweisprachig 02.09.2026)
//
// Suchintention: „konto trotz schufa“. Hier ist die Compliance DOPPELT
// streng: Das Konto entsteht beim Partner, die Eröffnung entscheidet die
// Bank — dieser Satz steht im Hero, im Weg, in der Ehrlichkeits-Sektion und
// im Abschluss, in beiden Sprachen. Texte: client/src/i18n/girokonto.ts.
// JSON-LD: Service + FAQPage.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect } from "react";
import { Dunkel, Block, Licht, Knopf, Fragen, Karten, Auf, Glas } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import KartenAufruf from "@/components/site/KartenAufruf";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { GIROKONTO_WOERTER } from "@/i18n/girokonto";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

export default function GirokontoTrotzNegativerBonitaet() {
  const t = useWoerter(GIROKONTO_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/current-account-despite-poor-credit" : "/girokonto-trotz-negativer-bonitaet";

  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Service",
      name: t.ldName,
      serviceType: t.ldArt,
      provider: { "@type": "Organization", name: "FIAON", url: "https://fiaon.com" },
      areaServed: ["DE", "AT", "CH"],
    });
    document.head.appendChild(el);
    return () => el.remove();
  }, [t]);

  return (
    <Dunkel seite="ratgeber" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten
        pfad={pfad}
        titel={t.seoTitel}
        beschreibung={t.seoBeschreibung}
        fragen={t.fragen}
        krumen={[{ name: t.krume, pfad }]}
      />

      {/* Hero mit dem Kartenbild — die Karte ist ZIEL, nie Zusage. */}
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="https://fiaon.com/mail/fiaon-karte-banner.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">{t.pille}</span>
          <h1 className="dk-h1">{t.h1a}<span className="dk-verlauf">{t.h1b}</span></h1>
          <p className="dk-lead">{t.lead}</p>
          <div className="dk-knoepfe">
            <Knopf href="/antrag">{t.antragStarten}</Knopf>
            <Knopf href={zu("/kontakt")} still>{t.kostenlosPruefen}</Knopf>
          </div>
        </div>
      </section>

      <Licht>
        <Block titel={t.warumTitel} lead={t.warumLead}>
          <Karten items={t.warum.map((k) => ({ tag: k.tag, titel: k.titel, text: k.text }))} />
        </Block>

        <Block schmal titel={t.wegTitel} lead={t.wegLead}>
          <Auf>
            <div className="sx-zeitleiste">
              {t.weg.map((e, i) => (
                <div className="sx-etappe" key={e.titel}>
                  <div className="spur"><span className="punkt">{i + 1}</span>{i < t.weg.length - 1 && <span className="faden" />}</div>
                  <div className="inhalt">
                    <span className="dauer">{e.dauer}</span>
                    <h3>{e.titel}</h3>
                    <p>{e.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </Auf>
        </Block>

        {/* Die Ehrlichkeits-Sektion — bewusst prominent. */}
        <Block schmal titel={t.nichtTitel} lead={t.nichtLead}>
          <Auf>
            <Glas ruhig>
              <ul style={{ margin: 0, padding: "0 0 0 18px", display: "grid", gap: 10, fontSize: 14.5, lineHeight: 1.65, color: "#334155" }}>
                {t.nicht.map(([fett, rest]) => (
                  <li key={fett}><b style={{ color: "#0f172a" }}>{fett}</b>{rest}</li>
                ))}
              </ul>
            </Glas>
          </Auf>
          <p className="dk-leise" style={{ marginTop: 16 }}>
            {t.nichtA}<a href={zu("/fiaon-erfahrungen")} style={{ color: "#1d4ed8" }}>{t.nichtLink}</a>{t.nichtB}
          </p>
        </Block>

        <Block schmal titel={t.basisTitel} lead={t.basisLead}>
          <div className="wz-tabelle-huelle">
            <table className="wz-tabelle">
              <thead><tr>{t.basisKopf.map((k, i) => <th scope="col" key={i}>{k || " "}</th>)}</tr></thead>
              <tbody>
                {t.basis.map((z) => <tr key={z[0]}>{z.map((c, i) => <td key={i}>{c}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
          <p className="dk-leise" style={{ marginTop: 14 }}>
            {t.basisA}<a href="/werkzeuge/karten-check" style={{ color: "#1d4ed8" }}>{t.basisLink1}</a>{t.basisB}
            <a href="/werkzeuge/selbstauskunft" style={{ color: "#1d4ed8" }}>{t.basisLink2}</a>{t.basisC}
            <a href={zu("/ratenzahlung-und-bonitaet")} style={{ color: "#1d4ed8" }}>{t.basisLink3}</a>{t.basisD}
          </p>
        </Block>

        <Block schmal titel={t.fragenTitel}>
          <Fragen items={t.fragen} />
          <p className="dk-leise" style={{ marginTop: 22 }}>
            {t.fussA}<a href={zu("/kreditkarte")} style={{ color: "#1d4ed8" }}>{t.fussLink}</a>{t.fussB}
          </p>
        </Block>
      </Licht>

      <KartenAufruf titel={t.aufrufTitel} satz={t.aufrufSatz} />
    </Dunkel>
  );
}
