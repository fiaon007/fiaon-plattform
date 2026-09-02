// ═══════════════════════════════════════════════════════════════════════════
// /inkasso-brief-erhalten — der Pfeiler für den gestressten Moment
// (30.08.2026)
//
// Suchintention: „inkasso brief was tun“. Wer das sucht, hat den Brief in der
// Hand und Puls. Deshalb ist der Ton dieser Seite RUHIG und souverän: erst
// prüfen, dann zahlen — nummerierte Schritte, klare Fristen, keine Panik und
// keine Verharmlosung. JSON-LD: HowTo + FAQPage.
// ═══════════════════════════════════════════════════════════════════════════
// 02.09.2026: zweisprachig — /inkasso-brief-erhalten und /en/debt-collection-letter;
// Texte im Wörterbuch client/src/i18n/inkasso-brief-erhalten.ts.
import { useEffect } from "react";
import { Dunkel, Block, Licht, Knopf, Fragen, Karten, Auf } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import KartenAufruf from "@/components/site/KartenAufruf";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { INKASSO_BRIEF_WOERTER } from "@/i18n/inkasso-brief-erhalten";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

export default function InkassoBriefErhalten() {
  const t = useWoerter(INKASSO_BRIEF_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/debt-collection-letter" : "/inkasso-brief-erhalten";
  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: t.howtoName,
      step: t.schritte.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.name, text: s.text })),
    });
    document.head.appendChild(el);
    return () => el.remove();
  }, [t]);

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
        <Block titel={t.planTitel} lead={t.planLead}>
          <div className="wz-fragen">
            {t.schritte.map((s, i) => (
              <Auf key={s.name} verzoegerung={i * 70}>
                <div className="wz-frage">
                  <p className="wz-nr">{t.schritt} {i + 1}</p>
                  <h3>{s.name}</h3>
                  <p className="wz-hinweis">{s.text}</p>
                </div>
              </Auf>
            ))}
          </div>
          <div className="dk-knoepfe" style={{ marginTop: 26 }}>
            <Knopf href={zu("/werkzeuge/inkassokosten")}>{t.kostenRechner}</Knopf>
            <Knopf href={zu("/werkzeuge/verjaehrung")} still>{t.verjaehrungPruefen}</Knopf>
          </div>
        </Block>

        <Block titel={t.fristenTitel} lead={t.fristenLead}>
          <Karten items={t.fristen} />
        </Block>

        <Block schmal titel={t.eintragTitel} lead={t.eintragLead}>
          <div className="wz-tabelle-huelle">
            <table className="wz-tabelle">
              <thead><tr>{t.eintragKopf.map((k) => <th key={k} scope="col">{k}</th>)}</tr></thead>
              <tbody>{t.eintragZeilen.map((z) => <tr key={z[0]}><td>{z[0]}</td><td>{z[1]}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="dk-leise" style={{ marginTop: 14 }}>
            {t.eintragA}<a href={zu("/schufa-eintrag-loeschen")} style={{ color: "#1d4ed8" }}>{t.eintragLink1}</a>{t.eintragB}<a href={zu("/eintrag-verjaehrung")} style={{ color: "#1d4ed8" }}>{t.eintragLink2}</a>{t.eintragC}
          </p>
        </Block>

        <Block schmal titel={t.fiaonTitel} lead={t.fiaonLead}>
          <div className="wz-fragen">
            {t.fiaon.map((f) => (
              <div key={f.nr} className="wz-frage">
                <p className="wz-nr">{f.nr}</p>
                <h3>{f.titel}</h3>
                <p className="wz-hinweis">{f.text}</p>
              </div>
            ))}
          </div>
        </Block>

        <Block schmal titel={t.fragenTitel}>
          <Fragen items={t.fragen} />
          <p className="dk-leise" style={{ marginTop: 22 }}>{t.fussSatz}</p>
        </Block>
      </Licht>

      <KartenAufruf titel={t.aufrufTitel} satz={t.aufrufSatz} />
    </Dunkel>
  );
}
