// ═══════════════════════════════════════════════════════════════════════════
// /bonitaetsauskunft-beantragen — der Pfeiler zum Beschaffungs-Suchwort
// (30.08.2026)
//
// Suchintention: „bonitätsauskunft beantragen / kostenlos“. Die Seite ist
// ehrlich: Der kostenlose Weg (Datenkopie nach Art. 15 DSGVO) steht ganz
// vorne — und daneben der FIAON-Weg für alle, die Beschaffung, Erklärung
// und Prüfung abgeben wollen (74 €, einmalig). Ehrlichkeit ist hier keine
// Tugend, sondern die Verkaufsstrategie: Wer den Gratisweg verschweigt,
// wirkt wie die Anbieter, vor denen wir warnen.
// JSON-LD: Service + FAQPage.
// ═══════════════════════════════════════════════════════════════════════════
// 02.09.2026: zweisprachig — /bonitaetsauskunft-beantragen und
// /en/request-your-credit-report; Texte im Wörterbuch client/src/i18n/bonitaetsauskunft-beantragen.ts.
import { useEffect } from "react";
import { Dunkel, Block, Licht, Knopf, Fragen, Auf } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import KartenAufruf from "@/components/site/KartenAufruf";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { BONITAETSAUSKUNFT_WOERTER } from "@/i18n/bonitaetsauskunft-beantragen";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

export default function BonitaetsauskunftBeantragen() {
  const t = useWoerter(BONITAETSAUSKUNFT_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/request-your-credit-report" : "/bonitaetsauskunft-beantragen";
  // Service-Markup: die Dienstleistung, wie sie sichtbar auf der Seite steht.
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
      offers: { "@type": "Offer", price: "74", priceCurrency: "EUR" },
    });
    document.head.appendChild(el);
    return () => el.remove();
  }, [t.ldName, t.ldArt]);

  return (
    <Dunkel seite="ratgeber" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten pfad={pfad} titel={t.seoTitel} beschreibung={t.seoBeschreibung} fragen={t.fragen} krumen={[{ name: t.krume, pfad }]} />

      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/akten.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
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
        <Block schmal titel={t.vergleichTitel} lead={t.vergleichLead}>
          <div className="wz-tabelle-huelle">
            <table className="wz-tabelle">
              <thead><tr>{t.kopf.map((k, i) => <th key={i} scope="col">{k || "\u00a0"}</th>)}</tr></thead>
              <tbody>{t.zeilen.map((z) => <tr key={z[0]}>{z.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <p className="dk-leise" style={{ marginTop: 14 }}>
            {t.gratisA}<a href={zu("/werkzeuge/selbstauskunft")} style={{ color: "#1d4ed8" }}>{t.gratisLink1}</a>{t.gratisB}<a href={zu("/werkzeuge/eintrag-pruefen")} style={{ color: "#1d4ed8" }}>{t.gratisLink2}</a>{t.gratisC}
          </p>
        </Block>

        <Block schmal titel={t.ablaufTitel} lead={t.ablaufLead}>
          <Auf>
            <div className="sx-zeitleiste">
              {t.ablauf.map((e, i) => (
                <div key={e.titel} className="sx-etappe">
                  <div className="spur"><span className="punkt">{i + 1}</span>{i < t.ablauf.length - 1 && <span className="faden" />}</div>
                  <div className="inhalt"><span className="dauer">{e.dauer}</span><h3>{e.titel}</h3><p>{e.text}</p></div>
                </div>
              ))}
            </div>
          </Auf>
        </Block>

        <Block schmal mitte titel={t.erhaltenTitel} lead={t.erhaltenLead}>
          <Auf>
            <div className="sx-dokument" role="img" aria-label={t.dokumentAria}>
              <div className="kopf"><b>{t.dokumentTitel}</b><span>{t.dokumentBeispiel}</span></div>
              <div className="rumpf">
                {t.dokumentZeilen.map((z) => <div key={z[0]} className="zeile"><span>{z[0]}</span><b className={z[2] || undefined}>{z[1]}</b></div>)}
              </div>
            </div>
          </Auf>
        </Block>

        <Block schmal mitte titel={t.preisTitel}>
          <Auf>
            <div className="sx-preis">
              <div className="betrag">{t.preisBetrag}<small>{t.preisEinmalig}</small></div>
              <ul className="zeilen">
                {t.preisZeilen.map((z) => (
                  <li key={z}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                    {z}
                  </li>
                ))}
              </ul>
              <div className="dk-knoepfe" style={{ justifyContent: "center", marginTop: 22 }}>
                <Knopf href="/antrag">{t.antragStarten}</Knopf>
              </div>
            </div>
          </Auf>
        </Block>

        <Block schmal titel={t.fragenTitel}>
          <Fragen items={t.fragen} />
          <p className="dk-leise" style={{ marginTop: 22 }}>
            {t.weiterlesen}
            {t.weiterLinks.map((l, i) => <span key={l.href}><a href={zu(l.href)} style={{ color: "#1d4ed8" }}>{l.t}</a>{i < t.weiterLinks.length - 1 ? " · " : ". "}</span>)}
            {t.fussSatz}
          </p>
        </Block>
      </Licht>

      <KartenAufruf titel={t.aufrufTitel} satz={t.aufrufSatz} />
    </Dunkel>
  );
}
